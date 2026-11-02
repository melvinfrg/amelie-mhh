"use client";

import type { Session } from "@supabase/supabase-js";
import { hasSupabase, supabase } from "./supabase";

/**
 * Each person can choose the page the site opens on (e.g. Amelie straight to Lernen).
 * The choice lives in the account (Supabase user metadata), so it follows the person to every device
 * and needs no extra table. In demo mode it stays in this browser.
 */

export interface StartOption {
  href: string;
  label: string;
}

export const START_GROUPS: { label: string; options: StartOption[] }[] = [
  { label: "Allgemein", options: [{ href: "/", label: "Startseite (alle Bereiche)" }] },
  {
    label: "Amelies Zeug",
    options: [
      { href: "/studium", label: "Studium · Übersicht" },
      { href: "/lernen", label: "Studium · Lernen" },
      { href: "/lernen/ueben", label: "Studium · Lernen → Üben" },
      { href: "/termine", label: "Studium · Termine" },
      { href: "/todos", label: "Studium · ToDos" },
    ],
  },
  {
    label: "Melvins Zeug",
    options: [
      { href: "/melvin", label: "Melvin · Übersicht" },
      { href: "/melvin/finanzen", label: "Melvin · Finanzen" },
      { href: "/melvin/termine", label: "Melvin · Termine" },
      { href: "/melvin/todos", label: "Melvin · ToDos" },
    ],
  },
  { label: "Gemeinsam", options: [{ href: "/batzis/index.html", label: "Die Batzi's" }] },
];

const VALID = new Set(START_GROUPS.flatMap((g) => g.options.map((o) => o.href)));
const LOCAL_KEY = "start_page";
/** Set once per browser tab, so the jump happens only when the site is opened, not on every click on "Startseite". */
const OPENED_KEY = "start_page_opened";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function startPageOf(session: Session | null): string {
  const value = hasSupabase
    ? (session?.user.user_metadata?.start_page as unknown)
    : safe(() => localStorage.getItem(LOCAL_KEY), null);
  return typeof value === "string" && VALID.has(value) ? value : "/";
}

export async function saveStartPage(href: string) {
  if (!VALID.has(href)) throw new Error("Unbekannte Seite");
  if (!hasSupabase) {
    safe(() => localStorage.setItem(LOCAL_KEY, href), undefined);
    return;
  }
  const { error } = await supabase().auth.updateUser({ data: { start_page: href } });
  if (error) throw error;
}

/** The installed apps open on their manifest's start_url instead of "/". */
const APP_STARTS = new Set(["/studium", "/melvin"]);

function isInstalledApp() {
  return safe(() => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true, false);
}

/**
 * Where to send the person right after opening the site, or null to stay.
 * Only the first page of a browser tab counts, and only when it is the start page (or an installed app's start page),
 * so links to a specific page and later clicks on "Startseite" still work as before.
 */
let decided: { target: string | null } | null = null;

export function startRedirect(session: Session | null, pathname: string): string | null {
  decided ??= { target: decide(session, pathname) };
  return decided.target;
}

function decide(session: Session | null, pathname: string): string | null {
  const firstView = safe(() => sessionStorage.getItem(OPENED_KEY) === null, false);
  if (!firstView) return null;
  safe(() => sessionStorage.setItem(OPENED_KEY, "1"), undefined);
  const target = startPageOf(session);
  if (target === pathname) return null;
  const opensHere = pathname === "/" || (APP_STARTS.has(pathname) && isInstalledApp());
  return opensHere && target !== "/" ? target : null;
}
