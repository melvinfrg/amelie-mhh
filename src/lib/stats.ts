import { dayKey } from "./dates";
import type { Review } from "./types";

/** Consecutive days (ending today or yesterday) with at least one review. */
export function streak(reviews: Review[], now = new Date()) {
  const days = new Set(reviews.map((r) => dayKey(r.reviewed_at)));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function accuracy(reviews: Review[]) {
  return reviews.length ? reviews.filter((r) => r.correct).length / reviews.length : null;
}

export function lastDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (n - 1 - i));
    return dayKey(d);
  });
}
