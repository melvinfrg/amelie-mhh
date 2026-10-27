"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useTable } from "@/lib/useTable";

export default function Notizen() {
  const notes = useTable("notes");
  const [draft, setDraft] = useState({ title: "", body: "" });

  const sorted = [...notes.rows].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    await notes.insert({ title: draft.title.trim(), body: draft.body.trim(), pinned: false });
    setDraft({ title: "", body: "" });
  }

  return (
    <>
      <PageHeader title="Notizen" subtitle="Gedanken, Ideen, Merkzettel" />
      <ErrorNote error={notes.error} />

      <Card className="mb-6">
        <form onSubmit={save} className="space-y-3">
          <TextInput
            placeholder="Titel (optional)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <TextArea
            required
            rows={3}
            placeholder="Neue Notiz …"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <Button type="submit">Notiz speichern</Button>
        </form>
      </Card>

      {sorted.length === 0 ? (
        <Empty>Noch keine Notizen.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{n.title || "Notiz"}</p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    aria-label={n.pinned ? "Lösen" : "Anheften"}
                    title={n.pinned ? "Lösen" : "Anheften"}
                    onClick={() => notes.update(n.id, { pinned: !n.pinned })}
                  >
                    {n.pinned ? "📌" : "📍"}
                  </Button>
                  <Button variant="danger" aria-label="Löschen" onClick={() => notes.remove(n.id)}>
                    ✕
                  </Button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{n.body}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
