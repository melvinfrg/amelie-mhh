"use client";

import { newId } from "./db";
import type { Mask } from "./types";

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface FoundWord {
  text: string;
  bbox: Box;
}

/** Trims list numbers, leader lines and stray punctuation that OCR picks up around a label. */
function clean(text: string) {
  return text
    .replace(/^[\s\d.)\-–—_:|•·*]+/, "")
    .replace(/[\s\-–—_:|•·*,;]+$/, "")
    .trim();
}

/**
 * Words on one OCR line can belong to different labels (left and right of a figure),
 * so a line is cut wherever the gap between two words is much wider than the text is tall.
 */
function splitLine(words: FoundWord[]): FoundWord[][] {
  const groups: FoundWord[][] = [];
  for (const w of [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    const height = w.bbox.y1 - w.bbox.y0;
    if (group && last && w.bbox.x0 - last.bbox.x1 < height * 1.5) group.push(w);
    else groups.push([w]);
  }
  return groups;
}

function overlap(a: Pick<Mask, "x" | "y" | "w" | "h">, b: Pick<Mask, "x" | "y" | "w" | "h">) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0;
}

/**
 * Finds printed labels on a figure with Tesseract, which runs in the browser at no cost.
 * Returns one mask per label; areas already covered by an existing mask are skipped.
 */
export async function detectLabels(src: string, existing: Mask[], level: number, onProgress: (share: number) => void): Promise<Mask[]> {
  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["deu", "lat"], 1, {
    // Served from public/tesseract (see scripts/copy-assets.mjs).
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    logger: (m) => m.status === "recognizing text" && onProgress(m.progress),
  });
  try {
    // Sparse text: labels are scattered around the picture rather than in paragraphs.
    await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
    const { data } = await worker.recognize(blob, {}, { blocks: true });
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    const found: Mask[] = [];
    for (const line of lines) {
      // Single letters stay in ("M. deltoideus", "N. ulnaris"), but a label needs at least one real word.
      const words = line.words.filter((w) => w.confidence >= 45 && /[a-zA-ZäöüÄÖÜß]/.test(w.text));
      for (const group of splitLine(words)) {
        if (!group.some((w) => /[a-zA-ZäöüÄÖÜß]{2}/.test(w.text))) continue;
        const label = clean(group.map((w) => w.text).join(" "));
        if (label.length < 3) continue;
        const pad = 3;
        const x0 = Math.max(0, Math.min(...group.map((w) => w.bbox.x0)) - pad);
        const y0 = Math.max(0, Math.min(...group.map((w) => w.bbox.y0)) - pad);
        const x1 = Math.min(width, Math.max(...group.map((w) => w.bbox.x1)) + pad);
        const y1 = Math.min(height, Math.max(...group.map((w) => w.bbox.y1)) + pad);
        const mask: Mask = { id: newId(), x: x0 / width, y: y0 / height, w: (x1 - x0) / width, h: (y1 - y0) / height, label, level };
        if ([...existing, ...found].some((m) => overlap(m, mask) > 0.5)) continue;
        found.push(mask);
      }
    }
    return found;
  } finally {
    await worker.terminate();
  }
}
