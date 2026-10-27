import { TONES } from "@/components/MonthCalendar";
import type { Contract, FinanceEntry, Interval, MelvinCategory } from "./types";

export const CATEGORY_TONE = {
  privat: TONES.indigo,
  arbeit: TONES.sky,
  sport: TONES.emerald,
  familie: TONES.orange,
  sonstiges: TONES.stone,
} satisfies Record<MelvinCategory, unknown>;

export const INTERVAL_LABEL: Record<Interval, string> = {
  monatlich: "monatlich",
  vierteljaehrlich: "vierteljährlich",
  halbjaehrlich: "halbjährlich",
  jaehrlich: "jährlich",
};

const MONTHS: Record<Interval, number> = { monatlich: 1, vierteljaehrlich: 3, halbjaehrlich: 6, jaehrlich: 12 };

/** The share of a recurring amount that falls on one month, e.g. a yearly 120 € insurance costs 10 € a month. */
export function perMonth(amount: number, interval: Interval | "einmalig" | null) {
  if (!interval || interval === "einmalig") return 0;
  return amount / MONTHS[interval];
}

export const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** "YYYY-MM" of a date or day string. */
export const monthKey = (d: string | Date) => (typeof d === "string" ? d.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);

/** True if a fixed entry runs in the given month ("YYYY-MM"). */
export function activeIn(e: Pick<FinanceEntry, "date" | "end_date">, month: string) {
  return monthKey(e.date) <= month && (!e.end_date || monthKey(e.end_date) >= month);
}

/** Contracts count as fixed costs while they run, if they have a price and are not switched off for Finanzen. */
export function contractCostIn(c: Contract, month: string) {
  if (!c.in_finances || !c.amount) return 0;
  if (c.start_date && monthKey(c.start_date) > month) return 0;
  if (c.end_date && monthKey(c.end_date) < month) return 0;
  return perMonth(Number(c.amount), c.interval);
}

export interface MonthBalance {
  fixedIncome: number;
  fixedCosts: number;
  contractCosts: number;
  variableIncome: number;
  variableCosts: number;
  income: number;
  costs: number;
  balance: number;
}

/** Everything that comes in and goes out in one month; fixed entries count with their monthly share. */
export function balance(entries: FinanceEntry[], contracts: Contract[], month: string): MonthBalance {
  let fixedIncome = 0;
  let fixedCosts = 0;
  let variableIncome = 0;
  let variableCosts = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    if (e.fixed) {
      if (!activeIn(e, month)) continue;
      const share = perMonth(amount, e.interval ?? "monatlich");
      if (e.kind === "einnahme") fixedIncome += share;
      else fixedCosts += share;
    } else if (monthKey(e.date) === month) {
      if (e.kind === "einnahme") variableIncome += amount;
      else variableCosts += amount;
    }
  }
  const contractCosts = contracts.reduce((sum, c) => sum + contractCostIn(c, month), 0);
  const income = fixedIncome + variableIncome;
  const costs = fixedCosts + contractCosts + variableCosts;
  return { fixedIncome, fixedCosts, contractCosts, variableIncome, variableCosts, income, costs, balance: income - costs };
}
