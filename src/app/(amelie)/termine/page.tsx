"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, ProgressBar, Select, TextArea, TextInput } from "@/components/ui";
import { Badge, DateFields, EventCard, isSoon, useCalendarView, ViewTabs } from "@/components/events";
import { CalendarExport } from "@/components/CalendarExport";
import { MhhSuggestions } from "@/components/MhhSuggestions";
import { BatziToggle, LinkedNote, ShareEvent } from "@/components/ShareEvent";
import { MonthCalendar, TONES } from "@/components/MonthCalendar";
import { isCurrent } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { eventSubjectIds, eventSubjects, SubjectDot } from "@/lib/subjects";
import { BATZI_CALENDAR, useBatziOverlay } from "@/lib/sharing";
import { useTable } from "@/lib/useTable";
import type { EventKind, StudyEvent, Subject } from "@/lib/types";

type Draft = Omit<StudyEvent, "id">;

const emptyDraft = (): Draft => ({
  title: "",
  kind: "pruefung",
  starts_at: new Date(new Date().setHours(9, 0, 0, 0) + 7 * 864e5).toISOString(),
  location: "",
  subject_id: null,
  subject_ids: [],
  notes: "",
  progress: 0,
  done: false,
  ends_at: null,
  all_day: false,
  pinned: false,
});

interface Filter {
  text: string;
  kinds: EventKind[];
  /** Subject ids; "none" stands for Termine without a subject. */
  subjects: string[];
  pinned: boolean;
}

const NO_FILTER: Filter = { text: "", kinds: [], subjects: [], pinned: false };

