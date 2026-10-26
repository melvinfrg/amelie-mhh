"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { QuestionImage, Video } from "@/components/Media";
import { Button, Card, Empty, PageHeader, ProgressBar, TextArea } from "@/components/ui";
import { formatInterval } from "@/lib/dates";
import { buildQueue, isNew, mcIsCorrect, previewDue, RATINGS, schedule, topicPath } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { useTable } from "@/lib/useTable";
import type { Grade } from "ts-fsrs";
import type { Question } from "@/lib/types";

export default function UebenPage() {
  return (
    <Suspense>
      <Session />
    </Suspense>
  );
}

/** Answers again within this window are repeated in the same session (learning steps). */
const SAME_SESSION_MS = 20 * 60 * 1000;

function Session() {
  const params = useSearchParams();
  const subjectId = params.get("fach");
  const topicId = params.get("thema");
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const { settings, loaded: settingsLoaded } = useSettings();

  const [queue, setQueue] = useState<string[] | null>(null);
  const [done, setDone] = useState({ count: 0, correct: 0 });
  const ready = topics.loaded && questions.loaded && reviews.loaded && settingsLoaded;

  // Build the queue once per filter, so answering doesn't reshuffle it.
  const filterKey = `${subjectId}|${topicId}`;
  const [builtFor, setBuiltFor] = useState<string | null>(null);
  if (ready && builtFor !== filterKey) {
    setBuiltFor(filterKey);
    setQueue(
      buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings, subjectId, topicId }).map((q) => q.id),
    );
    setDone({ count: 0, correct: 0 });
  }

  const current = queue?.length ? questions.rows.find((q) => q.id === queue[0]) : undefined;
  const scope = topicId
    ? topicPath(topics.rows, topicId)
    : subjectId
      ? subjects.rows.find((s) => s.id === subjectId)?.name
      : "Alle Fächer";

  async function rate(question: Question, rating: Grade, correct: boolean, startedAt: number) {
    const now = new Date();
    const next = schedule(question, rating, settings.desired_retention, now);
    await questions.update(question.id, next);
    await reviews.insert({
      question_id: question.id,
      topic_id: question.topic_id,
      rating,
      correct,
      reviewed_at: now.toISOString(),
      duration_ms: Date.now() - startedAt,
    });
    setDone((d) => ({ count: d.count + 1, correct: d.correct + (correct ? 1 : 0) }));
    setQueue((q) => {
      const rest = (q ?? []).slice(1);
      return new Date(next.due).getTime() - now.getTime() < SAME_SESSION_MS ? [...rest, question.id] : rest;
    });
  }

  return (
    <>
      <PageHeader
        title="Üben"
        subtitle={scope}
        action={
          <Link href="/lernen">
            <Button variant="ghost">← Übersicht</Button>
          </Link>
        }
      />
      {queue && (
        <div className="mb-4 flex items-center gap-3 text-sm text-slate-500">
          <span>{done.count} beantwortet</span>
          {done.count > 0 && <span>· {Math.round((done.correct / done.count) * 100)}% richtig</span>}
          <span className="ml-auto">{queue.length} übrig</span>
        </div>
      )}
      {queue && <ProgressBar value={done.count / Math.max(1, done.count + queue.length)} />}

      <div className="mt-6">
        {!queue && <Empty>Lädt …</Empty>}
        {queue && !current && (
          <Card className="text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 font-medium">Für heute ist hier alles erledigt.</p>
            <p className="mt-1 text-sm text-slate-500">
              {done.count > 0
                ? `${done.count} Fragen beantwortet, ${Math.round((done.correct / done.count) * 100)}% richtig.`
                : "Es sind gerade keine Fragen fällig. Neue Fragen legst du unter „Fragen“ an."}
            </p>
          </Card>
        )}
        {current && (
          <QuestionCard
            key={`${current.id}-${done.count}`}
            question={current}
            path={topicPath(topics.rows, current.topic_id)}
            retention={settings.desired_retention}
            onRate={rate}
          />
        )}
      </div>
    </>
  );
}

function QuestionCard({
  question,
  path,
  retention,
  onRate,
}: {
  question: Question;
  path: string;
  retention: number;
  onRate: (q: Question, rating: Grade, correct: boolean, startedAt: number) => Promise<void>;
}) {
  const [startedAt] = useState(() => Date.now());
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const multi = question.options.filter((o) => o.correct).length > 1;
  const correct = question.type === "mc" ? mcIsCorrect(question, selected) : null;
  const preview = revealed ? previewDue(question, retention) : null;

  function toggle(i: number) {
    if (revealed) return;
    setSelected((s) => (multi ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i]));
  }

  async function choose(rating: Grade) {
    setBusy(true);
    await onRate(question, rating, question.type === "mc" ? Boolean(correct) : rating >= 3, startedAt);
  }

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{path}</span>
        {isNew(question) && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-950 dark:text-sky-200">neu</span>}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
          {question.type === "mc" ? (multi ? "Mehrfachauswahl" : "Einfachauswahl") : "Erklären"}
        </span>
      </div>
      <h2 className="whitespace-pre-wrap text-lg font-medium">{question.prompt}</h2>
      {question.image_url && (
        <div className="mt-4">
          <QuestionImage url={question.image_url} />
        </div>
      )}

      {question.type === "mc" ? (
        <ul className="mt-4 space-y-2">
          {question.options.map((o, i) => {
            const picked = selected.includes(i);
            const tone = revealed
              ? o.correct
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                : picked
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
                  : "border-slate-200 opacity-70 dark:border-slate-800"
              : picked
                ? "border-teal-600 bg-teal-50 dark:bg-teal-950"
                : "border-slate-200 hover:border-slate-400 dark:border-slate-700";
            return (
              <li key={i}>
                <button onClick={() => toggle(i)} className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm ${tone}`}>
                  <span className="font-mono text-slate-400">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1">{o.text}</span>
                  {revealed && o.correct && <span>✓</span>}
                  {revealed && picked && !o.correct && <span>✗</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4">
          <TextArea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Erkläre in eigenen Worten …"
            disabled={revealed}
            aria-label="Deine Antwort"
          />
        </div>
      )}

      {!revealed ? (
        <div className="mt-4">
          <Button onClick={() => setRevealed(true)} disabled={question.type === "mc" && selected.length === 0}>
            {question.type === "mc" ? "Prüfen" : "Lösung zeigen"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {question.type === "mc" ? (
            <p className={`font-medium ${correct ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {correct ? "Richtig!" : "Leider falsch."}
            </p>
          ) : (
            question.answer && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
                <p className="mb-1 font-medium">Musterlösung</p>
                <p className="whitespace-pre-wrap">{question.answer}</p>
              </div>
            )
          )}
          {question.explanation && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="mb-1 font-medium">Erklärung</p>
              <p className="whitespace-pre-wrap">{question.explanation}</p>
            </div>
          )}
          {question.video_url && <Video url={question.video_url} />}
          {question.source && <p className="text-xs text-slate-500">Quelle: {question.source}</p>}

          <div>
            <p className="mb-2 text-sm text-slate-500">
              {question.type === "mc" ? "Wie sicher warst du?" : "Wie gut war deine Antwort?"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  disabled={busy || (question.type === "mc" && !correct && r.value > 1)}
                  onClick={() => choose(r.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-30 ${r.tone}`}
                >
                  {r.label}
                  {preview && <span className="block text-xs font-normal opacity-80">{formatInterval(new Date(), preview[r.value])}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
