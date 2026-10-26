import { z } from "zod";

export const GeneratedQuestionSchema = z.object({
  type: z.enum(["mc", "explain"]),
  prompt: z.string(),
  options: z.array(z.object({ text: z.string(), correct: z.boolean() })),
  answer: z.string(),
  explanation: z.string(),
  location: z.string(),
});

export const GenerationSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export type GenerateSource =
  | { kind: "pdf"; name: string; data: string }
  | { kind: "text"; text: string }
  | { kind: "url"; url: string };

export interface GenerateRequest {
  source: GenerateSource;
  topic: string;
  count: number;
  types: ("mc" | "explain")[];
  focus?: string;
}

/** Vercel rejects function request bodies above 4.5 MB; leave room for the JSON around the PDF. */
export const MAX_PDF_BYTES = 3_200_000;

export const GENERATION_INTRO =
  "Du erstellst Lernfragen für eine Medizinstudentin im ersten Semester (Vorklinik, Humanmedizin, MHH Hannover).";

export const GENERATION_RULES = `- Fragen ausschließlich auf Grundlage des gelieferten Materials. Nichts erfinden, was dort nicht steht oder nicht direkt daraus folgt.
- Deutsch, korrekte medizinische Fachsprache (lateinische Bezeichnungen wie im Material).
- Von groß nach klein: zuerst Fragen zu Grundstrukturen und Überblick, danach zu Details.
- Keine doppelten Fragen.`;

export type ChatPromptOptions = Omit<GenerateRequest, "source">;

/**
 * Prompt for the free route: pasted into claude.ai together with the material.
 * The answer comes back in the text import format of lib/textImport.ts.
 */
export function chatPrompt({ topic, count, types, focus }: ChatPromptOptions) {
  const allowed = types.map((t) => (t === "mc" ? "Multiple Choice" : "Erklär-Aufgaben")).join(" und ");
  return `${GENERATION_INTRO}

Erstelle aus dem angehängten Material ${count} Fragen zum Thema „${topic || "allgemein"}“. Erlaubte Fragetypen: ${allowed}.${focus ? `\nSchwerpunkt: ${focus}` : ""}

Regeln:
${GENERATION_RULES}
- Multiple Choice: 4-5 plausible Antwortoptionen im Stil von IMPP-Fragen, meist genau eine richtig. Falsche Optionen sollen typische Verwechslungen sein.
- Erklär-Aufgaben: offene Frage, die Verständnis prüft (Zusammenhänge, Funktion, klinischer Bezug), mit knapper Musterlösung.
- Erklärung: 2-4 Sätze, warum die Lösung stimmt und die anderen Optionen nicht. Merkhilfen sind willkommen.

Antworte NUR mit den Fragen in genau diesem Format, ohne Einleitung, ohne Markdown-Formatierung, eine Leerzeile zwischen zwei Fragen:

F: Fragetext (Multiple Choice)
+ richtige Antwort
- falsche Antwort
- falsche Antwort
- falsche Antwort
E: Erklärung
Q: Fundstelle im Material, z. B. Folie 12

F: Fragetext (Erklär-Aufgabe)
A: Musterlösung in Stichpunkten, durch Semikolon getrennt
E: Erklärung
Q: Fundstelle im Material`;
}
