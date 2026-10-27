"use client";

import { useState } from "react";
import { depth } from "@/lib/learning";
import { DEFAULT_SUBJECTS } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";
import type { Topic } from "@/lib/types";
import { Button, Select, TextInput } from "./ui";

export function TopicSelect({
  topics,
  value,
  onChange,
  allowAll,
  creatable,
}: {
  topics: Topic[];
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
  /** Offer to create a topic (and its subject) right here, e.g. when none exist yet. */
  creatable?: boolean;
}) {
  const subjects = useTable("subjects");
  const [creating, setCreating] = useState(false);
  const empty = subjects.loaded && topics.length === 0;

  if (creatable && (creating || empty)) {
    return (
      <NewTopic
        onCreated={(id) => {
          setCreating(false);
          onChange(id);
        }}
        onCancel={empty ? undefined : () => setCreating(false)}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={!allowAll} className="flex-1">
        <option value="">{allowAll ? "Alle Themen" : "Thema wählen …"}</option>
        {[...subjects.rows]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => (
            <optgroup key={s.id} label={s.name}>
              {flatten(topics, s.id).map((t) => (
                <option key={t.id} value={t.id}>
                  {"  ".repeat(depth(topics, t))}
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
      </Select>
      {creatable && (
        <Button type="button" variant="secondary" onClick={() => setCreating(true)} title="Neues Thema anlegen">
          + Neu
        </Button>
      )}
    </div>
  );
}

/** Creates a topic; subjects that don't exist yet come from the Vorklinik list and are created on the way. */
function NewTopic({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const missing = DEFAULT_SUBJECTS.filter((d) => !subjects.rows.some((s) => s.name === d.name));
  const choices = [
    ...[...subjects.rows].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ value: s.id, label: s.name })),
    ...missing.map((d) => ({ value: `new:${d.name}`, label: d.name })),
  ];
  const [subject, setSubject] = useState(() => choices.find((c) => c.label === "Anatomie")?.value ?? choices[0]?.value ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !subject) return;
    setBusy(true);
    try {
      let subjectId = subject;
      if (subject.startsWith("new:")) {
        const preset = DEFAULT_SUBJECTS.find((d) => d.name === subject.slice(4))!;
        subjectId = (await subjects.insert(preset)).id;
      }
      const sort = topics.rows.filter((t) => t.subject_id === subjectId && !t.parent_id).length;
      const topic = await topics.insert({ subject_id: subjectId, parent_id: null, name: name.trim(), sort });
      onCreated(topic.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-stone-300 p-3 dark:border-stone-700">
      <p className="text-sm text-stone-600 dark:text-stone-300">Neues Thema anlegen:</p>
      <div className="flex flex-wrap gap-2">
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-44" aria-label="Fach">
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // The picker sits inside other forms; Enter should create the topic, not submit them.
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
          placeholder="z. B. Schulter"
          className="min-w-40 flex-1"
          aria-label="Name des Themas"
        />
        <Button type="button" onClick={create} disabled={busy || !name.trim()}>
          Anlegen
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
    </div>
  );
}

function flatten(topics: Topic[], subjectId: string, parent: string | null = null): Topic[] {
  return topics
    .filter((t) => t.subject_id === subjectId && t.parent_id === parent)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .flatMap((t) => [t, ...flatten(topics, subjectId, t.id)]);
}
