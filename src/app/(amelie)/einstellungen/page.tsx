"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, PageHeader, TextInput } from "@/components/ui";
import { db } from "@/lib/db";
import { download } from "@/lib/ical";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { useSettings } from "@/lib/settings";
import { TABLES, type TableName } from "@/lib/types";
import { resetCache } from "@/lib/useTable";

const PUSH_TEXT: Record<PushState, string> = {
  on: "Auf diesem Gerät eingeschaltet.",
  off: "Auf diesem Gerät ausgeschaltet.",
  denied: "Benachrichtigungen sind für diese Seite blockiert. Erlauben lässt sich das in den Einstellungen des Browsers bzw. unter iOS-Einstellungen → Mitteilungen.",
  install: "Auf dem iPhone geht das nur in der App: Seite über Teilen → „Zum Home-Bildschirm“ installieren, dort öffnen und hier einschalten.",
  unsupported: "Dieser Browser kann keine Push-Benachrichtigungen empfangen.",
  unconfigured: "Push-Benachrichtigungen sind auf dem Server noch nicht eingerichtet.",
};

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    pushState().then(setState, () => setState("unsupported"));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === "on") await disablePush();
      else await enablePush();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setState(await pushState().catch(() => "unsupported" as const));
    setBusy(false);
  }

  return (
    <Card className="mb-4 space-y-3">
      <h2 className="font-medium">Benachrichtigungen</h2>
      <p className="text-sm text-stone-500">
        3 Monate vor jeder Prüfung kommt eine Push-Erinnerung aufs Handy, und auf der Startseite erscheint ein Hinweis. Einschalten auf jedem Gerät, das
        erinnert werden soll.
      </p>
      {state && <p className="text-sm">{PUSH_TEXT[state]}</p>}
      {(state === "on" || state === "off") && (
        <Button variant={state === "on" ? "secondary" : "primary"} onClick={toggle} disabled={busy}>
          {state === "on" ? "Ausschalten" : "🔔 Einschalten"}
        </Button>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </Card>
  );
}

export default function EinstellungenPage() {
  const { settings, save } = useSettings();
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    const data: Record<string, unknown[]> = {};
    for (const t of TABLES) data[t] = await db.list(t);
    download(`studium-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, data }, null, 2), "application/json");
  }

  async function importBackup(file: File) {
    try {
      const { data } = JSON.parse(await file.text()) as { data: Partial<Record<TableName, { id: string }[]>> };
      let count = 0;
      for (const t of TABLES) {
        const existing = new Set((await db.list(t)).map((r) => r.id));
        for (const row of data[t] ?? []) {
          if (existing.has(row.id)) continue;
          // user_id belongs to whoever exported; the database fills in the current user.
          const rest: Record<string, unknown> = { ...row };
          delete rest.user_id;
          await db.insert(t, rest as never);
          count++;
        }
      }
      resetCache();
      setStatus(`${count} Einträge importiert.`);
    } catch (e) {
      setStatus(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <PageHeader title="Einstellungen" />

      <Card className="mb-4 space-y-4">
        <h2 className="font-medium">Lernen</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Neue Fragen pro Tag">
            <TextInput
              type="number"
              min={0}
              max={500}
              value={settings.daily_new_limit}
              onChange={(e) => save({ daily_new_limit: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Ziel-Behaltensquote: ${Math.round(settings.desired_retention * 100)}%`}>
            <input
              type="range"
              min={0.75}
              max={0.97}
              step={0.01}
              value={settings.desired_retention}
              onChange={(e) => save({ desired_retention: Number(e.target.value) })}
              className="w-full accent-brand-700"
            />
            <span className="text-xs text-stone-500">Höher = häufigere Wiederholungen, dafür sitzt mehr.</span>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-700"
            checked={settings.gating_enabled}
            onChange={(e) => save({ gating_enabled: e.target.checked })}
          />
          Von groß nach klein: Unterthemen erst freischalten, wenn das übergeordnete Thema sitzt
        </label>
        {settings.gating_enabled && (
          <Field label={`Freischalten ab ${Math.round(settings.unlock_threshold * 100)}% sicherer Fragen`}>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={settings.unlock_threshold}
              onChange={(e) => save({ unlock_threshold: Number(e.target.value) })}
              className="w-full max-w-sm accent-brand-700"
            />
          </Field>
        )}
      </Card>

      <PushCard />

      <Card className="space-y-3">
        <h2 className="font-medium">Datensicherung</h2>
        <p className="text-sm text-stone-500">
          Exportiert alle Termine, To-dos, Links, Fächer, Fragen und den Lernverlauf als JSON-Datei. Der Import ergänzt fehlende Einträge.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            Backup herunterladen
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Backup importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
          />
        </div>
        {status && <p className="text-sm">{status}</p>}
      </Card>
    </>
  );
}
