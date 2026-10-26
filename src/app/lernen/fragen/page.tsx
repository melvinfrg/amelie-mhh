"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { QuestionImage } from "@/components/Media";
import { TopicSelect } from "@/components/TopicSelect";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { deleteQuestions } from "@/lib/cascade";
import { formatDate } from "@/lib/dates";
import { descendants, isNew, topicPath } from "@/lib/learning";
import { IMPORT_EXAMPLE, parseQuestions } from "@/lib/textImport";
import { useTable } from "@/lib/useTable";
import type { Question, QuestionType } from "@/lib/types";

export default function FragenPage() {
  return (
    <Suspense>
      <Fragen />
    </Suspense>
  );
}

const TYPE_LABEL: Record<QuestionType, string> = { mc: "Multiple Choice", explain: "Erklären", occlusion: "Abbildung" };

type Draft = Omit<Question, "id" | "card" | "due" | "suspended">;

const emptyDraft = (topic_id: string): Draft => ({
  topic_id,
  type: "mc",
  prompt: "",
  options: [
    { text: "", correct: true },
    { text: "", correct: false },
    { text: "", correct: false },
    { text: "", correct: false },
  ],
  answer: "",
  explanation: "",
  image_url: "",
  video_url: "",
  source: "",
});

function Fragen() {
  const params = useSearchParams();
  const topics = useTable("topics");
  const questions = useTable("questions");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topicFilter, setTopicFilter] = useState(params.get("thema") ?? "");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importTopic, setImportTopic] = useState("");

  const allowed = topicFilter ? new Set(descendants(topics.rows, topicFilter)) : null;
  const visible = questions.rows
    .filter((q) => !allowed || allowed.has(q.topic_id))
    .filter((q) => !search || `${q.prompt} ${q.explanation ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const parsed = importing ? parseQuestions(importText) : [];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const d = editing.draft;
    const row = {
      ...d,
      options: d.type === "mc" ? d.options.filter((o) => o.text.trim()) : [],
      answer: d.answer || null,
      explanation: d.explanation || null,
      image_url: d.image_url || null,
      video_url: d.video_url || null,
      source: d.source || null,
    };
    if (row.type === "mc" && !row.options.some((o) => o.correct)) return alert("Mindestens eine Antwort muss richtig sein.");
    if (editing.id) await questions.update(editing.id, row);
    else await questions.insert({ ...row, suspended: false, card: null, due: null });
    setEditing(null);
  }

  async function runImport() {
    if (!importTopic) return alert("Bitte ein Thema wählen.");
    for (const q of parsed) {
      await questions.insert({ ...q, topic_id: importTopic, image_url: null, suspended: false, card: null, due: null });
    }
    setImportText("");
    setImporting(false);
  }

  async function removeSelected() {
    const ids = visible.filter((q) => selected.has(q.id)).map((q) => q.id);
    if (!confirm(`${ids.length} ${ids.length === 1 ? "Frage" : "Fragen"} mit Lernfortschritt endgültig löschen?`)) return;
    await deleteQuestions(ids);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setDraft(patch: Partial<Draft>) {
    if (editing) setEditing({ ...editing, draft: { ...editing.draft, ...patch } });
  }

  return (
    <>
      <PageHeader
        title="Fragen"
        subtitle={`${questions.rows.length} Fragen insgesamt`}
        action={
          <div className="flex gap-2">
            <Link href="/lernen/generieren">
              <Button variant="secondary">✨ Mit KI generieren</Button>
            </Link>
            <Button variant="secondary" onClick={() => setImporting(!importing)}>
              Text-Import
            </Button>
            <Button onClick={() => setEditing({ draft: emptyDraft(topicFilter) })}>+ Frage</Button>
          </div>
        }
      />
      <ErrorNote error={questions.error} />
      {importing && (
        <Card className="mb-6 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Mehrere Fragen auf einmal einfügen, getrennt durch eine Leerzeile. <code>F:</code> Frage, <code>+</code> richtige und{" "}
            <code>-</code> falsche Antwort, <code>A:</code> Musterlösung, <code>E:</code> Erklärung, <code>V:</code> Video, <code>Q:</code> Quelle.
          </p>
          <TextArea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={IMPORT_EXAMPLE} className="font-mono" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-96">
              <TopicSelect topics={topics.rows} value={importTopic} onChange={setImportTopic} creatable />
            </div>
            <Button onClick={runImport} disabled={parsed.length === 0}>
              {parsed.length} Fragen importieren
            </Button>
            <Button variant="ghost" onClick={() => setImportText(IMPORT_EXAMPLE)}>
              Beispiel einfügen
            </Button>
          </div>
        </Card>
      )}

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Thema">
                <TopicSelect topics={topics.rows} value={editing.draft.topic_id} onChange={(v) => setDraft({ topic_id: v })} creatable />
              </Field>
              <Field label="Fragetyp">
                <Select value={editing.draft.type} onChange={(e) => setDraft({ type: e.target.value as QuestionType })}>
                  <option value="mc">Multiple Choice</option>
                  <option value="explain">Erklär-Aufgabe</option>
                </Select>
              </Field>
            </div>
            <Field label="Frage">
              <TextArea required value={editing.draft.prompt} onChange={(e) => setDraft({ prompt: e.target.value })} />
            </Field>
            {editing.draft.type === "mc" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Antworten (Haken = richtig, mehrere möglich)</p>
                {editing.draft.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.correct}
                      className="h-5 w-5 accent-emerald-600"
                      aria-label={`Antwort ${i + 1} richtig`}
                      onChange={() => setDraft({ options: editing.draft.options.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)) })}
                    />
                    <TextInput
                      value={o.text}
                      placeholder={`Antwort ${String.fromCharCode(65 + i)}`}
                      onChange={(e) => setDraft({ options: editing.draft.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                    />
                    <Button type="button" variant="ghost" onClick={() => setDraft({ options: editing.draft.options.filter((_, j) => j !== i) })}>
                      ✕
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={() => setDraft({ options: [...editing.draft.options, { text: "", correct: false }] })}>
                  + Antwort
                </Button>
              </div>
            ) : (
              <Field label="Musterlösung">
                <TextArea rows={4} value={editing.draft.answer ?? ""} onChange={(e) => setDraft({ answer: e.target.value })} />
              </Field>
            )}
            <Field label="Erklärung (wird nach dem Beantworten gezeigt)">
              <TextArea value={editing.draft.explanation ?? ""} onChange={(e) => setDraft({ explanation: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bild-URL (optional)">
                <TextInput value={editing.draft.image_url ?? ""} onChange={(e) => setDraft({ image_url: e.target.value })} placeholder="https://…" />
              </Field>
              <Field label="Video (YouTube, Vimeo, …)">
                <TextInput value={editing.draft.video_url ?? ""} onChange={(e) => setDraft({ video_url: e.target.value })} placeholder="https://youtu.be/…" />
              </Field>
              <Field label="Quelle">
                <TextInput value={editing.draft.source ?? ""} onChange={(e) => setDraft({ source: e.target.value })} placeholder="z. B. Vorlesung 3, Folie 12" />
              </Field>
            </div>
            {editing.draft.image_url && <QuestionImage url={editing.draft.image_url} />}
            <div className="flex gap-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-64">
          <TopicSelect topics={topics.rows} value={topicFilter} onChange={setTopicFilter} allowAll />
        </div>
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen …" className="max-w-xs" aria-label="Fragen durchsuchen" />
      </div>

      {visible.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={visible.every((q) => selected.has(q.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((q) => q.id)) : new Set())}
              className="h-5 w-5 accent-teal-700"
            />
            Alle {visible.length} angezeigten auswählen
          </label>
          {visible.some((q) => selected.has(q.id)) && (
            <Button variant="danger" onClick={removeSelected}>
              {visible.filter((q) => selected.has(q.id)).length} ausgewählte löschen
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 && questions.loaded && <Empty>Keine Fragen gefunden.</Empty>}
        {visible.map((q) => (
          <Card key={q.id} className={q.suspended ? "opacity-60" : ""}>
            <div className="flex flex-wrap items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(q.id)}
                onChange={() => toggle(q.id)}
                className="mt-1 h-5 w-5 accent-teal-700"
                aria-label="Frage auswählen"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">
                  {topicPath(topics.rows, q.topic_id)} · {TYPE_LABEL[q.type]}
                  {q.suspended && " · pausiert"}
                </p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap">{q.type === "occlusion" ? `${q.prompt} → ${q.answer}` : q.prompt}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {isNew(q)
                    ? "Neu, noch nicht gelernt"
                    : `${q.card?.reps ?? 0}× wiederholt · ${q.card?.lapses ?? 0}× vergessen · nächste Wiederholung ${formatDate(q.due!)}`}
                </p>
              </div>
              <div className="flex gap-1">
                {q.type === "occlusion" ? (
                  <Link href={`/lernen/abbildungen?id=${q.figure_id}`}>
                    <Button variant="ghost">Bearbeiten</Button>
                  </Link>
                ) : (
                  <Button variant="ghost" onClick={() => setEditing({ id: q.id, draft: { ...q } })}>
                    Bearbeiten
                  </Button>
                )}
                <Button variant="ghost" onClick={() => questions.update(q.id, { suspended: !q.suspended })}>
                  {q.suspended ? "Aktivieren" : "Pausieren"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isNew(q)}
                  onClick={() => confirm("Lernfortschritt dieser Frage zurücksetzen?") && questions.update(q.id, { card: null, due: null })}
                >
                  Zurücksetzen
                </Button>
                <Button variant="danger" onClick={() => confirm("Frage löschen?") && deleteQuestions([q.id])}>
                  Löschen
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
