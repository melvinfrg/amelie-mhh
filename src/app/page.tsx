"use client";

import { ExamReminder } from "@/components/ExamReminder";
import { AREAS, AreaLink, type LogoKind } from "@/components/Shell";
import { DateTile, Empty, Greeting, Panel } from "@/components/ui";
import { daysUntil, eventCountdown, eventTime, isCurrent } from "@/lib/dates";
import { BATZI_CALENDAR, batziItems } from "@/lib/sharing";
import { useTable } from "@/lib/useTable";

interface Upcoming {
  key: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
  logo: LogoKind;
  where: string;
  href: string;
}

/** The next dates from all three calendars; a date that sits in several of them shows once. */
function useUpcoming(days = 14) {
  const studium = useTable("events");
  const melvin = useTable("melvin_events");
  const batzis = useTable("batzi_events");
  const all: Upcoming[] = [
    ...melvin.rows.filter((e) => !e.done).map((e) => ({ ...e, key: `m${e.id}`, logo: "melvin" as const, where: "Melvin", href: "/melvin/termine" })),
    ...studium.rows.filter((e) => !e.done).map((e) => ({ ...e, key: `s${e.id}`, logo: "amelie" as const, where: "Studium", href: "/termine" })),
    ...batziItems(batzis.rows).map((e) => ({ ...e, key: `b${e.id}`, logo: "gemeinsam" as const, where: "Batzi's", href: BATZI_CALENDAR })),
  ];
  const seen = new Set<string>();
  return all
    .filter((e) => isCurrent(e) && daysUntil(e.starts_at) <= days)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .filter((e) => {
      const id = `${e.title.trim().toLowerCase()}|${e.starts_at}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 6);
}

/** Each calendar's dates take the colour of its area. */
const TILE: Record<LogoKind, string> = {
  melvin: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100",
  amelie: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
  gemeinsam: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
};

export default function Portal() {
  const upcoming = useUpcoming();
  return (
    <>
      <Greeting name="ihr zwei 👋" />

      <ExamReminder className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-3">
        {AREAS.map((a) => (
          <AreaLink
            key={a.href}
            href={a.href}
            className={`group flex items-center gap-4 rounded-[1.75rem] bg-gradient-to-br p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-col sm:items-start sm:p-6 dark:ring-1 dark:ring-white/10 ${a.tone}`}
          >
            <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-2xl shadow-soft transition group-hover:-rotate-6" aria-hidden>
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-semibold">{a.label}</span>
              <span className="block text-sm opacity-70">{a.who}</span>
            </span>
            <span aria-hidden className="text-lg opacity-40 transition group-hover:translate-x-1 group-hover:opacity-80 sm:hidden">
              →
            </span>
          </AreaLink>
        ))}
      </div>

      <Panel title="Die nächsten zwei Wochen" className="mt-8">
        {upcoming.length === 0 ? (
          <Empty>Keine Termine in den nächsten zwei Wochen.</Empty>
        ) : (
          <ul className="space-y-1">
            {upcoming.map((e) => (
              <li key={e.key}>
                <AreaLink href={e.href} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <DateTile iso={e.starts_at} className={TILE[e.logo]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="block text-sm text-stone-500 dark:text-stone-400">
                      {e.where} · {eventTime(e)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-stone-500 dark:text-stone-400">{eventCountdown(e)}</span>
                </AreaLink>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
