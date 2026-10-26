"use client";

import { depth } from "@/lib/learning";
import { useTable } from "@/lib/useTable";
import type { Topic } from "@/lib/types";
import { Select } from "./ui";

export function TopicSelect({ topics, value, onChange, allowAll }: { topics: Topic[]; value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const subjects = useTable("subjects");
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={!allowAll}>
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
  );
}

function flatten(topics: Topic[], subjectId: string, parent: string | null = null): Topic[] {
  return topics
    .filter((t) => t.subject_id === subjectId && t.parent_id === parent)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .flatMap((t) => [t, ...flatten(topics, subjectId, t.id)]);
}
