import { PDFDocument } from "pdf-lib";

export async function pageCount(file: File) {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return doc.getPageCount();
}

/** Copies pages from..to (1-based, inclusive) into a new PDF and returns it base64-encoded. */
export async function extractPages(file: File, from: number, to: number) {
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const target = await PDFDocument.create();
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  for (const page of await target.copyPages(source, indices)) target.addPage(page);
  const bytes = await target.save();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binary), size: bytes.length };
}
