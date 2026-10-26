import type { EventKind } from "./types";

export const KIND_LABEL: Record<EventKind, string> = {
  pruefung: "Prüfung",
  testat: "Testat",
  frist: "Frist",
  veranstaltung: "Veranstaltung",
  sonstiges: "Sonstiges",
};

export const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: "Hoch", 2: "Mittel", 3: "Niedrig" };
