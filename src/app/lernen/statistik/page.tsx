"use client";

import { Card, Empty, PageHeader, ProgressBar } from "@/components/ui";
import { dayKey } from "@/lib/dates";
import { buildQueue, descendants, isMastered, isNew, topicPath } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { accuracy, lastDays, streak } from "@/lib/stats";
import { SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";

function pct(value: number | null) {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

export default function StatistikPage() {
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const { settings } = useSettings();

  const today = dayKey(new Date());
  const todayReviews = reviews.rows.filter((r) => dayKey(r.reviewed_at) === today);
  const days = lastDays(30);
  const recent = reviews.rows.filter((r) => dayKey(r.reviewed_at) >= days[0]);
  const perDay = days.map((d) => {
    const rs = recent.filter((r) => dayKey(r.reviewed_at) === d);
    return { day: d, total: rs.length, correct: rs.filter((r) => r.correct).length };
  });
  const maxPerDay = Math.max(1, ...perDay.map((d) => d.total));
  const queue = buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings });

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    return {
      key,
      label: i === 0 ? "Heute*" : d.toLocaleDateString("de-DE", { weekday: "short" }),
      count: questions.rows.filter((q) => !q.suspended && !isNew(q) && q.due && (i === 0 ? dayKey(q.due) <= key : dayKey(q.due) === key)).length,
    };
  });
  const maxForecast = Math.max(1, ...forecast.map((f) => f.count));

  const topicStats = topics.rows
    .map((t) => {
      const rs = reviews.rows.filter((r) => r.topic_id === t.id);
      return { topic: t, reviews: rs.length, accuracy: accuracy(rs) };
    })
    .filter((t) => t.reviews >= 3)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 5);

  const kpis = [
    { label: "Heute wiederholt", value: String(todayReviews.length) },
    { label: "Jetzt fällig", value: String(queue.length) },
    { label: "Lernserie", value: streak(reviews.rows) === 1 ? "1 Tag" : `${streak(reviews.rows)} Tage` },
    { label: "Trefferquote (30 T)", value: pct(accuracy(recent)) },
    { label: "Fragen sicher", value: `${questions.rows.filter(isMastered).length} / ${questions.rows.length}` },
  ];

  return (
    <>
      <PageHeader title="Statistik" subtitle="Dein Lernfortschritt im Überblick" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-medium">Wiederholungen der letzten 30 Tage</h2>
          <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Wiederholungen pro Tag">
            {perDay.map((d) => (
              <div
                key={d.day}
                className="flex flex-1 flex-col justify-end"
                style={{ height: "100%" }}
                title={`${new Date(d.day).toLocaleDateString("de-DE")}: ${d.total} Wiederholungen, ${d.correct} richtig`}
              >
                <div className="w-full rounded-t-sm bg-rose-300 dark:bg-rose-800" style={{ height: `${((d.total - d.correct) / maxPerDay) * 100}%` }} />
                <div className="w-full bg-teal-600" style={{ height: `${(d.correct / maxPerDay) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>vor 30 Tagen</span>
            <span className="flex gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-teal-600" /> richtig
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-rose-300 dark:bg-rose-800" /> falsch
              </span>
            </span>
            <span>heute</span>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Vorschau: fällige Fragen</h2>
          <ul className="space-y-1.5 text-sm">
            {forecast.map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="w-12 text-slate-500">{f.label}</span>
                <div className="flex-1">
                  <ProgressBar value={f.count / maxForecast} />
                </div>
                <span className="w-8 text-right tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">* inklusive Fragen, die im Lauf des Tages wieder fällig werden</p>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Nach Fach</h2>
        {subjects.rows.length === 0 && <Empty>Noch keine Fächer.</Empty>}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...subjects.rows]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => {
              const ids = new Set(topics.rows.filter((t) => t.subject_id === s.id).flatMap((t) => descendants(topics.rows, t.id)));
              const qs = questions.rows.filter((q) => ids.has(q.topic_id) && !q.suspended);
              const rs = reviews.rows.filter((r) => ids.has(r.topic_id));
              const mastered = qs.length ? qs.filter(isMastered).length / qs.length : 0;
              return (
                <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2 text-sm sm:grid-cols-[12rem_1fr_6rem_6rem]">
                  <span className="flex items-center gap-2 font-medium">
                    <SubjectDot color={s.color} /> {s.name}
                  </span>
                  <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <ProgressBar value={mastered} color="bg-emerald-600" />
                  </div>
                  <span className="text-slate-500 sm:text-right">{qs.length} Fragen</span>
                  <span className="text-right tabular-nums">{pct(accuracy(rs))} richtig</span>
                </div>
              );
            })}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Schwächste Themen</h2>
        {topicStats.length === 0 ? (
          <Empty>Sobald du ein Thema mindestens dreimal geübt hast, erscheint es hier.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {topicStats.map((t) => (
              <li key={t.topic.id} className="flex items-center justify-between gap-3">
                <span>{topicPath(topics.rows, t.topic.id)}</span>
                <span className="tabular-nums text-rose-600">
                  {pct(t.accuracy)} bei {t.reviews} Antworten
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
