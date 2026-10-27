"use client";

import Link from "next/link";
import { Button, DateTile, Empty, Greeting, Panel, ProgressBar } from "@/components/ui";
import { countdown, daysUntil, eventCountdown, eventTime, formatEventDate, isCurrent } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { buildQueue, isNew } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { streak } from "@/lib/stats";
import { useTable } from "@/lib/useTable";

export default function Home() {
  const events = useTable("events");
  const todos = useTable("todos");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const { settings } = useSettings();

  const current = events.rows
    .filter((e) => !e.done && isCurrent(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = current.slice(0, 4);
  const nextExam = current.find((e) => e.kind === "pruefung" || e.kind === "testat");
  const openTodos = todos.rows
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.priority - b.priority)
    .slice(0, 5);
  const queue = buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings });
  const due = queue.filter((q) => !isNew(q)).length;
  const days = streak(reviews.rows);

  return (
    <>
      <Greeting name="Amelie 👋" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Anstehende Termine" href="/termine">
            {upcoming.length === 0 ? (
              <Empty>Keine anstehenden Termine.</Empty>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <DateTile iso={e.starts_at} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.title}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {KIND_LABEL[e.kind]} · {eventTime(e)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-stone-500 dark:text-stone-400">{eventCountdown(e)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="ToDos" href="/todos">
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
          <Panel title="Heute lernen" href="/lernen" more="Lernen">
            <p className="font-display text-4xl font-semibold tabular-nums">{queue.length}</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {queue.length === 1 ? "Frage" : "Fragen"} · {due} wiederholen, {queue.length - due} neu
            </p>
            {days > 0 && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">🔥 {days} {days === 1 ? "Tag" : "Tage"} in Folge</p>}
            <Link href="/lernen/ueben" className="mt-4 block">
              <Button className="w-full" disabled={queue.length === 0}>
                ▶ Jetzt üben
              </Button>
            </Link>
          </Panel>

          <Panel title="Nächste Prüfung" href="/termine">
            {nextExam ? (
              <>
                <p className="font-display text-3xl font-semibold text-brand-800 dark:text-brand-300">{eventCountdown(nextExam)}</p>
                <p className="mt-1 font-semibold">{nextExam.title}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{formatEventDate(nextExam)}</p>
                <div className="mt-4 flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
                  <ProgressBar value={nextExam.progress / 100} />
                  <span className="shrink-0 tabular-nums">{nextExam.progress}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500 dark:text-stone-400">Keine Prüfung eingetragen.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
