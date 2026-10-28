// Erinnerung 3 Monate vor einer Prüfung: dieselben Regeln und Texte für den Hinweis auf der Startseite
// und die Push-Benachrichtigung (/api/erinnerungen, läuft auf dem Server in UTC, daher feste Zeitzone).

export const REMINDER_MONTHS = 3;

interface ExamLike {
  kind?: string;
  starts_at: string;
  all_day?: boolean;
  done?: boolean;
}

/** True for an open exam that is three months or less ahead. */
export function inReminderWindow(e: ExamLike, now = new Date()) {
  const start = new Date(e.starts_at);
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() + REMINDER_MONTHS);
  return e.kind === "pruefung" && !e.done && start > now && start <= limit;
}

/** "noch 3 Monate", "noch 11 Wochen", "noch 9 Tage". */
export function timeLeft(iso: string, now = new Date()) {
  const days = Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
  if (days >= 85) return "noch 3 Monate";
  if (days >= 14) return `noch ${Math.round(days / 7)} Wochen`;
  return days === 1 ? "noch 1 Tag" : `noch ${days} Tage`;
}

export function examDay(e: { starts_at: string }) {
  return new Date(e.starts_at).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

export function reminderMessage(e: { title: string; starts_at: string; location?: string | null }, now = new Date()) {
  return {
    title: `📚 ${e.title}: ${timeLeft(e.starts_at, now)}`,
    body: `Prüfung am ${examDay(e)}${e.location ? ` (${e.location})` : ""}. Zeit, mit dem Lernen anzufangen!`,
  };
}
