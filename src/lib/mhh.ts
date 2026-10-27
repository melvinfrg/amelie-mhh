// Reads public dates from mhh.de (lecture periods, quintiles, re-registration, exam lists) and turns
// them into event suggestions. Runs on the server: mhh.de sends no CORS headers.

import type { EventKind } from "./types";

export interface Suggestion {
  /** Stable key without the date, so a moved exam shows up as a change instead of a new event. */
  source: string;
  group: string;
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  /** Repeat exams ("WH") are only offered, not preselected. */
  retake: boolean;
}

export const GROUPS = {
  semester: "Semester, Quintile und Pausen",
  exams: "Prüfungen",
  deadlines: "Anmeldefristen für Prüfungen",
  registration: "Rückmeldung",
};

const ZONE = "Europe/Berlin";

function offsetMinutes(ts: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(ts)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - ts) / 60000);
}

/** A wall-clock time in Hannover as an ISO timestamp, independent of the server's time zone. */
export function berlin(day: number, month: number, year: number, hour = 0, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess - offsetMinutes(guess) * 60000).toISOString();
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

type Range = { from: [number, number, number]; to: [number, number, number] };

/** Reads "05.10.-20.11.2026", "23.11.2026-22.01.2027", "22.01 -11.03.2029" or "05.10.2026 bis 12.03.2027". */
export function parseRange(text: string): Range | null {
  const t = text.replace(/(\d)\s+\./g, "$1.").replace(/\s*(?:[-–]|bis)\s*/g, "-");
  const m = t.match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?-(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const to: [number, number, number] = [+m[4], +m[5], +m[6]];
  let fromYear = m[3] ? +m[3] : to[2];
  // "27.11.-21.01.2029" crosses the new year.
  if (!m[3] && (+m[2] > to[1] || (+m[2] === to[1] && +m[1] > to[0]))) fromYear--;
  return { from: [+m[1], +m[2], fromYear], to };
}

function allDay(group: string, source: string, title: string, kind: EventKind, r: Range, notes: string | null = null): Suggestion {
  return {
    source,
    group,
    title,
    kind,
    starts_at: berlin(...r.from),
    ends_at: berlin(...r.to),
    all_day: true,
    location: null,
    notes,
    retake: false,
  };
}

/** Lecture periods, quintiles and breaks for Medizin from mhh.de/vorlesungszeiten. */
export function parseLecturePeriods(html: string): Suggestion[] {
  const out: Suggestion[] = [];
  const items = html.split(/class="accordion__item/).slice(1);
  for (const item of items) {
    const title = item.match(/full-width-box__title">\s*([^<]+?)\s*</)?.[1] ?? "";
    const semester = title.match(/(Winter|Sommer)semester\s+(\d{4})(?:\/(\d{4}))?/);
    if (!semester) continue;
    const label = semester[1] === "Winter" ? `Wintersemester ${semester[2]}/${semester[3]?.slice(2) ?? ""}` : `Sommersemester ${semester[2]}`;
    const key = semester[1] === "Winter" ? `WS${semester[2]}` : `SS${semester[2]}`;
    const text = htmlToText(item.slice(item.indexOf("accordion__content")));
    // The Medizin part runs from its heading to the next study programme.
    const start = text.search(/(^|\n)\s*Medizin\s*\n/);
    if (start < 0) continue;
    const rest = text.slice(start).replace(/^\s*Medizin\s*\n/, "");
    const end = rest.search(/Zahnmedizin|Masterstudieng|Bachelorstudieng/);
    const block = end >= 0 ? rest.slice(0, end) : rest;
    for (const segment of block.split(/\n|\|/).map((s) => s.trim()).filter(Boolean)) {
      const range = parseRange(segment);
      if (!range) continue;
      const quintil = segment.match(/Quintil\s*(\d)/)?.[1];
      if (quintil) {
        out.push(allDay(GROUPS.semester, `mhh:quintil:${key}:${quintil}`, `Quintil ${quintil}`, "veranstaltung", range, label));
      } else if (/Unterbrech|Unterbrechn/i.test(segment)) {
        const name = semester[1] === "Winter" ? "Weihnachtspause (keine Lehre)" : "Unterbrechung (keine Lehre)";
        out.push(allDay(GROUPS.semester, `mhh:pause:${key}`, name, "sonstiges", range, label));
      } else if (!/\D{3,}/.test(segment.replace(/bis/g, ""))) {
        out.push(allDay(GROUPS.semester, `mhh:vorlesungszeit:${key}`, `Vorlesungszeit ${label}`, "veranstaltung", range));
      }
    }
  }
  return out;
}

/** The re-registration windows from the registrar's page, which lists them without a year. */
export function parseRegistration(html: string, today = new Date()): Suggestion[] {
  const section = html.split(/class="accordion__item/).find((s) => /title">\s*Rückmeldung/.test(s));
  if (!section) return [];
  const text = htmlToText(section);
  const out: Suggestion[] = [];
  for (const [name, re] of [
    ["Winter", /Wintersemester:\s*(\d{1,2})\.(\d{1,2})\.\s*-\s*(\d{1,2})\.(\d{1,2})\./],
    ["Sommer", /Sommersemester:\s*(\d{1,2})\.(\d{1,2})\.\s*-\s*(\d{1,2})\.(\d{1,2})\./],
  ] as const) {
    const m = text.match(re);
    if (!m) continue;
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const r: Range = { from: [+m[1], +m[2], year], to: [+m[3], +m[4], year] };
      if (new Date(berlin(...r.to)) < today) continue;
      const semester = name === "Winter" ? `Wintersemester ${year}/${String(year + 1).slice(2)}` : `Sommersemester ${year}`;
      out.push(
        allDay(
          GROUPS.registration,
          `mhh:rueckmeldung:${name === "Winter" ? "WS" : "SS"}${year}`,
          `Rückmeldung ${semester}`,
          "frist",
          r,
          "Semesterbeitrag überweisen, sonst droht die Exmatrikulation.",
        ),
      );
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 2);
}

/** One text piece of the exam list PDF with its position (the pages are landscape, so x runs down the rows). */
export interface PdfItem {
  page: number;
  row: number;
  col: number;
  text: string;
}

// Column starts of the exam list, in PDF units along the row.
const COLUMNS = [
  ["year", 0],
  ["quintil", 70],
  ["block", 120],
  ["module", 165],
  ["type", 262],
  ["date", 340],
  ["room", 405],
  ["cohorts", 480],
  ["time", 535],
  ["duration", 605],
  ["deadline", 655],
  ["notes", 708],
] as const;

type Column = (typeof COLUMNS)[number][0];

function columnOf(col: number): Column {
  let name: Column = "year";
  for (const [c, start] of COLUMNS) if (col >= start) name = c;
  return name;
}

function dmy(s: string): [number, number, number] | null {
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Turns the positioned text of an MHH exam list ("Prüfungstermine") into exam and deadline suggestions. */
export function parseExamList(items: PdfItem[], studyYear: number, academicYear: string): Suggestion[] {
  // A row starts where the "Studienjahr" column holds the year number.
  const anchors = items.filter((i) => i.col < 70 && i.text.trim() === String(studyYear));
  const rows = new Map<PdfItem, Record<Column, string[]>>();
  for (const item of items) {
    if (!item.text.trim()) continue;
    const anchor = anchors
      .filter((a) => a.page === item.page && Math.abs(a.row - item.row) <= 9)
      .sort((a, b) => Math.abs(a.row - item.row) - Math.abs(b.row - item.row))[0];
    if (!anchor) continue;
    const cells = rows.get(anchor) ?? (Object.fromEntries(COLUMNS.map(([c]) => [c, []])) as unknown as Record<Column, string[]>);
    rows.set(anchor, cells);
    cells[columnOf(item.col)].push(`${String(item.row).padStart(5, "0")}\u0000${item.text.trim()}`);
  }

  const out: Suggestion[] = [];
  const seen = new Map<string, number>();
  for (const cells of rows.values()) {
    const get = (c: Column) =>
      cells[c]
        .sort()
        .map((v) => v.split("\u0000")[1])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const moduleName = get("module");
    const type = get("type");
    const dates = get("date");
    const from = dmy(dates);
    if (!moduleName || !from) continue;
    const toMatch = dates.match(/-\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
    const to = toMatch ? dmy(toMatch[1]) : null;
    const quintil = get("quintil");
    const retake = /\bWH\b|WH-/.test(type);
    const probe = /Probeklausur/i.test(moduleName);
    const kind: EventKind = probe ? "sonstiges" : /Testat/i.test(type) ? "testat" : "pruefung";
    const title = type ? `${moduleName} (${type})` : moduleName;
    const roomRaw = get("room");
    const room = roomRaw === "Abt." ? "Abteilung (wird bekanntgegeben)" : roomRaw || null;
    // "8:30:-18:00" also occurs.
    const timeText = get("time").replace(/:\s*-/g, "-");
    const times = [...timeText.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
    const remarks = get("notes");
    const deadline = dmy(get("deadline"));

    let key = `${academicYear}:sj${studyYear}:${quintil}|${moduleName}|${type}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) key += `|${n}`;

    const notes = [
      times.length > 1 ? `Zeiten je nach Kohorte: ${timeText}` : null,
      times.length === 1 && to ? `jeweils ${timeText}, Termin wird zugeteilt` : null,
      remarks || null,
      deadline ? `An-/Abmeldung bis ${deadline.map((v) => String(v).padStart(2, "0")).join(".")}` : null,
      `Quelle: MHH-Prüfungsliste ${studyYear}. Studienjahr ${academicYear.replace("_", "/")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const timed = times.length === 1 && !to;
    const t = times[0];
    out.push({
      source: `mhh:pruefung:${key}`,
      group: GROUPS.exams,
      title,
      kind,
      starts_at: timed ? berlin(...from, +t[1], +t[2]) : berlin(...from),
      ends_at: timed ? berlin(...from, +t[3], +t[4]) : to ? berlin(...to) : null,
      all_day: !timed,
      location: room,
      notes,
      retake: retake || probe,
    });
    if (deadline && !probe) {
      out.push({
        source: `mhh:frist:${key}`,
        group: GROUPS.deadlines,
        title: `Anmeldung: ${title}`,
        kind: "frist",
        starts_at: berlin(...deadline),
        ends_at: null,
        all_day: true,
        location: null,
        notes: `Prüfung am ${dates.replace(/\s+/g, " ")}`,
        retake,
      });
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** "2026_2027" for the academic year that contains the date (it starts in October, lists appear in September). */
export function academicYear(today = new Date()) {
  const y = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}_${y + 1}`;
}

export function examListUrls(year: string, studyYear: number) {
  const base = `https://www.mhh.de/fileadmin/mhh/medizin-studiengang/downloads/Curriula/${year}`;
  return [
    `${base}/MHH_Medizin_Pr%C3%BCfungen_${year}_Liste_SJ_${studyYear}.pdf`,
    `${base}/Pr%C3%BCfungen_${year}_${studyYear}._Studienjahr.pdf`,
    `${base}/Pr%C3%BCfungen_${year}_${studyYear}_Studienjahr.pdf`,
  ];
}

export const SOURCES = {
  lectures: "https://www.mhh.de/vorlesungszeiten",
  registrar: "https://www.mhh.de/studierendensekretariat/termine-fristen",
};
