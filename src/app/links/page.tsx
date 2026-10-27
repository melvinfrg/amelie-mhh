"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, TextInput } from "@/components/ui";
import { useTable } from "@/lib/useTable";
import type { LinkItem } from "@/lib/types";

const SUGGESTED: Omit<LinkItem, "id">[] = [
  { title: "MHH Hannover", url: "https://www.mhh.de", category: "MHH", description: "Startseite der Hochschule" },
  { title: "AMBOSS", url: "https://next.amboss.com/de", category: "Lernen", description: "Nachschlagewerk & Prüfungsfragen" },
  { title: "via medici (Thieme)", url: "https://viamedici.thieme.de", category: "Lernen", description: "Lernmodule und Prüfungsvorbereitung" },
  { title: "Kenhub", url: "https://www.kenhub.com/de", category: "Lernen", description: "Anatomie mit Bildern und Videos" },
  { title: "AnkiWeb", url: "https://ankiweb.net", category: "Lernen", description: "Anki-Karten synchronisieren" },
  { title: "IMPP", url: "https://www.impp.de", category: "Prüfungen", description: "Staatsexamen, Termine und Gegenstandskataloge" },
  { title: "Studentenwerk Hannover", url: "https://www.studentenwerk-hannover.de", category: "Alltag", description: "Mensa, BAföG, Wohnen" },
];

export default function LinksPage() {
  const links = useTable("links");
  const [draft, setDraft] = useState({ title: "", url: "", category: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = [...new Set(links.rows.map((l) => l.category || "Allgemein"))].sort();
  const missingSuggestions = SUGGESTED.filter((s) => !links.rows.some((l) => l.url === s.url));

  async function save(e: FormEvent) {
    e.preventDefault();
    const url = /^https?:\/\//.test(draft.url) ? draft.url : `https://${draft.url}`;
    const row = { ...draft, url, category: draft.category || "Allgemein", description: draft.description || null };
    if (editingId) await links.update(editingId, row);
    else await links.insert(row);
    setDraft({ title: "", url: "", category: "", description: "" });
    setEditingId(null);
  }

  return (
    <>
      <PageHeader title="Links" subtitle="Wichtige Seiten und Apps auf einen Blick" />
      <ErrorNote error={links.error} />
      <Card className="mb-6">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4">
          <Field label="Titel">
            <TextInput required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <TextInput required value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Kategorie">
            <TextInput
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              list="link-categories"
              placeholder="z. B. MHH"
            />
            <datalist id="link-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Beschreibung">
            <TextInput value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit">{editingId ? "Speichern" : "+ Link"}</Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                Abbrechen
              </Button>
            )}
            {missingSuggestions.length > 0 && links.loaded && (
              <Button
                type="button"
                variant="secondary"
                className="ml-auto"
                onClick={async () => {
                  for (const s of missingSuggestions) await links.insert(s);
                }}
              >
                Vorschläge hinzufügen ({missingSuggestions.length})
              </Button>
            )}
          </div>
        </form>
      </Card>

      {links.rows.length === 0 && links.loaded && <Empty>Noch keine Links gespeichert.</Empty>}
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{category}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.rows
                .filter((l) => (l.category || "Allgemein") === category)
                .map((l) => (
                  <Card key={l.id} className="flex flex-col">
                    <a href={l.url} target="_blank" rel="noreferrer" className="font-medium text-brand-800 hover:underline dark:text-brand-300">
                      {l.title} ↗
                    </a>
                    {l.description && <p className="mt-1 text-sm text-stone-500">{l.description}</p>}
                    <p className="mt-1 truncate text-xs text-stone-400">{l.url}</p>
                    <div className="mt-auto flex justify-end gap-1 pt-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingId(l.id);
                          setDraft({ title: l.title, url: l.url, category: l.category, description: l.description ?? "" });
                        }}
                      >
                        Bearbeiten
                      </Button>
                      <Button variant="danger" onClick={() => links.remove(l.id)}>
                        Löschen
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
