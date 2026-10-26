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
