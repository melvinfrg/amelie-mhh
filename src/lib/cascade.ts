"use client";

import { db } from "./db";
import { removeImage } from "./figures";
import type { ID, Question } from "./types";
import { load, removeRows } from "./useTable";

/**
 * Deletes questions together with their reviews. Occlusion questions also lose their mask,
 * otherwise saving the figure would bring them back.
 */
export async function deleteQuestions(ids: ID[]) {
  if (ids.length === 0) return;
  const gone = new Set(ids);
  const [questions, figures, reviews] = await Promise.all([db.list("questions"), db.list("figures"), db.list("reviews")]);
  const masksGone = new Map<ID, Set<string>>();
  for (const q of questions) {
    if (gone.has(q.id) && q.figure_id && q.mask_id) {
      masksGone.set(q.figure_id, (masksGone.get(q.figure_id) ?? new Set()).add(q.mask_id));
    }
  }
  for (const f of figures) {
    const drop = masksGone.get(f.id);
    if (drop) await db.update("figures", f.id, { masks: f.masks.filter((m) => !drop.has(m.id)) });
  }
  await removeRows("reviews", reviews.filter((r) => gone.has(r.question_id)).map((r) => r.id));
  await removeRows("questions", ids);
  if (masksGone.size > 0) await load("figures", true);
  await removeOrphanImages(questions.filter((q) => gone.has(q.id)), questions);
}

/** Removes stored question images (from Anki decks) that no remaining question uses. */
async function removeOrphanImages(deleted: Question[], all: Question[]) {
  const gone = new Set(deleted.map((q) => q.id));
  const stillUsed = new Set(all.filter((q) => !gone.has(q.id)).map((q) => q.image_url));
  const orphans = new Set(deleted.map((q) => q.image_url).filter((u): u is string => !!u && !/^(https?:|data:|blob:)/i.test(u) && !stillUsed.has(u)));
  for (const image of orphans) await removeImage(image).catch(() => undefined);
}

/** Counts what deleting these topics would take with it, for the confirmation dialog. */
export async function contentOf(topicIds: ID[]) {
  const ids = new Set(topicIds);
  const [questions, figures] = await Promise.all([db.list("questions"), db.list("figures")]);
  return {
    questions: questions.filter((q) => ids.has(q.topic_id)).length,
    figures: figures.filter((f) => ids.has(f.topic_id)).length,
  };
}

/**
 * Deletes topics with everything filed under them: questions, their reviews, figures and the
 * figure images. Pass the subject id to delete the subject as well.
 */
export async function deleteTopics(topicIds: ID[], subjectId?: ID) {
  const ids = new Set(topicIds);
  const [questions, figures, reviews] = await Promise.all([db.list("questions"), db.list("figures"), db.list("reviews")]);
  const doomedFigures = figures.filter((f) => ids.has(f.topic_id));
  await removeRows("reviews", reviews.filter((r) => ids.has(r.topic_id)).map((r) => r.id));
  await removeRows("questions", questions.filter((q) => ids.has(q.topic_id)).map((q) => q.id));
  await removeRows("figures", doomedFigures.map((f) => f.id));
  await removeRows("topics", topicIds);
  if (subjectId) await removeRows("subjects", [subjectId]);
  for (const f of doomedFigures) await removeImage(f.image).catch(() => undefined);
  await removeOrphanImages(questions.filter((q) => ids.has(q.topic_id)), questions);
}
