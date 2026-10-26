"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, PageHeader, Select, TextInput } from "@/components/ui";
import { countdown, daysUntil } from "@/lib/dates";
import { PRIORITY_LABEL } from "@/lib/labels";
import { SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";
import type { Todo } from "@/lib/types";

const PRIORITY_TONE = { 1: "text-rose-600", 2: "text-amber-600", 3: "text-slate-500" } as const;

function compare(a: Todo, b: Todo) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ad = a.due_date ?? "9999";
  const bd = b.due_date ?? "9999";
  return ad.localeCompare(bd) || a.priority - b.priority;
}

export default function TodosPage() {
  const todos = useTable("todos");
  const subjects = useTable("subjects");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | "done">("open");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await todos.insert({
      title: title.trim(),
      due_date: due || null,
      priority,
      subject_id: subjectId || null,
      notes: null,
      done: false,
    });
    setTitle("");
    setDue("");
  }

  const visible = todos.rows
    .filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done))
    .sort(compare);
  const doneCount = todos.rows.filter((t) => t.done).length;

  return (
    <>
      <PageHeader
        title="To-dos"
        subtitle={`${todos.rows.length - doneCount} offen · ${doneCount} erledigt`}
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-auto">
            <option value="open">Offen</option>
            <option value="done">Erledigt</option>
            <option value="all">Alle</option>
          </Select>
        }
      />
      <ErrorNote error={todos.error} />
      <Card className="mb-4">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neue Aufgabe, z. B. Präp-Besteck kaufen"
            className="min-w-48 flex-1"
            aria-label="Neue Aufgabe"
          />
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" aria-label="Fällig am" />
          <Select value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)} className="w-auto" aria-label="Priorität">
            {([1, 2, 3] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-auto" aria-label="Fach">
            <option value="">Kein Fach</option>
            {subjects.rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Hinzufügen</Button>
        </form>
      </Card>

      <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
        {visible.length === 0 && <Empty>Nichts zu tun 🎉</Empty>}
        {visible.map((t) => {
          const subject = subjects.rows.find((s) => s.id === t.subject_id);
          const overdue = !t.done && t.due_date && daysUntil(t.due_date) < 0;
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => todos.update(t.id, { done: !t.done })}
                className="h-5 w-5 accent-teal-700"
                aria-label={`${t.title} erledigt`}
              />
              <div className="min-w-0 flex-1">
                <p className={t.done ? "text-slate-400 line-through" : ""}>{t.title}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={PRIORITY_TONE[t.priority]}>● {PRIORITY_LABEL[t.priority]}</span>
                  {t.due_date && <span className={overdue ? "font-medium text-rose-600" : ""}>fällig {countdown(t.due_date)}</span>}
                  {subject && (
                    <span className="flex items-center gap-1">
                      <SubjectDot color={subject.color} /> {subject.name}
                    </span>
                  )}
                </p>
              </div>
              <Button variant="danger" onClick={() => todos.remove(t.id)} aria-label="Löschen">
                ✕
              </Button>
            </div>
          );
        })}
      </Card>
    </>
  );
}
