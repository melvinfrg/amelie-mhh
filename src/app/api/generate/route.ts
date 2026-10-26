import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import { GenerationSchema, type GenerateRequest } from "@/lib/generate";

export const maxDuration = 300;

const SYSTEM = `Du erstellst Lernfragen für eine Medizinstudentin im ersten Semester (Vorklinik, Humanmedizin, MHH Hannover).

Regeln:
- Fragen ausschließlich auf Grundlage des gelieferten Materials. Nichts erfinden, was dort nicht steht oder nicht direkt daraus folgt.
- Deutsch, korrekte medizinische Fachsprache (lateinische Bezeichnungen wie im Material).
- Von groß nach klein: zuerst Fragen zu Grundstrukturen und Überblick, danach zu Details.
- Multiple Choice ("mc"): 4-5 plausible Antwortoptionen im Stil von IMPP-Fragen, meist genau eine richtig. Falsche Optionen sollen typische Verwechslungen sein, keine offensichtlich absurden Antworten. Für "mc" bleibt "answer" leer.
- Erklär-Aufgaben ("explain"): offene Frage, die Verständnis prüft (Zusammenhänge, Funktion, klinischer Bezug). "answer" enthält eine knappe Musterlösung in Stichpunkten. "options" bleibt leer.
- "explanation": 2-4 Sätze, warum die Lösung stimmt und die anderen Optionen nicht. Merkhilfen sind willkommen.
- "location": wo im Material die Information steht (z. B. "Folie 12" oder "Abschnitt Schultergelenk"), sonst leer.
- Keine doppelten Fragen.`;

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

async function authorized(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Demo mode has no accounts; the API key is the only guard there.
  if (!url || !key) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return false;
  const { data, error } = await createClient(url, key).auth.getUser(token);
  return !error && Boolean(data.user);
}

/** Fetches a web page and reduces it to readable text. */
async function pageText(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Nur http(s)-Links");
  const response = await fetch(parsed, { headers: { "user-agent": "Mozilla/5.0 StudiumMHH" } });
  if (!response.ok) throw new Error(`Seite antwortet mit ${response.status}`);
  const html = await response.text();
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, 300_000);
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, { error: "Die KI ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt in Vercel)." });
  }
  if (!(await authorized(request))) return json(401, { error: "Bitte neu anmelden." });

  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Ungültige Anfrage." });
  }

  const count = Math.min(30, Math.max(1, Math.round(body.count || 10)));
  const types = body.types?.length ? body.types : ["mc"];
  const instruction = [
    `Thema in der Lernplattform: ${body.topic || "allgemein"}.`,
    `Erstelle ${count} Fragen. Erlaubte Fragetypen: ${types.map((t) => (t === "mc" ? "Multiple Choice (mc)" : "Erklär-Aufgabe (explain)")).join(", ")}.`,
    body.focus ? `Schwerpunkt: ${body.focus}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let material: Anthropic.Beta.BetaContentBlockParam;
  try {
    if (body.source.kind === "pdf") {
      material = {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: body.source.data },
        title: body.source.name,
      };
    } else {
      const text = body.source.kind === "url" ? await pageText(body.source.url) : body.source.text;
      if (!text.trim()) return json(400, { error: "Im Material wurde kein Text gefunden." });
      material = { type: "text", text: `<material>\n${text}\n</material>` };
    }
  } catch (e) {
    return json(400, { error: `Material konnte nicht geladen werden: ${e instanceof Error ? e.message : e}` });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GenerationSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: [material, { type: "text", text: instruction }] }],
    });

    if (response.stop_reason === "refusal") {
      return json(422, { error: "Die KI hat die Anfrage abgelehnt. Versuch es mit anderem Material." });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return json(502, { error: "Die Antwort der KI war unvollständig. Bitte weniger Fragen auf einmal erzeugen." });
    }
    const questions = response.parsed_output.questions.filter(
      (q) => types.includes(q.type) && (q.type === "explain" || q.options.some((o) => o.correct)),
    );
    return json(200, { questions });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "Zu viele Anfragen. Bitte kurz warten." });
    if (e instanceof Anthropic.AuthenticationError) return json(500, { error: "Der API-Schlüssel ist ungültig." });
    if (e instanceof Anthropic.BadRequestError) return json(400, { error: `Anfrage abgelehnt: ${e.message}` });
    if (e instanceof Anthropic.APIError) return json(502, { error: `KI-Fehler ${e.status}. Bitte später erneut versuchen.` });
    throw e;
  }
}
