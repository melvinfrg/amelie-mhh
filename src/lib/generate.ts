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
