"use client";

import { useState, type FormEvent } from "react";
import { compareTodos, matchesTodoFilter, PrioritySelect, TodoFilterSelect, TodoRow, type TodoFilter } from "@/components/todos";
import { Button, Card, Empty, ErrorNote, PageHeader, TextInput } from "@/components/ui";
import { useTable } from "@/lib/useTable";

const SUGGESTED = ["Haushalt", "Arbeit", "Papierkram", "Einkaufen", "Auto", "Sport"];

export default function MelvinTodos() {
  const todos = useTable("melvin_todos");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<TodoFilter>("open");
  const [only, setOnly] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await todos.insert({ title: title.trim(), due_date: due || null, priority, category: category.trim() || null, notes: null, done: false });
    setTitle("");
    setDue("");
  }

  const categories = [...new Set(todos.rows.map((t) => t.category).filter((c): c is string => Boolean(c)))].sort();
  const visible = todos.rows
    .filter((t) => matchesTodoFilter(t, filter) && (!only || t.category === only))
    .sort(compareTodos);
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
            placeholder="Neue Aufgabe, z. B. Steuererklärung abschicken"
            className="min-w-48 flex-1"
            aria-label="Neue Aufgabe"
          />
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" aria-label="Fällig am" />
          <PrioritySelect value={priority} onChange={setPriority} />
          <TextInput
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Bereich"
            className="w-36"
            list="todo-bereiche"
            aria-label="Bereich"
          />
          <datalist id="todo-bereiche">
            {[...new Set([...categories, ...SUGGESTED])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button type="submit">Hinzufügen</Button>
        </form>
      </Card>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "alle"}
              onClick={() => setOnly(c)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                only === c
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-stone-300 bg-white/60 text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200"
              }`}
            >
              {c ?? "Alle"}
            </button>
          ))}
        </div>
      )}

      <Card className="divide-y divide-stone-100 p-0 dark:divide-stone-800">
        {visible.length === 0 && <Empty>Nichts zu tun 🎉</Empty>}
        {visible.map((t) => (
          <TodoRow
            key={t.id}
            todo={t}
            onToggle={() => todos.update(t.id, { done: !t.done })}
            onRemove={() => todos.remove(t.id)}
            tag={t.category && <span className="rounded-full bg-brand-50 px-2 text-brand-800 dark:bg-brand-950 dark:text-brand-200">{t.category}</span>}
          />
        ))}
      </Card>
    </>
  );
}
