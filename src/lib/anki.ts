"use client";

import { unzipSync } from "fflate";
import { db } from "./db";
import { uploadImage } from "./figures";
import type { ID, McOption, Question, Subject, Topic } from "./types";
import { insertRows } from "./useTable";

/** One question as it will be imported; `key` is stable across re-imports of the same deck. */
export interface AnkiCard {
  key: string;
  deck: string[];
  prompt: string;
  answer: string;
  explanation: string | null;
  image: string | null;
}

export interface AnkiPackage {
  cards: AnkiCard[];
  skipped: { empty: number; occlusion: number };
  /** Reads one media file (by its name in the deck) out of the package. */
  media: (name: string) => Uint8Array | null;
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstd(b: Uint8Array) {
  return ZSTD_MAGIC.every((v, i) => b[i] === v);
}

async function unzstd(b: Uint8Array) {
  if (!isZstd(b)) return b;
  const { decompress } = await import("fzstd");
  return decompress(b);
}

function varint(buf: Uint8Array, pos: number): [number, number] {
  let value = 0;
  let scale = 1;
  for (;;) {
    const byte = buf[pos++];
    value += (byte & 0x7f) * scale;
    if (byte < 0x80) return [value, pos];
    scale *= 128;
  }
}

/** Walks the top-level fields of a protobuf message. */
function* protoFields(buf: Uint8Array): Generator<{ field: number; value: number | Uint8Array }> {
  let pos = 0;
  while (pos < buf.length) {
    const [tag, next] = varint(buf, pos);
    pos = next;
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (wire === 0) {
      const [value, after] = varint(buf, pos);
      pos = after;
      yield { field, value };
    } else if (wire === 2) {
      const [length, after] = varint(buf, pos);
      yield { field, value: buf.subarray(after, after + length) };
      pos = after + length;
    } else if (wire === 1) pos += 8;
    else if (wire === 5) pos += 4;
    else throw new Error("Unbekanntes Medienverzeichnis");
  }
}

/** Maps media names to the numbered files inside the zip. */
async function mediaIndex(raw: Uint8Array | undefined): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  if (!raw || raw.length === 0) return index;
  if (isZstd(raw)) {
    // Newer packages: MediaEntries { repeated MediaEntry entries = 1 } with name = 1, legacy_zip_filename = 255.
    let i = 0;
    for (const { field, value } of protoFields(await unzstd(raw))) {
      if (field !== 1 || typeof value === "number") continue;
      let name = "";
      let zipName = String(i);
      for (const f of protoFields(value)) {
        if (f.field === 1 && typeof f.value !== "number") name = new TextDecoder().decode(f.value);
        if (f.field === 255 && typeof f.value === "number") zipName = String(f.value);
      }
      index.set(name, zipName);
      i++;
    }
  } else {
    const json = JSON.parse(new TextDecoder().decode(raw)) as Record<string, string>;
    for (const [zipName, name] of Object.entries(json)) index.set(name, zipName);
  }
  return index;
}

const CLOZE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Anki fields are HTML; questions here are plain text with line breaks. */
export function htmlToText(html: string) {
  const prepared = html
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h\d|tr)>/gi, "\n")
    .replace(/<(div|p|h\d|tr)(\s[^>]*)?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<img[^>]*>/gi, "");
  const text = new DOMParser().parseFromString(`<body>${prepared}</body>`, "text/html").body.textContent ?? "";
  return text
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstImage(html: string) {
  const src = html.match(/<img[^>]+src=["']?([^"'>\s]+)/i)?.[1];
  if (!src) return null;
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}

function clozeCards(text: string): { n: number; prompt: string; answer: string }[] {
  const numbers = [...new Set([...text.matchAll(CLOZE)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  return numbers.map((n) => {
    const answers: string[] = [];
    const prompt = text.replace(CLOZE, (_, num: string, content: string, hint?: string) => {
      if (Number(num) !== n) return content;
      answers.push(htmlToText(content));
      return hint ? `[${hint}]` : "[…]";
    });
    return { n, prompt: htmlToText(prompt), answer: answers.join(" / ") };
  });
}

type Row = Record<string, unknown>;

function rows(db: import("sql.js").Database, sql: string): Row[] {
  const [result] = db.exec(sql);
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i]])));
}

function hasTable(db: import("sql.js").Database, name: string) {
  return rows(db, `select name from sqlite_master where type = 'table' and name = '${name}'`).length > 0;
}

