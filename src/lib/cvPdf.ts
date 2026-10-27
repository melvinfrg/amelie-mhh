import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { ACCENTS, contactLines, descriptionLines, period, today, type CvData } from "./cv";
import type { CvEntry } from "./types";

/** Lebenslauf als PDF, in drei Stilen, mit den Standardschriften (kein Download von Schriftdateien). */

const A4 = { w: 595.28, h: 841.89 };
const GREY = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.12, 0.12, 0.14);
const WHITE = rgb(1, 1, 1);

function color(hex: string, tintBy = 0): RGB {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v + (1 - v) * tintBy);
  return rgb(c[0], c[1], c[2]);
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/** The standard fonts only know Western European characters; anything else (emoji …) is dropped. */
function clean(font: PDFFont, text: string) {
  let out = "";
  for (const ch of text.replace(/\t/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      // not in WinAnsi
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  for (const para of clean(font, text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Writes top to bottom over as many pages as needed. */
class Writer {
  page!: PDFPage;
  y = 0;
  pages = 0;
  constructor(
    private doc: PDFDocument,
    public f: Fonts,
    private margin: { top: number; bottom: number },
    private onNewPage: (w: Writer, first: boolean) => void,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - this.margin.top;
    this.onNewPage(this, this.pages === 0);
    this.pages++;
  }
  ensure(height: number) {
    if (this.y - height < this.margin.bottom) this.newPage();
  }
  text(text: string, x: number, size: number, font: PDFFont, c: RGB = INK) {
    this.page.drawText(clean(font, text), { x, y: this.y - size, size, font, color: c });
  }
  /** Wrapped paragraph; returns nothing, moves y down. */
  para(text: string, x: number, width: number, size: number, font: PDFFont, c: RGB = INK, gap = 2) {
    for (const line of wrap(font, text, size, width)) {
      this.ensure(size + gap);
      this.text(line, x, size, font, c);
      this.y -= size + gap;
    }
  }
}

function entryHeight(w: Writer, e: CvEntry, width: number, size: number) {
  let h = size + 4;
  if (e.organization || e.location) h += size + 2;
  for (const l of descriptionLines(e.description)) h += wrap(w.f.regular, l.text, size - 0.5, width - (l.bullet ? 10 : 0)).length * (size + 1.5);
  return h + 8;
}

/** Title, organisation and description of one entry at x. */
function entryBody(w: Writer, e: CvEntry, x: number, width: number, size: number) {
  w.para(e.title, x, width, size + 1, w.f.bold, INK, 2);
  const where = [e.organization, e.location].filter(Boolean).join(", ");
  if (where) w.para(where, x, width, size - 0.5, w.f.italic, GREY, 2);
  w.y -= 1;
  for (const l of descriptionLines(e.description)) {
    if (l.bullet) {
      w.ensure(size + 2);
      w.text("•", x + 1, size - 0.5, w.f.regular, GREY);
      w.para(l.text, x + 10, width - 10, size - 0.5, w.f.regular, INK, 1.5);
    } else w.para(l.text, x, width, size - 0.5, w.f.regular, INK, 1.5);
  }
  w.y -= 8;
}

function sectionHeading(w: Writer, label: string, x: number, width: number, size: number, accent: RGB) {
  w.ensure(size + 40);
  w.y -= 8;
  w.text(label.toUpperCase(), x, size, w.f.bold, accent);
  w.y -= size + 4;
  w.page.drawLine({ start: { x, y: w.y }, end: { x: x + width, y: w.y }, thickness: 0.8, color: accent });
  w.y -= 9;
}

function skillDots(w: Writer, level: number, x: number, accent: RGB, size: number) {
  for (let i = 0; i < 5; i++)
    w.page.drawCircle({ x: x + i * (size + 1.5), y: w.y - size / 2 - 1, size: size / 2 - 0.5, color: i < level ? accent : color("E5E7EB") });
}

async function classic(data: CvData, compact: boolean) {
  const doc = await PDFDocument.create();
  const f = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const accent = color(ACCENTS[data.options.accent].hex);
  const m = compact ? 40 : 56;
  const width = A4.w - 2 * m;
  const size = compact ? 8.5 : 10;
  const dateCol = compact ? 95 : 115;
  const w = new Writer(doc, f, { top: m, bottom: m }, () => {});
  const p = data.profile;

  w.text(p.name || "Lebenslauf", m, compact ? 20 : 26, f.bold, accent);
  w.y -= (compact ? 20 : 26) + 6;
  if (p.headline) w.para(p.headline, m, width, size + 2, f.regular, GREY);
  const contact = contactLines(p);
  if (contact.length) {
    w.y -= 2;
    w.para(contact.join("   ·   "), m, width, size - 1, f.regular, GREY);
  }
  if (p.summary?.trim()) {
    sectionHeading(w, "Profil", m, width, size + 1, accent);
    w.para(p.summary, m, width, size, f.regular);
  }
  for (const g of data.groups) {
    sectionHeading(w, g.label, m, width, size + 1, accent);
    for (const e of g.entries) {
      w.ensure(Math.min(entryHeight(w, e, width - dateCol, size), 120));
      const top = w.y;
      w.text(period(e), m, size - 0.5, f.regular, GREY);
      w.y = top;
      entryBody(w, e, m + dateCol, width - dateCol, size);
    }
  }
  if (p.skills.length) {
    sectionHeading(w, "Kenntnisse", m, width, size + 1, accent);
    const colW = width / 2;
    p.skills.forEach((s, i) => {
      const x = m + (i % 2) * colW;
      if (i % 2 === 0) w.ensure(size + 6);
      w.text(s.name, x, size, f.regular);
      skillDots(w, s.level, x + colW - 70, accent, size - 1);
      if (i % 2 === 1 || i === p.skills.length - 1) w.y -= size + 5;
    });
  }
  if (p.languages.length) {
    sectionHeading(w, "Sprachen", m, width, size + 1, accent);
    w.para(p.languages.map((l) => `${l.name} (${l.level})`).join("   ·   "), m, width, size, f.regular);
  }
  if (p.interests?.trim()) {
    sectionHeading(w, "Interessen", m, width, size + 1, accent);
    w.para(p.interests, m, width, size, f.regular);
  }
  if (!compact) {
    w.ensure(62);
    w.y -= 20;
    w.text(`${data.options.place ? `${data.options.place}, ` : ""}${today()}`, m, size, f.regular);
    w.y -= 30;
    w.page.drawLine({ start: { x: m, y: w.y }, end: { x: m + 170, y: w.y }, thickness: 0.6, color: GREY });
    w.y -= 4;
    w.text(p.name, m, size - 1, f.regular, GREY);
  }
  return doc.save();
}

async function modern(data: CvData) {
  const doc = await PDFDocument.create();
  const f = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const hex = ACCENTS[data.options.accent].hex;
  const accent = color(hex);
  const light = color(hex, 0.9);
  const p = data.profile;
  const side = 180;
  const header = 96;
  const pad = 22;
  const size = 9.5;
  const mainX = side + 28;
  const mainW = A4.w - mainX - 36;

  const w = new Writer(doc, f, { top: header + 26, bottom: 44 }, (w, first) => {
    w.page.drawRectangle({ x: 0, y: 0, width: side, height: A4.h, color: light });
    if (first) {
      w.page.drawRectangle({ x: 0, y: A4.h - header, width: A4.w, height: header, color: accent });
      w.page.drawText(clean(f.bold, p.name || "Lebenslauf"), { x: pad, y: A4.h - 50, size: 26, font: f.bold, color: WHITE });
      if (p.headline) w.page.drawText(clean(f.regular, p.headline), { x: pad, y: A4.h - 74, size: 12, font: f.regular, color: WHITE });
    } else w.y = A4.h - 44;
  });

  // Sidebar on the first page, written with its own cursor.
  const sideW = side - 2 * pad;
  const sideTop = w.y;
  const sideHead = (label: string) => {
    w.y -= 8;
    w.text(label.toUpperCase(), pad, 9, f.bold, accent);
    w.y -= 15;
  };
  const contact = contactLines(p);
  if (contact.length) {
    sideHead("Kontakt");
    for (const c of contact) {
      w.para(c, pad, sideW, 8.5, f.regular, INK, 2.5);
      w.y -= 2;
    }
  }
  if (p.skills.length) {
    sideHead("Kenntnisse");
    for (const s of p.skills) {
      w.para(s.name, pad, sideW, 8.5, f.regular);
      w.page.drawRectangle({ x: pad, y: w.y - 2, width: sideW, height: 3.5, color: color("FFFFFF") });
      w.page.drawRectangle({ x: pad, y: w.y - 2, width: (sideW * Math.max(0, Math.min(5, s.level))) / 5, height: 3.5, color: accent });
      w.y -= 10;
    }
  }
  if (p.languages.length) {
    sideHead("Sprachen");
    for (const l of p.languages) {
      w.para(l.name, pad, sideW, 8.5, f.bold);
      w.para(l.level, pad, sideW, 8.5, f.regular, GREY);
      w.y -= 3;
    }
  }
  if (p.interests?.trim()) {
    sideHead("Interessen");
    w.para(p.interests, pad, sideW, 8.5, f.regular);
  }
  const firstPage = w.page;

  // Main column.
  w.page = firstPage;
  w.y = sideTop;
  if (p.summary?.trim()) {
    sectionHeading(w, "Profil", mainX, mainW, 10.5, accent);
    w.para(p.summary, mainX, mainW, size, f.regular);
  }
  for (const g of data.groups) {
    sectionHeading(w, g.label, mainX, mainW, 10.5, accent);
    for (const e of g.entries) {
      w.ensure(Math.min(entryHeight(w, e, mainW - 14, size) + 14, 130));
      const top = w.y;
      w.page.drawCircle({ x: mainX + 3, y: top - 4.5, size: 3, color: accent });
      w.text(period(e), mainX + 14, size - 1, f.bold, accent);
      w.y -= size + 3;
      entryBody(w, e, mainX + 14, mainW - 14, size);
      w.page.drawLine({ start: { x: mainX + 3, y: top - 9 }, end: { x: mainX + 3, y: w.y + 6 }, thickness: 0.8, color: color(hex, 0.6) });
    }
  }
  w.ensure(70);
  w.y -= 24;
  w.text(`${data.options.place ? `${data.options.place}, ` : ""}${today()}`, mainX, size, f.regular);
  w.y -= 34;
  w.page.drawLine({ start: { x: mainX, y: w.y }, end: { x: mainX + 170, y: w.y }, thickness: 0.6, color: GREY });
  w.y -= 4;
  w.text(p.name, mainX, size - 1, f.regular, GREY);
  return doc.save();
}

export async function cvPdf(data: CvData): Promise<Blob> {
  const bytes = data.options.style === "modern" ? await modern(data) : await classic(data, data.options.style === "kompakt");
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
