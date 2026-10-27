"use client";

import { AREAS, AreaLink, Logo, type LogoKind } from "@/components/Shell";
import { Card } from "@/components/ui";
import { daysUntil, eventCountdown, formatEventDate, isCurrent } from "@/lib/dates";
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
    .slice(0, 8);
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default function Portal() {
  const upcoming = useUpcoming();
  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-semibold capitalize text-brand-700 dark:text-brand-300">
          {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting()}, ihr zwei 👋</h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400">Wohin soll es gehen?</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {AREAS.map((a) => (
          <section
            key={a.href}
            className={`group relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-soft ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg dark:ring-white/10 ${a.tone}`}
          >
            <AreaLink href={a.href} className="flex items-start gap-4">
              <span
                className="block h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-soft transition group-hover:-rotate-6"
                aria-hidden
              >
                {a.icon}
              </span>
              <span className="min-w-0 pt-1">
                <span className="block font-display text-xl font-semibold">{a.label}</span>
                <span className="block text-sm opacity-75">{a.who}</span>
              </span>
            </AreaLink>
            <div className="mt-5 flex flex-wrap gap-2">
              {a.links.map((l) => (
                <AreaLink
                  key={l.href}
                  href={l.href}
                  className="rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
                >
                  {l.label}
                </AreaLink>
              ))}
            </div>
            <AreaLink href={a.href} className="mt-auto pt-5 text-sm font-semibold opacity-80 group-hover:opacity-100">
              Öffnen →
            </AreaLink>
          </section>
        ))}
      </div>

      {upcoming.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">📅 Die nächsten zwei Wochen</h2>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {upcoming.map((e) => (
              <li key={e.key}>
                <AreaLink href={e.href} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-xl" title={e.where} aria-hidden>
                    <Logo of={e.logo} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="block text-xs text-stone-500">
                      {e.where} · {formatEventDate(e)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{eventCountdown(e)}</span>
                </AreaLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
