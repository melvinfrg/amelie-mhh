"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { FigureEditor, FigureQuestion } from "@/components/Figure";
import { TopicSelect } from "@/components/TopicSelect";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, TextInput } from "@/components/ui";
import { LEVELS, removeImage, syncQuestions, uploadImage } from "@/lib/figures";
import { isMastered, isNew, topicPath } from "@/lib/learning";
import { useTable } from "@/lib/useTable";
import type { Figure, Mask } from "@/lib/types";

export default function AbbildungenPage() {
  return (
    <Suspense>
      <Abbildungen />
    </Suspense>
  );
}

function Abbildungen() {
  const params = useSearchParams();
  const id = params.get("id");
  return id ? <Editor id={id} /> : <Overview />;
}

function Overview() {
  const router = useRouter();
  const topics = useTable("topics");
  const figures = useTable("figures");
  const questions = useTable("questions");
  const [adding, setAdding] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!topicId || !file) return setError("Bitte Thema und Bild wählen.");
    setBusy(true);
    setError(null);
    try {
      const image = await uploadImage(file);
      const figure = await figures.insert({ topic_id: topicId, title: title.trim() || file.name.replace(/\.[^.]+$/, ""), image, masks: [], hide_all: true });
      router.push(`/lernen/abbildungen?id=${figure.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...figures.rows].sort(
    (a, b) => topicPath(topics.rows, a.topic_id).localeCompare(topicPath(topics.rows, b.topic_id)) || a.title.localeCompare(b.title),
  );

  return (
    <>
      <PageHeader
        title="Abbildungen"
        subtitle="Strukturen auf Anatomie-Bildern abdecken und abfragen, von grob nach fein."
        action={<Button onClick={() => setAdding(!adding)}>+ Abbildung</Button>}
      />
      <ErrorNote error={figures.error} />

      {adding && (
        <Card className="mb-6">
          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Thema">
                <TopicSelect topics={topics.rows} value={topicId} onChange={setTopicId} />
              </Field>
              <Field label="Titel">
                <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Schultergelenk von ventral" />
              </Field>
            </div>
            <Field label="Bild (Foto, Screenshot oder Scan)">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm" />
            </Field>
            {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Lädt hoch …" : "Hochladen und Strukturen markieren"}
            </Button>
          </form>
        </Card>
      )}

      {figures.loaded && figures.rows.length === 0 && !adding && (
        <Empty>
          Noch keine Abbildungen. Lade ein Bild hoch, z. B. eine Atlas-Seite oder eine Folie, und decke die Beschriftungen ab.
        </Empty>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((f) => {
          const own = questions.rows.filter((q) => q.figure_id === f.id);
          return (
            <Card key={f.id} className="flex flex-col">
              <p className="text-xs text-slate-500">{topicPath(topics.rows, f.topic_id)}</p>
              <p className="mb-2 font-medium">{f.title}</p>
              <div className="mb-3 overflow-hidden rounded-lg">
                <FigureThumb figure={f} />
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {f.masks.length} Strukturen · {own.filter(isMastered).length} sicher · {own.filter(isNew).length} neu
              </p>
              <div className="mt-auto flex gap-2">
                <Link href={`/lernen/ueben?abbildung=${f.id}`} className="flex-1">
                  <Button className="w-full" disabled={f.masks.length === 0}>
                    Üben
                  </Button>
                </Link>
                <Link href={`/lernen/abbildungen?id=${f.id}`}>
                  <Button variant="secondary">Bearbeiten</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function FigureThumb({ figure }: { figure: Figure }) {
  // Reuse the practice view with nothing asked, so the covered labels show as in a test.
  return <FigureQuestion figure={{ ...figure, hide_all: true }} maskId="" revealed={false} />;
}

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const topics = useTable("topics");
  const figures = useTable("figures");
  const questions = useTable("questions");
  const figure = figures.rows.find((f) => f.id === id);
  const [draft, setDraft] = useState<Figure | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawLevel, setDrawLevel] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Start editing from the stored figure once it has loaded.
  if (figure && draft?.id !== figure.id) setDraft(figure);

  if (!figures.loaded) return <Empty>Lädt …</Empty>;
  if (!figure || !draft) {
    return (
      <Empty>
        Abbildung nicht gefunden. <Link href="/lernen/abbildungen" className="underline">Zur Übersicht</Link>
      </Empty>
    );
  }

  const current = draft.masks.find((m) => m.id === selected);
  const dirty = JSON.stringify(draft) !== JSON.stringify(figure);

  function setMasks(masks: Mask[]) {
    setDraft((d) => d && { ...d, masks });
  }

  function patchMask(patch: Partial<Mask>) {
    setMasks(draft!.masks.map((m) => (m.id === selected ? { ...m, ...patch } : m)));
  }

  async function save() {
    const unnamed = draft!.masks.filter((m) => !m.label.trim());
    if (unnamed.length > 0) {
      setSelected(unnamed[0].id);
      return alert(`${unnamed.length} markierte Struktur(en) haben noch keinen Namen.`);
    }
    setSaving(true);
    try {
      const { topic_id, title, masks, hide_all } = draft!;
      await figures.update(id, { topic_id, title, masks, hide_all });
      await syncQuestions(draft!, questions.rows, questions);
      setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setSaving(false);
    }
  }

  async function removeFigure() {
    if (!confirm(`„${figure!.title}“ mit allen ${figure!.masks.length} Fragen löschen?`)) return;
    for (const q of questions.rows.filter((q) => q.figure_id === id)) await questions.remove(q.id);
    await figures.remove(id);
    await removeImage(figure!.image).catch(() => undefined);
    router.push("/lernen/abbildungen");
  }

  const byLevel = LEVELS.map((l) => ({ ...l, masks: draft.masks.filter((m) => m.level === l.value) }));

  return (
    <>
      <PageHeader
        title={draft.title || "Abbildung"}
        subtitle={topicPath(topics.rows, draft.topic_id)}
        action={
          <div className="flex gap-2">
            <Link href="/lernen/abbildungen">
              <Button variant="ghost">← Übersicht</Button>
            </Link>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Speichert …" : dirty ? "Speichern" : "Gespeichert"}
            </Button>
          </div>
        }
      />
      <ErrorNote error={figures.error ?? questions.error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Neue Markierung als:</span>
            {LEVELS.map((l) => (
              <Button key={l.value} variant={drawLevel === l.value ? "primary" : "secondary"} onClick={() => setDrawLevel(l.value)}>
                {l.value} · {l.label}
              </Button>
            ))}
          </div>
          <FigureEditor
            image={draft.image}
            masks={draft.masks}
            onChange={setMasks}
            selected={selected}
            onSelect={setSelected}
            drawLevel={drawLevel}
          />
          <p className="mt-2 text-xs text-slate-500">
            Rechteck über eine Beschriftung oder Struktur ziehen. Markierungen lassen sich verschieben und an der blauen Ecke vergrößern.
          </p>
        </div>

        <div className="space-y-4">
          {current ? (
            <Card className="space-y-3">
              <Field label="Name der Struktur">
                <TextInput
                  autoFocus
                  value={current.label}
                  onChange={(e) => patchMask({ label: e.target.value })}
                  placeholder="z. B. M. deltoideus"
                />
              </Field>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ebene</p>
                <div className="flex gap-1">
                  {LEVELS.map((l) => (
                    <Button key={l.value} variant={current.level === l.value ? "primary" : "secondary"} onClick={() => patchMask({ level: l.value })}>
                      {l.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button variant="danger" onClick={() => (setMasks(draft.masks.filter((m) => m.id !== current.id)), setSelected(null))}>
                Markierung löschen
              </Button>
            </Card>
          ) : (
            <Card className="text-sm text-slate-500">
              Ziehe auf dem Bild ein Rechteck, um eine Struktur zu markieren. Grobe Strukturen (Ebene 1) werden zuerst abgefragt, feinere erst, wenn
              die gröberen dieser Abbildung gelernt sind.
            </Card>
          )}

          <Card className="space-y-3 text-sm">
            {byLevel.map((l) => (
              <div key={l.value}>
                <p className="font-medium">
                  {l.value} · {l.label} ({l.masks.length})
                </p>
                <ul className="mt-1 space-y-0.5">
                  {l.masks.map((m) => (
                    <li key={m.id}>
                      <button className={`text-left hover:underline ${m.id === selected ? "font-semibold" : ""}`} onClick={() => setSelected(m.id)}>
                        {m.label || <span className="text-rose-600">ohne Namen</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>

          <Card className="space-y-3">
            <Field label="Titel">
              <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Thema">
              <TopicSelect topics={topics.rows} value={draft.topic_id} onChange={(v) => setDraft({ ...draft, topic_id: v })} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.hide_all}
                onChange={(e) => setDraft({ ...draft, hide_all: e.target.checked })}
                className="mt-0.5 accent-teal-700"
              />
              <span>Beim Üben alle Markierungen verdecken, nicht nur die gefragte (empfohlen, wenn auf dem Bild Beschriftungen stehen)</span>
            </label>
            {savedAt && !dirty && <p className="text-xs text-emerald-700 dark:text-emerald-400">Gespeichert um {savedAt}.</p>}
            <Button variant="danger" onClick={removeFigure}>
              Abbildung löschen
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
