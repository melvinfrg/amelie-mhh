"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, ProgressBar, Select, TextArea, TextInput } from "@/components/ui";
import { Badge, DateFields, EventCard, isSoon, useCalendarView, ViewTabs } from "@/components/events";
import { CalendarExport } from "@/components/CalendarExport";
import { MhhSuggestions } from "@/components/MhhSuggestions";
import { MonthCalendar, TONES } from "@/components/MonthCalendar";
import { isCurrent } from "@/lib/dates";
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
  ends_at: null,
  all_day: false,
});

const VIEW_KEY = "termine-ansicht";

const KIND_TONE = {
  pruefung: TONES.rose,
  testat: TONES.amber,
  frist: TONES.violet,
  veranstaltung: TONES.teal,
  sonstiges: TONES.stone,
} satisfies Record<EventKind, unknown>;


export default function TerminePage() {
  const events = useTable("events");
  const subjects = useTable("subjects");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [view, changeView] = useCalendarView(VIEW_KEY);

  function edit(target: { id?: string; draft: Draft }) {
    setEditing(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sorted = [...events.rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((e) => isCurrent(e) && !e.done);
  const past = sorted.filter((e) => !isCurrent(e) || e.done).reverse();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const draft = {
      ...editing.draft,
      location: editing.draft.location || null,
      notes: editing.draft.notes || null,
    };
    if (editing.id) await events.update(editing.id, draft);
    else await events.insert(draft);
    setEditing(null);
  }

  function row(ev: StudyEvent) {
    const subject = subjects.rows.find((s) => s.id === ev.subject_id);
    const urgent = isSoon(ev.starts_at) && (ev.kind === "pruefung" || ev.kind === "testat");
    return (
      <EventCard
        key={ev.id}
        event={ev}
        urgent={urgent}
        badge={<Badge className={KIND_TONE[ev.kind].chip}>{KIND_LABEL[ev.kind]}</Badge>}
        meta={
          subject && (
            <span className="flex items-center gap-1">
              <SubjectDot color={subject.color} /> {subject.name}
            </span>
          )
        }
      >
        <span className="text-xs text-stone-500">Vorbereitung</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={ev.progress}
          onChange={(e) => events.update(ev.id, { progress: Number(e.target.value) })}
          className="w-40 accent-brand-700"
          aria-label="Vorbereitungsstand"
        />
        <span className="w-10 text-sm tabular-nums">{ev.progress}%</span>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={() => events.update(ev.id, { done: !ev.done })}>
            {ev.done ? "Wieder öffnen" : "Erledigt"}
          </Button>
          <Button variant="ghost" onClick={() => edit({ id: ev.id, draft: { ...ev } })}>
            Bearbeiten
          </Button>
          <Button variant="danger" onClick={() => confirm(`„${ev.title}“ löschen?`) && events.remove(ev.id)}>
            Löschen
          </Button>
        </div>
      </EventCard>
    );
  }

  return (
    <>
      <PageHeader
        title="Termine"
        subtitle="Prüfungen, Testate und Fristen mit Countdown und Vorbereitungsstand"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowExport(!showExport)}>
              Exportieren / Abo
            </Button>
            <Button onClick={() => setEditing({ draft: emptyDraft() })}>+ Termin</Button>
          </div>
        }
      />
      <ErrorNote error={events.error} />
      {showExport && (
        <div className="mb-6">
          <CalendarExport />
        </div>
      )}
      <MhhSuggestions />

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Titel" className="sm:col-span-2">
              <TextInput
                required
                value={editing.draft.title}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, title: e.target.value },
                  })
                }
                placeholder="z. B. Anatomie-Testat Bewegungsapparat"
              />
            </Field>
            <Field label="Art">
              <Select
                value={editing.draft.kind}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: {
                      ...editing.draft,
                      kind: e.target.value as EventKind,
                    },
                  })
                }
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <DateFields
              draft={editing.draft}
              onChange={(patch) =>
                setEditing({
                  ...editing,
                  draft: { ...editing.draft, ...patch },
                })
              }
            />
            <Field label="Fach">
              <Select
                value={editing.draft.subject_id ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: {
                      ...editing.draft,
                      subject_id: e.target.value || null,
                    },
                  })
                }
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
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, location: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Notizen" className="sm:col-span-2">
              <TextArea
                value={editing.draft.notes ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, notes: e.target.value },
                  })
                }
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

      <ViewTabs view={view} onChange={changeView} />

      {view === "kalender" ? (
        <MonthCalendar
          events={events.rows}
          tone={(ev) => KIND_TONE[ev.kind]}
          label={(ev) => KIND_LABEL[ev.kind]}
          legend={(Object.keys(KIND_LABEL) as EventKind[]).map((k) => ({ label: KIND_LABEL[k], tone: KIND_TONE[k] }))}
          details={(ev) => {
            const subject = subjects.rows.find((s) => s.id === ev.subject_id);
            return subject && (
              <>
                <SubjectDot color={subject.color} /> {subject.name}
              </>
            );
          }}
          onEdit={(ev) => edit({ id: ev.id, draft: { ...ev } })}
          onNew={(day) => {
            const [y, m, d] = day.split("-").map(Number);
            edit({
              draft: {
                ...emptyDraft(),
                starts_at: new Date(y, m - 1, d, 9).toISOString(),
              },
            });
          }}
        />
      ) : (
        <>
          <div className="space-y-3">
            {upcoming.length === 0 && events.loaded && <Empty>Keine anstehenden Termine. Leg den ersten an!</Empty>}
            {upcoming.map(row)}
          </div>

          {past.length > 0 && (
            <div className="mt-8">
              <button className="text-sm font-medium text-stone-500" onClick={() => setShowPast(!showPast)}>
                {showPast ? "▾" : "▸"} Vergangen & erledigt ({past.length})
              </button>
              {showPast && <div className="mt-3 space-y-3">{past.map(row)}</div>}
            </div>
          )}
        </>
      )}
      {upcoming.length > 0 && (
        <p className="mt-6 text-xs text-stone-500">
          Ø Vorbereitung aller anstehenden Termine: {Math.round(upcoming.reduce((s, e) => s + e.progress, 0) / upcoming.length)}%
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
