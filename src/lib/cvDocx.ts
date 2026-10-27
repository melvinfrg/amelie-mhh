import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableCellBorders,
} from "docx";
import { ACCENTS, contactLines, descriptionLines, period, today, type CvData } from "./cv";
import type { CvEntry, CvProfile } from "./types";

/** Lebenslauf als Word-Datei, in drei Stilen. Loaded only when someone exports. */

const NONE = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
const NO_BORDERS: ITableCellBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const TABLE_NO_BORDERS = { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE };
const GREY = "6B7280";
// A4 width minus margins of 2 cm, in twips.
const WIDTH = 11906 - 2 * 1134;

/** The accent mixed with white, e.g. for a sidebar. */
function tint(hex: string, amount: number) {
  return [0, 2, 4]
    .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * amount))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function heading(text: string, accent: string, size: number) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { color: accent, space: 2, style: BorderStyle.SINGLE, size: 8 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: accent, size, characterSpacing: 20 })],
  });
}

function entryContent(e: CvEntry, size: number, withDescription: boolean) {
  const out = [
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: e.title, bold: true, size: size + 2 })] }),
  ];
  const where = [e.organization, e.location].filter(Boolean).join(", ");
  if (where) out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: where, italics: true, color: GREY, size })] }));
  if (withDescription)
    for (const l of descriptionLines(e.description))
      out.push(
        new Paragraph({
          spacing: { after: 20 },
          ...(l.bullet ? { bullet: { level: 0 } } : {}),
          children: [new TextRun({ text: l.text, size })],
        }),
      );
  return out;
}

/** Date on the left, the entry on the right, without visible lines. */
function entryTable(entries: CvEntry[], width: number, size: number, withDescription: boolean) {
  const left = Math.round(width * 0.24);
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [left, width - left],
    borders: TABLE_NO_BORDERS,
    rows: entries.map(
      (e) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: NO_BORDERS,
              width: { size: left, type: WidthType.DXA },
              margins: { bottom: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: period(e), color: GREY, size })] })],
            }),
            new TableCell({
              borders: NO_BORDERS,
              width: { size: width - left, type: WidthType.DXA },
              margins: { bottom: 140 },
              children: entryContent(e, size, withDescription),
            }),
          ],
        }),
    ),
  });
}

function dots(level: number) {
  return "●".repeat(Math.max(0, Math.min(5, level))) + "○".repeat(5 - Math.max(0, Math.min(5, level)));
}

function extras(p: CvProfile, accent: string, size: number, headSize: number) {
  const out: (Paragraph | Table)[] = [];
  if (p.skills.length) {
    out.push(heading("Kenntnisse", accent, headSize));
    for (const s of p.skills)
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          tabStops: [{ type: "right", position: WIDTH }],
          children: [new TextRun({ text: s.name, size }), new TextRun({ text: `\t${dots(s.level)}`, color: accent, size })],
        }),
      );
  }
  if (p.languages.length) {
    out.push(heading("Sprachen", accent, headSize));
    for (const l of p.languages)
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: `${l.name}: `, bold: true, size }), new TextRun({ text: l.level, size })],
        }),
      );
  }
  if (p.interests?.trim()) {
    out.push(heading("Interessen", accent, headSize));
    out.push(new Paragraph({ children: [new TextRun({ text: p.interests, size })] }));
  }
  return out;
}

function signature(data: CvData, size: number) {
  return [
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: `${data.options.place ? `${data.options.place}, ` : ""}${today()}`, size })] }),
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: "______________________________", color: GREY, size })] }),
    new Paragraph({ children: [new TextRun({ text: data.profile.name, size })] }),
  ];
}

function classic(data: CvData, compact: boolean) {
  const { profile: p } = data;
  const accent = ACCENTS[data.options.accent].hex;
  const size = compact ? 18 : 21;
  const headSize = compact ? 20 : 24;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: p.name || "Lebenslauf", bold: true, size: compact ? 40 : 52, color: accent })] }),
  ];
  if (p.headline) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: p.headline, size: size + 4, color: GREY })] }));
  const contact = contactLines(p);
  if (contact.length) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: contact.join("  ·  "), size: size - 2, color: GREY })] }));
  if (p.summary?.trim()) {
    children.push(heading("Profil", accent, headSize));
    children.push(new Paragraph({ children: [new TextRun({ text: p.summary, size })] }));
  }
  for (const g of data.groups) {
    children.push(heading(g.label, accent, headSize));
    children.push(entryTable(g.entries, WIDTH, size, true));
  }
  children.push(...extras(p, accent, size, headSize));
  if (!compact) children.push(...signature(data, size));
  return children;
}

