"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, ProgressBar, Select, TextArea, TextInput } from "@/components/ui";
import { countdown, daysUntil, formatDate, toLocalInput } from "@/lib/dates";
import { download, toIcs } from "@/lib/ical";
import { KIND_LABEL } from "@/lib/labels";
import { SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";
import type { EventKind, StudyEvent } from "@/lib/types";


type Draft = Omit<StudyEvent, "id">;

const emptyDraft = (): Draft => ({
  title: "",
  kind: "pruefung",
  starts_at: new Date(new Date().setHours(9, 0, 0, 0) + 7 * 864e5).toISOString(),
  location: "",
  subject_id: null,
  notes: "",
  progress: 0,
  done: false,
});

export default function TerminePage() {
  const events = useTable("events");
  const subjects = useTable("subjects");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [showPast, setShowPast] = useState(false);

  const sorted = [...events.rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((e) => daysUntil(e.starts_at) >= 0 && !e.done);
  const past = sorted.filter((e) => daysUntil(e.starts_at) < 0 || e.done).reverse();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const draft = { ...editing.draft, location: editing.draft.location || null, notes: editing.draft.notes || null };
    if (editing.id) await events.update(editing.id, draft);
    else await events.insert(draft);
    setEditing(null);
  }

  function row(ev: StudyEvent) {
    const subject = subjects.rows.find((s) => s.id === ev.subject_id);
    const days = daysUntil(ev.starts_at);
    const urgent = days >= 0 && days <= 14 && (ev.kind === "pruefung" || ev.kind === "testat");
    return (
      <Card key={ev.id} className={urgent ? "border-rose-300 dark:border-rose-900" : ""}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium dark:bg-slate-800">{KIND_LABEL[ev.kind]}</span>
              {subject && (
                <span className="flex items-center gap-1">
                  <SubjectDot color={subject.color} /> {subject.name}
                </span>
              )}
            </div>
            <h3 className={`mt-1 font-medium ${ev.done ? "line-through opacity-60" : ""}`}>{ev.title}</h3>
            <p className="text-sm text-slate-500">
              {formatDate(ev.starts_at, true)}
              {ev.location ? ` · ${ev.location}` : ""}
            </p>
            {ev.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{ev.notes}</p>}
          </div>
          <div className="text-right">
            <p className={`text-lg font-semibold ${urgent ? "text-rose-600" : ""}`}>{countdown(ev.starts_at)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">Vorbereitung</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={ev.progress}
            onChange={(e) => events.update(ev.id, { progress: Number(e.target.value) })}
            className="w-40 accent-teal-700"
            aria-label="Vorbereitungsstand"
          />
          <span className="w-10 text-sm tabular-nums">{ev.progress}%</span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" onClick={() => events.update(ev.id, { done: !ev.done })}>
              {ev.done ? "Wieder öffnen" : "Erledigt"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing({ id: ev.id, draft: { ...ev } })}>
              Bearbeiten
            </Button>
            <Button variant="danger" onClick={() => confirm(`„${ev.title}“ löschen?`) && events.remove(ev.id)}>
              Löschen
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Termine"
        subtitle="Prüfungen, Testate und Fristen mit Countdown und Vorbereitungsstand"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => download("studium-termine.ics", toIcs(events.rows), "text/calendar")}>
              Kalender-Export (.ics)
            </Button>
            <Button onClick={() => setEditing({ draft: emptyDraft() })}>+ Termin</Button>
          </div>
        }
      />
      <ErrorNote error={events.error} />

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Titel" className="sm:col-span-2">
              <TextInput
                required
                value={editing.draft.title}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })}
                placeholder="z. B. Anatomie-Testat Bewegungsapparat"
              />
            </Field>
            <Field label="Art">
              <Select
                value={editing.draft.kind}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, kind: e.target.value as EventKind } })}
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Datum & Uhrzeit">
              <TextInput
                type="datetime-local"
                required
                value={toLocalInput(editing.draft.starts_at)}
                onChange={(e) =>
                  e.target.value &&
                  setEditing({ ...editing, draft: { ...editing.draft, starts_at: new Date(e.target.value).toISOString() } })
                }
              />
            </Field>
            <Field label="Fach">
              <Select
                value={editing.draft.subject_id ?? ""}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, subject_id: e.target.value || null } })}
              >
                <option value="">–</option>
                {subjects.rows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ort">
              <TextInput
                value={editing.draft.location ?? ""}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, location: e.target.value } })}
              />
            </Field>
            <Field label="Notizen" className="sm:col-span-2">
              <TextArea
                value={editing.draft.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, notes: e.target.value } })}
              />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {upcoming.length === 0 && events.loaded && <Empty>Keine anstehenden Termine. Leg den ersten an!</Empty>}
        {upcoming.map(row)}
      </div>

      {past.length > 0 && (
        <div className="mt-8">
          <button className="text-sm font-medium text-slate-500" onClick={() => setShowPast(!showPast)}>
            {showPast ? "▾" : "▸"} Vergangen & erledigt ({past.length})
          </button>
          {showPast && <div className="mt-3 space-y-3">{past.map(row)}</div>}
        </div>
      )}
      {upcoming.length > 0 && (
        <p className="mt-6 text-xs text-slate-500">
          Ø Vorbereitung aller anstehenden Termine:{" "}
          {Math.round(upcoming.reduce((s, e) => s + e.progress, 0) / upcoming.length)}%
        </p>
      )}
      {upcoming.length > 0 && (
        <div className="mt-2 max-w-xs">
          <ProgressBar value={upcoming.reduce((s, e) => s + e.progress, 0) / upcoming.length / 100} />
        </div>
      )}
    </>
  );
}
