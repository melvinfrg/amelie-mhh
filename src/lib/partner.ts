"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useEventLinks, useShareTargets } from "./sharing";
import { hasSupabase, supabase } from "./supabase";
import type { CalendarSource, MelvinEvent } from "./types";

/**
 * Dates others share live from their calendar (Melvin's Termine for Amelie, supabase/migrations/0014_melvin_termine_teilen.sql).
 * They are only shown, never edited here. Changes come in over Supabase Realtime; a date that stops being shared
 * can't send a change to someone who may no longer read it, so the list also reloads when the page comes back
 * into view and once a minute while it is open.
 */

export interface PartnerItem extends MelvinEvent {
  owner: string;
  emoji: string;
  partner: true;
}

let rows: MelvinEvent[] | null = null;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function fetchShared() {
  const { data: session } = await supabase().auth.getSession();
  const me = session.session?.user.id;
  if (!me) return;
  const { data, error } = await supabase().from("melvin_events").select("*").eq("shared", true).neq("user_id", me);
  // Before the migration is in there is no `shared` column: nothing to show.
  rows = error ? [] : ((data ?? []) as MelvinEvent[]);
  emit();
}

function start() {
  if (started || !hasSupabase) return;
  started = true;
  fetchShared();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(fetchShared, 400);
  };
  supabase().channel("live:partner-events").on("postgres_changes", { event: "*", schema: "public", table: "melvin_events" }, soon).subscribe();
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && soon());
  setInterval(() => document.visibilityState === "visible" && fetchShared(), 60_000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const OVERLAY_KEY = "partner-termine-einblenden";

/**
 * The dates others share with me, switchable and remembered in this browser. Dates already copied into
 * `source` with "Übertragen" and kept connected are left out, so nothing shows twice.
 */
export function usePartnerEvents(source: CalendarSource) {
  const shared = useSyncExternalStore(
    subscribe,
    () => rows,
    () => null,
  );
  const { targets } = useShareTargets();
  const links = useEventLinks();
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(OVERLAY_KEY) !== "aus";
    } catch {
      return true;
    }
  });
  useEffect(start, []);
  function toggle(next: boolean) {
    setOn(next);
    try {
      localStorage.setItem(OVERLAY_KEY, next ? "an" : "aus");
    } catch {
      // Not remembered in private mode.
    }
  }
  const copied = new Set(
    links.rows.flatMap((l) =>
      l.a_kind === "melvin" && l.b_kind === source ? [l.a_id] : l.b_kind === "melvin" && l.a_kind === source ? [l.b_id] : [],
    ),
  );
  const all: PartnerItem[] = (shared ?? [])
    .filter((e) => !copied.has(e.id))
    .map((e) => {
      const t = targets.find((t) => t.user_id === e.user_id);
      return { ...e, owner: t?.name ?? "Melvin", emoji: t?.emoji ?? "💙", partner: true as const };
    });
  const names = [...new Set(all.map((e) => e.owner))];
  return { on, toggle, items: on ? all : [], available: all.length > 0, names: names.length ? names.join(" & ") : "Melvin" };
}

/** Names of the others who would see a shared date, e.g. "Amelie". */
export function useShareAudience() {
  const { targets, me } = useShareTargets();
  const others = targets.filter((t) => t.user_id !== me).map((t) => t.name);
  return others.length ? others.join(" & ") : "Amelie";
}
