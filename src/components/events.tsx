"use client";

import { useState, type ReactNode } from "react";
import { Card, Field, TextInput } from "@/components/ui";
import { dayKey, daysUntil, eventCountdown, formatEventDate, localMidnight, toLocalInput } from "@/lib/dates";

/** Building blocks shared by every "Termine" page, so Melvin's and Amelie's look the same. */

interface Timing {
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
}

/** Start and optional end; all-day events pick days, others a date and time. */
export function DateFields<T extends Timing>({ draft, onChange }: { draft: T; onChange: (patch: Partial<T>) => void }) {
  const allDay = Boolean(draft.all_day);
  const setAllDay = (on: boolean) =>
    onChange({
      all_day: on,
      starts_at: on ? localMidnight(dayKey(draft.starts_at)) : new Date(new Date(draft.starts_at).setHours(9, 0, 0, 0)).toISOString(),
      ends_at: draft.ends_at ? (on ? localMidnight(dayKey(draft.ends_at)) : null) : null,
    } as Partial<T>);
  return (
    <>
      <Field label={allDay ? "Erster Tag" : "Beginn"}>
        <DateInput
          type={allDay ? "date" : "datetime-local"}
          required
          value={allDay ? dayKey(draft.starts_at) : toLocalInput(draft.starts_at)}
          onCommit={(value) => {
            if (!value) return;
            const starts_at = allDay ? localMidnight(value) : new Date(value).toISOString();
            // Moving the start keeps an end that would now lie before it from staying behind.
            const ends_at = draft.ends_at && new Date(draft.ends_at) < new Date(starts_at) ? null : draft.ends_at;
            onChange({ starts_at, ends_at } as Partial<T>);
          }}
        />
      </Field>
      <Field label={allDay ? "Letzter Tag (optional)" : "Ende (optional)"}>
        <DateInput
          type={allDay ? "date" : "datetime-local"}
          min={allDay ? dayKey(draft.starts_at) : toLocalInput(draft.starts_at)}
          value={draft.ends_at ? (allDay ? dayKey(draft.ends_at) : toLocalInput(draft.ends_at)) : ""}
          onCommit={(value) =>
            onChange({
              ends_at: value ? (allDay ? localMidnight(value) : new Date(value).toISOString()) : null,
            } as Partial<T>)
          }
        />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        Ganztägig (z. B. Urlaub, Geburtstag, Frist)
      </label>
    </>
  );
}

/** A complete date ("YYYY-MM-DD", optionally with time) in a sensible year range. */
function plausible(value: string) {
  const year = Number(value.slice(0, 4));
  return /^\d{4}-\d{2}-\d{2}/.test(value) && year >= 1900 && year <= 2200 && !Number.isNaN(new Date(value).getTime());
}

/**
 * A date or date-time field you can type into freely. While the year is still being typed the browser already
 * reports dates like "0002-11-05"; handing those on and writing them back used to break the field
 * ("ungültiger Wert"). The field keeps its own text and only passes on complete, plausible dates.
 */
function DateInput({
  type,
  value,
  onCommit,
  min,
  required,
}: {
  type: "date" | "datetime-local";
  value: string;
  onCommit: (value: string) => void;
  min?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // A new value from outside (e.g. "Ganztägig" switched, another Termin opened) replaces what is in the field.
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  return (
    <TextInput
      type={type}
      required={required}
      min={min}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next === "" ? !required : plausible(next)) {
          setShown(next);
          onCommit(next);
        }
      }}
      onBlur={() => {
        // Leaving a half-typed date brings back the last valid one.
        if (text !== shown && !(text === "" && !required)) setText(shown);
      }}
    />
  );
}

export type CalendarView = "liste" | "kalender";

/** List or month view, remembered per page in this browser. */
export function useCalendarView(key: string) {
  const [view, setView] = useState<CalendarView>(() => {
    try {
      return localStorage.getItem(key) === "kalender" ? "kalender" : "liste";
    } catch {
      return "liste";
    }
  });
  function change(next: CalendarView) {
    setView(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered in private mode.
    }
  }
  return [view, change] as const;
}

export function ViewTabs({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div className="mb-4 inline-flex rounded-xl border border-stone-200 bg-white/60 p-0.5 text-sm dark:border-stone-800 dark:bg-stone-900/60" role="tablist">
      {(["liste", "kalender"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 font-semibold ${view === v ? "bg-brand-700 text-white" : "text-stone-600 dark:text-stone-300"}`}
        >
          {v === "liste" ? "☰ Liste" : "📅 Kalender"}
        </button>
      ))}
    </div>
  );
}

/** One event in a list: kind badge, title, date and place on the left, the countdown on the right, actions below. */
export function EventCard({
  event,
  badge,
  meta,
  urgent = false,
  children,
}: {
  event: Timing & { title: string; location?: string | null; notes?: string | null; done?: boolean };
  badge: ReactNode;
  meta?: ReactNode;
  urgent?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className={urgent ? "border-rose-300 dark:border-rose-900" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {badge}
            {meta}
          </div>
          <h3 className={`mt-1 font-semibold ${event.done ? "line-through opacity-60" : ""}`}>{event.title}</h3>
          <p className="text-sm text-stone-500">
            {formatEventDate(event)}
            {event.location ? ` · 📍 ${event.location}` : ""}
          </p>
          {event.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{event.notes}</p>}
        </div>
        <p className={`shrink-0 whitespace-nowrap text-right font-display text-lg font-semibold ${urgent ? "text-rose-600" : ""}`}>{eventCountdown(event)}</p>
      </div>
      {children && <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>}
    </Card>
  );
}

/** Small coloured label, e.g. the kind of an event. */
export function Badge({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${className}`}>{children}</span>;
}

/** Days until an event starts, for highlighting the next two weeks. */
export function isSoon(starts_at: string, days = 14) {
  const d = daysUntil(starts_at);
  return d >= 0 && d <= days;
}
