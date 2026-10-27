"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Field, PageHeader, Select } from "@/components/ui";
import { ankiText, importCards, readApkg, type AnkiPackage } from "@/lib/anki";
import { download } from "@/lib/ical";
import { DEFAULT_SUBJECTS } from "@/lib/subjects";
import { insertRows, useTable } from "@/lib/useTable";

const NEW = "new:";

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function AnkiPage() {
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const [pkg, setPkg] = useState<(AnkiPackage & { fileName: string }) | null>(null);
  const [subject, setSubject] = useState("");
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportSubject, setExportSubject] = useState("");

  const known = new Set(questions.rows.map((q) => q.source));
  const fresh = pkg?.cards.filter((c) => !known.has(c.key)) ?? [];
  const decks = [...fresh.reduce((m, c) => m.set(c.deck.join(" › ") || "(ohne Stapel)", (m.get(c.deck.join(" › ") || "(ohne Stapel)") ?? 0) + 1), new Map<string, number>())];
  const withImages = new Set(fresh.map((c) => c.image).filter(Boolean)).size;
  const rootDeck = pkg?.cards[0]?.deck[0] ?? "";

  const subjectOptions = [
    ...subjects.rows.map((s) => ({ value: s.id, label: s.name })),
    ...[...DEFAULT_SUBJECTS.map((d) => d.name), rootDeck]
      .filter((name, i, all) => name && all.indexOf(name) === i && !subjects.rows.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      .map((name) => ({ value: NEW + name, label: `${name} (neu)` })),
  ].sort((a, b) => a.label.localeCompare(b.label));

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setPkg(null);
    setBusy("Stapel wird gelesen …");
    try {
      const read = await readApkg(file);
      setPkg({ ...read, fileName: file.name });
      // Preselect the subject that matches the deck's top level, e.g. "Anatomie".
      const root = read.cards[0]?.deck[0]?.toLowerCase();
      const match = subjects.rows.find((s) => s.name.toLowerCase() === root);
      setSubject(match ? match.id : root ? NEW + read.cards[0].deck[0] : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (!pkg || !subject) return;
    setError(null);
    setBusy("Import läuft …");
    try {
      let subjectId = subject;
      let subjectName = subjects.rows.find((s) => s.id === subject)?.name ?? "";
      if (subject.startsWith(NEW)) {
        subjectName = subject.slice(NEW.length);
        const color = DEFAULT_SUBJECTS.find((d) => d.name === subjectName)?.color ?? "#64748b";
        const [created] = await insertRows("subjects", [{ name: subjectName, color }]);
        subjectId = created.id;
        setSubject(created.id);
      }
      const { imported, duplicates } = await importCards(pkg, fresh, { subjectId, subjectName, images, onProgress: setBusy });
      setResult(
        `${count(imported, "Frage", "Fragen")} importiert${duplicates ? `, ${count(duplicates, "war", "waren")} schon da` : ""}. Sie stehen unter ${subjectName} und kommen beim Üben als neue Karten.`,
      );
      setPkg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function runExport() {
    const topicIds = new Set(topics.rows.filter((t) => !exportSubject || t.subject_id === exportSubject).map((t) => t.id));
    const { text, count: n } = ankiText(
      questions.rows.filter((q) => topicIds.has(q.topic_id)),
      topics.rows,
      subjects.rows,
    );
    const name = subjects.rows.find((s) => s.id === exportSubject)?.name ?? "alle";
    download(`anki-${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}.txt`, text, "text/plain;charset=utf-8");
    setResult(`${count(n, "Frage", "Fragen")} für Anki exportiert.`);
  }

  const exportable = questions.rows.filter((q) => q.type !== "occlusion").length;

  return (
    <>
      <PageHeader title="Anki" subtitle="Stapel aus Anki übernehmen oder eigene Fragen nach Anki mitnehmen" />
      <ErrorNote error={error} />
      {result && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{result}</p>
      )}

      <Card className="mb-4 space-y-4">
        <h2 className="font-medium">Anki-Stapel importieren</h2>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-stone-300 px-4 py-4 text-sm hover:border-brand-600 hover:bg-brand-50 dark:border-stone-700 dark:hover:bg-brand-950">
          <span className="text-3xl">🃏</span>
          <span>
            <span className="block font-medium">{pkg ? pkg.fileName : ".apkg-Datei wählen"}</span>
            <span className="text-stone-500">
              In Anki: Stapel → Exportieren → „Anki Deck Package (.apkg)“. Alles wird hier im Browser gelesen.
            </span>
          </span>
          <input type="file" accept=".apkg,.colpkg" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </label>

        {pkg && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{count(fresh.length, "neue Frage", "neue Fragen")}</strong>
              {pkg.cards.length > fresh.length && <span className="text-stone-500"> ({pkg.cards.length - fresh.length} schon importiert)</span>}
              {pkg.skipped.occlusion > 0 && (
                <span className="text-stone-500">
                  {" "}
                  · {count(pkg.skipped.occlusion, "Bildverdeckungs-Karte", "Bildverdeckungs-Karten")} übersprungen (dafür die Seite Abbildungen nutzen)
                </span>
              )}
              {pkg.skipped.empty > 0 && <span className="text-stone-500"> · {pkg.skipped.empty} ohne Rückseite übersprungen</span>}
            </p>
            {decks.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800/50">
                {decks.map(([deck, n]) => (
                  <li key={deck} className="flex justify-between gap-3">
                    <span className="truncate">{deck}</span>
                    <span className="tabular-nums text-stone-500">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            {fresh.slice(0, 3).map((c) => (
              <div key={c.key} className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800">
                <p className="whitespace-pre-wrap font-medium">{c.prompt}</p>
                <p className="mt-1 whitespace-pre-wrap text-stone-600 dark:text-stone-300">→ {c.answer}</p>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="In welches Fach?">
                <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Fach wählen …</option>
                  {subjectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {withImages > 0 && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
                  {count(withImages, "Bild", "Bilder")} mit übernehmen
                </label>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Die Unterstapel werden zu Themen. Karten kommen als Erklär-Fragen und starten neu; der Lernstand aus Anki wird nicht übernommen.
              Lückentexte werden zu einer Frage pro Lücke.
            </p>
            <Button onClick={runImport} disabled={!subject || !fresh.length || Boolean(busy)}>
              {count(fresh.length, "Frage", "Fragen")} importieren
            </Button>
          </div>
        )}
        {busy && <p className="text-sm text-stone-500">{busy}</p>}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium">Für Anki exportieren</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Fach" className="w-full sm:w-64">
            <Select value={exportSubject} onChange={(e) => setExportSubject(e.target.value)}>
              <option value="">Alle Fächer</option>
              {subjects.rows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={runExport} disabled={!exportable}>
            Textdatei für Anki herunterladen
          </Button>
        </div>
        <p className="text-xs text-stone-500">
          In Anki: Datei → Importieren → die Datei wählen, als Notiztyp „Einfach“ (Basic) lassen und importieren. Die Stapel „Studium MHH::Fach::Thema“ legt
          Anki selbst an. Abbildungsfragen bleiben hier, weil Anki die Markierungen nicht kennt.
        </p>
      </Card>
    </>
  );
}
