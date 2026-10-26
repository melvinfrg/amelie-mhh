# Studium MHH

Persönliche Studien-Webseite für das Medizinstudium an der MHH: Termine mit Countdown, To-dos, Links und eine Lernplattform mit automatischer Wiederholung.

## Funktionen (Phase 1)

- **Übersicht:** nächste Prüfung mit Countdown, heute fällige Fragen, Lernserie, offene To-dos.
- **Termine:** Prüfungen, Testate, Fristen mit Countdown und Vorbereitungsstand; Export als `.ics` für den Handy-Kalender.
- **To-dos:** mit Fälligkeit, Priorität und Fach.
- **Links:** nach Kategorien, mit Vorschlägen (AMBOSS, via medici, Kenhub, AnkiWeb, IMPP …).
- **Lernen:**
  - Fächer → Themen → Unterthemen als Baum. „Von groß nach klein“: Unterthemen öffnen sich erst, wenn das übergeordnete Thema sitzt (Schwelle einstellbar, abschaltbar). Neue Fragen kommen immer zuerst aus den groben Themen.
  - Multiple Choice (Einfach- und Mehrfachauswahl) und Erklär-Aufgaben mit Musterlösung.
  - Jede Frage mit Erklärung, optional Bild, Video (YouTube/Vimeo eingebettet) und Quelle.
  - Wiederholung nach [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) (der Algorithmus aus Anki), Ziel-Behaltensquote und neue Fragen pro Tag einstellbar.
  - Fragen anlegen, bearbeiten, pausieren, zurücksetzen, löschen; Text-Import für viele Fragen auf einmal.
  - Statistik: Wiederholungen der letzten 30 Tage, Trefferquote pro Fach, schwächste Themen, Vorschau der fälligen Fragen.
- **Datensicherung:** Export/Import aller Daten als JSON.

## Lokal starten

```bash
npm install
npm run dev
```

Ohne Supabase-Zugangsdaten läuft die App im **Demo-Modus**: Alles wird nur im Browser (localStorage) gespeichert.

## Mit Supabase und Vercel betreiben

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen, Region **Central EU (Frankfurt)**.
2. Im SQL-Editor den Inhalt von `supabase/migrations/0001_init.sql` ausführen. Das legt alle Tabellen an und schaltet Row-Level-Security ein, sodass jeder Account nur seine eigenen Daten sieht.
3. Unter *Authentication → Providers → Email* E-Mail-Login aktiviert lassen. Nachdem Amelies Konto angelegt ist, unter *Authentication → Sign In / Providers* „Allow new users to sign up“ ausschalten.
4. Auf [vercel.com](https://vercel.com) das GitHub-Repo importieren und die Umgebungsvariablen aus `.env.example` setzen (Werte aus *Supabase → Project Settings → API*).
5. Fertig. Auf dem Handy lässt sich die Seite über „Zum Home-Bildschirm“ wie eine App installieren.

## Geplant

- **Phase 2:** Fragen per KI aus PDFs/Folien/Links generieren, KI-Bewertung von Erklär-Aufgaben, Anatomie-Bildfragen mit markierten Bereichen.
- **Phase 3:** Mündliche Prüfung mit Spracherkennung, Anki-Import/-Export (`.apkg`), Kosten & Belege für die Steuererklärung.

## Technik

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth) · ts-fsrs
