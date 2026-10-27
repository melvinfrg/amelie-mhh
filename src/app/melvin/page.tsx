"use client";

import Link from "next/link";
import { DateTile, Empty, Greeting, Panel } from "@/components/ui";
import { countdown, daysUntil, eventCountdown, eventTime, isCurrent } from "@/lib/dates";
import { MELVIN_CATEGORY_LABEL } from "@/lib/labels";
import { balance, CATEGORY_TONE, euro, monthKey } from "@/lib/melvin";
import { useTable } from "@/lib/useTable";

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
    .slice(0, 4);
  const openTodos = todos.rows
    .filter((t) => !t.done)
    .sort((x, y) => (x.due_date ?? "9999").localeCompare(y.due_date ?? "9999") || x.priority - y.priority)
    .slice(0, 5);
  const deadlines = contracts.rows
    .filter((c) => c.cancel_by && daysUntil(c.cancel_by) >= 0 && daysUntil(c.cancel_by) <= 60)
    .sort((x, y) => x.cancel_by!.localeCompare(y.cancel_by!));
  const pinned = notes.rows.filter((n) => n.pinned).slice(0, 3);

  return (
    <>
      <Greeting name="Melvin 👋" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Nächste Termine" href="/melvin/termine">
            {upcoming.length === 0 ? (
              <Empty>Keine anstehenden Termine.</Empty>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <DateTile iso={e.starts_at} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.title}</p>
                      <p className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_TONE[e.category].dot}`} />
                        {MELVIN_CATEGORY_LABEL[e.category]} · {eventTime(e)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-stone-500 dark:text-stone-400">{eventCountdown(e)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="ToDos" href="/melvin/todos">
            {openTodos.length === 0 ? (
              <Empty>Alles erledigt 🎉</Empty>
            ) : (
              <ul className="space-y-2.5">
                {openTodos.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-brand-700"
                      onChange={() => todos.update(t.id, { done: true })}
                      aria-label={`${t.title} erledigt`}
                    />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.due_date && (
                      <span className={`shrink-0 text-sm ${daysUntil(t.due_date) < 0 ? "font-semibold text-rose-600" : "text-stone-500 dark:text-stone-400"}`}>
                        {countdown(t.due_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* On phones the numbers come first, above the lists. */}
        <div className="order-first space-y-5 lg:order-none">
          <Panel title="Diesen Monat" href="/melvin/finanzen">
            <p className={`font-display text-4xl font-semibold tabular-nums ${b.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {euro(b.balance)}
            </p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">bleiben übrig</p>
            <p className="mt-3 text-sm tabular-nums text-stone-500 dark:text-stone-400">
              {euro(b.income)} rein · {euro(b.costs)} raus
            </p>
          </Panel>

          <Panel title="Verträge" href="/melvin/vertraege">
            {deadlines.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {contracts.rows.length ? "Keine Kündigungsfrist in den nächsten 60 Tagen." : "Noch keine Verträge eingetragen."}
              </p>
            ) : (
              <ul className="space-y-2">
                {deadlines.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-400">kündbar {countdown(c.cancel_by!)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {pinned.length > 0 && (
            <Panel title="Angeheftet" href="/melvin/notizen">
              <ul className="space-y-3">
                {pinned.map((n) => (
                  <li key={n.id}>
                    <Link href="/melvin/notizen" className="block rounded-xl bg-brand-50 px-3 py-2.5 text-sm transition hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-950">
                      <span className="block font-semibold">{n.title || "Notiz"}</span>
                      <span className="line-clamp-2 whitespace-pre-wrap text-stone-600 dark:text-stone-300">{n.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
