import type { CvEntry, CvProfile, CvSection } from "./types";

/** Shared by the Lebenslauf page and the Word/PDF export. */

export const SECTION: Record<CvSection, { label: string; icon: string; color: string }> = {
  beruf: { label: "Berufserfahrung", icon: "💼", color: "#6366f1" },
  praktikum: { label: "Praktika", icon: "🧪", color: "#0ea5e9" },
  ausbildung: { label: "Ausbildung & Studium", icon: "🎓", color: "#10b981" },
  schule: { label: "Schule", icon: "🏫", color: "#f59e0b" },
  weiterbildung: { label: "Weiterbildung", icon: "📚", color: "#8b5cf6" },
  ehrenamt: { label: "Ehrenamt", icon: "🤝", color: "#f43f5e" },
  sonstiges: { label: "Sonstiges", icon: "📌", color: "#78716c" },
};

export const SECTIONS = Object.keys(SECTION) as CvSection[];

export type CvStyle = "klassisch" | "modern" | "kompakt";

export const STYLES: Record<CvStyle, { label: string; hint: string }> = {
  klassisch: { label: "Klassisch", hint: "Tabellarisch, schlicht, für Bewerbungen" },
  modern: { label: "Modern", hint: "Farbige Seitenleiste mit Kenntnissen" },
  kompakt: { label: "Kompakt", hint: "Alles knapp auf möglichst einer Seite" },
};

/** Accent colours for the files, as hex without #. */
export const ACCENTS = {
  indigo: { label: "Indigo", hex: "4338CA" },
  petrol: { label: "Petrol", hex: "0F766E" },
  bordeaux: { label: "Bordeaux", hex: "9F1239" },
  graphit: { label: "Graphit", hex: "374151" },
} as const;

export type Accent = keyof typeof ACCENTS;

export interface ExportOptions {
  style: CvStyle;
  accent: Accent;
  sections: CvSection[];
  /** Place for the signature line, e.g. "Hannover". */
  place: string;
}

export interface CvGroup {
  section: CvSection;
  label: string;
  entries: CvEntry[];
}

export interface CvData {
  profile: CvProfile;
  groups: CvGroup[];
  options: ExportOptions;
}

export const emptyProfile = (): Omit<CvProfile, "id"> => ({
  name: "",
  headline: null,
  birth_date: null,
  birth_place: null,
  email: null,
  phone: null,
  address: null,
  website: null,
  summary: null,
  skills: [],
  languages: [],
  interests: null,
});

/** Newest first; running entries (no end) before finished ones that started at the same time. */
export function byRecent(a: CvEntry, b: CvEntry) {
  return b.start_date.localeCompare(a.start_date) || (b.end_date ?? "9999").localeCompare(a.end_date ?? "9999");
}

/** The entries for a file: chosen sections in the usual order, hidden ones left out. */
export function groups(entries: CvEntry[], sections: CvSection[] = SECTIONS): CvGroup[] {
  return SECTIONS.filter((s) => sections.includes(s))
    .map((s) => ({ section: s, label: SECTION[s].label, entries: entries.filter((e) => e.section === s && !e.hidden).sort(byRecent) }))
    .filter((g) => g.entries.length > 0);
}

/** "MM/YYYY" */
export function monthYear(day: string) {
  const [y, m] = day.split("-");
  return `${m}/${y}`;
}

export function period(e: Pick<CvEntry, "start_date" | "end_date">) {
  const start = monthYear(e.start_date);
  if (!e.end_date) return `seit ${start}`;
  const end = monthYear(e.end_date);
  return start === end ? start : `${start} – ${end}`;
}

/** Whole months an entry lasts (at least one). */
export function months(e: Pick<CvEntry, "start_date" | "end_date">) {
  const [y1, m1] = e.start_date.split("-").map(Number);
  const end = e.end_date ? e.end_date.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  return Math.max(1, (end[0] - y1) * 12 + (end[1] - m1) + 1);
}

export function duration(e: Pick<CvEntry, "start_date" | "end_date">) {
  return monthsText(months(e));
}

/** "2 Jahre, 3 Monate" */
export function monthsText(n: number) {
  const y = Math.floor(n / 12);
  const m = n % 12;
  return [y ? `${y} ${y === 1 ? "Jahr" : "Jahre"}` : "", m ? `${m} ${m === 1 ? "Monat" : "Monate"}` : ""].filter(Boolean).join(", ");
}

export function formatDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

/** Description lines; "- " or "• " at the start makes a bullet point. */
export function descriptionLines(text: string | null) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^[-•*]\s*/.test(l) ? { bullet: true, text: l.replace(/^[-•*]\s*/, "") } : { bullet: false, text: l }));
}

/** Contact lines for the files, in the usual order. */
export function contactLines(p: CvProfile) {
  return [
    p.address,
    p.phone,
    p.email,
    p.website,
    p.birth_date ? `geboren am ${formatDay(p.birth_date)}${p.birth_place ? ` in ${p.birth_place}` : ""}` : null,
  ].filter((l): l is string => Boolean(l?.trim()));
}

export function fileName(p: CvProfile, style: CvStyle, ext: string) {
  const name = (p.name || "Lebenslauf").trim().replace(/[^\p{L}\p{N}]+/gu, "_");
  return `Lebenslauf_${name}_${STYLES[style].label}.${ext}`;
}

export function today() {
  return new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
