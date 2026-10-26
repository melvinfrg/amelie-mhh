"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Empty, ErrorNote, PageHeader, ProgressBar, TextInput } from "@/components/ui";
import { buildQueue, childrenOf, descendants, isNew, isUnlocked, mastery } from "@/lib/learning";
import { useSettings } from "@/lib/settings";
import { DEFAULT_SUBJECTS, SubjectDot } from "@/lib/subjects";
import { useTable } from "@/lib/useTable";
import type { Question, Subject, Topic } from "@/lib/types";

export default function LernenPage() {
  const subjects = useTable("subjects");
  const topics = useTable("topics");
  const questions = useTable("questions");
  const reviews = useTable("reviews");
  const { settings } = useSettings();
  const [newSubject, setNewSubject] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const queue = buildQueue({ topics: topics.rows, questions: questions.rows, reviews: reviews.rows, settings });
  const sortedSubjects = [...subjects.rows].sort((a, b) => a.name.localeCompare(b.name));

  function countsFor(topicIds: Set<string>) {
    const qs = questions.rows.filter((q) => topicIds.has(q.topic_id) && !q.suspended);
    const dueNow = queue.filter((q) => topicIds.has(q.topic_id));
    return {
      total: qs.length,
      due: dueNow.filter((q) => !isNew(q)).length,
      fresh: dueNow.filter(isNew).length,
      mastered: qs.length ? qs.filter((q) => q.card?.state === 2).length / qs.length : 0,
    };
  }

  return (
    <>
      <PageHeader
        title="Lernen"
        subtitle="Fächer und Themen von groß nach klein. Fragen wiederholen sich automatisch."
        action={
          <Link href="/lernen/ueben">
            <Button disabled={queue.length === 0}>▶ Alles üben ({queue.length})</Button>
          </Link>
        }
      />
      <ErrorNote error={subjects.error ?? topics.error ?? questions.error} />

      {subjects.loaded && subjects.rows.length === 0 && (
        <Card className="mb-6">
          <p className="text-sm">
            Noch keine Fächer angelegt. Starte mit den Fächern der Vorklinik oder lege eigene an.
          </p>
          <Button
            className="mt-3"
            onClick={async () => {
              for (const s of DEFAULT_SUBJECTS) await subjects.insert(s);
            }}
          >
            Vorklinik-Fächer anlegen
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {sortedSubjects.map((subject) => {
          const ids = new Set(topics.rows.filter((t) => t.subject_id === subject.id).map((t) => t.id));
          const c = countsFor(ids);
          const isOpen = open === subject.id;
          return (
            <Card key={subject.id}>
              <div className="flex flex-wrap items-center gap-3">
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(isOpen ? null : subject.id)}>
                  <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
                  <SubjectDot color={subject.color} />
                  <span className="font-medium">{subject.name}</span>
                  <span className="text-xs text-slate-500">
                    {ids.size} Themen · {c.total} Fragen
                  </span>
                </button>
                <div className="w-32">
                  <ProgressBar value={c.mastered} color="bg-emerald-600" />
                  <p className="mt-0.5 text-right text-xs text-slate-500">{Math.round(c.mastered * 100)}% sicher</p>
                </div>
                <Link href={`/lernen/ueben?fach=${subject.id}`}>
                  <Button variant="secondary" disabled={c.due + c.fresh === 0}>
                    Üben · {c.due} fällig, {c.fresh} neu
                  </Button>
                </Link>
              </div>
              {isOpen && (
                <TopicTree
                  subject={subject}
                  topics={topics}
                  questions={questions.rows}
                  settings={settings}
                  countsFor={countsFor}
                  onDeleteSubject={async () => {
                    if (ids.size > 0) return alert("Bitte zuerst alle Themen dieses Fachs löschen.");
                    if (confirm(`Fach „${subject.name}“ löschen?`)) await subjects.remove(subject.id);
                  }}
                />
              )}
            </Card>
          );
        })}
      </div>

      <form
        className="mt-6 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newSubject.trim()) return;
          await subjects.insert({ name: newSubject.trim(), color: `hsl(${Math.round(Math.random() * 360)} 65% 45%)` });
          setNewSubject("");
        }}
      >
        <TextInput value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Neues Fach" aria-label="Neues Fach" />
        <Button type="submit" variant="secondary">
          Hinzufügen
        </Button>
      </form>
    </>
  );
}

