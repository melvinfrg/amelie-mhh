"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Empty } from "@/components/ui";
import { countdown, daysUntil, eventCountdown, formatEventDate, isCurrent } from "@/lib/dates";
import { MELVIN_CATEGORY_LABEL } from "@/lib/labels";
import { balance, CATEGORY_TONE, euro, monthKey } from "@/lib/melvin";
import { useTable } from "@/lib/useTable";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

function Section({ title, href, children, className = "" }: { title: string; href: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Alle →
        </Link>
      </div>
      {children}
    </Card>
  );
}

export default function MelvinHome() {
  const events = useTable("melvin_events");
  const todos = useTable("melvin_todos");
  const entries = useTable("finance_entries");
  const contracts = useTable("contracts");
  const notes = useTable("notes");

  const month = monthKey(new Date());
  const b = balance(entries.rows, contracts.rows, month);
  const upcoming = events.rows
    .filter((e) => !e.done && isCurrent(e))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at))
    .slice(0, 5);
  const openTodos = todos.rows
    .filter((t) => !t.done)
    .sort((x, y) => (x.due_date ?? "9999").localeCompare(y.due_date ?? "9999") || x.priority - y.priority)
    .slice(0, 6);
  const deadlines = contracts.rows
    .filter((c) => c.cancel_by && daysUntil(c.cancel_by) >= 0 && daysUntil(c.cancel_by) <= 60)
    .sort((x, y) => x.cancel_by!.localeCompare(y.cancel_by!));
  const pinned = notes.rows.filter((n) => n.pinned).slice(0, 3);

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">{new Date().toLocaleDateString("de-DE", { dateStyle: "full" })}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting()}, Melvin! 👋</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Section title="💶 Diesen Monat" href="/melvin/finanzen">
          <p className={`font-display text-3xl font-semibold tabular-nums ${b.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {euro(b.balance)}
          </p>
          <p className="text-sm text-stone-500">bleiben übrig</p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Einnahmen</span>
              <span className="tabular-nums">{euro(b.income)}</span>
            </p>
            <p className="flex justify-between">
              <span>Ausgaben</span>
              <span className="tabular-nums">− {euro(b.costs)}</span>
            </p>
          </div>
        </Section>

        <Section title="📅 Nächste Termine" href="/melvin/termine" className="md:col-span-2">
          {upcoming.length === 0 ? (
            <Empty>Keine anstehenden Termine.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_TONE[e.category].dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="text-xs text-stone-500">
                      {MELVIN_CATEGORY_LABEL[e.category]} · {formatEventDate(e)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold">{eventCountdown(e)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="✅ ToDos" href="/melvin/todos" className="md:col-span-2">
          {openTodos.length === 0 ? (
            <Empty>Alles erledigt 🎉</Empty>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {openTodos.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-700"
                    onChange={() => todos.update(t.id, { done: true })}
                    aria-label={`${t.title} erledigt`}
                  />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.category && <span className="text-xs text-stone-500">{t.category}</span>}
                  {t.due_date && (
                    <span className={`text-xs ${daysUntil(t.due_date) < 0 ? "text-rose-600" : "text-stone-500"}`}>{countdown(t.due_date)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="📑 Verträge" href="/melvin/vertraege">
          {deadlines.length === 0 ? (
            <p className="py-2 text-sm text-stone-500">
              {contracts.rows.length ? `${contracts.rows.length} Verträge, keine Kündigungsfrist in den nächsten 60 Tagen.` : "Noch keine Verträge eingetragen."}
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {deadlines.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 font-semibold text-amber-700 dark:text-amber-400">kündbar {countdown(c.cancel_by!)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {pinned.length > 0 && (
          <Section title="📌 Angeheftet" href="/melvin/notizen" className="md:col-span-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {pinned.map((n) => (
                <div key={n.id} className="rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-950/50">
                  <p className="font-semibold">{n.title || "Notiz"}</p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-stone-600 dark:text-stone-300">{n.body}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
