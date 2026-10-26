"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hasSupabase, supabase } from "@/lib/supabase";
import { AuthGate } from "./AuthGate";

const NAV = [
  { href: "/", label: "Übersicht", icon: "🏠" },
  { href: "/termine", label: "Termine", icon: "📅" },
  { href: "/todos", label: "To-dos", icon: "✅" },
  { href: "/lernen", label: "Lernen", icon: "🧠" },
  { href: "/lernen/fragen", label: "Fragen", icon: "📝" },
  { href: "/lernen/generieren", label: "KI-Fragen", icon: "✨" },
  { href: "/lernen/abbildungen", label: "Abbildungen", icon: "🦴" },
  { href: "/lernen/statistik", label: "Statistik", icon: "📊" },
  { href: "/links", label: "Links", icon: "🔗" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/lernen") return pathname === href || (href === "/lernen" && pathname === "/lernen/ueben");
  return pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGate>
      {(session) => (
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900">
            <div className="px-4 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Studium <span className="text-teal-700 dark:text-teal-400">MHH</span>
              </Link>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
              {NAV.map((item) => (
                <Link
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
                </Link>
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
