import type { McOption, Question } from "./types";

export type ParsedQuestion = Pick<Question, "type" | "prompt" | "options" | "answer" | "explanation" | "video_url" | "source">;

export const IMPORT_EXAMPLE = `F: Welcher Nerv innerviert den M. deltoideus?
- N. radialis
+ N. axillaris
- N. musculocutaneus
E: Der N. axillaris zieht durch die laterale Achsellücke und versorgt M. deltoideus und M. teres minor.

F: Erkläre den Aufbau der Rotatorenmanschette.
A: Mm. supraspinatus, infraspinatus, teres minor und subscapularis …
E: Sie zentriert den Humeruskopf in der Pfanne.`;

/**
 * Parses a simple text format, one question per block (blank line between blocks):
 *   F: question   + correct option   - wrong option   A: model answer   E: explanation   V: video   Q: source
 * Blocks with options become multiple choice, all others explain questions.
 */
export function parseQuestions(text: string): ParsedQuestion[] {
  return text
    // Answers pasted from a chat often come wrapped in a code block or with bold tags.
    .replace(/^\s*```.*$/gm, "")
    .replace(/\*\*([FAEVQ]:)\*\*/gi, "$1")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const q: ParsedQuestion = { type: "explain", prompt: "", options: [], answer: null, explanation: null, video_url: null, source: null };
      let last: "prompt" | "answer" | "explanation" | null = null;
      for (const raw of block.split("\n")) {
        const line = raw.trim();
        const tag = line.match(/^([FAEVQ]):\s*(.*)$/i);
        if (tag) {
          const value = tag[2];
          switch (tag[1].toUpperCase()) {
            case "F":
              q.prompt = value;
              last = "prompt";
              break;
            case "A":
              q.answer = value;
              last = "answer";
              break;
            case "E":
              q.explanation = value;
              last = "explanation";
              break;
            case "V":
              q.video_url = value || null;
              last = null;
              break;
            case "Q":
              q.source = value || null;
              last = null;
              break;
          }
        } else if (/^[+-]\s/.test(line)) {
          q.options.push({ text: line.slice(2).trim(), correct: line[0] === "+" } satisfies McOption);
          last = null;
        } else if (last) {
          q[last] = `${q[last] ?? ""}\n${line}`;
        } else if (!q.prompt) {
          q.prompt = line;
          last = "prompt";
        }
      }
      if (q.options.length > 0) q.type = "mc";
      return q;
    })
    .filter((q) => q.prompt && (q.type === "explain" || q.options.some((o) => o.correct)));
}
