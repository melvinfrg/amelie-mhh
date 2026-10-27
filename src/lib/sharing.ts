"use client";

import { useEffect, useState } from "react";
import { dayKey, localMidnight } from "./dates";
import { hasSupabase, supabase } from "./supabase";
import { load, useTable } from "./useTable";
import type { BatziEvent, CalendarSource, EventLink, TableName } from "./types";

/** Sending dates between Melvin's calendar, Amelie's Studium and the Batzi's (supabase/migrations/0010_event_links.sql). */

export const SOURCE_TABLE: Record<CalendarSource, TableName> = { studium: "events", melvin: "melvin_events", batzis: "batzi_events" };

export interface ShareTarget {
  user_id: string;
  name: string;
  emoji: string;
  /** The calendar that is theirs. */
  area: "studium" | "melvin";
}

/** A place a date can go: the Batzi's, or one person's own calendar. */
export interface Destination {
  kind: CalendarSource;
  user: string | null;
  label: string;
}

let targetsPromise: Promise<{ targets: ShareTarget[]; me: string | null }> | null = null;

function fetchTargets() {
  targetsPromise ??= (async () => {
    const [{ data: session }, { data, error }] = await Promise.all([supabase().auth.getSession(), supabase().rpc("share_targets")]);
    // Before the migration is in, or for someone who isn't in the Batzi's: nothing to share with.
    if (error) return { targets: [], me: session.session?.user.id ?? null };
    return { targets: (data ?? []) as ShareTarget[], me: session.session?.user.id ?? null };
  })();
  return targetsPromise;
}

/** Who can receive dates, and the logged-in user's id. Empty in demo mode. */
export function useShareTargets() {
  const [state, setState] = useState<{ targets: ShareTarget[]; me: string | null }>({ targets: [], me: null });
  useEffect(() => {
    if (!hasSupabase) return;
    let alive = true;
    fetchTargets().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const AREA_LABEL = { studium: "Studium", melvin: "Kalender" } as const;

/** Every calendar a date from `source` can be sent to, without the one it is already in. */
export function destinations(source: CalendarSource, targets: ShareTarget[], me: string | null): Destination[] {
  const out: Destination[] = [];
  if (source !== "batzis") out.push({ kind: "batzis", user: null, label: "🐻 Batzi-Kalender" });
  for (const t of targets) {
    const own = t.user_id === me;
    if (own && source === t.area) continue;
    out.push({ kind: t.area, user: t.user_id, label: `${t.emoji} ${own ? "Mein" : `${t.name}s`} ${AREA_LABEL[t.area]}` });
  }
  return out;
}

export async function shareEvent(source: CalendarSource, id: string, to: Destination[], keepLinked: boolean) {
  for (const d of to) {
    const { error } = await supabase().rpc("share_event", {
      src_kind: source,
      src_id: id,
      dest_kind: d.kind,
      dest_user: d.user,
      keep_linked: keepLinked,
    });
    if (error) throw error;
  }
  // The copies may have landed in tables this browser shows (the Batzi's, or one's own other calendar).
  await Promise.all([load("event_links", true), ...new Set(to.map((d) => load(SOURCE_TABLE[d.kind], true)))]);
}

export async function unlinkEvent(source: CalendarSource, id: string) {
  const { error } = await supabase().rpc("unlink_event", { ev_kind: source, event_id: id });
  if (error) throw error;
  await load("event_links", true);
}

/** The other ends of a date's connections. */
export function linksOf(links: EventLink[], source: CalendarSource, id: string) {
  return links.flatMap((l) =>
    l.a_kind === source && l.a_id === id
      ? [{ kind: l.b_kind, id: l.b_id, user: l.b_user }]
      : l.b_kind === source && l.b_id === id
        ? [{ kind: l.a_kind, id: l.a_id, user: l.a_user }]
        : [],
  );
}

export function useEventLinks() {
  return useTable("event_links");
}

/** A Batzi date in the shape of the other calendars, one entry per occurrence. */
export interface BatziItem {
  id: string;
  batziId: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  done: false;
  external: true;
}

function at(day: string, time: string | null) {
  if (!time) return localMidnight(day);
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Repeating dates (birthdays, weekly sports) are spread out over the year before and after today. */
export function batziItems(rows: BatziEvent[]): BatziItem[] {
  const from = addDays(dayKey(new Date()), -400);
  const to = addDays(dayKey(new Date()), 400);
  const out: BatziItem[] = [];
  for (const e of rows) {
    const allDay = e.all_day || !e.start_time;
    const length = e.end_date && e.end_date > e.event_date ? Math.round((new Date(e.end_date).getTime() - new Date(e.event_date).getTime()) / 864e5) : 0;
    const days: string[] = [];
    if (!e.recurrence || e.recurrence === "none") days.push(e.event_date);
    else {
      const [y, m, d] = e.event_date.split("-").map(Number);
      for (let i = 0; days.length < 800; i++) {
        const day =
          e.recurrence === "weekly"
            ? addDays(e.event_date, 7 * i)
            : e.recurrence === "biweekly"
              ? addDays(e.event_date, 14 * i)
              : e.recurrence === "monthly"
                ? dayKey(new Date(y, m - 1 + i, d))
                : dayKey(new Date(y + i, m - 1, d));
        if (day > to) break;
        if (day >= from) days.push(day);
      }
    }
    for (const day of days) {
      const last = addDays(day, length);
      out.push({
        id: `${e.id}:${day}`,
        batziId: e.id,
        title: e.title,
        starts_at: at(day, allDay ? null : e.start_time),
        ends_at: allDay ? (length ? localMidnight(last) : null) : e.end_time ? at(last, e.end_time) : length ? at(last, e.start_time) : null,
        all_day: allDay,
        location: e.location,
        notes: e.notes,
        done: false,
        external: true,
      });
    }
  }
  return out;
}

const OVERLAY_KEY = "batzis-einblenden";

/**
 * The Batzi's dates to show next to one's own, switchable and remembered in this browser.
 * Dates that are already connected with one of the own entries are left out, so nothing shows twice.
 */
export function useBatziOverlay(source: CalendarSource) {
  const batzi = useTable("batzi_events");
  const links = useEventLinks();
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(OVERLAY_KEY) !== "aus";
    } catch {
      return true;
    }
  });
  function toggle(next: boolean) {
    setOn(next);
    try {
      localStorage.setItem(OVERLAY_KEY, next ? "an" : "aus");
    } catch {
      // Not remembered in private mode.
    }
  }
  const hidden = new Set(
    links.rows.flatMap((l) =>
      l.a_kind === "batzis" && l.b_kind === source ? [l.a_id] : l.b_kind === "batzis" && l.a_kind === source ? [l.b_id] : [],
    ),
  );
  const items = on ? batziItems(batzi.rows.filter((e) => !hidden.has(e.id))) : [];
  return { on, toggle, items, available: batzi.rows.length > 0 };
}

export const BATZI_CALENDAR = "/batzis/index.html#/kalender";
