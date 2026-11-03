"use client";

import { useSyncExternalStore } from "react";
import FILE from "@/data/changelog.json";
import { hasSupabase, supabase } from "./supabase";

/**
 * Versionen und Update-Log, wie auf der Gruppe-2.1-Seite.
 *
 * Die Versionen stehen in src/data/changelog.json (neueste zuerst); mit jedem Update kommt dort oben ein Eintrag dazu.
 * Im Update-Log lassen sie sich zusätzlich bearbeiten: Diese Änderungen liegen in der Tabelle app_config
 * (Schlüssel „changelog_edits“) und werden über die Einträge der Datei gelegt, sodass neue Versionen aus späteren
 * Updates trotzdem automatisch erscheinen (supabase/migrations/0015_versionen_fehler.sql).
 */

export type ChangeType = "neu" | "besser" | "fix";

export interface ChangeItem {
  t: ChangeType;
  x: string;
}

export interface Version {
  v: string;
  /** YYYY-MM-DD */
  d: string;
  items: ChangeItem[];
}

/** A version as shown: where it came from, so an edit can be undone. */
export interface ShownVersion extends Version {
  /** The version number in the file, for entries that come from the file. */
  orig?: string;
  /** The id of a version added in the update log. */
  added?: string;
}

export interface ChangelogEdits {
  ver: Record<string, Version | { deleted: true }>;
  add: (Version & { id: string })[];
}

export const CHANGE_TAG: Record<ChangeType, [string, string]> = {
  neu: ["🆕", "Neu"],
  besser: ["✨", "Verbessert"],
  fix: ["🛠️", "Behoben"],
};

export const FILE_CHANGELOG = FILE as Version[];

const verParts = (v: string) =>
  String(v || "")
    .replace(/[^\d.]/g, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

/** Compares version numbers part by part: 2.10.0 is newer than 2.9.7. */
export function verCmp(a: string, b: string) {
  const x = verParts(a);
  const y = verParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function applyEdits(file: Version[], edits: ChangelogEdits): ShownVersion[] {
  const list: ShownVersion[] = [];
  for (const e of file) {
    const ed = edits.ver?.[e.v];
    if (ed && "deleted" in ed) continue;
    list.push({ ...(ed ?? e), orig: e.v });
  }
  for (const a of edits.add ?? []) list.push({ v: a.v, d: a.d, items: a.items, added: a.id });
  return list.sort((a, b) => verCmp(b.v, a.v) || String(b.d).localeCompare(String(a.d)));
}

// ---- The edits: loaded once, shared by every component ----

const EDITS_KEY = "amelie-mhh:changelog-edits";
const EMPTY_EDITS: ChangelogEdits = { ver: {}, add: [] };

function readLocalEdits(): ChangelogEdits {
  try {
    const c = JSON.parse(localStorage.getItem(EDITS_KEY) ?? "null");
    if (c && c.ver) return { ver: c.ver, add: c.add ?? [] };
  } catch {}
  return EMPTY_EDITS;
}

let edits: ChangelogEdits = EMPTY_EDITS;
let shown: ShownVersion[] = applyEdits(FILE_CHANGELOG, EMPTY_EDITS);
let seen: string | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setEdits(next: ChangelogEdits) {
  edits = next;
  shown = applyEdits(FILE_CHANGELOG, next);
  try {
    localStorage.setItem(EDITS_KEY, JSON.stringify(next));
  } catch {}
  emit();
}

/** Fetches the edits from the database. Before the migration is in there is no table: then the file is all there is. */
export async function loadEdits() {
  if (!hasSupabase) return;
  const { data, error } = await supabase().from("app_config").select("value").eq("key", "changelog_edits").maybeSingle();
  if (error) return;
  const v = (data?.value ?? null) as ChangelogEdits | null;
  setEdits(v?.ver ? { ver: v.ver, add: v.add ?? [] } : EMPTY_EDITS);
}

export async function saveEdits(next: ChangelogEdits) {
  if (hasSupabase) {
    const { error } = await supabase()
      .from("app_config")
      .upsert({ key: "changelog_edits", value: next, updated_at: new Date().toISOString() });
    if (error) {
      if (/app_config/.test(error.message)) throw new Error("Die Tabelle fürs Update-Log fehlt noch. Bitte supabase/migrations/0015_versionen_fehler.sql in Supabase ausführen.");
      throw error;
    }
  }
  setEdits(next);
}

export function getEdits() {
  return edits;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  edits = readLocalEdits();
  shown = applyEdits(FILE_CHANGELOG, edits);
  try {
    seen = localStorage.getItem(SEEN_KEY);
  } catch {}
  emit();
  loadEdits().catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

// ---- Seen version: per device, like on Gruppe 2.1 ----

const SEEN_KEY = "amelie-mhh:seen-version";

/** Remembers that the newest version was looked at, so the red dot and „Neu in Version …“ go away. */
export function markSeen() {
  const v = shown[0]?.v;
  if (!v) return;
  seen = v;
  try {
    localStorage.setItem(SEEN_KEY, v);
  } catch {}
  emit();
}

const SERVER: ShownVersion[] = applyEdits(FILE_CHANGELOG, EMPTY_EDITS);

/** The update log as shown: the file with the edits from the database on top. */
export function useChangelog() {
  const list = useSyncExternalStore(
    subscribe,
    () => shown,
    () => SERVER,
  );
  const seenVersion = useSyncExternalStore(
    subscribe,
    () => seen,
    () => null,
  );
  const current = list[0];
  // Nobody has seen anything on the very first visit either; then everything counts as new, like on Gruppe 2.1.
  const unseen = !!current && verCmp(current.v, seenVersion ?? "0") > 0;
  return { list, current, seenVersion, unseen };
}

// ---- Opening the update log from anywhere (footer, start page, #neuerungen) ----

export type LogTab = "log" | "bug";
const OPEN_EVENT = "amelie-mhh:open-changelog";

export function openChangelog(tab: LogTab = "log") {
  window.dispatchEvent(new CustomEvent<LogTab>(OPEN_EVENT, { detail: tab }));
}

export function onOpenChangelog(handler: (tab: LogTab) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<LogTab>).detail);
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
