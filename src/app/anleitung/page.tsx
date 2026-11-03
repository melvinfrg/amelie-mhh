"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { PageHeader, TextInput } from "@/components/ui";
import { openChangelog } from "@/lib/changelog";

/**
 * Anleitung: every function of the three areas step by step, like the guide on the Gruppe-2.1 page.
 * Sections fold open and closed; the search shows only the sections that contain the words and opens them.
 */

function Sec({ title, children, tech = false }: { title: string; children: ReactNode; tech?: boolean }) {
  return (
    <details
      data-guide
      className={`group mb-2.5 rounded-2xl bg-white shadow-soft dark:bg-stone-900 dark:ring-1 dark:ring-stone-800 ${tech ? "border-l-4 border-stone-700 dark:border-stone-400" : ""}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 font-semibold group-open:border-b group-open:border-stone-200/70 dark:group-open:border-stone-800 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        <span aria-hidden className="text-stone-400 transition group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="space-y-2 px-5 py-3 text-sm leading-relaxed [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </details>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 data-guide-head className="mb-3 mt-8 font-display text-xl font-semibold">{children}</h2>;
}

export default function AnleitungPage() {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [hits, setHits] = useState<number | null>(null);

  const sections = () => [...(root.current?.querySelectorAll<HTMLDetailsElement>("details[data-guide]") ?? [])];

  function search(q: string) {
    setQuery(q);
    const needle = q.trim().toLowerCase();
    let n = 0;
    for (const d of sections()) {
      const hit = !needle || (d.textContent ?? "").toLowerCase().includes(needle);
      d.style.display = hit ? "" : "none";
      if (needle && hit) d.open = true;
      if (hit) n++;
    }
    // A heading whose sections are all hidden goes too.
    root.current?.querySelectorAll<HTMLElement>("[data-guide-group]").forEach((g) => {
      g.style.display = [...g.querySelectorAll<HTMLElement>("details[data-guide]")].some((d) => d.style.display !== "none") ? "" : "none";
    });
    setHits(needle ? n : null);
  }

  function toggleAll() {
    const visible = sections().filter((d) => d.style.display !== "none");
    const open = !visible.every((d) => d.open);
    visible.forEach((d) => (d.open = open));
    setAllOpen(open);
  }

  return (
    <>
      <PageHeader title="📖 Anleitung" subtitle="Alle Funktionen Schritt für Schritt erklärt" />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Anleitung durchsuchen … (z. B. Anki, Push, Beleg, Termin teilen)"
          className="min-w-0 flex-1"
          type="search"
        />
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
        >
          {allOpen ? "Alle zuklappen" : "Alle aufklappen"}
        </button>
      </div>
      {hits !== null && <p className="mb-3 text-sm text-stone-500">{hits === 0 ? "Nichts gefunden. Versuch ein anderes Wort." : `${hits} ${hits === 1 ? "Abschnitt" : "Abschnitte"} gefunden.`}</p>}

      <div ref={root}>
        <section data-guide-group>
          <H>🏠 Allgemein</H>
          <Sec title="🔐 Anmelden & Startseite">
            <ul>
              <li>Ein Login für alles: Mit eurer E-Mail und eurem Passwort kommt ihr in alle drei Bereiche.</li>
              <li>
                Auf der <Link href="/" className="font-semibold underline">Startseite</Link> wählst du <b>Melvins Zeug</b>, <b>Amelies Zeug</b> (Studium) oder{" "}
                <b>Die Batzi&apos;s</b>. Darunter stehen angepinnte Termine und alle Termine der nächsten zwei Wochen aus allen Kalendern.
              </li>
              <li>Zurück zur Startseite geht es immer über den Knopf „← Startseite“ in der Seitenleiste bzw. oben auf dem Handy.</li>
              <li>Abmelden: unten in der Seitenleiste unter deiner E-Mail-Adresse.</li>
            </ul>
          </Sec>
          <Sec title="🏁 Eigene Startseite festlegen">
            <ul>
              <li>Ganz unten auf der Startseite (oder unter Einstellungen) bei „Beim Öffnen starten mit“ auswählen, welche Seite sich öffnen soll, z. B. „Studium · Lernen“.</li>
              <li>Das gilt nur für dein Konto, dafür aber auf all deinen Geräten.</li>
            </ul>
          </Sec>
          <Sec title="📱 Als App auf dem Handy">
            <ul>
              <li>iPhone: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Android: Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.</li>
              <li>Jeder Bereich hat sein eigenes Logo. Beim Installieren aus einem Bereich heraus bekommt die App dessen Logo.</li>
              <li>Push-Benachrichtigungen funktionieren auf dem iPhone nur in der installierten App (ab iOS 16.4).</li>
            </ul>
          </Sec>
          <Sec title="📋 Versionen, Update-Log & 🐞 Fehler melden">
            <ul>
              <li>
                Unten auf jeder Seite steht die <b>Versionsnummer</b>. Antippen öffnet das{" "}
                <button type="button" className="font-semibold underline" onClick={() => openChangelog("log")}>
                  Update-Log
                </button>{" "}
                mit allen Neuerungen (🆕), Verbesserungen (✨) und behobenen Fehlern (🛠️).
              </li>
              <li>Jede Version lässt sich auf- und zuklappen; oben filterst du nach Neu, Verbessert oder Behoben. „Alle aufklappen“ öffnet alles auf einmal.</li>
              <li>Ein <b>roter Punkt</b> an der Version und „🆕 Neu in Version …“ auf der Startseite zeigen, dass es seit deinem letzten Blick ins Update-Log etwas Neues gibt. Versionen, die für dich neu sind, sind blau umrandet und mit „neu für dich“ markiert.</li>
              <li>
                <b>„✏️ Bearbeiten“</b> im Update-Log: Stift an einer Version antippen, um Nummer, Datum und Einträge zu ändern (Art wählen, Reihenfolge mit ▲▼). „＋ Version hinzufügen“ legt eine eigene Version an, „↺ Original wiederherstellen“ macht eigene Änderungen rückgängig. Gespeichert wird in der Datenbank, also gleich für euch beide.
              </li>
              <li>
                <b>„🐞 Fehler melden“</b> (neben der Version): Bereich und Art wählen, kurz beschreiben, absenden. Darunter stehen alle gemeldeten Fehler; abhaken, wenn erledigt.
              </li>
              <li>Bei einer neuen Version kommt am nächsten Morgen eine Push-Benachrichtigung, wenn Push auf dem Gerät an ist (abschaltbar unter Einstellungen → Benachrichtigungen).</li>
            </ul>
          </Sec>
          <Sec title="🔔 Benachrichtigungen aufs Handy">
            <ol>
              <li>
                <Link href="/einstellungen" className="font-semibold underline">Einstellungen</Link> → Benachrichtigungen → „🔔 Einschalten“, auf jedem Gerät, das Nachrichten bekommen soll.
              </li>
              <li>Danach kommen: die Erinnerung 3 Monate vor jeder Prüfung und eine Nachricht, wenn es eine neue Version der Seite gibt.</li>
              <li>Mit „Neue Versionen melden“ schaltest du nur die Versions-Nachricht auf diesem Gerät an oder aus.</li>
            </ol>
          </Sec>
        </section>

        <section data-guide-group>
          <H>🎓 Amelies Zeug (Studium MHH)</H>
          <Sec title="🏠 Übersicht">
            <ul>
              <li>Nächste Prüfung mit Countdown, heute fällige Fragen, Lernserie und offene To-dos auf einen Blick.</li>
              <li>3 Monate vor jeder Prüfung erscheint hier und auf der Startseite ein Hinweis, bis du ihn wegklickst.</li>
            </ul>
          </Sec>
          <Sec title="📅 Termine">
            <ol>
              <li>„+ Termin“: Titel, Art (Prüfung, Testat, Frist, Veranstaltung, Sonstiges), Datum, ein oder mehrere Fächer, Ort und Vorbereitungsstand eintragen.</li>
              <li>Oben zwischen Liste und Monatskalender umschalten. Suche und Filter nach Art, Fach oder „📌 Nur angepinnte“.</li>
              <li>„📌 Anpinnen“ zeigt einen Termin dauerhaft oben auf der Startseite, egal wie weit weg er ist.</li>
              <li>Melvins geteilte Termine erscheinen mit 💙 (nur lesen). Ein- und ausblenden über den Schalter über der Liste.</li>
            </ol>
          </Sec>
          <Sec title="📤 Termine teilen & übertragen">
            <ul>
              <li>„📤 Übertragen“ an einem Termin kopiert ihn in andere Kalender: Melvins, Amelies Studium oder Die Batzi&apos;s.</li>
              <li>Verbundene Kopien (🔗) ändern sich automatisch mit, wenn eine davon geändert wird.</li>
              <li>Melvin legt in seinen Terminen mit „👀 Bei Amelie zeigen“ fest, welche Termine Amelie live sieht.</li>
            </ul>
          </Sec>
          <Sec title="📆 Kalender aufs Handy (Apple, Google, Supershift)">
            <ul>
              <li>In den Terminen „In anderen Kalender übernehmen“: Art und Fach auswählen (ohne Auswahl: alles).</li>
              <li><b>Datei</b>: einmaliger Export als .ics. <b>Abo-Link</b>: der Kalender aktualisiert sich von selbst. Abo-Links lassen sich jederzeit wieder löschen.</li>
              <li>Vorschläge von der MHH-Webseite lassen sich als Termine übernehmen.</li>
            </ul>
          </Sec>
          <Sec title="✅ ToDos">
            <ul>
              <li>Aufgabe mit Fälligkeit, Priorität und Fach anlegen; abhaken, wenn erledigt.</li>
            </ul>
          </Sec>
          <Sec title="🧠 Lernen: Fächer & Themen">
            <ol>
              <li>Unter Lernen → Fächer ein Fach anlegen, darin Themen und Unterthemen (von grob nach fein, z. B. „Obere Extremität“ → „Schulter“).</li>
              <li>„Von groß nach klein“: Unterthemen öffnen sich erst, wenn das übergeordnete Thema sitzt. Die Schwelle stellst du in den Einstellungen ein oder schaltest sie ab.</li>
              <li>Fächer, Themen und viele Fragen lassen sich auf einmal auswählen und löschen.</li>
            </ol>
          </Sec>
          <Sec title="📝 Fragen anlegen">
            <ul>
              <li>Lernen → Fragen → „+ Frage“: Multiple Choice (Haken = richtig, mehrere möglich) oder Erklär-Aufgabe mit Musterlösung.</li>
              <li>Optional mit Erklärung, Bild, Video (YouTube/Vimeo) und Quelle.</li>
              <li>Viele Fragen auf einmal: über den Text-Import einfügen.</li>
              <li>Fragen lassen sich bearbeiten, pausieren, zurücksetzen und löschen.</li>
            </ul>
          </Sec>
          <Sec title="▶️ Üben & Wiederholung">
            <ul>
              <li>Lernen → Üben zeigt die heute fälligen Fragen. Nach dem Aufdecken bewerten, wie gut es lief; daraus berechnet die Seite (FSRS, wie in Anki), wann die Frage wiederkommt.</li>
              <li>Ziel-Behaltensquote und neue Fragen pro Tag stellst du in den Einstellungen ein.</li>
              <li>🔊 lässt die Frage vorlesen, 🎤 die Antwort sprechen (mündliche Prüfung, Chrome/Edge/Safari). Danach siehst du, welche Stichworte der Musterlösung du genannt hast.</li>
            </ul>
          </Sec>
          <Sec title="✨ KI-Fragen">
            <ol>
              <li>Lernen → KI-Fragen: PDF oder Folien (Seitenbereich wählbar), Text einfügen oder einen Link angeben.</li>
              <li>Claude schlägt Multiple-Choice- und Erklär-Fragen mit Erklärung vor.</li>
              <li>Jede Frage vor dem Übernehmen prüfen und bei Bedarf bearbeiten. Kostenlos geht es auch über claude.ai: Vorlage kopieren, dort einfügen, Antwort zurückkopieren.</li>
            </ol>
          </Sec>
          <Sec title="🦴 Abbildungen">
            <ol>
              <li>Lernen → Abbildungen: Anatomie-Bild hochladen.</li>
              <li>Beschriftungen und Strukturen mit Rechtecken abdecken und in grob, mittel oder fein einteilen. „Beschriftungen erkennen“ findet gedruckte Beschriftungen automatisch.</li>
              <li>Jede Markierung wird eine eigene Frage; feinere Strukturen kommen erst, wenn die gröberen sitzen. Antwort eintippen (Tippfehler werden toleriert) oder nur aufdecken.</li>
            </ol>
          </Sec>
          <Sec title="🃏 Anki">
            <ul>
              <li>Lernen → Anki: .apkg-Stapel auswählen. Unterstapel werden Themen, Lückentexte eine Frage pro Lücke, Bilder auf Wunsch mit. Schon importierte Karten werden übersprungen.</li>
              <li>Export: die eigenen Fragen als Textdatei, die Anki mit Stapeln direkt importiert.</li>
            </ul>
          </Sec>
          <Sec title="📊 Statistik">
            <ul>
              <li>Wiederholungen der letzten 30 Tage, Trefferquote pro Fach, schwächste Themen und Vorschau der fälligen Fragen.</li>
            </ul>
          </Sec>
          <Sec title="💶 Kosten & Belege">
            <ul>
              <li>Ausgaben fürs Studium mit Foto oder PDF des Belegs eintragen.</li>
              <li>Summe pro Jahr und Kategorie; Export als CSV oder als ZIP mit allen Belegen für die Steuererklärung.</li>
            </ul>
          </Sec>
          <Sec title="🔗 Links">
            <ul>
              <li>Eigene Links nach Kategorien, mit Vorschlägen wie AMBOSS, via medici, Kenhub, AnkiWeb oder IMPP.</li>
            </ul>
          </Sec>
          <Sec title="⚙️ Einstellungen & Datensicherung">
            <ul>
              <li>Lern-Einstellungen, Startseite, Benachrichtigungen.</li>
              <li>Datensicherung: alle Studiums-Daten als JSON exportieren und wieder importieren (Bilder der Abbildungen bleiben im Speicher und sind nicht in der Datei).</li>
            </ul>
          </Sec>
        </section>

        <section data-guide-group>
          <H>👤 Melvins Zeug</H>
          <Sec title="💶 Finanzen">
            <ul>
              <li>„+ Ausgabe / Einnahme“: fest (🔁 Fix, z. B. Gehalt, Miete, Handy) oder variabel, mit Kategorie.</li>
              <li>Alles wird pro Monat verrechnet; Verträge zählen automatisch als Fixkosten. Unten: Ausgaben nach Kategorie.</li>
            </ul>
          </Sec>
          <Sec title="📅 Termine & ✅ ToDos">
            <ul>
              <li>Wie im Studium: Termine mit Kalender, ToDos mit Fälligkeit.</li>
              <li>„👀 Bei Amelie zeigen“ teilt einen Termin live mit Amelie (sie kann ihn nur sehen).</li>
            </ul>
          </Sec>
          <Sec title="📑 Verträge">
            <ul>
              <li>„+ Vertrag“: Versicherungen, Abos & Co. mit Nummer, Laufzeit, Kosten, „Kündigen bis“ und Links (Police, Kündigung, Hotline …).</li>
              <li>„Bald kündigen?“ zeigt alle Fristen der nächsten 60 Tage.</li>
            </ul>
          </Sec>
          <Sec title="📄 Lebenslauf">
            <ul>
              <li>Eckdaten und Stationen eintragen; sie erscheinen als Zeitstrahl. Einzelne Stationen lassen sich ausblenden.</li>
              <li>Download als Word oder PDF in den Stilen Klassisch, Modern oder Kompakt.</li>
            </ul>
          </Sec>
          <Sec title="📝 Notizen">
            <ul>
              <li>Schnelle Notizen, wichtige mit 📌 oben anheften.</li>
            </ul>
          </Sec>
        </section>

        <section data-guide-group>
          <H>🏡 Die Batzi&apos;s</H>
          <Sec title="🏡 Start & Profil">
            <ul>
              <li>Euer gemeinsamer Alltag: ToDos, Einkauf, Rezepte, Kalender, Tracker, Reisen, Tagebuch und Orga.</li>
              <li>Unten in der Seitenleiste (Handy: oben rechts) Name, Tier und Farbe ändern oder abmelden.</li>
            </ul>
          </Sec>
          <Sec title="🛒 Einkauf & 🍳 Rezepte">
            <ul>
              <li>Einkaufsliste nach Läden; eigene Läden lassen sich hinzufügen und verwalten.</li>
              <li>Rezepte mit Zutaten und Schritten; das Suchfeld steht immer oben.</li>
            </ul>
          </Sec>
          <Sec title="📅 Kalender, ⏳ Tracker, ✈️ Reisen, 💌 Tagebuch, 🗂️ Orga">
            <ul>
              <li>Kalender: gemeinsame Termine; sie lassen sich in Amelies und Melvins Kalender einblenden und als Abo aufs Handy holen.</li>
              <li>Tracker: Tage seit bzw. bis zu einem Datum, mit Meilensteinen und Jahrestagen. Reisen: mit Titelbild (direkt hochladen). Tagebuch: jeden Tag Stimmung und ein paar Zeilen. Orga: Versicherungen, Strom, Abos & Co. mit Betrag, wer zahlt und Laufzeit.</li>
            </ul>
          </Sec>
        </section>

        <section data-guide-group>
          <H>🔧 Einrichtung & Technik (für Melvin)</H>
          <Sec tech title="🗄️ Supabase & Vercel">
            <ul>
              <li>Datenbank: Supabase (Region Frankfurt). Neue Tabellen kommen als SQL-Datei in <code>supabase/migrations/</code> und werden im SQL-Editor der Reihe nach ausgeführt.</li>
              <li>Die Seite läuft auf Vercel; jeder Merge in <code>main</code> wird automatisch veröffentlicht. Umgebungsvariablen stehen in <code>.env.example</code>.</li>
              <li>Ein täglicher Vercel-Cron hält Supabase wach (<code>/api/wachhalten</code>) und schickt Erinnerungen (<code>/api/erinnerungen</code>).</li>
            </ul>
          </Sec>
          <Sec tech title="📋 Neue Version eintragen">
            <ol>
              <li>Bei jedem Update in <code>src/data/changelog.json</code> ganz oben eine Version ergänzen: Nummer, Datum und Einträge mit Art <code>neu</code>, <code>besser</code> oder <code>fix</code>.</li>
              <li>Nummer: große Umbauten zählen vorne hoch (3.0.0), neue Funktionen in der Mitte (2.8.0), reine Fehlerbehebungen hinten (2.7.1).</li>
              <li>Nach dem Veröffentlichen sehen beide den roten Punkt, und am nächsten Morgen geht die Push-Nachricht raus.</li>
              <li>Kleine Korrekturen gehen auch direkt im Update-Log über „✏️ Bearbeiten“, ohne Update.</li>
            </ol>
          </Sec>
          <Sec tech title="🔔 Push einrichten">
            <ol>
              <li>Einstellungen → Benachrichtigungen → „🔑 Schlüssel erzeugen“.</li>
              <li><code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code> und <code>CRON_SECRET</code> in Vercel eintragen, die SQL-Zeile in Supabase ausführen, neu deployen.</li>
            </ol>
          </Sec>
          <Sec tech title="🧳 Umzug der alten Batzi's-Daten">
            <ul>
              <li>
                <code>/batzis/umzug.html</code> öffnen (auf der neuen Seite angemeldet), mit dem alten Batzi&apos;s-Login anmelden, Personen zuordnen. Ein zweiter Durchlauf überspringt, was schon da ist.
              </li>
            </ul>
          </Sec>
        </section>
      </div>
    </>
  );
}
