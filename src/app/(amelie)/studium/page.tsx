"use client";

import Link from "next/link";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { countdown, daysUntil, eventCountdown, formatEventDate, isCurrent } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { buildQueue, isNew } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { streak } from "@/lib/stats";
import { useTable } from "@/lib/useTable";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default function Home() {
  const events = useTable("events");
  const todos = useTable("todos");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const { settings } = useSettings();

  const upcoming = events.rows
    .filter((e) => !e.done && isCurrent(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);
  const nextExam = upcoming.find((e) => e.kind === "pruefung" || e.kind === "testat");
  const openTodos = todos.rows
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.priority - b.priority)
    .slice(0, 6);
  const queue = buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings });
  const due = queue.filter((q) => !isNew(q)).length;

  return (
    <>
      <PageHeader title={`${greeting()}, Amelie! 👋`} subtitle={new Date().toLocaleDateString("de-DE", { dateStyle: "full" })} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <p className="text-xs uppercase tracking-wide text-stone-500">Nächste Prüfung</p>
          {nextExam ? (
            <>
              <p className="mt-2 text-3xl font-semibold text-brand-800 dark:text-brand-300">{eventCountdown(nextExam)}</p>
              <p className="mt-1 font-medium">{nextExam.title}</p>
              <p className="text-sm text-stone-500">{formatEventDate(nextExam)}</p>
              <p className="mt-2 text-xs text-stone-500">Vorbereitung: {nextExam.progress}%</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-500">Keine Prüfung eingetragen.</p>
          )}
        </Card>

        <Card className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-stone-500">Heute lernen</p>
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{due}</p>
              <p className="text-sm text-stone-500">fällige Wiederholungen</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">{queue.length - due}</p>
              <p className="text-sm text-stone-500">neue Fragen</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">🔥 {streak(reviews.rows)}</p>
              <p className="text-sm text-stone-500">Tage in Folge</p>
            </div>
            <Link href="/lernen/ueben" className="ml-auto">
              <Button disabled={queue.length === 0}>▶ Jetzt üben</Button>
            </Link>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Anstehende Termine</h2>
            <Link href="/termine" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
              Alle →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty>Keine anstehenden Termine.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-stone-500">
                      {KIND_LABEL[e.kind]} · {formatEventDate(e)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">{eventCountdown(e)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">ToDos</h2>
            <Link href="/todos" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
              Alle →
            </Link>
          </div>
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
                  {t.due_date && (
                    <span className={`text-xs ${daysUntil(t.due_date) < 0 ? "text-rose-600" : "text-stone-500"}`}>
                      {countdown(t.due_date)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
