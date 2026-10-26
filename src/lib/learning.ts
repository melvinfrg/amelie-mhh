import { createEmptyCard, fsrs, generatorParameters, State, type Card, type Grade } from "ts-fsrs";
import { dayKey } from "./dates";
import type { CardJson, ID, Question, Review, Settings, Topic } from "./types";

export const RATINGS: { value: Grade; label: string; tone: string }[] = [
  { value: 1, label: "Nochmal", tone: "bg-rose-600 hover:bg-rose-700" },
  { value: 2, label: "Schwer", tone: "bg-amber-500 hover:bg-amber-600" },
  { value: 3, label: "Gut", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { value: 4, label: "Leicht", tone: "bg-sky-600 hover:bg-sky-700" },
];

function scheduler(retention: number) {
  return fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true }));
}

function toCard(json: CardJson | null, now: Date): Card {
  if (!json) return createEmptyCard(now);
  return {
    ...json,
    due: new Date(json.due),
    last_review: json.last_review ? new Date(json.last_review) : undefined,
  };
}

function toJson(card: Card): CardJson {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Next due date for every possible rating, used to label the rating buttons. */
export function previewDue(question: Question, retention: number, now = new Date()) {
  const preview = scheduler(retention).repeat(toCard(question.card, now), now);
  return Object.fromEntries(RATINGS.map((r) => [r.value, preview[r.value].card.due])) as Record<Grade, Date>;
}

export function schedule(question: Question, rating: Grade, retention: number, now = new Date()) {
  const { card } = scheduler(retention).next(toCard(question.card, now), now, rating);
  return { card: toJson(card), due: card.due.toISOString() };
}

export function isNew(q: Question) {
  return !q.card || q.card.state === State.New;
}

export function isMastered(q: Question) {
  return q.card?.state === State.Review;
}

export function childrenOf(topics: Topic[], parent: ID | null, subject?: ID) {
  return topics
    .filter((t) => t.parent_id === parent && (subject === undefined || t.subject_id === subject))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function descendants(topics: Topic[], id: ID): ID[] {
  return [id, ...topics.filter((t) => t.parent_id === id).flatMap((t) => descendants(topics, t.id))];
}

export function depth(topics: Topic[], topic: Topic): number {
  const parent = topics.find((t) => t.id === topic.parent_id);
  return parent ? 1 + depth(topics, parent) : 0;
}

export function topicPath(topics: Topic[], id: ID): string {
  const topic = topics.find((t) => t.id === id);
  if (!topic) return "–";
  return topic.parent_id ? `${topicPath(topics, topic.parent_id)} › ${topic.name}` : topic.name;
}

/** Share of a topic's own (active) questions that are in long-term review. null = topic has no questions. */
export function mastery(questions: Question[], topicId: ID): number | null {
  const own = questions.filter((q) => q.topic_id === topicId && !q.suspended);
  if (own.length === 0) return null;
  return own.filter(isMastered).length / own.length;
}

/**
 * "Von groß nach klein": a subtopic only opens once its parent topics are mastered
 * to the configured threshold. Parents without questions don't block.
 */
export function isUnlocked(
  topics: Topic[],
  questions: Question[],
  settings: Pick<Settings, "gating_enabled" | "unlock_threshold">,
  topicId: ID,
): boolean {
  if (!settings.gating_enabled) return true;
  const topic = topics.find((t) => t.id === topicId);
  if (!topic?.parent_id) return true;
  const parentMastery = mastery(questions, topic.parent_id);
  if (parentMastery !== null && parentMastery < settings.unlock_threshold) return false;
  return isUnlocked(topics, questions, settings, topic.parent_id);
}

export function newStudiedToday(reviews: Review[], questions: Question[]) {
  const today = dayKey(new Date());
  const firstReview = new Map<ID, string>();
  for (const r of reviews) {
    const prev = firstReview.get(r.question_id);
    if (!prev || r.reviewed_at < prev) firstReview.set(r.question_id, r.reviewed_at);
  }
  const existing = new Set(questions.map((q) => q.id));
  return [...firstReview.entries()].filter(([id, at]) => existing.has(id) && dayKey(at) === today).length;
}

export interface QueueOptions {
  topics: Topic[];
  questions: Question[];
  reviews: Review[];
  settings: Settings | Omit<Settings, "id">;
  /** Restrict to a subject or a topic (including its subtopics). */
  subjectId?: ID | null;
  topicId?: ID | null;
  now?: Date;
}

/** Due reviews first (oldest first), then new questions from coarse to fine topics. */
export function buildQueue(opts: QueueOptions): Question[] {
  const { topics, questions, reviews, settings, subjectId, topicId, now = new Date() } = opts;
  const allowedTopics = new Set(
    topicId
      ? descendants(topics, topicId)
      : topics.filter((t) => !subjectId || t.subject_id === subjectId).map((t) => t.id),
  );
  const candidates = questions.filter(
    (q) =>
      !q.suspended &&
      allowedTopics.has(q.topic_id) &&
      isUnlocked(topics, questions, settings, q.topic_id),
  );

  const due = candidates
    .filter((q) => !isNew(q) && q.due && new Date(q.due) <= now)
    .sort((a, b) => a.due!.localeCompare(b.due!));

  const remainingNew = Math.max(0, settings.daily_new_limit - newStudiedToday(reviews, questions));
  const topicDepth = new Map(topics.map((t) => [t.id, depth(topics, t)]));
  const topicSort = new Map(topics.map((t) => [t.id, t.sort]));
  const fresh = candidates
    .filter(isNew)
    .sort(
      (a, b) =>
        (topicDepth.get(a.topic_id) ?? 0) - (topicDepth.get(b.topic_id) ?? 0) ||
        (topicSort.get(a.topic_id) ?? 0) - (topicSort.get(b.topic_id) ?? 0) ||
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    )
    .slice(0, remainingNew);

  return [...due, ...fresh];
}

export function mcIsCorrect(question: Question, selected: number[]) {
  const correct = question.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
  return correct.length === selected.length && correct.every((i) => selected.includes(i));
}
