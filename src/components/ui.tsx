import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const input =
  "rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800",
  secondary:
    "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
  ghost: "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
  danger: "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-soft dark:border-stone-800 dark:bg-stone-900 ${/(^|\s)p-/.test(className) ? "" : "p-4"} ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-stone-700 dark:text-stone-300">{label}</span>
      {children}
    </label>
  );
}

/** Inputs fill their container unless the caller passes its own width class. */
function inputClass(extra = "") {
  return `${input} ${/(^|\s)(w-|flex-1)/.test(extra) ? "" : "w-full"} ${extra}`;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass(props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={inputClass(props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass(props.className)} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">{children}</p>;
}

export function ProgressBar({ value, color = "bg-brand-600" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      Fehler: {error}
    </p>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

/** The header of the overview pages: today's date above a greeting. */
export function Greeting({ name, subtitle }: { name: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-8">
      <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
        {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {greeting()}, {name}
      </h1>
      {subtitle && <p className="mt-2 text-stone-500 dark:text-stone-400">{subtitle}</p>}
    </header>
  );
}

/** A card on an overview page: a quiet heading with a link to the full page, then its content. */
export function Panel({
  title,
  href,
  more = "Alle",
  children,
  className = "",
}: {
  title: string;
  href?: string;
  more?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-semibold text-stone-400 transition hover:text-brand-700 dark:hover:text-brand-300">
            {more} →
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Weekday and day of a date as a small tile, so lists of dates read at a glance. */
export function DateTile({ iso, className = "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200" }: { iso: string; className?: string }) {
  const d = new Date(iso);
  return (
    <span className={`grid h-11 w-11 shrink-0 place-content-center rounded-xl text-center leading-none ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "")}</span>
      <span className="mt-0.5 font-display text-lg font-semibold">{d.getDate()}</span>
    </span>
  );
}
