"use client";

import { useEffect, useState } from "react";
import { saveStartPage, START_GROUPS, startPageOf } from "@/lib/startPage";
import { hasSupabase, supabase } from "@/lib/supabase";
import { Card, Field, Select } from "./ui";

/** Lets the signed-in person pick the page the site opens on. */
export function StartPagePicker({ className = "" }: { className?: string }) {
  const [value, setValue] = useState<string | null>(hasSupabase ? null : startPageOf(null));
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase()
      .auth.getSession()
      .then(({ data }) => setValue(startPageOf(data.session)));
  }, []);

  async function change(href: string) {
    const before = value;
    setValue(href);
    setStatus(null);
    try {
      await saveStartPage(href);
      setStatus("Gespeichert. Gilt ab dem nächsten Öffnen der Seite, auf all deinen Geräten.");
    } catch (e) {
      setValue(before);
      setStatus(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <Card className={`space-y-3 ${className}`}>
      <h2 className="font-medium">Startseite</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Welche Seite soll sich öffnen, wenn du die Seite aufrufst? Das gilt nur für dein Konto. Über „Startseite“ kommst du jederzeit zurück zu allen
        Bereichen.
      </p>
      <Field label="Beim Öffnen starten mit">
        <Select value={value ?? ""} disabled={value === null} onChange={(e) => change(e.target.value)} className="sm:max-w-sm">
          {START_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.href} value={o.href}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      {status && <p className="text-sm">{status}</p>}
    </Card>
  );
}
