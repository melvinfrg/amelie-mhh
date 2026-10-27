"use client";

import { useState, type FormEvent } from "react";
import { Badge, DateFields, EventCard, isSoon, useCalendarView, ViewTabs } from "@/components/events";
import { BatziToggle, LinkedNote, ShareEvent } from "@/components/ShareEvent";
import { MonthCalendar, TONES } from "@/components/MonthCalendar";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { isCurrent } from "@/lib/dates";
import { MELVIN_CATEGORY_LABEL } from "@/lib/labels";
import { CATEGORY_TONE } from "@/lib/melvin";
import { BATZI_CALENDAR, useBatziOverlay } from "@/lib/sharing";
import { useTable } from "@/lib/useTable";
import type { MelvinCategory, MelvinEvent } from "@/lib/types";

type Draft = Omit<MelvinEvent, "id">;

const CATEGORIES = Object.keys(MELVIN_CATEGORY_LABEL) as MelvinCategory[];

const emptyDraft = (): Draft => ({
  title: "",
  category: "privat",
  starts_at: new Date(new Date().setHours(18, 0, 0, 0) + 864e5).toISOString(),
  ends_at: null,
  all_day: false,
  location: "",
  notes: "",
  done: false,
});

export default function MelvinTermine() {
  const events = useTable("melvin_events");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [view, changeView] = useCalendarView("melvin-termine-ansicht");
  const batzis = useBatziOverlay("melvin");

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
    const draft = { ...editing.draft, location: editing.draft.location || null, notes: editing.draft.notes || null };
    if (editing.id) await events.update(editing.id, draft);
    else await events.insert(draft);
    setEditing(null);
  }

  const set = (patch: Partial<Draft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });

  function row(ev: MelvinEvent) {
    return (
      <EventCard
        key={ev.id}
        event={ev}
        urgent={isSoon(ev.starts_at, 1) && !ev.done}
        badge={<Badge className={CATEGORY_TONE[ev.category].chip}>{MELVIN_CATEGORY_LABEL[ev.category]}</Badge>}
        meta={<LinkedNote source="melvin" id={ev.id} />}
      >
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
        <ShareEvent source="melvin" id={ev.id} />
      </EventCard>
    );
  }

  return (
    <>
      <PageHeader
        title="Termine"
        subtitle="Dein Kalender mit Countdown"
        action={<Button onClick={() => edit({ draft: emptyDraft() })}>+ Termin</Button>}
      />
      <ErrorNote error={events.error} />

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Titel" className="sm:col-span-2">
              <TextInput required value={editing.draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. Zahnarzt" />
            </Field>
            <Field label="Art">
              <Select value={editing.draft.category} onChange={(e) => set({ category: e.target.value as MelvinCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MELVIN_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ort">
              <TextInput value={editing.draft.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
            </Field>
            <DateFields draft={editing.draft} onChange={set} />
            <Field label="Notizen" className="sm:col-span-2">
              <TextArea value={editing.draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
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
      {view === "kalender" && batzis.available && <BatziToggle on={batzis.on} onChange={batzis.toggle} />}

      {view === "kalender" ? (
        <MonthCalendar
          events={[...events.rows, ...batzis.items]}
          tone={(ev) => ("external" in ev ? TONES.batzi : CATEGORY_TONE[ev.category])}
          label={(ev) => ("external" in ev ? "Batzi's" : MELVIN_CATEGORY_LABEL[ev.category])}
          legend={[
            ...CATEGORIES.map((c) => ({ label: MELVIN_CATEGORY_LABEL[c], tone: CATEGORY_TONE[c] })),
            ...(batzis.items.length ? [{ label: "Batzi's", tone: TONES.batzi }] : []),
          ]}
          onEdit={(ev) => ("external" in ev ? (window.location.href = BATZI_CALENDAR) : edit({ id: ev.id, draft: { ...ev } }))}
          onNew={(day) => {
            const [y, m, d] = day.split("-").map(Number);
            edit({ draft: { ...emptyDraft(), starts_at: new Date(y, m - 1, d, 18).toISOString() } });
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
              <button className="text-sm font-semibold text-stone-500" onClick={() => setShowPast(!showPast)}>
                {showPast ? "▾" : "▸"} Vergangen & erledigt ({past.length})
              </button>
              {showPast && <div className="mt-3 space-y-3">{past.map(row)}</div>}
            </div>
          )}
        </>
      )}
    </>
  );
}