function matches(ev: StudyEvent, f: Filter, subjects: Subject[]) {
  if (f.kinds.length && !f.kinds.includes(ev.kind)) return false;
  if (f.pinned && !ev.pinned) return false;
  if (f.subjects.length) {
    const ids = eventSubjectIds(ev);
    if (!(ids.length ? ids : ["none"]).some((id) => f.subjects.includes(id))) return false;
  }
  const q = f.text.trim().toLowerCase();
  if (q) {
    const names = eventSubjects(ev, subjects).map((s) => s.name);
    if (![ev.title, ev.location, ev.notes, ...names].some((t) => t?.toLowerCase().includes(q))) return false;
  }
  return true;
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        active
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
      }`}
    >
      {children}
    </button>
  );
}

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
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const batzis = useBatziOverlay("studium");

  function edit(target: { id?: string; draft: Draft }) {
    setEditing(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeFilters = filter.kinds.length + filter.subjects.length + (filter.pinned ? 1 : 0) + (filter.text.trim() ? 1 : 0);
  const shown = events.rows.filter((e) => matches(e, filter, subjects.rows));
  const sorted = [...shown].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((e) => isCurrent(e) && !e.done);
  const past = sorted.filter((e) => !isCurrent(e) || e.done).reverse();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const subject_ids = eventSubjectIds(editing.draft);
    const draft = {
      ...editing.draft,
      subject_ids,
      subject_id: subject_ids[0] ?? null,
      location: editing.draft.location || null,
      notes: editing.draft.notes || null,
    };
    if (editing.id) await events.update(editing.id, draft);
    else await events.insert(draft);
    setEditing(null);
  }

  function row(ev: StudyEvent) {
    const evSubjects = eventSubjects(ev, subjects.rows);
    const urgent = isSoon(ev.starts_at) && (ev.kind === "pruefung" || ev.kind === "testat");
    return (
      <EventCard
        key={ev.id}
        event={ev}
        urgent={urgent}
        badge={<Badge className={KIND_TONE[ev.kind].chip}>{KIND_LABEL[ev.kind]}</Badge>}
        meta={
          <>
            {ev.pinned && <span title="Auf der Startseite angepinnt">📌</span>}
            {evSubjects.map((subject) => (
              <span key={subject.id} className="flex items-center gap-1">
                <SubjectDot color={subject.color} /> {subject.name}
              </span>
            ))}
            <LinkedNote source="studium" id={ev.id} />
          </>
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
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            variant="ghost"
            title={ev.pinned ? "Von der Startseite nehmen" : "Auf der Startseite anzeigen"}
            onClick={() => events.update(ev.id, { pinned: !ev.pinned })}
          >
            {ev.pinned ? "📌 Lösen" : "📌 Anpinnen"}
          </Button>
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
        <ShareEvent source="studium" id={ev.id} />
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
            <div className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-stone-700 dark:text-stone-300">Fächer</span>
              <div className="flex flex-wrap gap-2">
                {subjects.rows.map((s) => {
                  const ids = eventSubjectIds(editing.draft);
                  return (
                    <Chip
                      key={s.id}
                      active={ids.includes(s.id)}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, subject_ids: toggle(ids, s.id), subject_id: null },
                        })
                      }
                    >
                      <SubjectDot color={s.color} /> {s.name}
                    </Chip>
                  );
                })}
                {subjects.rows.length === 0 && <span className="text-stone-500">Noch keine Fächer angelegt.</span>}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(editing.draft.pinned)}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, pinned: e.target.checked } })}
              />
              📌 Auf der Startseite anpinnen
            </label>
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

      <div className="flex flex-wrap items-start gap-2">
        <ViewTabs view={view} onChange={changeView} />
        <TextInput
          type="search"
          value={filter.text}
          onChange={(e) => setFilter({ ...filter, text: e.target.value })}
          placeholder="🔍 Suchen …"
          aria-label="Termine durchsuchen"
          className="w-44 flex-none sm:w-56"
        />
        <Button variant="secondary" aria-expanded={showFilter} onClick={() => setShowFilter(!showFilter)}>
          Filter{activeFilters ? ` (${activeFilters})` : ""} {showFilter ? "▴" : "▾"}
        </Button>
        {activeFilters > 0 && (
          <Button variant="ghost" onClick={() => setFilter(NO_FILTER)}>
            Zurücksetzen
          </Button>
        )}
      </div>
      {showFilter && (
        <Card className="mb-4 space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Art</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                <Chip key={k} active={filter.kinds.includes(k)} onClick={() => setFilter({ ...filter, kinds: toggle(filter.kinds, k) })}>
                  {KIND_LABEL[k]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Fach</p>
            <div className="flex flex-wrap gap-2">
              {subjects.rows.map((s) => (
                <Chip key={s.id} active={filter.subjects.includes(s.id)} onClick={() => setFilter({ ...filter, subjects: toggle(filter.subjects, s.id) })}>
                  <SubjectDot color={s.color} /> {s.name}
                </Chip>
              ))}
              <Chip active={filter.subjects.includes("none")} onClick={() => setFilter({ ...filter, subjects: toggle(filter.subjects, "none") })}>
                ohne Fach
              </Chip>
            </div>
          </div>
          <Chip active={filter.pinned} onClick={() => setFilter({ ...filter, pinned: !filter.pinned })}>
            📌 Nur angepinnte
          </Chip>
        </Card>
      )}
      {activeFilters > 0 && (
        <p className="mb-3 text-sm text-stone-500">
          {shown.length} von {events.rows.length} Terminen passen zum Filter.
        </p>
      )}
      {view === "kalender" && batzis.available && <BatziToggle on={batzis.on} onChange={batzis.toggle} />}

      {view === "kalender" ? (
        <MonthCalendar
          events={[...shown, ...(activeFilters ? [] : batzis.items)]}
          tone={(ev) => ("external" in ev ? TONES.batzi : KIND_TONE[ev.kind])}
          label={(ev) => ("external" in ev ? "Batzi's" : KIND_LABEL[ev.kind])}
          legend={[
            ...(Object.keys(KIND_LABEL) as EventKind[]).map((k) => ({ label: KIND_LABEL[k], tone: KIND_TONE[k] })),
            ...(batzis.items.length ? [{ label: "Batzi's", tone: TONES.batzi }] : []),
          ]}
          details={(ev) => {
            if ("external" in ev) return null;
            const evSubjects = eventSubjects(ev, subjects.rows);
            return evSubjects.length > 0 && (
              <>
                {evSubjects.map((subject) => (
                  <span key={subject.id} className="mr-2 inline-flex items-center gap-1">
                    <SubjectDot color={subject.color} /> {subject.name}
                  </span>
                ))}
              </>
            );
          }}
          onEdit={(ev) => ("external" in ev ? (window.location.href = BATZI_CALENDAR) : edit({ id: ev.id, draft: { ...ev } }))}
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
            {upcoming.length === 0 && events.loaded && (
              <Empty>{activeFilters ? "Keine anstehenden Termine passen zum Filter." : "Keine anstehenden Termine. Leg den ersten an!"}</Empty>
            )}
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
