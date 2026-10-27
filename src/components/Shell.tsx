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
  { href: "/todos", label: "To-dos", icon: "✅" },
  { href: "/lernen", label: "Lernen", icon: "🧠" },
  { href: "/kosten", label: "Kosten", icon: "💶" },
  { href: "/links", label: "Links", icon: "🔗" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
];

/** The site holds three areas under one login: Amelie's Studium, Die Batzi's (plain HTML under /batzis) and Melvin's page. */
export const AREAS = [
  { href: "/studium", label: "Studium MHH", icon: "🩺", who: "Amelie" },
  { href: "/batzis/index.html", label: "Die Batzi's", icon: "🐻", who: "Amelie & Melvin" },
  { href: "/melvin", label: "Melvin", icon: "🧑‍💻", who: "Melvin" },
];

const PORTAL: NavItem[] = AREAS.map(({ href, label, icon }) => ({ href, label, icon }));

const MELVIN: NavItem[] = [
  { href: "/melvin", label: "Übersicht", icon: "🏠" },
  { href: "/batzis/index.html", label: "Die Batzi's", icon: "🐻" },
];

function area(pathname: string) {
  if (pathname === "/") return { brand: <>Amelie <span className="text-teal-700 dark:text-teal-400">&amp;</span> Melvin</>, nav: PORTAL };
  if (pathname.startsWith("/melvin")) return { brand: <>Melvin<span className="text-indigo-600 dark:text-indigo-400">.</span></>, nav: MELVIN };
  return { brand: <>Studium <span className="text-teal-700 dark:text-teal-400">MHH</span></>, nav: STUDIUM };
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
  const { brand, nav } = area(pathname);

  return (
    <AuthGate>
      {(session) => (
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900">
            <div className="px-4 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                {brand}
              </Link>
              {pathname !== "/" && (
                <Link href="/" className="mt-0.5 block text-xs text-slate-500 hover:underline">
                  ← Alle Bereiche
                </Link>
              )}
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
              {nav.map((item) => (
                <AreaLink
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    isActive(pathname, item.href)
                      ? "bg-teal-50 font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </AreaLink>
              ))}
            </nav>
            {session && (
              <div className="hidden px-4 py-3 text-xs text-slate-500 md:block">
                <p className="truncate">{session.user.email}</p>
                <button className="mt-1 underline" onClick={() => supabase().auth.signOut()}>
                  Abmelden
                </button>
              </div>
            )}
          </aside>
          <main className="min-w-0 flex-1 bg-slate-50 px-4 py-6 md:px-8 dark:bg-slate-950">
            {!hasSupabase && (
              <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Demo-Modus: Supabase ist nicht verbunden, alle Daten bleiben nur in diesem Browser.
              </p>
            )}
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      )}
    </AuthGate>
  );
}
