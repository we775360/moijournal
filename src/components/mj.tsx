import { Link } from "@tanstack/react-router";
import type { ReactNode, InputHTMLAttributes } from "react";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="sticker grid h-9 w-9 place-items-center rounded-xl bg-blush font-hand text-2xl text-ink">
        m
      </span>
      <span className="font-display text-xl font-extrabold text-ink">MoiJournal</span>
    </Link>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-display font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-50";
export const btnPrimary = `${btn} sticker bg-primary text-primary-foreground`;
export const btnSoft = `${btn} border-2 border-ink bg-paper text-ink`;
export const btnSmall =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50";

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border-2 border-ink bg-paper px-4 py-3 text-lg text-ink outline-none transition-shadow placeholder:text-muted-foreground/60 focus:shadow-[4px_4px_0_var(--ink)]"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`sticker rounded-3xl bg-paper p-6 ${className}`}>{children}</div>;
}

export function Spinner({ label = "opening your diary…" }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <p className="animate-pulse font-hand text-2xl text-muted-foreground">✎ {label}</p>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
      {children}
    </p>
  );
}
