"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { hasSupabase } from "@/lib/supabase";
import { destinations, linksOf, shareEvent, unlinkEvent, useEventLinks, useShareTargets, type Destination } from "@/lib/sharing";
import type { CalendarSource } from "@/lib/types";

const key = (d: Destination) => `${d.kind}:${d.user ?? ""}`;

/** "🔗 auch bei …" for a date that is connected with copies in other calendars. */
export function LinkedNote({ source, id }: { source: CalendarSource; id: string }) {
  const links = useEventLinks();
  const { targets } = useShareTargets();
  const other = linksOf(links.rows, source, id);
  if (other.length === 0) return null;
  const names = other.map((o) => {
    if (o.kind === "batzis") return "Batzi's";
    const t = targets.find((t) => t.user_id === o.user);
    return t ? t.name : o.kind === "studium" ? "Studium" : "Kalender";
  });
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300" title="Änderungen werden übertragen">
      🔗 {[...new Set(names)].join(", ")}
    </span>
  );
}

/** Button that sends a date into other calendars (the Batzi's, the other person's), optionally kept connected. */
export function ShareEvent({ source, id }: { source: CalendarSource; id: string }) {
  const { targets, me } = useShareTargets();
  const links = useEventLinks();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState(true);
  const [state, setState] = useState<{ busy?: boolean; done?: string; error?: string }>({});

  if (!hasSupabase) return null;
  const options = destinations(source, targets, me);
  const linked = linksOf(links.rows, source, id);
  if (options.length === 0 && linked.length === 0) return null;

  async function send() {
    const to = options.filter((d) => picked.has(key(d)));
    if (to.length === 0) return;
    setState({ busy: true });
    try {
      await shareEvent(source, id, to, keep);
      setState({ done: `Übertragen an ${to.map((d) => d.label.replace(/^\S+ /, "")).join(", ")} ✓` });
      setPicked(new Set());
      setTimeout(() => setOpen(false), 1800);
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String((e as { message?: string }).message ?? e) });
    }
  }

  if (!open)
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
          setState({});
        }}
      >
        📤 Übertragen
      </Button>
    );

  return (
    <div className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-700 dark:bg-stone-800/60">
      <p className="mb-2 font-semibold">In welchen Kalender soll der Termin auch?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((d) => {
          const on = picked.has(key(d));
          const already = linked.some((l) => l.kind === d.kind && (l.user ?? null) === d.user);
          return (
            <button
              key={key(d)}
              type="button"
              onClick={() => {
                const next = new Set(picked);
                if (on) next.delete(key(d));
                else next.add(key(d));
                setPicked(next);
              }}
              className={`rounded-full border px-3 py-1 font-semibold transition ${
                on ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-stone-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
              }`}
            >
              {d.label}
              {already ? " 🔗" : ""}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Verbunden halten: Änderungen an Zeit, Ort und Titel gehen überall mit
      </label>
      {state.error && <p className="mt-2 text-rose-700 dark:text-rose-400">Fehler: {state.error}</p>}
      {state.done && <p className="mt-2 text-emerald-700 dark:text-emerald-400">{state.done}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={send} disabled={state.busy || picked.size === 0}>
          Übertragen
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Schließen
        </Button>
        {linked.length > 0 && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => confirm("Verbindung lösen? Die Kopien bleiben, ändern sich aber nicht mehr mit.") && unlinkEvent(source, id)}
          >
            Verbindung lösen
          </Button>
        )}
      </div>
    </div>
  );
}

/** Switch for showing the Batzi's dates in one's own calendar. */
export function BatziToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="mb-4 ml-3 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 dark:text-stone-300">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      🐻 Batzi-Termine zeigen
    </label>
  );
}
