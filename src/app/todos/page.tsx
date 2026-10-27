"use client";

import { useState, type FormEvent } from "react";
import { compareTodos, matchesTodoFilter, PrioritySelect, TodoFilterSelect, TodoRow, type TodoFilter } from "@/components/todos";
import { Button, Card, Empty, ErrorNote, PageHeader, Select, TextInput } from "@/components/ui";
import { SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";

export default function TodosPage() {
  const todos = useTable("todos");
  const subjects = useTable("subjects");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState<TodoFilter>("open");

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

  const visible = todos.rows.filter((t) => matchesTodoFilter(t, filter)).sort(compareTodos);
  const doneCount = todos.rows.filter((t) => t.done).length;

  return (
    <>
      <PageHeader
        title="ToDos"
        subtitle={`${todos.rows.length - doneCount} offen · ${doneCount} erledigt`}
        action={<TodoFilterSelect value={filter} onChange={setFilter} />}
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
          <PrioritySelect value={priority} onChange={setPriority} />
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

      <Card className="divide-y divide-stone-100 p-0 dark:divide-stone-800">
        {visible.length === 0 && <Empty>Nichts zu tun 🎉</Empty>}
        {visible.map((t) => {
          const subject = subjects.rows.find((s) => s.id === t.subject_id);
          return (
            <TodoRow
              key={t.id}
              todo={t}
              onToggle={() => todos.update(t.id, { done: !t.done })}
              onRemove={() => todos.remove(t.id)}
              tag={
                subject && (
                  <span className="flex items-center gap-1">
                    <SubjectDot color={subject.color} /> {subject.name}
                  </span>
                )
              }
            />
          );
        })}
      </Card>
    </>
  );
}
