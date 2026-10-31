import type { StudyEvent, Subject } from "./types";

export const DEFAULT_SUBJECTS: Pick<Subject, "name" | "color">[] = [
  { name: "Anatomie", color: "#dc2626" },
  { name: "Histologie", color: "#db2777" },
  { name: "Biochemie", color: "#7c3aed" },
  { name: "Physiologie", color: "#2563eb" },
  { name: "Biologie", color: "#16a34a" },
  { name: "Chemie", color: "#ca8a04" },
  { name: "Physik", color: "#0891b2" },
  { name: "Psychologie & Soziologie", color: "#ea580c" },
  { name: "Terminologie", color: "#64748b" },
];

export function subjectName(subjects: Subject[], id: string | null | undefined) {
  return subjects.find((s) => s.id === id)?.name;
}

export function SubjectDot({ color }: { color?: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? "#94a3b8" }} />;
}

/** The subjects of an event; rows from before migration 0013 only know subject_id. */
export function eventSubjectIds(e: Pick<StudyEvent, "subject_id" | "subject_ids">): string[] {
  if (e.subject_ids?.length) return e.subject_ids;
  return e.subject_id ? [e.subject_id] : [];
}

/** The subjects of an event in the order of the subject list, skipping deleted ones. */
export function eventSubjects(e: Pick<StudyEvent, "subject_id" | "subject_ids">, subjects: Subject[]) {
  const ids = new Set(eventSubjectIds(e));
  return subjects.filter((s) => ids.has(s.id));
}
