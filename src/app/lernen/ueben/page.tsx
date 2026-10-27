"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FigureQuestion } from "@/components/Figure";
import { QuestionImage, Video } from "@/components/Media";
import { Button, Card, Empty, PageHeader, ProgressBar, TextArea, TextInput } from "@/components/ui";
import { formatInterval } from "@/lib/dates";
import { checkAnswer } from "@/lib/figures";
import { canDictate, keywords, mentioned, speak, stopSpeaking, useDictation } from "@/lib/speech";
import { buildQueue, isNew, mcIsCorrect, previewDue, RATINGS, schedule, topicPath } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { useTable } from "@/lib/useTable";
import type { Grade } from "ts-fsrs";
import type { Figure, Question } from "@/lib/types";

export default function UebenPage() {
  return (
    <Suspense>
      <Session />
    </Suspense>
  );
}

const READ_ALOUD_KEY = "amelie-mhh:pref:vorlesen";

// Per-device preferences; storage may be unavailable (private mode), then the default applies.
function readPreference(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePreference(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // Not persisted; the toggle still works for this visit.
  }
}

/** Answers again within this window are repeated in the same session (learning steps). */
const SAME_SESSION_MS = 20 * 60 * 1000;

function Session() {
  const params = useSearchParams();
  const subjectId = params.get("fach");
  const topicId = params.get("thema");
  const figureId = params.get("abbildung");
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const figures = useTable("figures");
  const { settings, loaded: settingsLoaded } = useSettings();

  const [queue, setQueue] = useState<string[] | null>(null);
  const [readAloud, setReadAloud] = useState(() => readPreference(READ_ALOUD_KEY));

  function toggleReadAloud(on: boolean) {
    setReadAloud(on);
    writePreference(READ_ALOUD_KEY, on);
    if (!on) stopSpeaking();
  }
  const [done, setDone] = useState({ count: 0, correct: 0 });
  const ready = topics.loaded && questions.loaded && reviews.loaded && figures.loaded && settingsLoaded;

  // Build the queue once per filter, so answering doesn't reshuffle it.
  const filterKey = `${subjectId}|${topicId}|${figureId}`;
  const [builtFor, setBuiltFor] = useState<string | null>(null);
  const freshQueue = () =>
    buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings, subjectId, topicId, figureId }).map(
      (q) => q.id,
    );
  if (ready && builtFor !== filterKey) {
    setBuiltFor(filterKey);
    setQueue(freshQueue());
    setDone({ count: 0, correct: 0 });
  }

  const current = queue?.length ? questions.rows.find((q) => q.id === queue[0]) : undefined;
  // Finishing coarse structures can open finer ones of the same figure.
  const unlocked = queue && !current ? freshQueue() : [];
  const figureFilter = figures.rows.find((f) => f.id === figureId);
  const scope = figureFilter
    ? `${topicPath(topics.rows, figureFilter.topic_id)} › ${figureFilter.title}`
    : topicId
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
          <div className="flex gap-2">
            <Button
              variant={readAloud ? "primary" : "secondary"}
              onClick={() => toggleReadAloud(!readAloud)}
              title="Fragen beim Erscheinen vorlesen, wie in der mündlichen Prüfung"
            >
              {readAloud ? "🔊 Vorlesen an" : "🔇 Vorlesen aus"}
            </Button>
            <Link href="/lernen">
              <Button variant="ghost">← Übersicht</Button>
            </Link>
          </div>
        }
      />
      {queue && (
        <div className="mb-4 flex items-center gap-3 text-sm text-stone-500">
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
            <p className="mt-1 text-sm text-stone-500">
              {done.count > 0
                ? `${done.count} Fragen beantwortet, ${Math.round((done.correct / done.count) * 100)}% richtig.`
                : "Es sind gerade keine Fragen fällig. Neue Fragen legst du unter „Fragen“ an."}
            </p>
            {unlocked.length > 0 && (
              <Button className="mt-4" onClick={() => setQueue(unlocked)}>
                Weiter mit {unlocked.length === 1 ? "einer freigeschalteten Frage" : `${unlocked.length} freigeschalteten Fragen`}
              </Button>
            )}
          </Card>
        )}
        {current && (
          <QuestionCard
            key={`${current.id}-${done.count}`}
            question={current}
            figure={current.figure_id ? figures.rows.find((f) => f.id === current.figure_id) : undefined}
            path={topicPath(topics.rows, current.topic_id)}
            retention={settings.desired_retention}
            readAloud={readAloud}
            onRate={rate}
          />
        )}
      </div>
    </>
  );
}

