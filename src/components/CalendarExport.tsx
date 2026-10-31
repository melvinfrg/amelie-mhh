"use client";

import { useState } from "react";
import { Button, Card, TextInput } from "@/components/ui";
import { download, matchesFilter, toIcs } from "@/lib/ical";
import { KIND_LABEL } from "@/lib/labels";
import { hasSupabase } from "@/lib/supabase";
import { eventSubjects, SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";
import type { CalendarFeed, EventKind, FeedFilter } from "@/lib/types";

const KINDS = Object.keys(KIND_LABEL) as EventKind[];

function toggle<T>(list: T[] | undefined, value: T) {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function describe(filter: FeedFilter, subjectName: (id: string) => string) {
  const parts = [
    filter.kinds?.length ? filter.kinds.map((k) => KIND_LABEL[k]).join(", ") : "alle Arten",
    filter.subjects?.length ? filter.subjects.map(subjectName).join(", ") : "alle Fächer",
  ];
  if (filter.hideDone) parts.push("ohne Erledigte");
  return parts.join(" · ");
}

function feedUrl(feed: CalendarFeed) {
  return `${window.location.origin}/api/kalender/${feed.token}.ics`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          prompt("Link kopieren:", text);
        }
      }}
    >
      {copied ? "Kopiert ✓" : label}
    </Button>
  );
}

export function CalendarExport() {
  const events = useTable("events");
  const subjects = useTable("subjects");
  const feeds = useTable("calendar_feeds");
  const [filter, setFilter] = useState<FeedFilter>({ hideDone: true });
  const [name, setName] = useState("Studium MHH");
  const [shown, setShown] = useState<string | null>(null);

  const subjectName = (id: string) => (id === "none" ? "ohne Fach" : (subjects.rows.find((s) => s.id === id)?.name ?? "gelöschtes Fach"));
  const matching = events.rows.filter((e) => matchesFilter(e, filter));

  function downloadFile() {
    const file = toIcs(
      matching.map((e) => ({ ...e, subject: eventSubjects(e, subjects.rows).map((s) => s.name).join(", ") || null })),
      name || "Studium MHH",
    );
    download(`${(name || "studium").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}.ics`, file, "text/calendar;charset=utf-8");
  }

  async function createFeed() {
    const feed = await feeds.insert({ name: name || "Studium MHH", filter, token: crypto.randomUUID() } as Omit<CalendarFeed, "id">);
    setShown(feed.id);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      active
        ? "border-brand-700 bg-brand-700 text-white"
        : "border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
    }`;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-medium">In anderen Kalender übernehmen</h2>
        <p className="text-sm text-stone-500">Für Apple Kalender, Supershift, Google Kalender oder Outlook. Ohne Auswahl wird alles übernommen.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-stone-500">Art</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} className={chip(Boolean(filter.kinds?.includes(k)))} onClick={() => setFilter({ ...filter, kinds: toggle(filter.kinds, k) })}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {subjects.rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-500">Fach</p>
          <div className="flex flex-wrap gap-2">
            {subjects.rows.map((s) => (
              <button
                key={s.id}
                className={`${chip(Boolean(filter.subjects?.includes(s.id)))} flex items-center gap-1.5`}
                onClick={() => setFilter({ ...filter, subjects: toggle(filter.subjects, s.id) })}
              >
                <SubjectDot color={s.color} /> {s.name}
              </button>
            ))}
            <button className={chip(Boolean(filter.subjects?.includes("none")))} onClick={() => setFilter({ ...filter, subjects: toggle(filter.subjects, "none") })}>
              ohne Fach
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(filter.hideDone)} onChange={(e) => setFilter({ ...filter, hideDone: e.target.checked })} />
        Erledigte weglassen
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-stone-500">Name im Kalender</span>
          <TextInput className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <Button variant="secondary" onClick={downloadFile} disabled={!matching.length}>
          {matching.length === 1 ? "1 Termin als Datei" : `${matching.length} Termine als Datei`} (.ics)
        </Button>
        {hasSupabase && <Button onClick={createFeed}>Abo-Link erstellen</Button>}
      </div>

      <details className="text-sm text-stone-600 dark:text-stone-300">
        <summary className="cursor-pointer font-medium">Datei oder Abo – was ist der Unterschied?</summary>
        <div className="mt-2 space-y-2">
          <p>
            <strong>Datei:</strong> eine Momentaufnahme. Auf dem iPhone die Datei öffnen und „Alle hinzufügen“ tippen; Apps wie Supershift können .ics-Dateien
            importieren. Spätere Änderungen hier kommen nicht mit.
          </p>
          <p>
            <strong>Abo-Link:</strong> der Kalender bleibt automatisch aktuell (Apple Kalender fragt etwa stündlich nach). iPhone: Einstellungen → Apps →
            Kalender → Kalenderaccounts → Account hinzufügen → Andere → „Kalenderabo hinzufügen“ und den Link einfügen, oder einfach unten auf „In Apple
            Kalender öffnen“ tippen. Supershift zeigt die Kalender des Handys mit an: erst wie beschrieben abonnieren, dann den Kalender in Supershift
            in den Kalender-Einstellungen einblenden. Google Kalender: „Andere Kalender“ → „Per URL“ und den https-Link einfügen. Wer den Link kennt, sieht die
            Termine, also nicht öffentlich teilen.
          </p>
        </div>
      </details>

      {feeds.rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-500">Abo-Links</p>
          {feeds.rows.map((feed) => {
            const url = feedUrl(feed);
            return (
              <div key={feed.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{feed.name}</p>
                    <p className="text-xs text-stone-500">{describe(feed.filter ?? {}, subjectName)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => setShown(shown === feed.id ? null : feed.id)}>
                      {shown === feed.id ? "Ausblenden" : "Link zeigen"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        confirm(`Abo „${feed.name}“ löschen? Kalender, die es abonniert haben, bekommen dann keine Termine mehr.`) && feeds.remove(feed.id)
                      }
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
                {shown === feed.id && (
                  <div className="mt-3 space-y-2">
                    <code className="block break-all rounded bg-stone-100 px-2 py-1 text-xs dark:bg-stone-800">{url}</code>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={url.replace(/^https?:/, "webcal:")}
                        className="inline-flex items-center rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
                      >
                        In Apple Kalender öffnen
                      </a>
                      <CopyButton text={url} label="Link kopieren" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!hasSupabase && <p className="text-xs text-stone-500">Abo-Links gibt es nur mit Konto, im Demo-Modus nur die Datei.</p>}
    </Card>
  );
}
