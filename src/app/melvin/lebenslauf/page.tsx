"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import {
  ACCENTS,
  byRecent,
  duration,
  emptyProfile,
  fileName,
  groups,
  months,
  monthsText,
  period,
  SECTION,
  SECTIONS,
  STYLES,
  type Accent,
  type CvStyle,
} from "@/lib/cv";
import { download } from "@/lib/ical";
import { useTable } from "@/lib/useTable";
import type { CvEntry, CvProfile, CvSection } from "@/lib/types";

type EntryDraft = Omit<CvEntry, "id">;
type ProfileDraft = Omit<CvProfile, "id">;

const emptyEntry = (section: CvSection = "beruf"): EntryDraft => ({
  section,
  title: "",
  organization: "",
  location: "",
  start_date: `${new Date().getFullYear()}-01-01`,
  end_date: null,
  description: "",
  hidden: false,
});

const toMonth = (day: string | null) => (day ? day.slice(0, 7) : "");
const fromMonth = (month: string) => `${month}-01`;
const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;

export default function Lebenslauf() {
  const profiles = useTable("cv_profile");
  const entries = useTable("cv_entries");
  const profile = profiles.rows[0];
  const [editingProfile, setEditingProfile] = useState<ProfileDraft | null>(null);
  const [editing, setEditing] = useState<{ id?: string; draft: EntryDraft } | null>(null);

  function edit(target: { id?: string; draft: EntryDraft }) {
    setEditing(target);
    setEditingProfile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const d = editing.draft;
    const draft: EntryDraft = {
      ...d,
      title: d.title.trim(),
      organization: d.organization?.trim() || null,
      location: d.location?.trim() || null,
      description: d.description?.trim() || null,
      end_date: d.end_date && d.end_date < d.start_date ? d.start_date : d.end_date,
    };
    if (editing.id) await entries.update(editing.id, draft);
    else await entries.insert(draft);
    setEditing(null);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!editingProfile) return;
    const d = editingProfile;
    const draft: ProfileDraft = {
      ...d,
      skills: d.skills.filter((s) => s.name.trim()),
      languages: d.languages.filter((l) => l.name.trim()),
    };
    if (profile) await profiles.update(profile.id, draft);
    else await profiles.insert(draft);
    setEditingProfile(null);
  }

  const set = (patch: Partial<EntryDraft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });
  const setP = (patch: Partial<ProfileDraft>) => editingProfile && setEditingProfile({ ...editingProfile, ...patch });

  const sorted = [...entries.rows].sort(byRecent);
  const workMonths = entries.rows.filter((e) => e.section === "beruf").reduce((s, e) => s + months(e), 0);

  return (
    <>
      <PageHeader
        title="Lebenslauf"
        subtitle="Eckdaten einmal eintragen, als Zeitstrahl ansehen und als Word oder PDF herunterladen"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setEditingProfile(profile ? { ...emptyProfile(), ...profile } : emptyProfile());
              }}
            >
              👤 Persönliches
            </Button>
            <Button onClick={() => edit({ draft: emptyEntry() })}>+ Station</Button>
          </div>
        }
      />
      <ErrorNote error={entries.error ?? profiles.error} />

      {editingProfile && (
        <Card className="mb-6">
          <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <TextInput required value={editingProfile.name} onChange={(e) => setP({ name: e.target.value })} placeholder="Vor- und Nachname" />
            </Field>
            <Field label="Kurzbeschreibung">
              <TextInput value={editingProfile.headline ?? ""} onChange={(e) => setP({ headline: e.target.value })} placeholder="z. B. Industriekaufmann" />
            </Field>
            <Field label="Geburtsdatum">
              <TextInput type="date" value={editingProfile.birth_date ?? ""} onChange={(e) => setP({ birth_date: e.target.value || null })} />
            </Field>
            <Field label="Geburtsort">
              <TextInput value={editingProfile.birth_place ?? ""} onChange={(e) => setP({ birth_place: e.target.value })} />
            </Field>
            <Field label="E-Mail">
              <TextInput type="email" value={editingProfile.email ?? ""} onChange={(e) => setP({ email: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <TextInput type="tel" value={editingProfile.phone ?? ""} onChange={(e) => setP({ phone: e.target.value })} />
            </Field>
            <Field label="Adresse">
              <TextInput value={editingProfile.address ?? ""} onChange={(e) => setP({ address: e.target.value })} placeholder="Straße, PLZ Ort" />
            </Field>
            <Field label="Website / LinkedIn">
              <TextInput value={editingProfile.website ?? ""} onChange={(e) => setP({ website: e.target.value })} />
            </Field>
            <Field label="Profil (ein paar Sätze über dich)" className="sm:col-span-2">
              <TextArea value={editingProfile.summary ?? ""} onChange={(e) => setP({ summary: e.target.value })} />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Kenntnisse (1–5)</p>
              {editingProfile.skills.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <TextInput
                    className="flex-1"
                    placeholder="z. B. Excel"
                    value={s.name}
                    onChange={(e) => setP({ skills: editingProfile.skills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <Select
                    className="w-20"
                    value={s.level}
                    onChange={(e) => setP({ skills: editingProfile.skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)) })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" variant="danger" onClick={() => setP({ skills: editingProfile.skills.filter((_, j) => j !== i) })} aria-label="Entfernen">
                    ✕
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setP({ skills: [...editingProfile.skills, { name: "", level: 3 }] })}>
                + Kenntnis
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Sprachen</p>
              {editingProfile.languages.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <TextInput
                    className="flex-1"
                    placeholder="z. B. Englisch"
                    value={l.name}
                    onChange={(e) => setP({ languages: editingProfile.languages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <TextInput
                    className="w-32"
                    placeholder="fließend"
                    list="sprachniveaus"
                    value={l.level}
                    onChange={(e) => setP({ languages: editingProfile.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })}
                  />
                  <Button type="button" variant="danger" onClick={() => setP({ languages: editingProfile.languages.filter((_, j) => j !== i) })} aria-label="Entfernen">
                    ✕
                  </Button>
                </div>
              ))}
              <datalist id="sprachniveaus">
                {["Muttersprache", "verhandlungssicher", "fließend", "gut", "Grundkenntnisse", "C2", "C1", "B2", "B1", "A2", "A1"].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <Button type="button" variant="secondary" onClick={() => setP({ languages: [...editingProfile.languages, { name: "", level: "" }] })}>
                + Sprache
              </Button>
            </div>

            <Field label="Interessen / Hobbys" className="sm:col-span-2">
              <TextInput value={editingProfile.interests ?? ""} onChange={(e) => setP({ interests: e.target.value })} placeholder="z. B. Fußball, Kochen, Reisen" />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditingProfile(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editing && (
        <Card className="mb-6">
          <form onSubmit={saveEntry} className="grid gap-3 sm:grid-cols-2">
            <Field label="Art">
              <Select value={editing.draft.section} onChange={(e) => set({ section: e.target.value as CvSection })}>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SECTION[s].icon} {SECTION[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titel / Position">
              <TextInput required value={editing.draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. Sachbearbeiter Einkauf" />
            </Field>
            <Field label="Firma / Schule / Hochschule">
              <TextInput value={editing.draft.organization ?? ""} onChange={(e) => set({ organization: e.target.value })} />
            </Field>
            <Field label="Ort">
              <TextInput value={editing.draft.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
            </Field>
            <Field label="Von (Monat)">
              <TextInput type="month" required value={toMonth(editing.draft.start_date)} onChange={(e) => e.target.value && set({ start_date: fromMonth(e.target.value) })} />
            </Field>
            <Field label="Bis (Monat)">
              <div className="flex items-center gap-3">
                <TextInput
                  type="month"
                  className="flex-1"
                  disabled={!editing.draft.end_date}
                  min={toMonth(editing.draft.start_date)}
                  value={toMonth(editing.draft.end_date)}
                  onChange={(e) => e.target.value && set({ end_date: fromMonth(e.target.value) })}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={!editing.draft.end_date}
                    onChange={(e) => set({ end_date: e.target.checked ? null : editing.draft.start_date })}
                  />
                  bis heute
                </label>
              </div>
            </Field>
            <Field label="Aufgaben / Beschreibung (Zeilen mit „-“ werden Aufzählungspunkte)" className="sm:col-span-2">
              <TextArea
                rows={4}
                value={editing.draft.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
                placeholder={"- Angebote einholen und vergleichen\n- Lieferanten betreuen"}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editing.draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
              In den Dateien weglassen (bleibt im Zeitstrahl)
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {entries.rows.length === 0 && entries.loaded ? (
        <Card className="mb-6">
          <Empty>Noch keine Stationen. Fang mit deinem aktuellen Job oder deinem Schulabschluss an.</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Stationen" value={String(entries.rows.length)} />
            <Stat label="Berufserfahrung" value={workMonths ? monthsText(workMonths) : "–"} />
            <Stat label="Aktuell" value={sorted.find((e) => !e.end_date)?.title ?? "–"} />
          </div>
          <Timeline entries={entries.rows} onEdit={(e) => edit({ id: e.id, draft: { ...e } })} />
        </>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <h2 className="mb-3 font-semibold">Verlauf</h2>
          {sorted.length === 0 ? (
            <Empty>Hier erscheint dein Lebenslauf von neu nach alt.</Empty>
          ) : (
            <ol className="relative ml-2 border-l-2 border-stone-200 dark:border-stone-700">
              {sorted.map((e) => (
                <li key={e.id} className={`relative mb-5 pl-6 ${e.hidden ? "opacity-50" : ""}`}>
                  <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full ring-4 ring-white dark:ring-stone-900" style={{ background: SECTION[e.section].color }} />
                  <p className="text-xs font-semibold text-stone-500">
                    {period(e)} · {duration(e)}
                  </p>
                  <p className="font-semibold">
                    {SECTION[e.section].icon} {e.title}
                  </p>
                  {(e.organization || e.location) && <p className="text-sm text-stone-500">{[e.organization, e.location].filter(Boolean).join(", ")}</p>}
                  {e.description && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{e.description}</p>}
                  <div className="mt-1 flex gap-1">
                    <Button variant="ghost" onClick={() => edit({ id: e.id, draft: { ...e } })}>
                      Bearbeiten
                    </Button>
                    <Button variant="ghost" onClick={() => entries.update(e.id, { hidden: !e.hidden })}>
                      {e.hidden ? "In Dateien zeigen" : "In Dateien weglassen"}
                    </Button>
                    <Button variant="danger" onClick={() => confirm(`„${e.title}“ löschen?`) && entries.remove(e.id)}>
                      Löschen
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-4">
          <ProfileCard profile={profile} onEdit={() => setEditingProfile(profile ? { ...emptyProfile(), ...profile } : emptyProfile())} />
          <ExportCard profile={profile} entries={entries.rows} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 truncate font-display text-2xl font-semibold">{value}</p>
    </Card>
  );
}

/** Bars on a time axis, one lane per kind; overlapping entries of a kind stack in extra rows. */
function Timeline({ entries, onEdit }: { entries: CvEntry[]; onEdit: (e: CvEntry) => void }) {
  if (entries.length === 0) return null;
  const now = new Date();
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const endIndex = (e: CvEntry) => (e.end_date ? monthIndex(e.end_date) : nowIndex) + 1;
  const firstYear = Math.min(...entries.map((e) => Number(e.start_date.slice(0, 4))));
  const lastYear = Math.max(now.getFullYear(), ...entries.map((e) => Math.ceil(endIndex(e) / 12) - 1));
  const from = firstYear * 12;
  const total = (lastYear + 1) * 12 - from;
  const pct = (i: number) => ((i - from) / total) * 100;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const step = years.length > 24 ? 5 : years.length > 12 ? 2 : 1;

  const lanes = SECTIONS.map((section) => {
    const rows: CvEntry[][] = [];
    for (const e of entries.filter((x) => x.section === section).sort((a, b) => a.start_date.localeCompare(b.start_date))) {
      const row = rows.find((r) => endIndex(r[r.length - 1]) <= monthIndex(e.start_date));
      if (row) row.push(e);
      else rows.push([e]);
    }
    return { section, rows };
  }).filter((l) => l.rows.length > 0);

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Zeitstrahl</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="relative ml-36 h-6 border-b border-stone-200 text-xs text-stone-500 dark:border-stone-700">
            {years.map((y) =>
              (y - firstYear) % step === 0 ? (
                <span key={y} className="absolute -translate-x-1/2" style={{ left: `${pct(y * 12)}%` }}>
                  {y}
                </span>
              ) : null,
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-36 right-0">
              {years.map((y) => (
                <span key={y} className="absolute inset-y-0 border-l border-stone-100 dark:border-stone-800" style={{ left: `${pct(y * 12)}%` }} />
              ))}
              <span className="absolute inset-y-0 border-l-2 border-dashed border-brand-400" style={{ left: `${pct(nowIndex + 1)}%` }} title="heute" />
            </div>
            {lanes.map((lane) => (
              <div key={lane.section} className="flex items-start border-b border-stone-100 py-2 last:border-0 dark:border-stone-800">
                <span className="w-36 shrink-0 pr-2 pt-1 text-sm font-semibold">
                  {SECTION[lane.section].icon} {SECTION[lane.section].label}
                </span>
                <div className="relative flex-1 space-y-1">
                  {lane.rows.map((row, i) => (
                    <div key={i} className="relative h-7">
                      {row.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => onEdit(e)}
                          title={`${e.title}${e.organization ? `, ${e.organization}` : ""} (${period(e)})`}
                          className={`absolute inset-y-0 overflow-hidden rounded-lg px-2 text-left text-xs font-semibold leading-7 text-white shadow-sm transition hover:brightness-110 ${e.hidden ? "opacity-50" : ""}`}
                          style={{
                            left: `${pct(monthIndex(e.start_date))}%`,
                            width: `max(${pct(endIndex(e)) - pct(monthIndex(e.start_date))}%, 6px)`,
                            background: SECTION[lane.section].color,
                          }}
                        >
                          <span className="block truncate">{e.title}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProfileCard({ profile, onEdit }: { profile: CvProfile | undefined; onEdit: () => void }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">👤 Persönliches</h2>
        <Button variant="ghost" onClick={onEdit}>
          Bearbeiten
        </Button>
      </div>
      {!profile ? (
        <p className="text-sm text-stone-500">Name, Kontakt, Kenntnisse und Sprachen fehlen noch.</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{profile.name}</p>
          {profile.headline && <p className="text-stone-500">{profile.headline}</p>}
          {[profile.email, profile.phone, profile.address].filter(Boolean).map((l) => (
            <p key={l} className="truncate text-stone-600 dark:text-stone-300">
              {l}
            </p>
          ))}
          {profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {profile.skills.map((s) => (
                <span key={s.name} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  {s.name} {"●".repeat(s.level)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const OPTIONS_KEY = "lebenslauf-export";

function ExportCard({ profile, entries }: { profile: CvProfile | undefined; entries: CvEntry[] }) {
  const [opts, setOpts] = useState<{ style: CvStyle; accent: Accent; sections: CvSection[]; place: string }>(() => {
    const fallback = { style: "klassisch" as CvStyle, accent: "indigo" as Accent, sections: SECTIONS, place: "" };
    try {
      return { ...fallback, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}") };
    } catch {
      return fallback;
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<typeof opts>) {
    const next = { ...opts, ...patch };
    setOpts(next);
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered in private mode.
    }
  }

  async function make(kind: "docx" | "pdf") {
    setBusy(kind);
    setError(null);
    try {
      const data = { profile: { ...emptyProfile(), id: "", ...profile }, groups: groups(entries, opts.sections), options: opts };
      const blob = kind === "docx" ? await (await import("@/lib/cvDocx")).cvDocx(data) : await (await import("@/lib/cvPdf")).cvPdf(data);
      download(fileName(data.profile, opts.style, kind), blob, blob.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-semibold transition ${
      active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
    }`;

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">📄 Herunterladen</h2>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-stone-500">Stil</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STYLES) as CvStyle[]).map((s) => (
            <button key={s} className={chip(opts.style === s)} onClick={() => update({ style: s })} title={STYLES[s].hint}>
              {STYLES[s].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">{STYLES[opts.style].hint}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-stone-500">Farbe</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button
              key={a}
              onClick={() => update({ accent: a })}
              title={ACCENTS[a].label}
              aria-label={ACCENTS[a].label}
              className={`h-8 w-8 rounded-full ring-offset-2 transition ${opts.accent === a ? "ring-2 ring-stone-800 dark:ring-stone-200" : ""}`}
              style={{ background: `#${ACCENTS[a].hex}` }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-stone-500">Was soll rein?</p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.filter((s) => entries.some((e) => e.section === s)).map((s) => (
            <button
              key={s}
              className={chip(opts.sections.includes(s))}
              onClick={() => update({ sections: opts.sections.includes(s) ? opts.sections.filter((x) => x !== s) : [...opts.sections, s] })}
            >
              {SECTION[s].icon} {SECTION[s].label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Ort für die Unterschrift">
        <TextInput value={opts.place} onChange={(e) => update({ place: e.target.value })} placeholder="z. B. Hannover" />
      </Field>
      {error && <p className="text-sm text-rose-700">Fehler: {error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => make("docx")} disabled={busy !== null || entries.length === 0}>
          {busy === "docx" ? "Erstelle …" : "⬇ Word (.docx)"}
        </Button>
        <Button onClick={() => make("pdf")} disabled={busy !== null || entries.length === 0}>
          {busy === "pdf" ? "Erstelle …" : "⬇ PDF"}
        </Button>
      </div>
      {!profile && <p className="text-xs text-stone-500">Tipp: Erst unter „Persönliches“ Name und Kontakt eintragen.</p>}
    </Card>
  );
}
