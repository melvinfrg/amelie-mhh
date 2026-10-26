"use client";

import { useEffect, useRef, useState } from "react";

// The Web Speech API is not in every TypeScript DOM lib yet; this is the part we use.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canDictate = () => recognitionClass() !== null;

/**
 * Speech to text in the browser (Chrome, Edge, Safari; not Firefox).
 * Final phrases are passed to onFinal; the phrase still being spoken is returned as `interim`.
 */
export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const finalRef = useRef(onFinal);

  useEffect(() => {
    finalRef.current = onFinal;
  });

  useEffect(() => () => recognition.current?.stop(), []);

  function start() {
    const Klass = recognitionClass();
    if (!Klass) return setError("Spracheingabe geht in diesem Browser nicht. Am besten Chrome, Edge oder Safari verwenden.");
    const r = new Klass();
    r.lang = "de-DE";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalRef.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Bitte den Zugriff aufs Mikrofon erlauben.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Spracherkennung: ${e.error}`);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    setError(null);
    setListening(true);
    r.start();
  }

  function stop() {
    recognition.current?.stop();
  }

  return { listening, interim, error, start, stop };
}

/** Reads a text aloud in German, cancelling anything still being spoken. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

const STOP_WORDS = new Set(
  "aber alle allem allen aller alles also andere anderen auch bzw dabei damit dann dass dem den denen der des die dies diese diesem diesen dieser durch eine einem einen einer eines etwa für gegen haben hier ihre ihren immer innerhalb kann können mehr muss nach nicht noch oder ohne sehr sich sind sowie über unter usw vom von vor während wenn werden wird wobei zwischen zum zur".split(
    " ",
  ),
);

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Content words of a model answer, e.g. the terms an examiner would listen for. */
export function keywords(answer: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of answer.split(/[^A-Za-zÄÖÜäöüß]+/)) {
    const key = normalize(word);
    if (word.length < 5 || STOP_WORDS.has(word.toLowerCase()) || seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out.slice(0, 20);
}

/**
 * Whether a keyword came up in the spoken answer. Compares word stems, so "Muskeln" counts for
 * "Muskel" and dictation slips like "Supraspinatus"/"supra spinatus" still match.
 */
export function mentioned(keyword: string, text: string) {
  const stem = normalize(keyword).slice(0, 6);
  const words = normalize(text).split(/[^a-z]+/);
  const joined = words.join("");
  return words.some((w) => w.startsWith(stem)) || joined.includes(normalize(keyword));
}