/** Reads an Anki package (.apkg/.colpkg), old or new format, entirely in the browser. */
export async function readApkg(file: File): Promise<AnkiPackage> {
  const zip = new Uint8Array(await file.arrayBuffer());
  const wanted = new Set(["collection.anki21b", "collection.anki21", "collection.anki2", "media"]);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, { filter: (f) => wanted.has(f.name) });
  } catch {
    throw new Error("Das ist keine Anki-Datei (.apkg).");
  }
  // Newer exports also contain a stub collection.anki2 that only says "please update", so prefer the newest.
  const raw = entries["collection.anki21b"] ?? entries["collection.anki21"] ?? entries["collection.anki2"];
  if (!raw) throw new Error("In der Datei ist keine Anki-Sammlung.");
  const media = await mediaIndex(entries["media"]);

  const initSqlJs = (await import("sql.js")).default;
  // Served from public/sqljs (see scripts/copy-assets.mjs).
  const SQL = await initSqlJs({ locateFile: () => "/sqljs/sql-wasm-browser.wasm" });
  const db = new SQL.Database(await unzstd(raw));
  try {
    const deckNames = new Map<string, string[]>();
    if (hasTable(db, "decks")) {
      for (const d of rows(db, "select id, name from decks")) deckNames.set(String(d.id), String(d.name).split("\x1f"));
    } else {
      const [col] = rows(db, "select decks from col");
      for (const d of Object.values(JSON.parse(String(col.decks)) as Record<string, { id: number; name: string }>)) {
        deckNames.set(String(d.id), d.name.split("::"));
      }
    }

    const noteDeck = new Map<string, string[]>();
    for (const c of rows(db, "select nid, did from cards order by ord")) {
      if (!noteDeck.has(String(c.nid))) noteDeck.set(String(c.nid), deckNames.get(String(c.did)) ?? []);
    }

    const cards: AnkiCard[] = [];
    const skipped = { empty: 0, occlusion: 0 };
    for (const note of rows(db, "select id, guid, flds from notes order by id")) {
      const fields = String(note.flds).split("\x1f");
      const deck = (noteDeck.get(String(note.id)) ?? []).filter((d, i) => !(i === 0 && /^(Default|Standard)$/.test(d)));
      const clozeField = fields.findIndex((f) => /\{\{c\d+::/.test(f));
      if (fields.some((f) => f.includes("image-occlusion:"))) {
        skipped.occlusion++;
        continue;
      }
      if (clozeField >= 0) {
        const extra = htmlToText(fields.filter((_, i) => i !== clozeField).join("\n")) || null;
        const image = firstImage(fields.join(" "));
        for (const c of clozeCards(fields[clozeField])) {
          cards.push({ key: `anki:${note.guid}:${c.n}`, deck, prompt: c.prompt, answer: c.answer, explanation: extra, image });
        }
        continue;
      }
      const prompt = htmlToText(fields[0] ?? "");
      const answer = htmlToText(fields[1] ?? "");
      if (!prompt || !answer) {
        skipped.empty++;
        continue;
      }
      cards.push({
        key: `anki:${note.guid}:0`,
        deck,
        prompt,
        answer,
        explanation: htmlToText(fields.slice(2).join("\n")) || null,
        image: firstImage(fields.join(" ")),
      });
    }

    const readMedia = (name: string) => {
      const zipName = media.get(name);
      if (!zipName) return null;
      const found = unzipSync(zip, { filter: (f) => f.name === zipName })[zipName];
      return found ?? null;
    };
    return { cards, skipped, media: readMedia };
  } finally {
    db.close();
  }
}

/** Media files in new packages are zstd-compressed one by one. */
export async function mediaFile(pkg: AnkiPackage, name: string): Promise<File | null> {
  const raw = pkg.media(name);
  if (!raw) return null;
  const bytes = await unzstd(raw);
  const ext = name.split(".").pop()?.toLowerCase();
  const type = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/jpeg";
  return new File([bytes as BlobPart], name, { type });
}

export interface ImportOptions {
  subjectId: ID;
  /** Drop the first deck level when it is just the subject's name, e.g. "Anatomie::Schulter" into Anatomie. */
  subjectName: string;
  images: boolean;
  onProgress?: (text: string) => void;
}

/** Files the cards under the subject, one topic per deck level, and skips cards imported before. */
export async function importCards(pkg: AnkiPackage, cards: AnkiCard[], options: ImportOptions) {
  const [topics, questions] = await Promise.all([db.list("topics"), db.list("questions")]);
  const known = new Set(questions.map((q) => q.source).filter(Boolean));
  const fresh = cards.filter((c) => !known.has(c.key));

  const topicIds = new Map<string, ID>();
  for (const t of topics.filter((t) => t.subject_id === options.subjectId)) topicIds.set(`${t.parent_id ?? ""}/${t.name}`, t.id);
  async function topicFor(deck: string[]) {
    let path = deck[0]?.toLowerCase() === options.subjectName.toLowerCase() ? deck.slice(1) : deck;
    if (path.length === 0) path = ["Anki-Import"];
    let parent: ID | null = null;
    for (const name of path) {
      const key: string = `${parent ?? ""}/${name}`;
      let id: ID | undefined = topicIds.get(key);
      if (!id) {
        const sort = [...topicIds.keys()].filter((k) => k.startsWith(`${parent ?? ""}/`)).length;
        const created: Topic[] = await insertRows("topics", [{ subject_id: options.subjectId, parent_id: parent, name, sort }]);
        id = created[0].id;
        topicIds.set(key, id);
      }
      parent = id;
    }
    return parent!;
  }

  const uploaded = new Map<string, string | null>();
  let imagesDone = 0;
  const imageCount = options.images ? new Set(fresh.map((c) => c.image).filter(Boolean)).size : 0;
  async function imageFor(name: string | null) {
    if (!options.images || !name) return null;
    if (!uploaded.has(name)) {
      let path: string | null = null;
      try {
        const file = await mediaFile(pkg, name);
        // SVGs and broken files are skipped; the question still works without its picture.
        if (file && file.type !== "image/svg+xml") path = await uploadImage(file);
      } catch {
        path = null;
      }
      uploaded.set(name, path);
      options.onProgress?.(`Bilder hochladen … ${++imagesDone}/${imageCount}`);
    }
    return uploaded.get(name) ?? null;
  }

  const rows: Omit<Question, "id">[] = [];
  for (const c of fresh) {
    rows.push({
      topic_id: await topicFor(c.deck),
      type: "explain",
      prompt: c.prompt,
      options: [],
      answer: c.answer,
      explanation: c.explanation,
      image_url: await imageFor(c.image),
      video_url: null,
      source: c.key,
      suspended: false,
      card: null,
      due: null,
    });
  }
  options.onProgress?.(`Fragen speichern … ${rows.length}`);
  await insertRows("questions", rows);
  return { imported: rows.length, duplicates: cards.length - fresh.length };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function tsvField(s: string) {
  return /[\t"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function mcBack(options: McOption[]) {
  const letter = (i: number) => String.fromCharCode(65 + i);
  return options
    .map((o, i) => (o.correct ? `${letter(i)}) ${o.text}` : null))
    .filter(Boolean)
    .join("\n");
}

/**
 * Anki's "Notes in Plain Text" format with file headers, so Anki fills in the deck by itself.
 * Figure questions are left out because they need the image with its masks.
 */
export function ankiText(questions: Question[], topics: Topic[], subjects: Subject[]) {
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  function deckOf(topicId: string) {
    const path: string[] = [];
    for (let t = topicById.get(topicId); t; t = t.parent_id ? topicById.get(t.parent_id) : undefined) path.unshift(t.name);
    const subject = subjectById.get(topicById.get(topicId)?.subject_id ?? "");
    return ["Studium MHH", subject?.name ?? "Ohne Fach", ...path].map((p) => p.replace(/::/g, ":")).join("::");
  }
  const notes: { deck: string; line: string }[] = [];
  for (const q of questions) {
    if (q.type === "occlusion") continue;
    const front =
      q.type === "mc"
        ? `${escapeHtml(q.prompt)}<br><br>${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${escapeHtml(o.text)}`).join("<br>")}`
        : escapeHtml(q.prompt);
    const backText = q.type === "mc" ? mcBack(q.options) : (q.answer ?? "");
    const back = [escapeHtml(backText), q.explanation ? `<br><br><i>${escapeHtml(q.explanation)}</i>` : ""].join("");
    const deck = deckOf(q.topic_id);
    notes.push({ deck, line: [front, back, deck, "studium-mhh"].map(tsvField).join("\t") });
  }
  // Parent decks first: Anki creates a duplicate "Deck+" when a subdeck's line comes before its parent's.
  notes.sort((a, b) => (a.deck < b.deck ? -1 : a.deck > b.deck ? 1 : 0));
  const header = ["#separator:tab", "#html:true", "#deck column:3", "#tags column:4"];
  return { text: [...header, ...notes.map((n) => n.line)].join("\n") + "\n", count: notes.length };
}
