"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hasSupabase, supabase } from "@/lib/supabase";
import { AuthGate } from "./AuthGate";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const STUDIUM: NavItem[] = [
  { href: "/studium", label: "Übersicht", icon: "🏠" },
  { href: "/termine", label: "Termine", icon: "📅" },
  { href: "/todos", label: "ToDos", icon: "✅" },
  { href: "/lernen", label: "Lernen", icon: "🧠" },
  { href: "/kosten", label: "Kosten", icon: "💶" },
  { href: "/links", label: "Links", icon: "🔗" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
];

export type Area = "portal" | "melvin" | "studium";

/** The site holds three areas under one login: Melvin's page, Amelie's Studium and Die Batzi's (plain HTML under /batzis). */
export const AREAS = [
  {
    href: "/melvin",
    label: "Melvins Zeug",
    icon: "🧑‍💻",
    who: "Finanzen, Termine, ToDos, Verträge, Lebenslauf",
    tone: "from-indigo-100 to-indigo-50 text-indigo-950 dark:from-indigo-950 dark:to-stone-900 dark:text-indigo-50",
    links: [
      { href: "/melvin/finanzen", label: "💶 Finanzen" },
      { href: "/melvin/termine", label: "📅 Termine" },
      { href: "/melvin/todos", label: "✅ ToDos" },
      { href: "/melvin/vertraege", label: "📑 Verträge" },
    ],
  },
  {
    href: "/studium",
    label: "Amelies Zeug",
    icon: "🩺",
    who: "Studium MHH: Termine, Lernen, Kosten",
    tone: "from-teal-100 to-teal-50 text-teal-950 dark:from-teal-950 dark:to-stone-900 dark:text-teal-50",
    links: [
      { href: "/termine", label: "📅 Termine" },
      { href: "/todos", label: "✅ ToDos" },
      { href: "/lernen", label: "🧠 Lernen" },
      { href: "/kosten", label: "💶 Kosten" },
    ],
  },
  {
    href: "/batzis/index.html",
    label: "Die Batzi's",
    icon: "🐻",
    who: "Unser gemeinsamer Alltag",
    tone: "from-orange-100 to-rose-50 text-rose-950 dark:from-rose-950 dark:to-stone-900 dark:text-rose-50",
    links: [
      { href: "/batzis/index.html#/todos", label: "✅ ToDos" },
      { href: "/batzis/index.html#/einkauf", label: "🛒 Einkauf" },
      { href: "/batzis/index.html#/kalender", label: "📅 Kalender" },
      { href: "/batzis/index.html#/tagebuch", label: "💌 Tagebuch" },
    ],
  },
];

const PORTAL: NavItem[] = AREAS.map(({ href, label, icon }) => ({ href, label, icon }));

const MELVIN: NavItem[] = [
  { href: "/melvin", label: "Übersicht", icon: "🏠" },
  { href: "/melvin/finanzen", label: "Finanzen", icon: "💶" },
  { href: "/melvin/termine", label: "Termine", icon: "📅" },
  { href: "/melvin/todos", label: "ToDos", icon: "✅" },
  { href: "/melvin/vertraege", label: "Verträge", icon: "📑" },
  { href: "/melvin/lebenslauf", label: "Lebenslauf", icon: "📄" },
  { href: "/melvin/notizen", label: "Notizen", icon: "📝" },
  { href: "/batzis/index.html", label: "Die Batzi's", icon: "🐻" },
];

function area(pathname: string): { id: Area; icon: string; brand: ReactNode; nav: NavItem[] } {
  if (pathname === "/")
    return { id: "portal", icon: "🏡", brand: <>Amelie <span className="text-brand-600 dark:text-brand-400">&amp;</span> Melvin</>, nav: PORTAL };
  if (pathname.startsWith("/melvin"))
    return { id: "melvin", icon: "🧑‍💻", brand: <>Melvins <span className="text-brand-600 dark:text-brand-400">Zeug</span></>, nav: MELVIN };
  return { id: "studium", icon: "🩺", brand: <>Studium <span className="text-brand-700 dark:text-brand-400">MHH</span></>, nav: STUDIUM };
}

/** Die Batzi's are static files, not a Next.js route, so they need a full page load. */
export function AreaLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (href.startsWith("/batzis"))
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  // "Lernen" stays highlighted on all of its tabs (Üben, Fragen, Anki, …); the overviews only on themselves.
  if (href === "/studium" || href === "/melvin") return pathname === href;
  return pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { id, icon, brand, nav } = area(pathname);

  return (
    <div data-area={id} className="min-h-screen">
      <AuthGate>
        {(session) => (
          <div className="flex min-h-screen flex-col md:flex-row">
            <aside className="border-b border-stone-200/80 bg-white/70 backdrop-blur md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:bg-transparent dark:border-stone-800 dark:bg-stone-900/70 md:dark:bg-transparent">
              <div className="flex items-center gap-3 px-4 py-4 md:px-5 md:py-6">
                <Link
                  href="/"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl shadow-soft transition hover:-rotate-6 dark:bg-brand-950"
                  aria-label="Alle Bereiche"
                >
                  <span aria-hidden>{icon}</span>
                </Link>
                <div className="min-w-0">
                  <Link href={nav[0].href} className="block truncate font-display text-lg font-semibold tracking-tight">
                    {brand}
                  </Link>
                  {pathname !== "/" && (
                    <Link href="/" className="block text-xs text-stone-500 hover:underline">
                      ← Alle Bereiche
                    </Link>
                  )}
                </div>
              </div>
              <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:px-3">
                {nav.map((item) => (
                  <AreaLink
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                      isActive(pathname, item.href)
                        ? "bg-white text-brand-800 shadow-soft dark:bg-stone-800 dark:text-brand-200"
                        : "text-stone-600 hover:bg-white/70 dark:text-stone-300 dark:hover:bg-stone-800/60"
                    }`}
                  >
                    <span aria-hidden className="w-5 text-center text-base">
                      {item.icon}
                    </span>
                    {item.label}
                  </AreaLink>
                ))}
              </nav>
              {session && (
                <div className="hidden px-5 py-4 text-xs text-stone-500 md:block">
                  <p className="truncate">{session.user.email}</p>
                  <button className="mt-1 underline" onClick={() => supabase().auth.signOut()}>
                    Abmelden
                  </button>
                </div>
              )}
            </aside>
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
              {!hasSupabase && (
                <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Demo-Modus: Supabase ist nicht verbunden, alle Daten bleiben nur in diesem Browser.
                </p>
              )}
              <div className="mx-auto max-w-5xl">{children}</div>
            </main>
          </div>
        )}
      </AuthGate>
    </div>
  );
}