function QuestionCard({
  question,
  figure,
  path,
  retention,
  readAloud,
  onRate,
}: {
  question: Question;
  figure?: Figure;
  path: string;
  retention: number;
  readAloud: boolean;
  onRate: (q: Question, rating: Grade, correct: boolean, startedAt: number) => Promise<void>;
}) {
  const [startedAt] = useState(() => Date.now());
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const multi = question.options.filter((o) => o.correct).length > 1;
  const correct = question.type === "mc" ? mcIsCorrect(question, selected) : null;
  const typed = question.type === "occlusion" && revealed && text.trim() ? checkAnswer(text, question.answer ?? "") : null;
  const preview = revealed ? previewDue(question, retention) : null;

  useEffect(() => {
    if (!readAloud) return;
    const options = question.type === "mc" ? question.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o.text}.`).join(" ") : "";
    speak(`${question.prompt} ${options}`);
    return stopSpeaking;
  }, [question, readAloud]);

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
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span>{path}</span>
        {isNew(question) && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-950 dark:text-sky-200">neu</span>}
        <span className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">
          {question.type === "mc" ? (multi ? "Mehrfachauswahl" : "Einfachauswahl") : question.type === "occlusion" ? "Abbildung" : "Erklären"}
        </span>
      </div>
      <h2 className="whitespace-pre-wrap text-lg font-medium">{question.prompt}</h2>
      {question.image_url && (
        <div className="mt-4">
          <QuestionImage url={question.image_url} />
        </div>
      )}

      {question.type === "occlusion" ? (
        <div className="mt-4 space-y-3">
          {figure ? (
            <FigureQuestion figure={figure} maskId={question.mask_id ?? ""} revealed={revealed} />
          ) : (
            <p className="text-sm text-rose-700">Die Abbildung zu dieser Frage fehlt.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setRevealed(true);
            }}
          >
            <TextInput
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Name der Struktur (optional eintippen)"
              disabled={revealed}
              aria-label="Deine Antwort"
              autoComplete="off"
            />
          </form>
        </div>
      ) : question.type === "mc" ? (
        <ul className="mt-4 space-y-2">
          {question.options.map((o, i) => {
            const picked = selected.includes(i);
            const tone = revealed
              ? o.correct
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                : picked
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
                  : "border-stone-200 opacity-70 dark:border-stone-800"
              : picked
                ? "border-brand-600 bg-brand-50 dark:bg-brand-950"
                : "border-stone-200 hover:border-stone-400 dark:border-stone-700";
            return (
              <li key={i}>
                <button onClick={() => toggle(i)} className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm ${tone}`}>
                  <span className="font-mono text-stone-400">{String.fromCharCode(65 + i)}</span>
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
            placeholder={canDictate() ? "Erkläre in eigenen Worten, getippt oder gesprochen …" : "Erkläre in eigenen Worten …"}
            disabled={revealed}
            aria-label="Deine Antwort"
          />
          {!revealed && <Dictation onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />}
        </div>
      )}

      {!revealed ? (
        <div className="mt-4">
          <Button onClick={() => setRevealed(true)} disabled={question.type === "mc" && selected.length === 0}>
            {question.type === "mc" ? "Prüfen" : question.type === "occlusion" ? "Aufdecken" : "Lösung zeigen"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {question.type === "occlusion" ? (
            <p className="font-medium">
              {question.answer}
              {typed && (
                <span
                  className={`ml-2 text-sm ${
                    typed === "right" ? "text-emerald-700 dark:text-emerald-400" : typed === "close" ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {typed === "right" ? "✓ richtig" : typed === "close" ? "fast, schau auf die Schreibweise" : `✗ du hattest „${text.trim()}“`}
                </span>
              )}
            </p>
          ) : question.type === "mc" ? (
            <p className={`font-medium ${correct ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {correct ? "Richtig!" : "Leider falsch."}
            </p>
          ) : (
            question.answer && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
                <p className="mb-1 font-medium">Musterlösung</p>
                <p className="whitespace-pre-wrap">{question.answer}</p>
                {text.trim() && <KeywordCheck answer={question.answer} text={text} />}
              </div>
            )
          )}
          {question.explanation && (
            <div className="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800">
              <p className="mb-1 font-medium">Erklärung</p>
              <p className="whitespace-pre-wrap">{question.explanation}</p>
            </div>
          )}
          {question.video_url && <Video url={question.video_url} />}
          {question.source && <p className="text-xs text-stone-500">Quelle: {question.source}</p>}

          <div>
            <p className="mb-2 text-sm text-stone-500">
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

function Dictation({ onText }: { onText: (text: string) => void }) {
  const { listening, interim, error, start, stop } = useDictation(onText);
  if (!canDictate()) return null;
  return (
    <div className="mt-2 space-y-1">
      <Button type="button" variant={listening ? "danger" : "secondary"} onClick={listening ? stop : start}>
        {listening ? "⏹ Aufnahme beenden" : "🎤 Antwort sprechen"}
      </Button>
      {listening && <p className="text-sm text-stone-500">{interim ? `… ${interim}` : "Ich höre zu …"}</p>}
      {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
    </div>
  );
}

/** Shows which terms of the model answer came up, as a quick aid for rating yourself. */
function KeywordCheck({ answer, text }: { answer: string; text: string }) {
  const terms = keywords(answer);
  if (terms.length === 0) return null;
  const hits = terms.filter((t) => mentioned(t, text));
  return (
    <div className="mt-3 border-t border-emerald-200 pt-2 dark:border-emerald-900">
      <p className="mb-1 text-xs text-stone-600 dark:text-stone-300">
        Du hast {hits.length} von {terms.length} Stichworten genannt:
      </p>
      <div className="flex flex-wrap gap-1">
        {terms.map((t) => (
          <span
            key={t}
            className={`rounded px-1.5 py-0.5 text-xs ${
              hits.includes(t) ? "bg-emerald-600 text-white" : "bg-white text-stone-500 ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
