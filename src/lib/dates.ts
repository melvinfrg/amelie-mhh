const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date = new Date()) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole calendar days from today to the given date (negative = in the past). */
export function daysUntil(iso: string) {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay().getTime()) / DAY);
}

export function countdown(iso: string) {
  const days = daysUntil(iso);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "gestern";
  if (days > 0) return `in ${days} Tagen`;
  return `vor ${-days} Tagen`;
}

export function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Converts an ISO timestamp into the value format of <input type="datetime-local">. */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dayKey(d: Date | string) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatInterval(from: Date, to: Date) {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} Min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} Std`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} T`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} Mon`;
  return `${(days / 365).toFixed(1)} J`;
}

/** Last moment that still belongs to an event: its end, or the end of its day for all-day events. */
export function eventEnd(e: { starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  const end = new Date(e.ends_at ?? e.starts_at);
  if (e.all_day) end.setHours(23, 59, 59, 999);
  return end;
}

/** True while an event is running or still ahead. */
export function isCurrent(e: { starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  return e.ends_at || e.all_day ? eventEnd(e) >= startOfDay() : daysUntil(e.starts_at) >= 0;
}

export function formatEventDate(e: { starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  if (e.all_day) {
    const end = e.ends_at && dayKey(e.ends_at) !== dayKey(e.starts_at) ? ` – ${formatDate(e.ends_at)}` : "";
    return `${formatDate(e.starts_at)}${end}`;
  }
  if (!e.ends_at) return formatDate(e.starts_at, true);
  const sameDay = dayKey(e.ends_at) === dayKey(e.starts_at);
  const endText = sameDay
    ? new Date(e.ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : formatDate(e.ends_at, true);
  return `${formatDate(e.starts_at, true)} – ${endText}`;
}

/** Countdown that also covers running multi-day events, e.g. "läuft noch 12 Tage". */
export function eventCountdown(e: { starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  if (daysUntil(e.starts_at) < 0 && (e.ends_at || e.all_day) && eventEnd(e) >= startOfDay()) {
    const left = daysUntil(eventEnd(e).toISOString());
    return left === 0 ? "endet heute" : `läuft noch ${left} ${left === 1 ? "Tag" : "Tage"}`;
  }
  return countdown(e.starts_at);
}

/** The time part of an event for lists that already show its day: "10:00", "10:00 – 12:00", "ganztägig" or "bis Fr., 30.10.". */
export function eventTime(e: { starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (e.ends_at && dayKey(e.ends_at) !== dayKey(e.starts_at))
    return `bis ${new Date(e.ends_at).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}`;
  if (e.all_day) return "ganztägig";
  return e.ends_at ? `${time(e.starts_at)} – ${time(e.ends_at)}` : time(e.starts_at);
}

/** Local midnight of a "YYYY-MM-DD" day, as stored for all-day events. */
export function localMidnight(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}
