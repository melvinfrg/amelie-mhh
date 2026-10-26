# Studium MHH

Persönliche Studien-Webseite für das Medizinstudium an der MHH: Termine mit Countdown, To-dos, Links und eine Lernplattform mit automatischer Wiederholung.

## Funktionen (Phase 1)

- **Übersicht:** nächste Prüfung mit Countdown, heute fällige Fragen, Lernserie, offene To-dos.
- **Termine:** Prüfungen, Testate, Fristen mit Countdown und Vorbereitungsstand; Export als `.ics` für den Handy-Kalender.
- **To-dos:** mit Fälligkeit, Priorität und Fach.
- **Kosten & Belege:** Ausgaben fürs Studium mit Foto oder PDF des Belegs, Summe pro Jahr und Kategorie, Export als CSV oder als ZIP mit allen Belegen für die Steuererklärung. Belege liegen im privaten Supabase-Speicher (`receipts`).
- **Links:** nach Kategorien, mit Vorschlägen (AMBOSS, via medici, Kenhub, AnkiWeb, IMPP …).
- **Lernen:**
  - Fächer → Themen → Unterthemen als Baum. „Von groß nach klein“: Unterthemen öffnen sich erst, wenn das übergeordnete Thema sitzt (Schwelle einstellbar, abschaltbar). Neue Fragen kommen immer zuerst aus den groben Themen.
  - Multiple Choice (Einfach- und Mehrfachauswahl) und Erklär-Aufgaben mit Musterlösung.
  - Mündliche Prüfung: Fragen vorlesen lassen (🔊) und Erklär-Aufgaben laut beantworten (🎤, Spracherkennung des Browsers, Chrome/Edge/Safari). Nach dem Aufdecken zeigt die Seite, welche Stichworte der Musterlösung genannt wurden.
  - Jede Frage mit Erklärung, optional Bild, Video (YouTube/Vimeo eingebettet) und Quelle.
  - Wiederholung nach [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) (der Algorithmus aus Anki), Ziel-Behaltensquote und neue Fragen pro Tag einstellbar.
  - Fragen anlegen, bearbeiten, pausieren, zurücksetzen, löschen; Text-Import für viele Fragen auf einmal.
  - Statistik: Wiederholungen der letzten 30 Tage, Trefferquote pro Fach, schwächste Themen, Vorschau der fälligen Fragen.
- **KI-Fragen:** PDF/Folien (Seitenbereich wählbar), eingefügter Text oder ein Link → Claude schlägt Multiple-Choice- und Erklär-Fragen mit Erklärung vor; jede Frage wird vor dem Übernehmen geprüft und kann bearbeitet werden.
- **Abbildungen:** Anatomie-Bilder hochladen, Beschriftungen und Strukturen mit Rechtecken abdecken und in drei Ebenen (grob, mittel, fein) einteilen. Jede Markierung wird eine eigene Frage mit Wiederholung; feinere Strukturen einer Abbildung kommen erst, wenn die gröberen gelernt sind. Antwort eintippen (Tippfehler werden toleriert) oder nur aufdecken. Gedruckte Beschriftungen kann die Seite mit „Beschriftungen erkennen“ automatisch finden und abdecken (Texterkennung mit Tesseract direkt im Browser, kostenlos, Dateien liegen unter `public/tesseract`).
- **Datensicherung:** Export/Import aller Daten als JSON (Bilder der Abbildungen bleiben im Supabase-Speicher und sind nicht in der Datei).

## Lokal starten

```bash
npm install
npm run dev
```

Ohne Supabase-Zugangsdaten läuft die App im **Demo-Modus**: Alles wird nur im Browser (localStorage) gespeichert.

## Mit Supabase und Vercel betreiben

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen, Region **Central EU (Frankfurt)**.
2. Im SQL-Editor die Dateien aus `supabase/migrations/` der Reihe nach ausführen. Das legt alle Tabellen an und schaltet Row-Level-Security ein, sodass jeder Account nur seine eigenen Daten sieht.
3. Unter *Authentication → Providers → Email* E-Mail-Login aktiviert lassen. Nachdem Amelies Konto angelegt ist, unter *Authentication → Sign In / Providers* „Allow new users to sign up“ ausschalten.
4. Auf [vercel.com](https://vercel.com) das GitHub-Repo importieren und die Umgebungsvariablen aus `.env.example` setzen (Werte aus *Supabase → Project Settings → API*).
5. Für die KI-Fragen in Vercel zusätzlich `ANTHROPIC_API_KEY` (Typ *Sensitive*) setzen, Schlüssel von [platform.claude.com](https://platform.claude.com). Die Schnittstelle `/api/generate` nimmt nur Anfragen angemeldeter Nutzer an.
6. Fertig. Auf dem Handy lässt sich die Seite über „Zum Home-Bildschirm“ wie eine App installieren.

## Geplant

- **Phase 2:** KI-Bewertung von Erklär-Aufgaben.
- **Phase 3:** Anki-Import/-Export (`.apkg`).

## Technik

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth) · ts-fsrs
