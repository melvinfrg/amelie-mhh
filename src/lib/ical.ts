import type { StudyEvent } from "./types";

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

export function toIcs(events: StudyEvent[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Studium MHH//DE", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const end = new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@studium-mhh`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(e.title)}`,
      ...(e.location ? [`LOCATION:${escape(e.location)}`] : []),
      ...(e.notes ? [`DESCRIPTION:${escape(e.notes)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
