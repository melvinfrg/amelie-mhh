"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/events";
import { Button, Card, Empty, ErrorNote, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { countdown, daysUntil } from "@/lib/dates";
import { euro, INTERVAL_LABEL, perMonth } from "@/lib/melvin";
import { useTable } from "@/lib/useTable";
import type { Contract, ContractKind, ContractLink, Interval } from "@/lib/types";

type Draft = Omit<Contract, "id">;

const KIND: Record<ContractKind, { label: string; icon: string; tone: string }> = {
  versicherung: { label: "Versicherung", icon: "🛡️", tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" },
  abo: { label: "Abo", icon: "📺", tone: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100" },
  vertrag: { label: "Vertrag", icon: "📑", tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" },
  sonstiges: { label: "Sonstiges", icon: "📎", tone: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100" },
};

const KINDS = Object.keys(KIND) as ContractKind[];

const emptyDraft = (kind: ContractKind = "vertrag"): Draft => ({
  title: "",
  kind,
  provider: "",
  amount: null,
  interval: "monatlich",
  contract_no: "",
  start_date: null,
  end_date: null,
  cancel_by: null,
  notice: "",
  url: "",
  links: [],
  notes: "",
  in_finances: true,
});

const fmt = (day: string) => new Date(day).toLocaleDateString("de-DE");

/** Adds https:// when someone types "allianz.de". */
function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Sends a link with the phone's share sheet (WhatsApp, Mail, AirDrop …); copies it where that isn't available. */
async function share(title: string, text: string, url?: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "geteilt";
    } catch {
      return null; // Closed the share sheet.
    }
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join("\n"));
    return "kopiert";
  } catch {
    prompt("Zum Kopieren:", [text, url].filter(Boolean).join("\n"));
    return null;
  }
}

function summary(c: Contract) {
  const lines = [`${KIND[c.kind].icon} ${c.title}${c.provider ? ` (${c.provider})` : ""}`];
  if (c.amount) lines.push(`Kosten: ${euro(Number(c.amount))}${c.interval ? ` ${c.interval === "einmalig" ? "einmalig" : INTERVAL_LABEL[c.interval]}` : ""}`);
  if (c.contract_no) lines.push(`Nummer: ${c.contract_no}`);
  if (c.cancel_by) lines.push(`Kündbar bis: ${fmt(c.cancel_by)}`);
  if (c.url) lines.push(`Kundenportal: ${c.url}`);
  for (const l of c.links ?? []) lines.push(`${l.label || "Link"}: ${l.url}`);
  return lines.join("\n");
}

export default function Vertraege() {
  const contracts = useTable("contracts");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [only, setOnly] = useState<ContractKind | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
      provider: d.provider?.trim() || null,
      contract_no: d.contract_no?.trim() || null,
      notice: d.notice?.trim() || null,
      notes: d.notes?.trim() || null,
      url: normalizeUrl(d.url ?? "") || null,
      amount: d.amount ? Number(d.amount) : null,
      links: d.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: normalizeUrl(l.url) })),
    };
    if (editing.id) await contracts.update(editing.id, draft);
    else await contracts.insert(draft);
    setEditing(null);
  }

  async function shareAndTell(title: string, text: string, url?: string) {
    const result = await share(title, text, url);
    if (result === "kopiert") {
      setNote("In die Zwischenablage kopiert ✓");
      setTimeout(() => setNote(null), 2500);
    }
  }

  const set = (patch: Partial<Draft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });
  const setLink = (i: number, patch: Partial<ContractLink>) =>
    editing && set({ links: editing.draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const sorted = [...contracts.rows].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.title.localeCompare(b.title));
  const visible = sorted.filter((c) => !only || c.kind === only);
  const monthly = contracts.rows.reduce((s, c) => s + (c.amount ? perMonth(Number(c.amount), c.interval) : 0), 0);
  const soon = contracts.rows
    .filter((c) => c.cancel_by && daysUntil(c.cancel_by) >= 0 && daysUntil(c.cancel_by) <= 60)
    .sort((a, b) => a.cancel_by!.localeCompare(b.cancel_by!));

  return (
    <>
      <PageHeader title="Verträge" subtitle="Versicherungen, Abos und Co. mit allen Links an einem Ort" action={<Button onClick={() => edit({ draft: emptyDraft() })}>+ Vertrag</Button>} />
      <ErrorNote error={contracts.error} />
      {note && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{note}</p>}

      {editing && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <TextInput required value={editing.draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. Haftpflicht, Netflix, Handy" />
            </Field>
            <Field label="Art">
              <Select value={editing.draft.kind} onChange={(e) => set({ kind: e.target.value as ContractKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND[k].icon} {KIND[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Anbieter">
              <TextInput value={editing.draft.provider ?? ""} onChange={(e) => set({ provider: e.target.value })} placeholder="z. B. HUK, Telekom" />
            </Field>
            <Field label="Vertrags-/Kundennummer">
              <TextInput value={editing.draft.contract_no ?? ""} onChange={(e) => set({ contract_no: e.target.value })} />
            </Field>
            <Field label="Kosten (€)">
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={editing.draft.amount ?? ""}
                onChange={(e) => set({ amount: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Wie oft?">
              <Select value={editing.draft.interval ?? "monatlich"} onChange={(e) => set({ interval: e.target.value as Interval | "einmalig" })}>
                {(Object.keys(INTERVAL_LABEL) as Interval[]).map((i) => (
                  <option key={i} value={i}>
                    {INTERVAL_LABEL[i]}
                  </option>
                ))}
                <option value="einmalig">einmalig</option>
              </Select>
            </Field>
            <Field label="Beginn">
              <TextInput type="date" value={editing.draft.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value || null })} />
            </Field>
            <Field label="Läuft bis">
              <TextInput type="date" value={editing.draft.end_date ?? ""} onChange={(e) => set({ end_date: e.target.value || null })} />
            </Field>
            <Field label="Kündigen bis">
              <TextInput type="date" value={editing.draft.cancel_by ?? ""} onChange={(e) => set({ cancel_by: e.target.value || null })} />
            </Field>
            <Field label="Kündigungsfrist">
              <TextInput value={editing.draft.notice ?? ""} onChange={(e) => set({ notice: e.target.value })} placeholder="z. B. 3 Monate zum Laufzeitende" />
            </Field>
            <Field label="Kundenportal / Website" className="sm:col-span-2">
              <TextInput type="text" inputMode="url" value={editing.draft.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Weitere Links (Police, Kündigung, Hotline …)</p>
              {editing.draft.links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <TextInput className="w-40" placeholder="Bezeichnung" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                  <TextInput className="flex-1" inputMode="url" placeholder="https://…" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                  <Button type="button" variant="danger" aria-label="Link entfernen" onClick={() => set({ links: editing.draft.links.filter((_, j) => j !== i) })}>
                    ✕
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => set({ links: [...editing.draft.links, { label: "", url: "" }] })}>
                + Link
              </Button>
            </div>
            <Field label="Notizen" className="sm:col-span-2">
              <TextArea value={editing.draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editing.draft.in_finances} onChange={(e) => set({ in_finances: e.target.checked })} />
              Kosten bei den Finanzen als Fixkosten mitrechnen
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Kosten pro Monat</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{euro(monthly)}</p>
          <p className="mt-1 text-xs text-stone-500">{euro(monthly * 12)} im Jahr</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Verträge</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{contracts.rows.length}</p>
          <p className="mt-1 text-xs text-stone-500">{KINDS.map((k) => `${contracts.rows.filter((c) => c.kind === k).length} ${KIND[k].label}`).join(" · ")}</p>
        </Card>
        <Card className={soon.length ? "border-amber-300 dark:border-amber-800" : ""}>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bald kündigen?</p>
          {soon.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Keine Frist in den nächsten 60 Tagen.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {soon.slice(0, 3).map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate font-semibold">{c.title}</span>
                  <span className="shrink-0 text-amber-700 dark:text-amber-400">{countdown(c.cancel_by!)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[null, ...KINDS].map((k) => (
          <button
            key={k ?? "alle"}
            onClick={() => setOnly(k)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
              only === k
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-stone-300 bg-white/60 text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200"
            }`}
          >
            {k ? `${KIND[k].icon} ${KIND[k].label}` : "Alle"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <Empty>{contracts.rows.length ? "Nichts in dieser Art." : "Noch keine Verträge. Leg den ersten an, z. B. deine Haftpflicht."}</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((c) => {
            const links = [...(c.url ? [{ label: "Kundenportal", url: c.url }] : []), ...(c.links ?? [])];
            const cancelDays = c.cancel_by ? daysUntil(c.cancel_by) : null;
            return (
              <Card key={c.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-950" aria-hidden>
                    {KIND[c.kind].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge className={KIND[c.kind].tone}>{KIND[c.kind].label}</Badge>
                      {c.provider && <span className="text-stone-500">{c.provider}</span>}
                    </div>
                    <h3 className="mt-1 truncate font-semibold">{c.title}</h3>
                  </div>
                  {c.amount ? (
                    <p className="text-right">
                      <span className="block font-display text-lg font-semibold tabular-nums">{euro(Number(c.amount))}</span>
                      <span className="block text-xs text-stone-500">{c.interval === "einmalig" ? "einmalig" : INTERVAL_LABEL[(c.interval ?? "monatlich") as Interval]}</span>
                    </p>
                  ) : null}
                </div>

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {c.contract_no && (
                    <>
                      <dt className="text-stone-500">Nummer</dt>
                      <dd>
                        <button className="truncate font-mono text-xs underline decoration-dotted" title="Kopieren" onClick={() => navigator.clipboard?.writeText(c.contract_no!)}>
                          {c.contract_no}
                        </button>
                      </dd>
                    </>
                  )}
                  {c.start_date && (
                    <>
                      <dt className="text-stone-500">Seit</dt>
                      <dd>{fmt(c.start_date)}</dd>
                    </>
                  )}
                  {c.end_date && (
                    <>
                      <dt className="text-stone-500">Läuft bis</dt>
                      <dd>{fmt(c.end_date)}</dd>
                    </>
                  )}
                  {c.cancel_by && (
                    <>
                      <dt className="text-stone-500">Kündigen bis</dt>
                      <dd className={cancelDays !== null && cancelDays >= 0 && cancelDays <= 60 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
                        {fmt(c.cancel_by)} ({countdown(c.cancel_by)})
                      </dd>
                    </>
                  )}
                  {c.notice && (
                    <>
                      <dt className="text-stone-500">Frist</dt>
                      <dd>{c.notice}</dd>
                    </>
                  )}
                </dl>
                {c.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">{c.notes}</p>}

                {links.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {links.map((l, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-1.5 text-sm dark:bg-stone-800/60">
                        <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-brand-700 hover:underline dark:text-brand-300">
                          🔗 {l.label || l.url.replace(/^https?:\/\//, "")}
                        </a>
                        <button className="shrink-0 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200" onClick={() => shareAndTell(`${c.title}: ${l.label || "Link"}`, `${c.title} – ${l.label || "Link"}`, l.url)}>
                          Schicken
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex flex-wrap gap-1 pt-3">
                  <Button variant="secondary" onClick={() => shareAndTell(c.title, summary(c))}>
                    📤 Alles schicken
                  </Button>
                  <Button variant="ghost" onClick={() => edit({ id: c.id, draft: { ...c, links: c.links ?? [] } })}>
                    Bearbeiten
                  </Button>
                  <Button variant="danger" className="ml-auto" onClick={() => confirm(`„${c.title}“ löschen?`) && contracts.remove(c.id)}>
                    Löschen
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
