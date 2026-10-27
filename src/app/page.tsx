"use client";

import { AREAS, AreaLink } from "@/components/Shell";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default function Portal() {
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
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/80 text-4xl shadow-soft transition group-hover:-rotate-6 dark:bg-white/10"
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
    </>
  );
}
