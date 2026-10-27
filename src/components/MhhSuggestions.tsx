"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Select } from "@/components/ui";
import { eventEnd, formatEventDate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import type { Suggestion } from "@/lib/mhh";
import { GROUPS } from "@/lib/mhh";
import { insertRows, useTable } from "@/lib/useTable";
import type { StudyEvent, Subject } from "@/lib/types";

interface Response {
  studyYear: number;
  academicYear: string;
  suggestions: Suggestion[];
  errors: string[];
  links: { label: string; url: string }[];
}

const YEAR_KEY = "mhh-studienjahr";
const HIDDEN_KEY = "mhh-ausgeblendet";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

/** Guesses the subject of an exam from its module name, e.g. "Makroanatomie I" → Anatomie. */
function subjectFor(title: string, subjects: Subject[]) {
  const t = title.toLowerCase();
  return subjects.filter((s) => t.includes(s.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0]?.id ?? null;
}

function toEvent(s: Suggestion, subjects: Subject[]): Omit<StudyEvent, "id"> {
  return {
    title: s.title,
    kind: s.kind,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    all_day: s.all_day,
    location: s.location,
    notes: s.notes,
    subject_id: s.group === GROUPS.exams || s.kind === "frist" ? subjectFor(s.title, subjects) : null,
    progress: 0,
    done: false,
    source: s.source,
  };
}

function differs(s: Suggestion, e: StudyEvent) {
  const same = (a?: string | null, b?: string | null) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  return !same(s.starts_at, e.starts_at) || !same(s.ends_at, e.ends_at ?? null) || s.title !== e.title || s.location !== e.location;
}

export function MhhSuggestions() {
  const events = useTable("events");
  const subjects = useTable("subjects");
  // The page renders only in the browser (behind the login), so storage can be read right away.
  const [studyYear, setStudyYear] = useState(() => readStorage(YEAR_KEY, 1));
  const [hidden, setHidden] = useState(() => readStorage<string[]>(HIDDEN_KEY, []));
  const [loaded, setLoaded] = useState<{ year: number; data?: Response; error?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mhh?sj=${studyYear}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Response) => !cancelled && setLoaded({ year: studyYear, data }))
      .catch((e) => !cancelled && setLoaded({ year: studyYear, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [studyYear]);

  const current = loaded?.year === studyYear ? loaded : null;
  const data = current?.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = current?.error ?? actionError;

  const bySource = useMemo(() => new Map(events.rows.filter((e) => e.source).map((e) => [e.source!, e])), [events.rows]);

  const { fresh, changed } = useMemo(() => {
    const fresh: Suggestion[] = [];
    const changed: { s: Suggestion; e: StudyEvent }[] = [];
    if (!data || !events.loaded) return { fresh, changed };
    const today = new Date();
    for (const s of data.suggestions) {
      const existing = bySource.get(s.source);
      if (existing) {
        if (differs(s, existing)) changed.push({ s, e: existing });
      } else if (!hidden.includes(s.source) && eventEnd(s) >= today) {
        fresh.push(s);
      }
    }
    return { fresh, changed };
  }, [data, events.loaded, bySource, hidden]);

  // Repeat exams, mock exams and their deadlines are offered but not ticked.
  const selected = picked ?? new Set(fresh.filter((s) => !s.retake).map((s) => s.source));

  function toggle(source: string) {
    const next = new Set(selected);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setPicked(next);
  }

  function hide(sources: string[]) {
    const next = [...new Set([...hidden, ...sources])];
    setHidden(next);
    writeStorage(HIDDEN_KEY, next);
    setPicked(new Set([...selected].filter((s) => !sources.includes(s))));
  }

  async function take(list: Suggestion[]) {
    setBusy(true);
    try {
      await insertRows(
        "events",
        list.map((s) => toEvent(s, subjects.rows)),
      );
      setDone(`${list.length} ${list.length === 1 ? "Termin" : "Termine"} übernommen.`);
      setPicked(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(items: { s: Suggestion; e: StudyEvent }[]) {
    setBusy(true);
    try {
      for (const { s, e } of items) {
        await events.update(e.id, { starts_at: s.starts_at, ends_at: s.ends_at, all_day: s.all_day, title: s.title, location: s.location });
      }
      setDone(`${items.length} ${items.length === 1 ? "Termin" : "Termine"} aktualisiert.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const groups = [...new Set(fresh.map((s) => s.group))];
  const chosen = fresh.filter((s) => selected.has(s.source));
  const count = fresh.length + changed.length;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="text-left" onClick={() => setOpen(!open)}>
          <h2 className="font-medium">
            {open ? "▾" : "▸"} Vorschläge von der MHH-Webseite
            {count > 0 && <span className="ml-2 rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">{count}</span>}
          </h2>
          <p className="text-sm text-slate-500">
            {!data && !error
              ? "Termine werden geladen …"
              : count
                ? "Quintile, Vorlesungszeiten, Rückmeldung und Prüfungen, die noch nicht im Kalender stehen"
                : "Alles Bekannte steht schon im Kalender."}
          </p>
        </button>
        <label className="flex items-center gap-2 text-sm">
          Studienjahr
          <Select
            className="w-auto"
            value={studyYear}
            onChange={(e) => {
              setStudyYear(Number(e.target.value));
              setPicked(null);
              writeStorage(YEAR_KEY, Number(e.target.value));
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}.
              </option>
            ))}
          </Select>
        </label>
      </div>

      {done && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{done}</p>}

      {open && (
        <div className="mt-4 space-y-5">
          {current?.error && <p className="text-sm text-rose-600">Die MHH-Seite war nicht erreichbar ({current.error}). Später nochmal versuchen.</p>}
          {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
          {data?.errors.map((e) => (
            <p key={e} className="text-sm text-amber-700 dark:text-amber-400">
              {e}
            </p>
          ))}

          {changed.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium">Auf der MHH-Seite geändert</h3>
              <ul className="space-y-2">
                {changed.map(({ s, e }) => (
                  <li key={s.source} className="rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-800">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-slate-500">
                      <span className="line-through">{formatEventDate(e)}</span> → {formatEventDate(s)}
                    </p>
                  </li>
                ))}
              </ul>
              <Button className="mt-2" variant="secondary" disabled={busy} onClick={() => refresh(changed)}>
                {changed.length === 1 ? "Termin aktualisieren" : `Alle ${changed.length} aktualisieren`}
              </Button>
            </section>
          )}

          {groups.map((group) => {
            const items = fresh.filter((s) => s.group === group);
            return (
              <section key={group}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{group}</h3>
                  <button className="text-xs text-slate-500 hover:underline" onClick={() => hide(items.map((s) => s.source))}>
                    Gruppe ausblenden
                  </button>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {items.map((s) => (
                    <li key={s.source} className="flex items-start gap-3 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(s.source)}
                        onChange={() => toggle(s.source)}
                        aria-label={`${s.title} übernehmen`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {s.title}
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500 dark:bg-slate-800">
                            {KIND_LABEL[s.kind]}
                          </span>
                        </p>
                        <p className="text-slate-500">
                          {formatEventDate(s)}
                          {s.location ? ` · ${s.location}` : ""}
                        </p>
                      </div>
                      <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => hide([s.source])} aria-label={`${s.title} ausblenden`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {fresh.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !chosen.length} onClick={() => take(chosen)}>
                {chosen.length === 1 ? "1 Termin übernehmen" : `${chosen.length} Termine übernehmen`}
              </Button>
              {chosen.length < fresh.length && (
                <Button variant="ghost" disabled={busy} onClick={() => setPicked(new Set(fresh.map((s) => s.source)))}>
                  Alle auswählen
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Wiederholungsprüfungen und die Probeklausur sind nicht vorausgewählt. Die MHH kann Termine noch ändern; geänderte Daten tauchen hier oben
            wieder auf. Quellen:{" "}
            {data?.links.map((l, i) => (
              <span key={l.url}>
                {i > 0 && ", "}
                <a className="underline" href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
            {hidden.length > 0 && (
              <>
                {" · "}
                <button
                  className="underline"
                  onClick={() => {
                    setHidden([]);
                    writeStorage(HIDDEN_KEY, []);
                  }}
                >
                  {hidden.length} ausgeblendete wieder zeigen
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
