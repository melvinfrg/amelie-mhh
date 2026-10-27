"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { dayKey, formatEventDate } from "@/lib/dates";

export interface Tone {
  chip: string;
  bar: string;
  dot: string;
}

/** Colour sets for calendar entries; multi-day bars are thin lines on phones and labelled bands from the sm breakpoint on. */
export const TONES = {
  rose: {
    chip: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
    bar: "bg-rose-400 sm:bg-rose-100 sm:text-rose-900 sm:dark:bg-rose-950 sm:dark:text-rose-100",
    dot: "bg-rose-500",
  },
  amber: {
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
    bar: "bg-amber-400 sm:bg-amber-100 sm:text-amber-900 sm:dark:bg-amber-950 sm:dark:text-amber-100",
    dot: "bg-amber-500",
  },
  violet: {
    chip: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
    bar: "bg-violet-400 sm:bg-violet-100 sm:text-violet-900 sm:dark:bg-violet-950 sm:dark:text-violet-100",
    dot: "bg-violet-500",
  },
  teal: {
    chip: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
    bar: "bg-teal-400 sm:bg-teal-100 sm:text-teal-900 sm:dark:bg-teal-950 sm:dark:text-teal-100",
    dot: "bg-teal-500",
  },
  indigo: {
    chip: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100",
    bar: "bg-indigo-400 sm:bg-indigo-100 sm:text-indigo-900 sm:dark:bg-indigo-950 sm:dark:text-indigo-100",
    dot: "bg-indigo-500",
  },
  sky: {
    chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
    bar: "bg-sky-400 sm:bg-sky-100 sm:text-sky-900 sm:dark:bg-sky-950 sm:dark:text-sky-100",
    dot: "bg-sky-500",
  },
  emerald: {
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    bar: "bg-emerald-400 sm:bg-emerald-100 sm:text-emerald-900 sm:dark:bg-emerald-950 sm:dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  orange: {
    chip: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
    bar: "bg-orange-400 sm:bg-orange-100 sm:text-orange-900 sm:dark:bg-orange-950 sm:dark:text-orange-100",
    dot: "bg-orange-500",
  },
  stone: {
    chip: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100",
    bar: "bg-stone-400 sm:bg-stone-100 sm:text-stone-900 sm:dark:bg-stone-950 sm:dark:text-stone-100",
    dot: "bg-stone-500",
  },
} satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

/** What the calendar needs from an entry; the Studium, Melvin and the Batzi's each map their own rows onto it. */
export interface CalendarItem {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
  done?: boolean;
  location?: string | null;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function firstDay(e: CalendarItem) {
  return dayKey(e.starts_at);
}

function lastDay(e: CalendarItem) {
  return dayKey(e.ends_at ?? e.starts_at);
}

/** Events that last several days (a quintile, a block of oral exams) are drawn as bars, the rest as entries. */
function isSpan(e: CalendarItem) {
  return lastDay(e) > firstDay(e);
}

function time(e: CalendarItem) {
  return e.all_day
    ? ""
    : new Date(e.starts_at).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function MonthCalendar<T extends CalendarItem>({
  events,
  tone,
  label,
  legend,
  details,
  onEdit,
  onNew,
}: {
  events: T[];
  /** Colour of an entry, e.g. by its kind. */
  tone: (e: T) => Tone;
  /** Short kind shown before the date in the day list. */
  label: (e: T) => string;
  legend: { label: string; tone: Tone }[];
  /** Extra line under an entry in the day list, e.g. its subject. */
  details?: (e: T) => ReactNode;
  onEdit: (e: T) => void;
  onNew: (day: string) => void;
}) {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  // Six weeks starting on the Monday on or before the 1st.
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const weeks = days[35].getMonth() === month.getMonth() ? 6 : 5;

  const sorted = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const on = (day: string) => sorted.filter((e) => firstDay(e) <= day && day <= lastDay(e));
  const spans = sorted.filter(isSpan);

  function shift(months: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));
  }