function modern(data: CvData) {
  const { profile: p } = data;
  const accent = ACCENTS[data.options.accent].hex;
  const light = tint(accent, 0.9);
  const size = 20;
  const side = Math.round(WIDTH * 0.32);
  const main = WIDTH - side;
  const white = (text: string, opts: { bold?: boolean; size?: number } = {}) => new TextRun({ text, color: "FFFFFF", size: opts.size ?? size, bold: opts.bold });

  const header = new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [WIDTH],
    borders: TABLE_NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            shading: { type: ShadingType.CLEAR, fill: accent, color: "auto" },
            margins: { top: 300, bottom: 300, left: 300, right: 300 },
            children: [
              new Paragraph({ children: [white(p.name || "Lebenslauf", { bold: true, size: 48 })] }),
              ...(p.headline ? [new Paragraph({ children: [white(p.headline, { size: 24 })] })] : []),
            ],
          }),
        ],
      }),
    ],
  });

  const sideHeading = (text: string) =>
    new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: text.toUpperCase(), bold: true, color: accent, size: 20 })] });
  const sideChildren: Paragraph[] = [];
  const contact = contactLines(p);
  if (contact.length) {
    sideChildren.push(sideHeading("Kontakt"));
    for (const c of contact) sideChildren.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: c, size: 18 })] }));
  }
  if (p.skills.length) {
    sideChildren.push(sideHeading("Kenntnisse"));
    for (const s of p.skills) {
      sideChildren.push(new Paragraph({ children: [new TextRun({ text: s.name, size: 18 })] }));
      sideChildren.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: dots(s.level), color: accent, size: 18 })] }));
    }
  }
  if (p.languages.length) {
    sideChildren.push(sideHeading("Sprachen"));
    for (const l of p.languages)
      sideChildren.push(
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${l.name}`, bold: true, size: 18 }), new TextRun({ text: ` – ${l.level}`, size: 18 })] }),
      );
  }
  if (p.interests?.trim()) {
    sideChildren.push(sideHeading("Interessen"));
    sideChildren.push(new Paragraph({ children: [new TextRun({ text: p.interests, size: 18 })] }));
  }
  if (sideChildren.length === 0) sideChildren.push(new Paragraph(""));

  const mainChildren: (Paragraph | Table)[] = [];
  if (p.summary?.trim()) {
    mainChildren.push(heading("Profil", accent, 22));
    mainChildren.push(new Paragraph({ children: [new TextRun({ text: p.summary, size })] }));
  }
  for (const g of data.groups) {
    mainChildren.push(heading(g.label, accent, 22));
    for (const e of g.entries) {
      mainChildren.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: period(e), bold: true, color: accent, size: 18 })] }));
      mainChildren.push(...entryContent(e, size, true));
    }
  }
  mainChildren.push(...signature(data, size));

  const body = new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [side, main],
    borders: TABLE_NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            width: { size: side, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: light, color: "auto" },
            margins: { top: 120, bottom: 200, left: 240, right: 240 },
            verticalAlign: VerticalAlign.TOP,
            children: sideChildren,
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: main, type: WidthType.DXA },
            margins: { top: 0, left: 360, right: 120 },
            children: mainChildren,
          }),
        ],
      }),
    ],
  });
  return [header, new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.LEFT, children: [] }), body];
}

export async function cvDocx(data: CvData): Promise<Blob> {
  const children = data.options.style === "modern" ? modern(data) : classic(data, data.options.style === "kompakt");
  const margin = data.options.style === "kompakt" ? 850 : 1134;
  const doc = new Document({
    creator: data.profile.name || "Lebenslauf",
    title: `Lebenslauf ${data.profile.name}`.trim(),
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }],
  });
  return Packer.toBlob(doc);
}
