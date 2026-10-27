"use client";

import { useFigureImage } from "@/lib/figures";

/** Turns a YouTube/Vimeo link into an embed URL; returns null for other links. */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    const start = u.searchParams.get("t") ?? u.searchParams.get("start");
    const seconds = start ? parseTime(start) : 0;
    const suffix = seconds ? `?start=${seconds}` : "";
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}${suffix}`;
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}${suffix}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function parseTime(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const m = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function Video({ url }: { url: string }) {
  const embed = embedUrl(url);
  if (embed) {
    return (
      <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg bg-black">
        <iframe
          src={embed}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title="Erklärvideo"
        />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return <video src={url} controls className="w-full rounded-lg" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline dark:text-brand-400">
      ▶ Video/Quelle öffnen
    </a>
  );
}

/** True for images kept in the private bucket (e.g. from an Anki deck) rather than at a public URL. */
export function isStoredImage(url: string) {
  return !/^(https?:|data:|blob:)/i.test(url);
}

export function QuestionImage({ url }: { url: string }) {
  const stored = useFigureImage(isStoredImage(url) ? url : undefined);
  const src = isStoredImage(url) ? stored.url : url;
  if (stored.error) return <p className="text-sm text-rose-700">Bild konnte nicht geladen werden: {stored.error}</p>;
  if (!src) return <div className="h-48 w-full max-w-md animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />;
  // eslint-disable-next-line @next/next/no-img-element -- user-provided URLs from any host and signed storage URLs
  return <img src={src} alt="Abbildung zur Frage" className="max-h-96 w-auto rounded-lg border border-stone-200 dark:border-stone-800" />;
}
