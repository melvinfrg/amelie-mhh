"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Everything around studying lives under one main menu entry; these tabs switch between its parts.
const TABS = [
  { href: "/lernen", label: "Fächer", icon: "🧠" },
  { href: "/lernen/ueben", label: "Üben", icon: "▶️" },
  { href: "/lernen/fragen", label: "Fragen", icon: "📝" },
  { href: "/lernen/generieren", label: "KI-Fragen", icon: "✨" },
  { href: "/lernen/abbildungen", label: "Abbildungen", icon: "🦴" },
  { href: "/lernen/anki", label: "Anki", icon: "🃏" },
  { href: "/lernen/statistik", label: "Statistik", icon: "📊" },
];

export default function LernenLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Lernen" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 md:mx-0 md:px-0 dark:border-stone-800">
        {TABS.map((tab) => {
          const active = tab.href === "/lernen" ? pathname === "/lernen" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-brand-700 font-medium text-brand-800 dark:border-brand-400 dark:text-brand-200"
                  : "border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
