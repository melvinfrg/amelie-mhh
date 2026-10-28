"use client";

import Link from "next/link";
import { useState } from "react";
import { examDay, inReminderWindow, timeLeft } from "@/lib/examReminder";
import { useTable } from "@/lib/useTable";

const STORAGE_KEY = "pruefung-hinweis-ausgeblendet";

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Hint on the start pages for every exam that is three months or less away, until it is hidden. */
export function ExamReminder({ className = "" }: { className?: string }) {
  const events = useTable("events");
  const [hidden, setHidden] = useState(readHidden);

  const exams = events.rows
    .filter((e) => inReminderWindow(e) && !hidden.includes(e.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (exams.length === 0) return null;

  function hide(id: string) {
    const next = [...hidden, id];
    setHidden(next);
    try {
      // Only exams that still exist are kept, so the list doesn't grow forever.
      const ids = new Set(events.rows.map((e) => e.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.filter((h) => ids.has(h))));
    } catch {
      // Not remembered in private mode.
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {exams.map((e) => (
        <div
          key={e.id}
          role="status"
          className="flex items-start gap-3 rounded-[1.75rem] bg-amber-50 p-4 text-amber-950 shadow-soft ring-1 ring-amber-200 sm:items-center sm:p-5 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
        >
          <span aria-hidden className="text-2xl leading-none">
            📚
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {e.title}: {timeLeft(e.starts_at)}
            </p>
            <p className="text-sm opacity-80">
              Prüfung am {examDay(e)}. Zeit, mit dem Lernen anzufangen!{" "}
              <Link href="/lernen" className="font-semibold underline underline-offset-2">
                Zum Lernen
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => hide(e.id)}
            className="shrink-0 rounded-xl px-2 py-1 text-sm font-semibold opacity-70 transition hover:bg-amber-100 hover:opacity-100 dark:hover:bg-amber-900/50"
            aria-label={`Hinweis zu ${e.title} ausblenden`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
