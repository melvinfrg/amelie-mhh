"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, Select, TextInput } from "@/components/ui";
import { activeIn, balance, contractCostIn, euro, INTERVAL_LABEL, monthKey, perMonth } from "@/lib/melvin";
import { useTable } from "@/lib/useTable";
import type { FinanceEntry, Interval } from "@/lib/types";

type Draft = Omit<FinanceEntry, "id">;

const CATEGORIES = {
  ausgabe: ["Wohnen", "Lebensmittel", "Mobilität", "Freizeit", "Kleidung", "Gesundheit", "Geschenke", "Urlaub", "Sparen", "Sonstiges"],
  einnahme: ["Gehalt", "Nebenjob", "Kindergeld", "Rückerstattung", "Geschenk", "Sonstiges"],
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyDraft = (fixed: boolean, kind: Draft["kind"] = "ausgabe"): Draft => ({
  title: "",
  kind,
  amount: 0,
  fixed,
  interval: fixed ? "monatlich" : null,
  date: today(),
  end_date: null,
  category: kind === "ausgabe" ? "Sonstiges" : "Gehalt",
  note: null,
});

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}

function monthName(month: string, opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", opts);
}

export default function Finanzen() {
  const entries = useTable("finance_entries");
  const contracts = useTable("contracts");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);

  const b = balance(entries.rows, contracts.rows, month);
  const fixed = entries.rows.filter((e) => e.fixed && activeIn(e, month)).sort((x, y) => y.kind.localeCompare(x.kind) || Number(y.amount) - Number(x.amount));
  const fromContracts = contracts.rows.filter((c) => contractCostIn(c, month) > 0);
  const variable = entries.rows.filter((e) => !e.fixed && monthKey(e.date) === month).sort((x, y) => y.date.localeCompare(x.date));

  // Spending by category this month, fixed costs with their monthly share.
  const byCategory = new Map<string, number>();
  for (const e of [...fixed, ...variable]) {
    if (e.kind !== "ausgabe") continue;
    const amount = e.fixed ? perMonth(Number(e.amount), e.interval ?? "monatlich") : Number(e.amount);
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
  }
  if (b.contractCosts) byCategory.set("Verträge & Abos", (byCategory.get("Verträge & Abos") ?? 0) + b.contractCosts);
  const categories = [...byCategory].sort((x, y) => y[1] - x[1]);
  const maxCategory = Math.max(1, ...categories.map(([, v]) => v));

  const year = month.slice(0, 4);
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((m) => ({
    month: m,
    ...balance(entries.rows, contracts.rows, m),
  }));
  const maxYear = Math.max(1, ...yearMonths.map((m) => Math.abs(m.balance)));

  function edit(target: { id?: string; draft: Draft }) {
    setEditing(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const d = editing.draft;
    const draft: Draft = {
      ...d,
      title: d.title.trim(),
      category: d.category.trim() || "Sonstiges",
      interval: d.fixed ? (d.interval ?? "monatlich") : null,
      end_date: d.fixed ? d.end_date || null : null,
      note: d.note?.trim() || null,
    };
    if (editing.id) await entries.update(editing.id, draft);
    else await entries.insert(draft);
    setEditing(null);
  }

  const set = (patch: Partial<Draft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });

  function entryRow(e: FinanceEntry) {
    const amount = Number(e.amount);
    const sign = e.kind === "einnahme" ? "+" : "−";
    return (
      <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-lg dark:bg-stone-800" aria-hidden>
          {e.kind === "einnahme" ? "💰" : "🧾"}
        </span>
        <button className="min-w-0 flex-1 text-left" onClick={() => edit({ id: e.id, draft: { ...e, amount } })}>
          <span className="block truncate font-semibold">{e.title}</span>
          <span className="block text-xs text-stone-500">
            {e.category} ·{" "}
            {e.fixed
              ? `${INTERVAL_LABEL[e.interval ?? "monatlich"]}${e.end_date ? ` bis ${new Date(e.end_date).toLocaleDateString("de-DE")}` : ""}`
              : new Date(e.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
            {e.note ? ` · ${e.note}` : ""}
          </span>
        </button>
        <span className="text-right">
          <span className={`block font-semibold tabular-nums ${e.kind === "einnahme" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
            {sign} {euro(amount)}
          </span>
          {e.fixed && e.interval && e.interval !== "monatlich" && (
            <span className="block text-xs text-stone-500 tabular-nums">= {euro(perMonth(amount, e.interval))} / Monat</span>
          )}
        </span>
        <Button variant="danger" aria-label="Löschen" onClick={() => confirm(`„${e.title}“ löschen?`) && entries.remove(e.id)}>
          ✕
        </Button>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Finanzen"
        subtitle="Fixe und variable Einnahmen und Ausgaben, verrechnet pro Monat"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => edit({ draft: emptyDraft(true) })}>
              + Fix
            </Button>
            <Button onClick={() => edit({ draft: emptyDraft(false) })}>+ Ausgabe / Einnahme</Button>
          </div>
        }
      />
      <ErrorNote error={entries.error ?? contracts.error} />

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Segmented
                value={editing.draft.kind}
                options={[
                  ["ausgabe", "🧾 Ausgabe"],
                  ["einnahme", "💰 Einnahme"],
                ]}
                onChange={(kind) => set({ kind, category: CATEGORIES[kind].includes(editing.draft.category) ? editing.draft.category : CATEGORIES[kind][0] })}
              />
              <Segmented
                value={editing.draft.fixed ? "fix" : "variabel"}
                options={[
                  ["variabel", "Einmalig / variabel"],
                  ["fix", "🔁 Fix (wiederkehrend)"],
                ]}
                onChange={(v) => set({ fixed: v === "fix", interval: v === "fix" ? (editing.draft.interval ?? "monatlich") : null })}
              />
            </div>
            <Field label="Titel">
              <TextInput
                required
                value={editing.draft.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder={editing.draft.kind === "einnahme" ? "z. B. Gehalt" : editing.draft.fixed ? "z. B. Miete" : "z. B. Wocheneinkauf"}
              />
            </Field>
            <Field label="Betrag (€)">
              <TextInput
                required
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={editing.draft.amount || ""}
                onChange={(e) => set({ amount: Number(e.target.value) })}
              />
            </Field>
            {editing.draft.fixed && (
              <Field label="Wie oft?">
                <Select value={editing.draft.interval ?? "monatlich"} onChange={(e) => set({ interval: e.target.value as Interval })}>
                  {(Object.keys(INTERVAL_LABEL) as Interval[]).map((i) => (
                    <option key={i} value={i}>
                      {INTERVAL_LABEL[i]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Kategorie">
              <TextInput list="finanz-kategorien" value={editing.draft.category} onChange={(e) => set({ category: e.target.value })} />
              <datalist id="finanz-kategorien">
                {CATEGORIES[editing.draft.kind].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={editing.draft.fixed ? "Ab" : "Datum"}>
              <TextInput type="date" required value={editing.draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </Field>
            {editing.draft.fixed && (
              <Field label="Bis (optional)">
                <TextInput type="date" min={editing.draft.date} value={editing.draft.end_date ?? ""} onChange={(e) => set({ end_date: e.target.value || null })} />
              </Field>
            )}
            <Field label="Notiz" className="sm:col-span-2">
              <TextInput value={editing.draft.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold capitalize">{monthName(month)}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Voriger Monat">
            ‹
          </Button>
          <Button variant="ghost" onClick={() => setMonth(monthKey(new Date()))}>
            Heute
          </Button>
          <Button variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Nächster Monat">
            ›
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Einnahmen" value={euro(b.income)} tone="text-emerald-700 dark:text-emerald-400">
          fix {euro(b.fixedIncome)} · variabel {euro(b.variableIncome)}
        </Stat>
        <Stat label="Ausgaben" value={euro(b.costs)}>
          fix {euro(b.fixedCosts + b.contractCosts)} · variabel {euro(b.variableCosts)}
        </Stat>
        <Stat
          label="Bleibt übrig"
          value={euro(b.balance)}
          tone={b.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
        >
          {b.income > 0 ? `${Math.round((b.costs / b.income) * 100)} % der Einnahmen ausgegeben` : "Noch keine Einnahmen eingetragen"}
        </Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="font-semibold">🔁 Fix</h2>
            <span className="text-xs text-stone-500">pro Monat gerechnet</span>
          </div>
          {fixed.length === 0 && fromContracts.length === 0 ? (
            <Empty>Noch nichts Festes, z. B. Gehalt, Miete, Handy.</Empty>
          ) : (
            <ul className="mt-2 divide-y divide-stone-100 pb-2 dark:divide-stone-800">
              {fixed.map(entryRow)}
              {fromContracts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-lg dark:bg-stone-800" aria-hidden>
                    📑
                  </span>
                  <Link href="/melvin/vertraege" className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="block text-xs text-stone-500">aus Verträgen · {c.interval ? INTERVAL_LABEL[c.interval as Interval] : ""}</span>
                  </Link>
                  <span className="font-semibold tabular-nums">− {euro(contractCostIn(c, month))}</span>
                  <span className="w-9" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="font-semibold">🧾 Variabel im {monthName(month, { month: "long" })}</h2>
            <Button variant="ghost" onClick={() => edit({ draft: { ...emptyDraft(false), date: month === monthKey(new Date()) ? today() : `${month}-01` } })}>
              + Neu
            </Button>
          </div>
          {variable.length === 0 ? <Empty>Diesen Monat noch nichts eingetragen.</Empty> : <ul className="mt-2 divide-y divide-stone-100 pb-2 dark:divide-stone-800">{variable.map(entryRow)}</ul>}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Ausgaben nach Kategorie</h2>
          {categories.length === 0 ? (
            <Empty>Keine Ausgaben in diesem Monat.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {categories.map(([name, value]) => (
                <li key={name}>
                  <div className="flex justify-between">
                    <span>{name}</span>
                    <span className="tabular-nums text-stone-600 dark:text-stone-300">{euro(value)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(value / maxCategory) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Übrig pro Monat {year}</h2>
          <div className="flex h-32 items-center gap-1">
            {yearMonths.map((m) => (
              <button
                key={m.month}
                onClick={() => setMonth(m.month)}
                title={`${monthName(m.month)}: ${euro(m.balance)}`}
                className={`flex h-full flex-1 flex-col rounded-md px-0.5 ${m.month === month ? "bg-brand-50 dark:bg-brand-950" : ""}`}
              >
                <span className="flex flex-1 items-end">
                  {m.balance > 0 && <span className="w-full rounded-t bg-emerald-500" style={{ height: `${(m.balance / maxYear) * 100}%` }} />}
                </span>
                <span className="flex flex-1 items-start">
                  {m.balance < 0 && <span className="w-full rounded-b bg-rose-500" style={{ height: `${(-m.balance / maxYear) * 100}%` }} />}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-center text-[10px] text-stone-500">
            {yearMonths.map((m) => (
              <span key={m.month} className="flex-1">
                {monthName(m.month, { month: "narrow" })}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, tone = "", children }: { label: string; value: string; tone?: string; children: ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-stone-500">{children}</p>
    </Card>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-stone-200 p-0.5 text-sm dark:border-stone-700">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 font-semibold ${value === v ? "bg-brand-700 text-white" : "text-stone-600 dark:text-stone-300"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