  const selectedEvents = on(selected);

  return (
    <Card className="p-2 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 px-2 pt-2 sm:px-0 sm:pt-0">
        <h2 className="text-lg font-semibold capitalize">
          {month.toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => shift(-1)} aria-label="Voriger Monat">
            ‹
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const d = new Date();
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(today);
            }}
          >
            Heute
          </Button>
          <Button variant="ghost" onClick={() => shift(1)} aria-label="Nächster Monat">
            ›
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-stone-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-stone-200 dark:border-stone-800">
        {days.slice(0, weeks * 7).map((d, i) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const daySpans = spans.filter((e) => firstDay(e) <= key && key <= lastDay(e));
          const entries = on(key).filter((e) => !isSpan(e));
          const weekStart = i % 7 === 0;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              onDoubleClick={() => onNew(key)}
              className={`flex min-h-16 flex-col border-b border-r border-stone-200 p-0.5 text-left align-top transition sm:min-h-24 sm:p-1 dark:border-stone-800 ${
                inMonth ? "" : "bg-stone-50 text-stone-400 dark:bg-stone-900/60"
              } ${selected === key ? "ring-2 ring-inset ring-brand-600" : "hover:bg-stone-50 dark:hover:bg-stone-800/50"}`}
              aria-label={`${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}, ${on(key).length} Termine`}
            >
              <span
                className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs sm:self-start ${
                  key === today ? "bg-brand-700 font-semibold text-white" : ""
                }`}
              >
                {d.getDate()}
              </span>
              <span className="flex w-full flex-col gap-0.5">
                {daySpans.map((e) => {
                  const showTitle = key === firstDay(e) || weekStart;
                  return (
                    <span
                      key={e.id}
                      title={e.title}
                      className={`block h-1.5 w-full sm:h-auto sm:truncate sm:px-1 sm:text-[11px] sm:leading-4 ${tone(e).bar} ${
                        e.done ? "opacity-40" : ""
                      } ${key === firstDay(e) ? "rounded-l" : ""} ${key === lastDay(e) ? "rounded-r" : ""}`}
                    >
                      <span className={`hidden sm:inline ${showTitle ? "" : "invisible"}`}>{e.title}</span>
                    </span>
                  );
                })}
                {/* On phones only dots fit; the list below the calendar shows the titles. */}
                {entries.length > 0 && (
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {entries.map((e) => (
                      <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${tone(e).dot} ${e.done ? "opacity-40" : ""}`} />
                    ))}
                  </span>
                )}
                {entries.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    title={e.title}
                    className={`hidden truncate rounded px-1 text-[11px] leading-4 sm:block ${tone(e).chip} ${e.done ? "line-through opacity-50" : ""}`}
                  >
                    {time(e) && <span className="mr-1 tabular-nums">{time(e)}</span>}
                    {e.title}
                  </span>
                ))}
                {entries.length > 3 && <span className="hidden px-1 text-[11px] text-stone-500 sm:block">+{entries.length - 3} weitere</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-stone-500 sm:px-0">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${l.tone.dot}`} /> {l.label}
          </span>
        ))}
      </div>

      <div className="mt-4 border-t border-stone-200 px-2 pt-3 sm:px-0 dark:border-stone-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-medium">
            {new Date(`${selected}T12:00:00`).toLocaleDateString("de-DE", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>
          <Button variant="secondary" onClick={() => onNew(selected)}>
            + Termin
          </Button>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-stone-500">Nichts eingetragen.</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => {
              const extra = details?.(e);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onEdit(e)}
                    className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  >
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone(e).dot}`} />
                    <span className="min-w-0">
                      <span className={`block font-medium ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</span>
                      <span className="block text-sm text-stone-500">
                        {label(e)} · {formatEventDate(e)}
                        {e.location ? ` · ${e.location}` : ""}
                      </span>
                      {extra && <span className="flex items-center gap-1 text-xs text-stone-500">{extra}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
