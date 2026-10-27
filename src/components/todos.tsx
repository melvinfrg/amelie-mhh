"use client";

import type { ReactNode } from "react";
import { Button, Select } from "@/components/ui";
import { countdown, daysUntil } from "@/lib/dates";
import { PRIORITY_LABEL } from "@/lib/labels";

/** Building blocks shared by every "ToDos" page, so Melvin's and Amelie's look the same. */

const PRIORITY_TONE = { 1: "text-rose-600", 2: "text-amber-600", 3: "text-stone-500" } as const;

interface TodoLike {
  id: string;
  title: string;
  due_date: string | null;
  priority: 1 | 2 | 3;
  done: boolean;
}

/** Open first, then by due date (none last) and priority. */
export function compareTodos(a: TodoLike, b: TodoLike) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.priority - b.priority;
}

export type TodoFilter = "open" | "all" | "done";

export function matchesTodoFilter(t: TodoLike, filter: TodoFilter) {
  return filter === "all" ? true : filter === "done" ? t.done : !t.done;
}

export function TodoFilterSelect({ value, onChange }: { value: TodoFilter; onChange: (v: TodoFilter) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as TodoFilter)} className="w-auto">
      <option value="open">Offen</option>
      <option value="done">Erledigt</option>
      <option value="all">Alle</option>
    </Select>
  );
}

export function PrioritySelect({ value, onChange }: { value: 1 | 2 | 3; onChange: (v: 1 | 2 | 3) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(Number(e.target.value) as 1 | 2 | 3)} className="w-auto" aria-label="Priorität">
      {([1, 2, 3] as const).map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}

export function TodoRow({
  todo,
  tag,
  onToggle,
  onRemove,
}: {
  todo: TodoLike;
  /** E.g. the subject or category. */
  tag?: ReactNode;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const overdue = !todo.done && todo.due_date && daysUntil(todo.due_date) < 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <input type="checkbox" checked={todo.done} onChange={onToggle} className="h-5 w-5 accent-brand-700" aria-label={`${todo.title} erledigt`} />
      <div className="min-w-0 flex-1">
        <p className={todo.done ? "text-stone-400 line-through" : "font-medium"}>{todo.title}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span className={PRIORITY_TONE[todo.priority]}>● {PRIORITY_LABEL[todo.priority]}</span>
          {todo.due_date && <span className={overdue ? "font-semibold text-rose-600" : ""}>fällig {countdown(todo.due_date)}</span>}
          {tag}
        </p>
      </div>
      <Button variant="danger" onClick={onRemove} aria-label="Löschen">
        ✕
      </Button>
    </div>
  );
}
