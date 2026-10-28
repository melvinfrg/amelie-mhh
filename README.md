# Amelie & Melvin

Eine Seite, ein Login, drei Bereiche:

- **Studium MHH** (`/studium`, Amelie): Termine mit Countdown, To-dos, Links und eine Lernplattform mit automatischer Wiederholung (Details unten).
- **Die Batzi's** (`/batzis`, beide): die gemeinsame Alltags-Zentrale (ToDos, Einkauf, Rezepte, Kalender, Tracker, Reisen, Tagebuch, Orga, Fotos). Reines HTML/JS in `public/batzis`, übernommen aus [melvinfrg/die_batzis](https://github.com/melvinfrg/die_batzis). Die Tabellen liegen im selben Supabase-Projekt mit dem Präfix `batzi_` (`supabase/migrations/0005_batzis.sql`); Zugriff hat, wessen E-Mail in `batzi_members` steht. `js/config.js` wird beim Build aus den Umgebungsvariablen erzeugt. Die Kalender-Abos laufen über die Edge Function `batzi-ical` (`supabase/functions/batzi-ical`).
- **Melvins Zeug** (`/melvin`): Übersicht, Finanzen (fixe und variable Einnahmen/Ausgaben, pro Monat verrechnet, Verträge zählen als Fixkosten), Termine mit Kalender, ToDos, Verträge (Versicherungen, Abos & Co. mit Links zum Verschicken), Lebenslauf (Stationen und Eckdaten als Zeitstrahl, Download als Word oder PDF in den Stilen Klassisch, Modern, Kompakt; `src/lib/cvDocx.ts`, `cvPdf.ts`) und Notizen. Tabellen in `supabase/migrations/0009_melvin.sql` und `0011_lebenslauf.sql`.

**Einheitliche Optik:** Alle Bereiche nutzen die Schriften der Batzi's (Fredoka, Nunito), warme Farben und runde Karten. Jeder Bereich hat seine Akzentfarbe (`brand-*` in `src/app/globals.css`, gesetzt über `data-area` in `Shell`). Termine und ToDos teilen sich die Bausteine in `src/components/events.tsx`, `todos.tsx` und `MonthCalendar.tsx`.

**Termine teilen:** Jeder Termin aus Melvins Kalender, Amelies Studium oder den Batzi's lässt sich mit „📤 Übertragen“ in die anderen Kalender kopieren, auch in den der anderen Person. Verbundene Kopien (🔗) ändern sich automatisch mit, wenn eine davon geändert wird (Trigger in `supabase/migrations/0010_event_links.sql`). Die Batzi-Termine lassen sich außerdem in den eigenen Kalendern einblenden; die Startseite zeigt die nächsten zwei Wochen aus allen drei Kalendern. Teilen geht nur zwischen Mitgliedern der Batzi's.

**Umzug der alten Batzis-Daten:** `/batzis/umzug.html` öffnen (auf der neuen Seite angemeldet), mit dem alten Batzis-Login anmelden, Personen zuordnen. Die Seite kopiert alle Daten und Fotos; im alten Projekt wird nichts gelöscht, und ein zweiter Durchlauf überspringt, was schon da ist. Jede Person braucht vorher ein Konto auf der neuen Seite.

## Studium MHH

## Funktionen (Phase 1)

- **Übersicht:** nächste Prüfung mit Countdown, heute fällige Fragen, Lernserie, offene To-dos.
- **Termine:** Prüfungen, Testate, Fristen mit Countdown und Vorbereitungsstand; Export als `.ics` für den Handy-Kalender.
- **Prüfungserinnerung:** 3 Monate vor jeder Prüfung erscheint auf der Startseite (`/` und `/studium`) ein Hinweis, bis er weggeklickt wird, und es kommt einmal eine Push-Benachrichtigung. Push wird pro Gerät unter *Einstellungen → Benachrichtigungen* eingeschaltet (iPhone: nur in der App vom Home-Bildschirm, ab iOS 16.4). Ein täglicher Vercel-Cron ruft `/api/erinnerungen` auf (`vercel.json`); die Datenbank gibt die fälligen Prüfungen nur mit `CRON_SECRET` heraus (dessen SHA-256 steht in der Tabelle `cron_secret`) (`supabase/migrations/0012_pruefungserinnerung.sql`). Wird eine Prüfung auf mehr als 3 Monate verschoben, kommt die Erinnerung später noch einmal.
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
- **Anki:** `.apkg`-Stapel (alte und neue Anki-Formate) im Browser einlesen; Unterstapel werden Themen, Lückentexte eine Frage pro Lücke, Bilder auf Wunsch mit. Bereits importierte Karten werden beim erneuten Import übersprungen. Export der eigenen Fragen als Textdatei, die Anki mit Stapeln direkt importiert. SQLite läuft dafür als WebAssembly aus `public/sqljs`.
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
6. Für die Prüfungserinnerung unter *Einstellungen → Benachrichtigungen* „Schlüssel erzeugen“ klicken: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `CRON_SECRET` in Vercel eintragen, die angezeigte SQL-Zeile in Supabase ausführen und neu deployen.
7. Fertig. Auf dem Handy lässt sich die Seite über „Zum Home-Bildschirm“ wie eine App installieren.

## Geplant

- **Phase 2:** KI-Bewertung von Erklär-Aufgaben.

## Technik

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth) · ts-fsrs
