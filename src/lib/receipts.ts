"use client";

import { zipSync } from "fflate";
import { newId } from "./db";
import { shrink } from "./figures";
import { hasSupabase, supabase } from "./supabase";
import type { Expense } from "./types";

const BUCKET = "receipts";

/** Common tax-relevant costs of a first degree; free text is allowed too. */
export const CATEGORIES = [
  "Semesterbeitrag",
  "Fachliteratur",
  "Arbeitsmittel",
  "Laptop & Technik",
  "Kopien & Druck",
  "Fahrtkosten",
  "Kurse & Prüfungen",
  "Sonstiges",
];

export const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Accepts "12,50", "12.50" and "1.234,50". */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export async function uploadReceipt(file: File): Promise<{ receipt: string; receipt_name: string }> {
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) throw new Error("Bitte ein Foto oder eine PDF wählen.");
  if (!hasSupabase) {
    // Demo mode keeps everything in localStorage, which only holds a few MB.
    if (isPdf && file.size > 1_500_000) throw new Error("Im Demo-Modus gehen nur PDFs bis 1,5 MB.");
    const receipt = isPdf ? await dataUrl(file) : (await shrink(file, 1400)).toDataURL("image/jpeg", 0.8);
    return { receipt, receipt_name: file.name };
  }
  if (file.size > 10_485_760) throw new Error("Die Datei ist größer als 10 MB.");
  const body = isPdf ? file : await toJpeg(await shrink(file, 2400));
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) throw new Error("Bitte neu anmelden.");
  const path = `${auth.user.id}/${newId()}.${isPdf ? "pdf" : "jpg"}`;
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
  if (error) throw error;
  return { receipt: path, receipt_name: file.name };
}

function toJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht umgewandelt werden"))), "image/jpeg", 0.85),
  );
}

function dataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function removeReceipt(receipt: string | null) {
  if (!receipt || !hasSupabase || receipt.startsWith("data:")) return;
  await supabase().storage.from(BUCKET).remove([receipt]);
}

export async function receiptUrl(receipt: string): Promise<string> {
  if (receipt.startsWith("data:") || !hasSupabase) return receipt;
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(receipt, 600);
  if (error) throw error;
  return data.signedUrl;
}

async function receiptBytes(receipt: string): Promise<{ bytes: Uint8Array; ext: string }> {
  const res = await fetch(await receiptUrl(receipt));
  if (!res.ok) throw new Error(`Beleg konnte nicht geladen werden (${res.status})`);
  const blob = await res.blob();
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === "application/pdf" ? "pdf" : "jpg" };
}

function fileSafe(s: string) {
  return s.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "_").slice(0, 40) || "Beleg";
}

function csvCell(v: string) {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Semicolons and decimal commas so Excel and Numbers in German open it directly. */
export function expensesCsv(rows: Expense[], files: Map<string, string> = new Map()) {
  const lines = [["Datum", "Beschreibung", "Kategorie", "Betrag (EUR)", "Notiz", "Beleg"].join(";")];
  for (const e of rows) {
    const [y, m, d] = e.date.split("-");
    lines.push(
      [
        `${d}.${m}.${y}`,
        e.title,
        e.category,
        Number(e.amount).toFixed(2).replace(".", ","),
        e.note ?? "",
        files.get(e.id) ?? (e.receipt ? "ja" : ""),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  // The BOM tells Excel the file is UTF-8, otherwise umlauts break.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** One ZIP with the list as CSV and every receipt named by date and title. */
export async function expensesZip(rows: Expense[], onProgress?: (done: number, total: number) => void) {
  const withReceipt = rows.filter((e) => e.receipt);
  const entries: Record<string, Uint8Array> = {};
  const names = new Map<string, string>();
  const used = new Set<string>();
  let done = 0;
  for (const e of withReceipt) {
    const { bytes, ext } = await receiptBytes(e.receipt!);
    let name = `Belege/${e.date}_${fileSafe(e.title)}.${ext}`;
    for (let i = 2; used.has(name); i++) name = `Belege/${e.date}_${fileSafe(e.title)}_${i}.${ext}`;
    used.add(name);
    entries[name] = bytes;
    names.set(e.id, name);
    onProgress?.(++done, withReceipt.length);
  }
  entries["Kosten.csv"] = new TextEncoder().encode(expensesCsv(rows, names));
  return zipSync(entries, { level: 0 });
}
