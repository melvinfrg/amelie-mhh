"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CHANGE_TAG,
  getEdits,
  loadEdits,
  markSeen,
  onOpenChangelog,
  openChangelog,
  saveEdits,
  useChangelog,
  verCmp,
  type ChangeItem,
  type ChangeType,
  type LogTab,
  type ShownVersion,
} from "@/lib/changelog";
import { hasSupabase, supabase } from "@/lib/supabase";
import { useTable } from "@/lib/useTable";
import { Button, Field, Select, TextArea, TextInput } from "./ui";

const TYPES = Object.keys(CHANGE_TAG) as ChangeType[];

const COUNT_TONE: Record<ChangeType, string> = {
  neu: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  besser:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  fix: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

const HEAD_TONE: Record<ChangeType, string> = {
  neu: "text-sky-700 dark:text-sky-300",
  besser: "text-violet-700 dark:text-violet-300",
  fix: "text-amber-700 dark:text-amber-300",
};

const chip = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs font-semibold transition ${
    on
      ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
      : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
  }`;

export function fmtDate(d: string) {
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------- Footer, red dot and „Neu in Version …“ ----------

/** At the bottom of every page: the version (opens the update log), 🐞 Fehler melden and the Anleitung. */
export function SiteFooter() {
  const { current, unseen } = useChangelog();
  const link =
    "font-semibold text-stone-500 underline-offset-2 transition hover:text-stone-800 hover:underline dark:text-stone-400 dark:hover:text-stone-100";
  return (
    <footer className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-stone-200/70 pt-4 text-xs text-stone-400 dark:border-stone-800">
      <span>© {new Date().getFullYear()} Amelie &amp; Melvin</span>
      <span aria-hidden>·</span>
      <button
        type="button"
        className={link}
        onClick={() => openChangelog("log")}
        title="Update-Log: Neuerungen und Änderungen"
      >
        Version {current?.v ?? "?"}
        {unseen && (
          <span
            className="ml-1 inline-block h-2 w-2 rounded-full bg-rose-600 align-middle"
            aria-label="neu"
          />
        )}
      </button>
      <span aria-hidden>·</span>
      <button
        type="button"
        className={link}
        onClick={() => openChangelog("bug")}
        title="Fehler der Webseite melden"
      >
        🐞 Fehler melden
      </button>
      <span aria-hidden>·</span>
      <Link href="/anleitung" className={link}>
        📖 Anleitung
      </Link>
    </footer>
  );
}

/** On the start page while the newest version hasn't been looked at on this device. */
export function WhatsNew({ className = "" }: { className?: string }) {
  const { current, unseen } = useChangelog();
  if (!unseen || !current) return null;
  return (
    <div className={`text-center ${className}`}>
      <button
        type="button"
        onClick={() => openChangelog("log")}
        className="motion-rise rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 transition hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-950"
      >
        🆕 <b>Neu in Version {current.v}</b> – was hat sich geändert?
      </button>
    </div>
  );
}

// ---------- The dialog ----------

/** Lives once in the Shell. Opens from the footer, the start page and the link /#neuerungen (used by the push message). */
export function UpdateLogHost() {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<LogTab>("log");
  const [editing, setEditing] = useState<ShownVersion | "new" | null>(null);
  const [draft, setDraft] = useState<BugDraft | null>(null);
  // The content only mounts while the dialog is open: opening the list is what counts as „seen“.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const open = (t: LogTab) => {
      setTab(t);
      setEditing(null);
      setShown(true);
      loadEdits().catch(() => {});
      if (!ref.current?.open) ref.current?.showModal();
    };
    const fromHash = () => {
      if (location.hash === "#neuerungen" || location.hash === "#fehler") {
        open(location.hash === "#fehler" ? "bug" : "log");
        history.replaceState(null, "", location.pathname + location.search);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    const off = onOpenChangelog(open);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      off();
    };
  }, []);

  const close = () => ref.current?.close();
  const title = editing
    ? editing === "new"
      ? "＋ Version hinzufügen"
      : `✏️ Version ${editing.v} bearbeiten`
    : tab === "bug"
      ? "🐞 Fehler melden"
      : "📋 Update-Log";

  return (
    <dialog
      ref={ref}
      onClose={() => setShown(false)}
      onClick={(e) => e.target === ref.current && close()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm dark:bg-stone-900 dark:text-stone-100 dark:ring-1 dark:ring-stone-800"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200/70 bg-white/95 px-5 py-4 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <h2 className="flex-1 font-display text-xl font-semibold">{title}</h2>
        <button
          type="button"
          onClick={close}
          className="grid h-9 w-9 place-items-center rounded-full text-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
      {shown && (
        <div className="p-5">
          {!editing && (
            <div className="mb-4 flex gap-2">
              {(
                [
                  ["log", "📋 Versionen"],
                  ["bug", "🐞 Fehler melden"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`${chip(tab === k)} px-4 py-2 text-sm`}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {editing ? (
            <VersionEditor
              entry={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : tab === "log" ? (
            <VersionList onEdit={setEditing} />
          ) : (
            <BugTab draft={draft} setDraft={setDraft} onSent={close} />
          )}
        </div>
      )}
    </dialog>
  );
}

// ---------- Versionen ----------

function VersionList({
  onEdit,
}: {
  onEdit: (v: ShownVersion | "new") => void;
}) {
  const { list, current, seenVersion } = useChangelog();
  const [filter, setFilter] = useState<ChangeType | "">("");
  const [edit, setEdit] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // What was new for this person when the log was opened stays marked, even though opening it counts as seen.
  const [seenBefore] = useState(seenVersion);
  const isNew = (v: ShownVersion) =>
    !!seenBefore && verCmp(v.v, seenBefore) > 0;

  useEffect(() => {
    markSeen();
  }, [current?.v]);

  const visible = list.filter(
    (v) => !filter || v.items.some((it) => it.t === filter),
  );
  const isOpen = (v: ShownVersion, i: number) =>
    open[v.v + v.added] ?? (i === 0 || isNew(v) || !!filter);
  const allOpen = visible.every((v, i) => isOpen(v, i));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <p className="w-full">
          Aktuell: <b>Version {current?.v ?? "–"}</b>
          {current && <> vom {fmtDate(current.d)}</>}
        </p>
        {(["", ...TYPES] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={chip(filter === k)}
            onClick={() => setFilter(k)}
          >
            {k ? CHANGE_TAG[k].join(" ") : "Alle"}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          className={chip(false)}
          onClick={() =>
            setOpen(
              Object.fromEntries(visible.map((v) => [v.v + v.added, !allOpen])),
            )
          }
        >
          {allOpen ? "Alle zuklappen" : "Alle aufklappen"}
        </button>
        <button
          type="button"
          className={chip(edit)}
          onClick={() => setEdit(!edit)}
          title="Versionen bearbeiten, hinzufügen oder löschen"
        >
          ✏️ Bearbeiten
        </button>
      </div>

      {edit && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950/40">
          <span className="flex-1 text-stone-600 dark:text-stone-300">
            ✏️ Versionen über den Stift bearbeiten.
          </span>
          <Button variant="secondary" onClick={() => onEdit("new")}>
            ＋ Version hinzufügen
          </Button>
        </div>
      )}

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-stone-500">
          Keine Einträge.
        </p>
      )}
      <div className="space-y-2">
        {visible.map((v, i) => {
          const counts = Object.fromEntries(
            TYPES.map((t) => [t, v.items.filter((it) => it.t === t).length]),
          ) as Record<ChangeType, number>;
          const newHere = isNew(v);
          return (
            <details
              key={v.v + v.added}
              open={isOpen(v, i)}
              onToggle={(e) => {
                const now = (e.currentTarget as HTMLDetailsElement).open;
                if (now !== isOpen(v, i))
                  setOpen((o) => ({ ...o, [v.v + v.added]: now }));
              }}
              className={`group rounded-2xl border ${newHere ? "border-sky-400 bg-sky-50/50 dark:border-sky-700 dark:bg-sky-950/30" : "border-stone-200 dark:border-stone-800"}`}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 group-open:border-b group-open:border-stone-200/70 dark:group-open:border-stone-800 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="text-stone-400 transition group-open:rotate-90"
                >
                  ▸
                </span>
                {edit && (
                  <button
                    type="button"
                    className="rounded-lg border border-stone-300 px-1.5 text-sm dark:border-stone-700"
                    title="Version bearbeiten"
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(v);
                    }}
                  >
                    ✏️
                  </button>
                )}
                <span className="font-bold">Version {v.v}</span>
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  {fmtDate(v.d)}
                </span>
                {i === 0 && (
                  <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-stone-200 dark:text-stone-900">
                    aktuell
                  </span>
                )}
                {newHere && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    neu für dich
                  </span>
                )}
                <span className="ml-auto flex gap-1.5">
                  {TYPES.filter((t) => counts[t]).map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${COUNT_TONE[t]}`}
                      title={CHANGE_TAG[t][1]}
                    >
                      {CHANGE_TAG[t][0]} {counts[t]}
                    </span>
                  ))}
                </span>
              </summary>
              <div className="px-4 pb-2 pt-1">
                {TYPES.filter((t) => !filter || t === filter).map((t) => {
                  const items = v.items.filter((it) => it.t === t);
                  if (!items.length) return null;
                  return (
                    <div key={t} className="pt-2">
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${HEAD_TONE[t]}`}
                      >
                        {CHANGE_TAG[t][0]} {CHANGE_TAG[t][1]}
                      </p>
                      <ul className="mb-2 mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                        {items.map((it, j) => (
                          <li key={j}>{it.x}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}

function VersionEditor({
  entry,
  onDone,
}: {
  entry: ShownVersion | null;
  onDone: () => void;
}) {
  const { list } = useChangelog();
  const isNew = !entry;
  const edits = getEdits();
  const edited = !!(entry?.orig && edits.ver[entry.orig]);
  const [v, setV] = useState(entry?.v ?? "");
  const [d, setD] = useState(entry?.d ?? new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ChangeItem[]>(
    entry?.items.map((it) => ({ ...it })) ?? [{ t: "neu", x: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(next: typeof edits, done = onDone) {
    setBusy(true);
    setError(null);
    try {
      await saveEdits(next);
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function save() {
    const clean = items
      .map((it) => ({ t: it.t, x: it.x.trim() }))
      .filter((it) => it.x);
    const num = v.trim();
    if (!/^\d+(\.\d+){1,3}$/.test(num))
      return setError("Bitte eine Versionsnummer wie 2.7.1 eingeben.");
    if (!d) return setError("Bitte ein Datum wählen.");
    if (!clean.length)
      return setError("Bitte mindestens einen Eintrag ausfüllen.");
    if (list.some((e) => e.v === num && e !== entry))
      return setError(`Die Version ${num} gibt es schon.`);
    const data = { v: num, d, items: clean };
    const next = { ver: { ...edits.ver }, add: [...edits.add] };
    if (entry?.orig) next.ver[entry.orig] = data;
    else if (entry?.added)
      next.add = next.add.map((a) =>
        a.id === entry.added ? { ...data, id: a.id } : a,
      );
    else next.add.push({ ...data, id: crypto.randomUUID() });
    run(next);
  }

  function reset() {
    if (
      !entry?.orig ||
      !confirm(
        `Eigene Änderungen an Version ${entry.orig} verwerfen und das Original wiederherstellen?`,
      )
    )
      return;
    const next = { ver: { ...edits.ver }, add: [...edits.add] };
    delete next.ver[entry.orig];
    run(next);
  }

  function remove() {
    if (!entry || !confirm(`Version ${entry.v} aus dem Update-Log löschen?`))
      return;
    const next = {
      ver: { ...edits.ver },
      add: edits.add.filter((a) => a.id !== entry.added),
    };
    if (entry.orig) next.ver[entry.orig] = { deleted: true };
    run(next);
  }

  const move = (i: number, by: number) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setItems(next);
  };

  return (
    <div className="space-y-4">
      {(edited || isNew) && (
        <p className="text-sm text-stone-500">
          {edited
            ? "Geändert gegenüber der Original-Version."
            : "Eigener Eintrag im Update-Log."}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Version *">
          <TextInput
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="z. B. 2.7.1"
            maxLength={20}
          />
        </Field>
        <Field label="Datum *">
          <TextInput
            type="date"
            value={d}
            onChange={(e) => setD(e.target.value)}
          />
        </Field>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Einträge</h3>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="grid grid-cols-[8.5rem_1fr] gap-2 border-t border-stone-200/70 pt-2 sm:grid-cols-[8.5rem_1fr_auto] dark:border-stone-800"
            >
              <Select
                value={it.t}
                onChange={(e) =>
                  setItems(
                    items.map((x, j) =>
                      j === i ? { ...x, t: e.target.value as ChangeType } : x,
                    ),
                  )
                }
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CHANGE_TAG[t].join(" ")}
                  </option>
                ))}
              </Select>
              <TextArea
                rows={2}
                value={it.x}
                placeholder="Was wurde geändert?"
                onChange={(e) =>
                  setItems(
                    items.map((x, j) =>
                      j === i ? { ...x, x: e.target.value } : x,
                    ),
                  )
                }
              />
              <span className="col-span-2 flex justify-end gap-1 sm:col-span-1 sm:flex-col">
                <button
                  type="button"
                  className={chip(false)}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  title="nach oben"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={chip(false)}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  title="nach unten"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className={chip(false)}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  title="Eintrag löschen"
                >
                  🗑️
                </button>
              </span>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => setItems([...items, { t: "neu", x: "" }])}
        >
          ＋ Eintrag
        </Button>
      </div>
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          💾 Speichern
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={busy}>
          ← Zurück
        </Button>
        <span className="flex-1" />
        {edited && (
          <Button
            variant="secondary"
            onClick={reset}
            disabled={busy}
            title="Eigene Änderungen an dieser Version verwerfen"
          >
            ↺ Original wiederherstellen
          </Button>
        )}
        {!isNew && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            🗑️ Version löschen
          </Button>
        )}
      </div>
      <p className="text-xs text-stone-500">
        {hasSupabase
          ? "Gespeichert wird in der Datenbank, sofort für euch beide sichtbar. Neue Versionen aus späteren Updates erscheinen trotzdem automatisch."
          : "Demo-Modus: Die Änderungen bleiben in diesem Browser."}
      </p>
    </div>
  );
}

// ---------- Fehler melden ----------

interface BugDraft {
  area: string;
  kind: string;
  text: string;
  steps: string;
  device: boolean;
}

const BUG_AREAS = [
  "Startseite",
  "Studium · Übersicht",
  "Studium · Termine",
  "Studium · ToDos",
  "Studium · Lernen",
  "Studium · Kosten",
  "Studium · Links",
  "Einstellungen",
  "Melvin · Übersicht",
  "Melvin · Finanzen",
  "Melvin · Termine",
  "Melvin · ToDos",
  "Melvin · Verträge",
  "Melvin · Lebenslauf",
  "Melvin · Notizen",
  "Die Batzi's",
  "Anleitung",
  "Anmeldung / Abmelden",
  "Sonstiges",
];

const BUG_KINDS = [
  "Etwas funktioniert nicht",
  "Falsche Darstellung / Layout",
  "Daten fehlen oder werden nicht gespeichert",
  "Text / Rechtschreibung",
  "Sonstiges",
];

function areaOf(pathname: string) {
  if (pathname === "/") return "Startseite";
  if (pathname.startsWith("/anleitung")) return "Anleitung";
  if (pathname.startsWith("/einstellungen")) return "Einstellungen";
  const melvin: Record<string, string> = {
    "/melvin": "Melvin · Übersicht",
    "/melvin/finanzen": "Melvin · Finanzen",
    "/melvin/termine": "Melvin · Termine",
    "/melvin/todos": "Melvin · ToDos",
    "/melvin/vertraege": "Melvin · Verträge",
    "/melvin/lebenslauf": "Melvin · Lebenslauf",
    "/melvin/notizen": "Melvin · Notizen",
  };
  if (melvin[pathname]) return melvin[pathname];
  const studium: [string, string][] = [
    ["/studium", "Studium · Übersicht"],
    ["/termine", "Studium · Termine"],
    ["/todos", "Studium · ToDos"],
    ["/lernen", "Studium · Lernen"],
    ["/kosten", "Studium · Kosten"],
    ["/links", "Studium · Links"],
  ];
  return studium.find(([p]) => pathname.startsWith(p))?.[1] ?? "Sonstiges";
}

function deviceInfo(version: string) {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "anderes Gerät";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${os} · ${browser} · ${screen.width}×${screen.height} (Fenster ${innerWidth}×${innerHeight}) · Version ${version}`;
}

function BugTab({
  draft,
  setDraft,
  onSent,
}: {
  draft: BugDraft | null;
  setDraft: (d: BugDraft | null) => void;
  onSent: () => void;
}) {
  const pathname = usePathname();
  const { current } = useChangelog();
  const reports = useTable("bug_reports");
  const d: BugDraft = draft ?? {
    area: areaOf(pathname),
    kind: BUG_KINDS[0],
    text: "",
    steps: "",
    device: true,
  };
  const set = (patch: Partial<BugDraft>) => setDraft({ ...d, ...patch });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  async function send() {
    if (!d.text.trim())
      return setStatus("Bitte kurz beschreiben, was passiert ist.");
    setBusy(true);
    setStatus("Wird gesendet …");
    try {
      const email = hasSupabase
        ? ((await supabase().auth.getSession()).data.session?.user.email ??
          null)
        : null;
      await reports.insert({
        area: d.area,
        kind: d.kind,
        text: d.text.trim(),
        steps: d.steps.trim() || null,
        reporter: email,
        device: d.device ? deviceInfo(current?.v ?? "?") : null,
        version: current?.v ?? null,
        done: false,
      });
      setDraft(null);
      setStatus("✅ Danke! Der Fehler wurde gemeldet.");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : String((e as { message?: string })?.message ?? e);
      setStatus(
        /bug_reports/.test(msg)
          ? "Die Tabelle für Fehlermeldungen fehlt noch. Bitte supabase/migrations/0015_versionen_fehler.sql in Supabase ausführen."
          : `Die Meldung konnte nicht gesendet werden: ${msg}`,
      );
    }
    setBusy(false);
  }

  const sorted = [...reports.rows].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  const open = sorted.filter((r) => !r.done);
  const done = sorted.filter((r) => r.done);
  const shown = showDone ? sorted : open;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Hier bitte <b>Fehler der Webseite</b> melden, z. B. wenn etwas falsch
        angezeigt wird, ein Knopf nicht funktioniert oder Eingaben nicht
        gespeichert werden. Wünsche und Ideen passen auch.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bereich *">
          <Select
            value={d.area}
            onChange={(e) => set({ area: e.target.value })}
          >
            {BUG_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Art des Fehlers *">
          <Select
            value={d.kind}
            onChange={(e) => set({ kind: e.target.value })}
          >
            {BUG_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Was ist passiert? *">
        <TextArea
          rows={4}
          value={d.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="z. B. Beim Speichern einer Frage unter Lernen → Fragen passiert nichts."
        />
      </Field>
      <Field label="Was hast du davor gemacht? (optional)">
        <TextArea
          rows={2}
          value={d.steps}
          onChange={(e) => set({ steps: e.target.value })}
          placeholder="z. B. Lernen geöffnet → Fragen → Neue Frage → Bild hinzugefügt"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={d.device}
          onChange={(e) => set({ device: e.target.checked })}
        />{" "}
        Gerätedaten mitsenden (Gerät, Browser, Bildschirmgröße, Version)
      </label>
      {status && <p className="text-sm">{status}</p>}
      <div className="flex gap-2">
        <Button onClick={send} disabled={busy} className="flex-1 sm:flex-none">
          🐞 Fehler senden
        </Button>
        {status?.startsWith("✅") && (
          <Button variant="secondary" onClick={onSent}>
            Schließen
          </Button>
        )}
      </div>

      <div className="border-t border-stone-200/70 pt-4 dark:border-stone-800">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="flex-1 font-semibold">
            Gemeldete Fehler{" "}
            {open.length > 0 && (
              <span className="text-stone-500">({open.length} offen)</span>
            )}
          </h3>
          {done.length > 0 && (
            <button
              type="button"
              className={chip(showDone)}
              onClick={() => setShowDone(!showDone)}
            >
              Erledigte zeigen ({done.length})
            </button>
          )}
        </div>
        {reports.error && !/bug_reports/.test(reports.error) && (
          <p className="text-sm text-rose-600">{reports.error}</p>
        )}
        {shown.length === 0 ? (
          <p className="py-3 text-sm text-stone-500">
            {open.length === 0 && done.length > 0
              ? "Alles erledigt 🎉"
              : "Noch nichts gemeldet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border border-stone-200 p-3 text-sm dark:border-stone-800 ${r.done ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <label className="flex flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={r.done}
                      onChange={(e) =>
                        reports.update(r.id, { done: e.target.checked })
                      }
                      title="Erledigt"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block font-semibold ${r.done ? "line-through" : ""}`}
                      >
                        {r.area} · {r.kind}
                      </span>
                      <span className="block whitespace-pre-wrap">
                        {r.text}
                      </span>
                      {r.steps && (
                        <span className="mt-1 block whitespace-pre-wrap text-stone-500">
                          Vorher: {r.steps}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-stone-500">
                        {r.created_at &&
                          new Date(r.created_at).toLocaleString("de-DE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        {r.reporter && ` · ${r.reporter}`}
                        {r.device && ` · ${r.device}`}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-stone-400 hover:text-rose-600"
                    title="Löschen"
                    onClick={() =>
                      confirm("Diese Meldung löschen?") && reports.remove(r.id)
                    }
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
