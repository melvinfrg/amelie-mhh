"use client";

import { AREAS, AreaLink } from "@/components/Shell";
import { PageHeader } from "@/components/ui";

export default function Portal() {
  return (
    <>
      <PageHeader title="Willkommen 👋" subtitle="Ein Login, drei Bereiche" />
      <div className="grid gap-4 sm:grid-cols-3">
        {AREAS.map((a) => (
          <AreaLink
            key={a.href}
            href={a.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="text-4xl" aria-hidden>
              {a.icon}
            </span>
            <p className="mt-3 text-lg font-semibold">{a.label}</p>
            <p className="text-sm text-slate-500">{a.who}</p>
          </AreaLink>
        ))}
      </div>
    </>
  );
}