function TopicTree({
  subject,
  topics,
  questions,
  settings,
  countsFor,
  onDeleteSubject,
}: {
  subject: Subject;
  topics: ReturnType<typeof useTable<"topics">>;
  questions: Question[];
  settings: ReturnType<typeof useSettings>["settings"];
  countsFor: (ids: Set<string>) => { total: number; due: number; fresh: number; mastered: number };
  onDeleteSubject: () => void;
}) {
  const [adding, setAdding] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");

  async function add(parent: string | null) {
    if (!name.trim()) return;
    const siblings = childrenOf(topics.rows, parent, subject.id);
    await topics.insert({
      subject_id: subject.id,
      parent_id: parent,
      name: name.trim(),
      sort: siblings.length ? Math.max(...siblings.map((s) => s.sort)) + 1 : 0,
    });
    setName("");
    setAdding(undefined);
  }

  async function remove(topic: Topic) {
    const ids = descendants(topics.rows, topic.id);
    const affected = questions.filter((q) => ids.includes(q.topic_id)).length;
    if (affected > 0) return alert(`Dieses Thema hat noch ${affected} Fragen. Verschiebe oder lösche sie zuerst.`);
    if (!confirm(`Thema „${topic.name}“ mit allen Unterthemen löschen?`)) return;
    for (const id of ids.reverse()) await topics.remove(id);
  }

  function addForm(parent: string | null) {
    return (
      <form
        className="my-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(parent);
        }}
      >
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={parent ? "Unterthema" : "Thema"} />
        <Button type="submit">OK</Button>
        <Button type="button" variant="ghost" onClick={() => setAdding(undefined)}>
          ✕
        </Button>
      </form>
    );
  }

  function render(parent: string | null, level: number) {
    return childrenOf(topics.rows, parent, subject.id).map((topic) => {
      const ids = new Set(descendants(topics.rows, topic.id));
      const c = countsFor(ids);
      const own = mastery(questions, topic.id);
      const unlocked = isUnlocked(topics.rows, questions, settings, topic.id);
      return (
        <li key={topic.id}>
          <div className="group flex flex-wrap items-center gap-2 rounded-lg py-1.5 pr-2 hover:bg-slate-50 dark:hover:bg-slate-800/50" style={{ paddingLeft: level * 20 + 8 }}>
            <span className="text-slate-400">{level === 0 ? "■" : "└"}</span>
            <span className={unlocked ? "" : "text-slate-400"}>
              {!unlocked && "🔒 "}
              {topic.name}
            </span>
            <span className="text-xs text-slate-500">
              {c.total} Fragen
              {own !== null && ` · ${Math.round(own * 100)}% sicher`}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Link href={`/lernen/ueben?thema=${topic.id}`} className="text-xs text-teal-700 hover:underline dark:text-teal-400">
                {c.due + c.fresh > 0 ? `Üben (${c.due + c.fresh})` : ""}
              </Link>
              <Link href={`/lernen/fragen?thema=${topic.id}`} className="px-1 text-xs text-slate-500 hover:underline">
                Fragen
              </Link>
              <button className="px-1 text-xs text-slate-500 hover:underline" onClick={() => setAdding(topic.id)}>
                + Unterthema
              </button>
              <button
                className="px-1 text-xs text-slate-500 hover:underline"
                onClick={() => {
                  const next = prompt("Neuer Name", topic.name);
                  if (next?.trim()) topics.update(topic.id, { name: next.trim() });
                }}
              >
                Umbenennen
              </button>
              <button className="px-1 text-xs text-rose-600 hover:underline" onClick={() => remove(topic)}>
                Löschen
              </button>
            </div>
          </div>
          {adding === topic.id && <div style={{ paddingLeft: (level + 1) * 20 + 8 }}>{addForm(topic.id)}</div>}
          <ul>{render(topic.id, level + 1)}</ul>
        </li>
      );
    });
  }

  const roots = childrenOf(topics.rows, null, subject.id);
  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      {roots.length === 0 && <Empty>Noch keine Themen. Beginne mit den groben Bereichen, z. B. „Obere Extremität“.</Empty>}
      <ul className="text-sm">{render(null, 0)}</ul>
      {adding === null ? (
        addForm(null)
      ) : (
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={() => setAdding(null)}>
            + Thema
          </Button>
          <Button variant="danger" onClick={onDeleteSubject}>
            Fach löschen
          </Button>
        </div>
      )}
      {settings.gating_enabled && (
        <p className="mt-2 text-xs text-slate-500">
          🔒 Unterthemen öffnen sich, sobald {Math.round(settings.unlock_threshold * 100)}% der Fragen des übergeordneten Themas sicher sitzen.
        </p>
      )}
    </div>
  );
}
