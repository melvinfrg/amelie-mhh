import { KIND_LABEL } from "./labels";
import type { FeedFilter, StudyEvent } from "./types";

const ZONE = "Europe/Berlin";

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** The calendar day of a timestamp in Hannover, as YYYYMMDD; works the same on the server (UTC) and in the browser. */
function localDay(iso: string, addDays = 0) {
  const d = new Date(new Date(iso).getTime() + addDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/-/g, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

/** RFC 5545 wants lines of at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export type IcsEvent = Pick<StudyEvent, "id" | "title" | "kind" | "starts_at" | "location" | "notes"> &
  Partial<Pick<StudyEvent, "ends_at" | "all_day">> & { subject?: string | null };

export function toIcs(events: IcsEvent[], name = "Studium MHH") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studium MHH//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    `X-WR-TIMEZONE:${ZONE}`,
    // Subscribed calendars check back about every hour.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const now = stamp(new Date().toISOString());
  for (const e of events) {
    const timing = e.all_day
      ? [`DTSTART;VALUE=DATE:${localDay(e.starts_at)}`, `DTEND;VALUE=DATE:${localDay(e.ends_at ?? e.starts_at, 1)}`]
      : [`DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 36e5).toISOString())}`];
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@studium-mhh`,
      `DTSTAMP:${now}`,
      ...timing,
      `SUMMARY:${escape(e.title)}`,
      `CATEGORIES:${escape([KIND_LABEL[e.kind], e.subject].filter(Boolean).join(","))}`,
      ...(e.all_day ? ["TRANSP:TRANSPARENT"] : []),
      ...(e.location ? [`LOCATION:${escape(e.location)}`] : []),
      ...(e.notes ? [`DESCRIPTION:${escape(e.notes)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function matchesFilter(e: Pick<StudyEvent, "kind" | "subject_id" | "done">, filter: FeedFilter) {
  if (filter.kinds?.length && !filter.kinds.includes(e.kind)) return false;
  if (filter.subjects?.length && !filter.subjects.includes(e.subject_id ?? "none")) return false;
  if (filter.hideDone && e.done) return false;
  return true;
}

export function download(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
