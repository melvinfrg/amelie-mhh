"use client";

import Link from "next/link";
import { useState } from "react";
import { TopicSelect } from "@/components/TopicSelect";
import { Button, Card, Field, PageHeader, TextArea, TextInput } from "@/components/ui";
import type { GenerateRequest, GenerateSource, GeneratedQuestion } from "@/lib/generate";
import { MAX_PDF_BYTES } from "@/lib/generate";
import { topicPath } from "@/lib/learning";
import { extractPages, pageCount } from "@/lib/pdf";
import { hasSupabase, supabase } from "@/lib/supabase";
import { useTable } from "@/lib/useTable";

type SourceKind = GenerateSource["kind"];

const SOURCE_LABEL: Record<SourceKind, string> = { pdf: "PDF / Folien", text: "Text einfügen", url: "Link" };

interface Draft extends GeneratedQuestion {
  key: number;
  editing: boolean;
}

export default function GenerierenPage() {
  const topics = useTable("topics");
  const questions = useTable("questions");
  const [topicId, setTopicId] = useState("");
  const [kind, setKind] = useState<SourceKind>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [range, setRange] = useState({ from: 1, to: 1 });
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState({ mc: true, explain: true });
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [saved, setSaved] = useState(0);

  async function chooseFile(next: File | null) {
    setFile(next);
    setError(null);
    if (!next) return;
    try {
      const n = await pageCount(next);
      setPages(n);
      setRange({ from: 1, to: Math.min(n, 30) });
    } catch {
      setError("Die PDF-Datei konnte nicht gelesen werden.");
      setFile(null);
    }
  }

  async function buildSource(): Promise<GenerateSource | null> {
    if (kind === "pdf") {
      if (!file) return setError("Bitte eine PDF-Datei wählen."), null;
      const from = Math.max(1, Math.min(range.from, pages));
      const to = Math.max(from, Math.min(range.to, pages));
      const { base64, size } = await extractPages(file, from, to);
      if (size > MAX_PDF_BYTES) {
        setError(`Die Seiten ${from}–${to} sind zu groß (${(size / 1e6).toFixed(1)} MB, max. 3 MB). Bitte weniger Seiten wählen.`);
        return null;
      }
      setSourceLabel(`${file.name}, S. ${from}–${to}`);
      return { kind: "pdf", name: file.name, data: base64 };
    }
    if (kind === "url") {
      if (!/^https?:\/\//.test(url)) return setError("Bitte einen Link mit https:// eingeben."), null;
      setSourceLabel(url);
      return { kind: "url", url };
    }
    if (text.trim().length < 50) return setError("Bitte etwas mehr Text einfügen."), null;
    setSourceLabel("eingefügter Text");
    return { kind: "text", text };
  }

  async function generate() {
    setError(null);
    setSaved(0);
    if (!topicId) return setError("Bitte zuerst ein Thema wählen.");
    const selectedTypes = (Object.keys(types) as ("mc" | "explain")[]).filter((t) => types[t]);
    if (selectedTypes.length === 0) return setError("Bitte mindestens einen Fragetyp wählen.");
    setBusy(true);
    try {
      const source = await buildSource();
      if (!source) return;
      const body: GenerateRequest = {
        source,
        topic: topicPath(topics.rows, topicId),
        count,
        types: selectedTypes,
        focus: focus.trim() || undefined,
      };
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (hasSupabase) {
        const { data } = await supabase().auth.getSession();
        if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({ error: `Serverfehler ${response.status}` }));
      if (!response.ok) return setError(result.error ?? `Fehler ${response.status}`);
      setDrafts((result.questions as GeneratedQuestion[]).map((q, i) => ({ ...q, key: Date.now() + i, editing: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function accept(draft: Draft) {
    await questions.insert({
      topic_id: topicId,
      type: draft.type,
      prompt: draft.prompt,
      options: draft.type === "mc" ? draft.options.filter((o) => o.text.trim()) : [],
      answer: draft.type === "explain" ? draft.answer || null : null,
      explanation: draft.explanation || null,
      image_url: null,
      video_url: null,
      source: `KI · ${sourceLabel}${draft.location ? ` · ${draft.location}` : ""}`,
      suspended: false,
      card: null,
      due: null,
    });
    setDrafts((ds) => ds.filter((d) => d.key !== draft.key));
    setSaved((n) => n + 1);
  }

  function update(key: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  return (
    <>
      <PageHeader
        title="Fragen generieren"
        subtitle="Die KI erstellt Fragen aus deinem Material. Du prüfst sie, bevor sie in die Lernplattform kommen."
      />

      <Card className="mb-6 space-y-4">
        <Field label="In welches Thema sollen die Fragen?">
          <TopicSelect topics={topics.rows} value={topicId} onChange={setTopicId} />
        </Field>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Material</p>
          <div className="mb-3 flex gap-1">
            {(Object.keys(SOURCE_LABEL) as SourceKind[]).map((k) => (
              <Button key={k} type="button" variant={kind === k ? "primary" : "secondary"} onClick={() => setKind(k)}>
                {SOURCE_LABEL[k]}
              </Button>
            ))}
          </div>
          {kind === "pdf" && (
            <div className="space-y-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                className="block text-sm"
                aria-label="PDF-Datei"
              />
              {file && pages > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{pages} Seiten. Verwenden: Seite</span>
                  <TextInput
                    type="number"
                    min={1}
                    max={pages}
                    value={range.from}
                    onChange={(e) => setRange({ ...range, from: Number(e.target.value) })}
                    className="w-20"
                    aria-label="Von Seite"
                  />
                  <span>bis</span>
                  <TextInput
                    type="number"
                    min={1}
                    max={pages}
                    value={range.to}
                    onChange={(e) => setRange({ ...range, to: Number(e.target.value) })}
                    className="w-20"
                    aria-label="Bis Seite"
                  />
                </div>
              )}
              <p className="text-xs text-slate-500">Die KI sieht auch Abbildungen auf den Folien. Pro Durchgang höchstens etwa 3 MB.</p>
            </div>
          )}
          {kind === "text" && (
            <TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Skript, Mitschrift oder Lehrbuchabschnitt einfügen …" />
          )}
          {kind === "url" && (
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Anzahl Fragen: ${count}`}>
            <input type="range" min={3} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-teal-700" />
          </Field>
          <div className="text-sm">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">Fragetypen</p>
            <label className="mr-4 inline-flex items-center gap-1.5">
              <input type="checkbox" checked={types.mc} onChange={(e) => setTypes({ ...types, mc: e.target.checked })} className="accent-teal-700" />
              Multiple Choice
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={types.explain}
                onChange={(e) => setTypes({ ...types, explain: e.target.checked })}
                className="accent-teal-700"
              />
              Erklären
            </label>
          </div>
          <Field label="Schwerpunkt (optional)">
            <TextInput value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="z. B. nur Innervation" />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
        <Button onClick={generate} disabled={busy}>
          {busy ? "KI arbeitet … (bis zu 2 Minuten)" : "✨ Fragen generieren"}
        </Button>
      </Card>

      {saved > 0 && (
        <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">
          {saved} Fragen übernommen. <Link href="/lernen/ueben" className="underline">Jetzt üben</Link>
        </p>
      )}

      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{drafts.length} Vorschläge prüfen</h2>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDrafts([])}>
                Alle verwerfen
              </Button>
              <Button
                onClick={async () => {
                  for (const d of drafts) await accept(d);
                }}
              >
                Alle übernehmen
              </Button>
            </div>
          </div>
          {drafts.map((d) => (
            <Card key={d.key}>
              <p className="mb-1 text-xs text-slate-500">
                {d.type === "mc" ? "Multiple Choice" : "Erklären"}
                {d.location && ` · ${d.location}`}
              </p>
              {d.editing ? (
                <div className="space-y-2">
                  <TextArea value={d.prompt} onChange={(e) => update(d.key, { prompt: e.target.value })} aria-label="Frage" />
                  {d.type === "mc" &&
                    d.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={o.correct}
                          className="h-5 w-5 accent-emerald-600"
                          aria-label={`Antwort ${i + 1} richtig`}
                          onChange={() => update(d.key, { options: d.options.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)) })}
                        />
                        <TextInput
                          value={o.text}
                          onChange={(e) => update(d.key, { options: d.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                        />
                      </div>
                    ))}
                  {d.type === "explain" && (
                    <TextArea value={d.answer} onChange={(e) => update(d.key, { answer: e.target.value })} aria-label="Musterlösung" />
                  )}
                  <TextArea value={d.explanation} onChange={(e) => update(d.key, { explanation: e.target.value })} aria-label="Erklärung" />
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap font-medium">{d.prompt}</p>
                  {d.type === "mc" ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {d.options.map((o, i) => (
                        <li key={i} className={o.correct ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}>
                          {o.correct ? "✓" : "–"} {o.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-2 text-sm dark:bg-emerald-950">{d.answer}</p>
                  )}
                  {d.explanation && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{d.explanation}</p>}
                </>
              )}
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="danger" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>
                  Verwerfen
                </Button>
                <Button variant="ghost" onClick={() => update(d.key, { editing: !d.editing })}>
                  {d.editing ? "Fertig" : "Bearbeiten"}
                </Button>
                <Button onClick={() => accept(d)}>Übernehmen</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
