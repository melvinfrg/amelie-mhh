"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, ProgressBar, Select, TextInput } from "@/components/ui";
import { dayKey } from "@/lib/dates";
import { download } from "@/lib/ical";
import { CATEGORIES, euro, expensesCsv, expensesZip, parseAmount, receiptUrl, removeReceipt, uploadReceipt } from "@/lib/receipts";
import { useTable } from "@/lib/useTable";
import type { Expense } from "@/lib/types";

const today = () => dayKey(new Date());
const EMPTY_DRAFT = { date: "", title: "", amount: "", category: CATEGORIES[1], note: "" };

function formatDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** Opens the receipt in a new tab. The tab is opened before the await so Safari doesn't block it. */
async function openReceipt(receipt: string) {
  const tab = window.open("", "_blank");
  try {
    let url = await receiptUrl(receipt);
    // Browsers refuse to navigate a tab to a data: URL, so demo receipts go through a blob URL.
    if (url.startsWith("data:")) url = URL.createObjectURL(await (await fetch(url)).blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    alert(`Beleg konnte nicht geöffnet werden: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export default function KostenPage() {
  const expenses = useTable("expenses");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT, date: today() }));
  const [file, setFile] = useState<File | null>(null);
  const [dropReceipt, setDropReceipt] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const years = [...new Set([new Date().getFullYear(), ...expenses.rows.map((e) => Number(e.date.slice(0, 4)))])].sort((a, b) => b - a);
  const rows = expenses.rows
    .filter((e) => e.date.startsWith(`${year}-`))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const total = rows.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = [...rows.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1],
  );
  const missing = rows.filter((e) => !e.receipt).length;
  const categories = [...new Set([...CATEGORIES, ...expenses.rows.map((e) => e.category)])];
  const amount = parseAmount(draft.amount);

  function reset() {
    setDraft({ ...EMPTY_DRAFT, date: today(), category: draft.category });
    setFile(null);
    setDropReceipt(false);
    setEditing(null);
    setFileKey((k) => k + 1);
  }

  function edit(e: Expense) {
    setEditing(e);
    setDraft({ date: e.date, title: e.title, amount: Number(e.amount).toFixed(2).replace(".", ","), category: e.category, note: e.note ?? "" });
    setFile(null);
    setDropReceipt(false);
    setFileKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (amount === null || !draft.title.trim() || !draft.date) return;
    setError(null);
    setBusy(file ? "Beleg wird hochgeladen …" : "Speichern …");
    try {
      const uploaded = file ? await uploadReceipt(file) : null;
      const row = {
        date: draft.date,
        title: draft.title.trim(),
        amount,
        category: draft.category.trim() || "Sonstiges",
        note: draft.note.trim() || null,
        ...(uploaded ?? (dropReceipt ? { receipt: null, receipt_name: null } : {})),
      };
      if (editing) {
        await expenses.update(editing.id, row);
        if (uploaded || dropReceipt) await removeReceipt(editing.receipt);
      } else {
        await expenses.insert({ receipt: null, receipt_name: null, ...row });
      }
      setYear(Number(draft.date.slice(0, 4)));
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(e: Expense) {
    if (!confirm(`„${e.title}“ (${euro.format(Number(e.amount))}) löschen?${e.receipt ? " Der Beleg wird mitgelöscht." : ""}`)) return;
    await expenses.remove(e.id);
    await removeReceipt(e.receipt);
    if (editing?.id === e.id) reset();
  }

  async function exportZip() {
    setError(null);
    setBusy("ZIP wird erstellt …");
    try {
      const zip = await expensesZip([...rows].reverse(), (done, all) => setBusy(`Belege laden … ${done}/${all}`));
      download(`Kosten-${year}.zip`, zip as BlobPart, "application/zip");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Kosten & Belege"
        subtitle="Ausgaben fürs Studium sammeln, für die Steuererklärung"
        action={
          <Select aria-label="Jahr" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />
      <ErrorNote error={expenses.error ?? error} />

      <Card className="mb-4">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
          <Field label="Datum" className="sm:col-span-2">
            <TextInput type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Beschreibung" className="sm:col-span-4">
            <TextInput
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="z. B. Sobotta Atlas, Präparierbesteck"
            />
          </Field>
          <Field label="Betrag in €" className="sm:col-span-2">
            <TextInput
              required
              inputMode="decimal"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              placeholder="0,00"
              aria-invalid={draft.amount !== "" && amount === null}
            />
          </Field>
          <Field label="Kategorie" className="sm:col-span-2">
            <TextInput list="expense-categories" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <datalist id="expense-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Notiz" className="sm:col-span-2">
            <TextInput value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="optional" />
          </Field>

          <div className="sm:col-span-6">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-stone-300 px-4 py-3 text-sm hover:border-brand-600 hover:bg-brand-50 dark:border-stone-700 dark:hover:bg-brand-950">
              <span className="text-2xl">🧾</span>
              <span>
                <span className="block font-medium">{file ? file.name : "Beleg fotografieren oder Datei wählen"}</span>
                <span className="text-stone-500">
                  {file
                    ? "Wird beim Speichern hochgeladen. Tippen zum Ändern."
                    : editing?.receipt && !dropReceipt
                      ? `Aktuell: ${editing.receipt_name ?? "Beleg"}. Neue Datei ersetzt ihn.`
                      : "Foto oder PDF, bis 10 MB"}
                </span>
              </span>
              <input
                key={fileKey}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {editing?.receipt && !file && (
              <label className="mt-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <input type="checkbox" checked={dropReceipt} onChange={(e) => setDropReceipt(e.target.checked)} />
                Beleg entfernen
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
            <Button type="submit" disabled={Boolean(busy) || amount === null || !draft.title.trim()}>
              {editing ? "Speichern" : "+ Ausgabe"}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" onClick={reset}>
                Abbrechen
              </Button>
            )}
            {busy && <span className="text-sm text-stone-500">{busy}</span>}
          </div>
        </form>
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm text-stone-500">Summe {year}</p>
            <p className="text-3xl font-semibold tabular-nums">{euro.format(total)}</p>
            <p className="text-sm text-stone-500">
              {rows.length} {rows.length === 1 ? "Ausgabe" : "Ausgaben"}
              {missing > 0 && <span className="text-amber-700 dark:text-amber-400"> · {missing} ohne Beleg</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!rows.length}
              onClick={() => download(`Kosten-${year}.csv`, expensesCsv([...rows].reverse()), "text/csv;charset=utf-8")}
            >
              Liste (CSV)
            </Button>
            <Button variant="secondary" disabled={!rows.length || Boolean(busy)} onClick={exportZip}>
              ZIP mit Belegen
            </Button>
          </div>
        </div>
        {byCategory.length > 0 && (
          <div className="mt-4 space-y-2">
            {byCategory.map(([category, sum]) => (
              <div key={category} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_7rem]">
                <span className="truncate">{category}</span>
                <ProgressBar value={total ? sum / total : 0} />
                <span className="text-right tabular-nums">{euro.format(sum)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-stone-500">
          Hinweis: Kosten eines Erststudiums zählen meist als Sonderausgaben (bis 6.000 € pro Jahr) und gehören in die Anlage
          Sonderausgaben. Das ist keine Steuerberatung; im Zweifel bei einem Lohnsteuerhilfeverein nachfragen.
        </p>
      </Card>

      {rows.length === 0 && expenses.loaded && <Empty>Für {year} sind noch keine Ausgaben eingetragen.</Empty>}
      <div className="space-y-2">
        {rows.map((e) => (
          <Card key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <span className="w-20 text-sm tabular-nums text-stone-500">{formatDate(e.date)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.title}</p>
              <p className="truncate text-xs text-stone-500">
                {e.category}
                {e.note && ` · ${e.note}`}
              </p>
            </div>
            <span className="font-medium tabular-nums">{euro.format(Number(e.amount))}</span>
            <div className="flex gap-1">
              {e.receipt ? (
                <Button variant="ghost" onClick={() => openReceipt(e.receipt!)} title={e.receipt_name ?? undefined}>
                  🧾 Beleg
                </Button>
              ) : (
                <span className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">kein Beleg</span>
              )}
              <Button variant="ghost" onClick={() => edit(e)}>
                Bearbeiten
              </Button>
              <Button variant="danger" onClick={() => remove(e)}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
