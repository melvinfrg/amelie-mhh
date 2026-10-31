"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hasSupabase, supabase } from "@/lib/supabase";
import { AuthGate } from "./AuthGate";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/** The site logo: A for Amelie, M for Melvin and 2024. In each person's area the other letter is faded. */
export type LogoKind = "gemeinsam" | "melvin" | "amelie";

export function Logo({ of, className = "h-full w-full" }: { of: LogoKind; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static SVG, nothing to optimize
  return <img src={`/logos/${of}.svg`} alt="" draggable={false} className={className} />;
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
    icon: <Logo of="melvin" />,
    who: "Finanzen, Termine, Verträge",
    tone: "from-indigo-100/80 to-violet-50 text-indigo-950 dark:from-indigo-950 dark:to-stone-900 dark:text-indigo-50",
  },
  {
    href: "/studium",
    label: "Amelies Zeug",
    icon: <Logo of="amelie" />,
    who: "Studium an der MHH",
    tone: "from-teal-100/80 to-emerald-50 text-teal-950 dark:from-teal-950 dark:to-stone-900 dark:text-teal-50",
  },
  {
    href: "/batzis/index.html",
    label: "Die Batzi's",
    icon: <Logo of="gemeinsam" />,
    who: "Unser gemeinsamer Alltag",
    tone: "from-orange-100/80 to-rose-50 text-rose-950 dark:from-rose-950 dark:to-stone-900 dark:text-rose-50",
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
  { href: "/batzis/index.html", label: "Die Batzi's", icon: <Logo of="gemeinsam" /> },
];

function area(pathname: string): { id: Area; icon: LogoKind; brand: ReactNode; nav: NavItem[] } {
  if (pathname === "/")
    return { id: "portal", icon: "gemeinsam", brand: <>Amelie <span className="text-brand-600 dark:text-brand-400">&amp;</span> Melvin</>, nav: PORTAL };
  if (pathname.startsWith("/melvin"))
    return { id: "melvin", icon: "melvin", brand: <>Melvins <span className="text-brand-600 dark:text-brand-400">Zeug</span></>, nav: MELVIN };
  return { id: "studium", icon: "amelie", brand: <>Studium <span className="text-brand-700 dark:text-brand-400">MHH</span></>, nav: STUDIUM };
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

/**
 * The way back to the start page, in the same place in all three areas (the Batzi's copy it in public/batzis):
 * a card under the area's name in the sidebar, a small pill in the top bar on phones.
 */
function HomeButton({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <Link
        href="/"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-stone-700 shadow-soft md:hidden dark:bg-stone-800 dark:text-stone-200"
      >
        <span className="block h-7 w-7 overflow-hidden rounded-full">
          <Logo of="gemeinsam" />
        </span>
        Startseite
      </Link>
    );
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm shadow-soft transition hover:-translate-y-0.5 hover:bg-white dark:border-stone-700 dark:bg-stone-800/80 dark:hover:bg-stone-800"
    >
      <span aria-hidden className="text-stone-400 transition group-hover:-translate-x-0.5">
        ←
      </span>
      <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-xl">
        <Logo of="gemeinsam" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-semibold text-stone-800 dark:text-stone-100">Startseite</span>
        <span className="block text-xs text-stone-500 dark:text-stone-400">Alle Bereiche</span>
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { id, icon, brand, nav } = area(pathname);

  return (
    <div data-area={id} className="min-h-screen">
      <AuthGate>
        {(session) => (
          <div className="flex min-h-screen flex-col md:flex-row">
            <aside className="border-b border-stone-200/50 bg-white/70 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:bg-transparent dark:border-stone-800 dark:bg-stone-900/70 md:dark:bg-transparent">
              <div className="flex items-center gap-3 px-4 py-3 md:px-5 md:pb-4 md:pt-6">
                <Link
                  href={nav[0].href}
                  className="block h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-soft transition hover:-rotate-6 md:h-11 md:w-11"
                  aria-label={id === "portal" ? "Startseite" : "Übersicht"}
                >
                  <Logo of={icon} />
                </Link>
                <Link href={nav[0].href} className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-tight md:text-xl">
                  {brand}
                </Link>
                {id !== "portal" && <HomeButton compact />}
              </div>
              {id !== "portal" && (
                <div className="hidden px-3 pb-4 md:block">
                  <HomeButton />
                </div>
              )}
              <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible md:px-3">
                {nav.map((item) => (
                  <AreaLink
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      isActive(pathname, item.href)
                        ? "bg-white text-brand-800 shadow-soft dark:bg-stone-800 dark:text-brand-200"
                        : "text-stone-600 hover:bg-white/70 dark:text-stone-300 dark:hover:bg-stone-800/60"
                    }`}
                  >
                    <span aria-hidden className="grid h-6 w-6 place-items-center text-lg">
                      {item.icon}
                    </span>
                    {item.label}
                  </AreaLink>
                ))}
              </nav>
              {session && (
                <div className="hidden px-3 pb-6 pt-4 md:block">
                  <div className="rounded-2xl bg-white/80 px-4 py-3 text-xs shadow-soft dark:bg-stone-800/80">
                    <p className="truncate font-semibold text-stone-700 dark:text-stone-200">{session.user.email}</p>
                    <button className="mt-1 text-stone-500 underline hover:text-stone-800 dark:hover:text-stone-200" onClick={() => supabase().auth.signOut()}>
                      Abmelden
                    </button>
                  </div>
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
