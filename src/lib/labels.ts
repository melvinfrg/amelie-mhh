import type { EventKind, MelvinCategory } from "./types";

export const KIND_LABEL: Record<EventKind, string> = {
  pruefung: "Prüfung",
  testat: "Testat",
  frist: "Frist",
  veranstaltung: "Veranstaltung",
  sonstiges: "Sonstiges",
};

export const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: "Hoch", 2: "Mittel", 3: "Niedrig" };

export const MELVIN_CATEGORY_LABEL: Record<MelvinCategory, string> = {
  privat: "Privat",
  arbeit: "Arbeit",
  sport: "Sport",
  familie: "Familie & Freunde",
  sonstiges: "Sonstiges",
};
