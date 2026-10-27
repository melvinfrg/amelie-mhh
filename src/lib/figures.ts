"use client";

import { useEffect, useState } from "react";
import { newId } from "./db";
import { hasSupabase, supabase } from "./supabase";
import type { Figure, Mask, Question } from "./types";

const BUCKET = "figures";

export const LEVELS: { value: number; label: string; tone: string }[] = [
  { value: 1, label: "Grob", tone: "border-teal-500 bg-teal-500/20" },
  { value: 2, label: "Mittel", tone: "border-amber-500 bg-amber-500/20" },
  { value: 3, label: "Fein", tone: "border-rose-500 bg-rose-500/20" },
];

/** Scales an image down and re-encodes it as JPEG, so uploads stay small. */
export async function shrink(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency; keep transparent diagrams on white instead of black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Stores an image and returns the value for Figure.image. */
export async function uploadImage(file: File): Promise<string> {
  if (!hasSupabase) {
    // Demo mode keeps everything in localStorage, which only holds a few MB.
    const canvas = await shrink(file, 1200);
    return canvas.toDataURL("image/jpeg", 0.8);
  }
  const canvas = await shrink(file, 1800);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht umgewandelt werden"))), "image/jpeg", 0.85),
  );
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) throw new Error("Bitte neu anmelden.");
  const path = `${auth.user.id}/${newId()}.jpg`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function removeImage(image: string) {
  if (!hasSupabase || image.startsWith("data:")) return;
  await supabase().storage.from(BUCKET).remove([image]);
}

const signed = new Map<string, { url: string; expires: number }>();

export async function imageUrl(image: string): Promise<string> {
  if (image.startsWith("data:") || !hasSupabase) return image;
  const cached = signed.get(image);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(image, 3600);
  if (error) throw error;
  signed.set(image, { url: data.signedUrl, expires: Date.now() + 3600_000 });
  return data.signedUrl;
}

/** Resolves Figure.image to something an <img> can show. */
export function useFigureImage(image: string | undefined) {
  const [state, setState] = useState<{ image?: string; url?: string; error?: string }>({});
  useEffect(() => {
    if (!image) return;
    let active = true;
    imageUrl(image)
      .then((url) => active && setState({ image, url }))
      .catch((e) => active && setState({ image, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      active = false;
    };
  }, [image]);
  return state.image === image ? state : {};
}

export function occlusionPrompt(title: string) {
  return `${title}: Welche Struktur ist markiert?`;
}

type QuestionApi = {
  insert: (row: Omit<Question, "id">) => Promise<Question>;
  update: (id: string, patch: Partial<Question>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/** Keeps one occlusion question per mask in step with the figure. Learning progress of unchanged masks is kept. */
export async function syncQuestions(figure: Figure, all: Question[], api: QuestionApi) {
  const existing = all.filter((q) => q.figure_id === figure.id);
  const prompt = occlusionPrompt(figure.title);
  for (const mask of figure.masks) {
    const q = existing.find((e) => e.mask_id === mask.id);
    if (!q) {
      await api.insert({
        topic_id: figure.topic_id,
        type: "occlusion",
        prompt,
        options: [],
        answer: mask.label,
        explanation: null,
        image_url: null,
        video_url: null,
        source: null,
        suspended: false,
        card: null,
        due: null,
        figure_id: figure.id,
        mask_id: mask.id,
        level: mask.level,
      });
    } else if (q.answer !== mask.label || q.level !== mask.level || q.prompt !== prompt || q.topic_id !== figure.topic_id) {
      await api.update(q.id, { answer: mask.label, level: mask.level, prompt, topic_id: figure.topic_id });
    }
  }
  const kept = new Set(figure.masks.map((m) => m.id));
  for (const q of existing) if (!kept.has(q.mask_id ?? "")) await api.remove(q.id);
}

export function emptyMask(x: number, y: number, level: number): Mask {
  return { id: newId(), x, y, w: 0, h: 0, label: "", level };
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Compares a typed answer with the label, forgiving case, punctuation and small typos. */
export function checkAnswer(input: string, label: string): "right" | "close" | "wrong" {
  const a = normalize(input);
  const b = normalize(label);
  if (!a) return "wrong";
  if (a === b) return "right";
  const d = distance(a, b);
  if (d <= Math.max(1, Math.floor(b.length * 0.15))) return "right";
  if (d <= Math.floor(b.length * 0.35)) return "close";
  return "wrong";
}
