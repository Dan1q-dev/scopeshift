"use client";

import { useEffect, useRef, useState } from "react";
import { ghostButton, primaryButton } from "@/components/ui/SiteHeader";
import { classificationStyle, stepLabels, stepOrder, type StepKey, type StepState } from "@/lib/client/real-project-ui";
import { scopeClassificationLabels, type ScopeClassification } from "@/types/real-project";

export const fieldClass = "mt-1.5 block w-full rounded-lg border border-white/15 bg-[#0b1115] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60";
export const primaryClass = `${primaryButton} gap-2 px-4 py-2.5`;
export const secondaryClass = `${ghostButton} gap-2 py-2`;
export const quietButton = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-emerald-200 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40";
export const checkboxClass = "mt-0.5 h-4 w-4 shrink-0 accent-emerald-400";
export const cardClass = "rounded-2xl border border-white/10 bg-white/[0.025]";

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

export function ClassificationPill({ classification, prefix }: { classification: ScopeClassification; prefix?: string }) {
  const style = classificationStyle[classification];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.pill}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {prefix && <span className="opacity-75">{prefix}</span>}{scopeClassificationLabels[classification]}
    </span>
  );
}

export function Metric({ label, value, hint, emphasis = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className={`rounded-xl px-3.5 py-3 ${emphasis ? "border border-emerald-300/20 bg-emerald-300/[0.06]" : "bg-black/25"}`}>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="tabular m-0 mt-1 text-lg font-semibold">{value}</dd>
      {hint && <p className="m-0 mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** One step of the flow. The heading takes focus when the flow moves here. */
export function SectionCard({ step, index, title, eyebrow, state, description, actions, children }: {
  step: StepKey; index: number; title: string; eyebrow: string; state: StepState; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={`step-${step}`} aria-labelledby={`step-${step}-title`} className={`${cardClass} section-enter scroll-mt-24 p-5 sm:p-6 ${state === "current" ? "border-emerald-300/25 shadow-[0_0_0_1px_rgb(110_231_183/0.06),0_30px_60px_-40px_rgb(16_185_129/0.45)]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className={`tabular mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${state === "done" ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200" : state === "current" ? "border-emerald-300/60 text-emerald-200" : "border-white/15 text-slate-500"}`}>
            {state === "done" ? <CheckIcon /> : index}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold uppercase tracking-widest text-emerald-300">{eyebrow}</p>
            <h2 id={`step-${step}-title`} tabIndex={-1} className="m-0 mt-1 text-xl font-semibold tracking-tight focus:outline-none">{title}</h2>
          </div>
        </div>
        {actions}
      </div>
      {description && <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</div>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** Progress through Request, Review, Price, Respond. Locked steps cannot be opened yet. */
export function StepRail({ states, onJump }: { states: Record<StepKey, StepState>; onJump: (step: StepKey) => void }) {
  return (
    <nav aria-label="Workflow steps" className="sticky top-0 z-20 -mx-1 rounded-2xl border border-white/10 bg-[#0c1216]/85 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#0c1216]/70">
      <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0">
        {stepOrder.map((key, index) => {
          const state = states[key];
          return (
            <li key={key} className="relative">
              <button type="button" disabled={state === "locked"} aria-current={state === "current" ? "step" : undefined} onClick={() => onJump(key)}
                className={`step-pill group flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:py-2 sm:text-sm ${state === "current" ? "bg-emerald-300/10 text-emerald-100" : state === "done" ? "text-slate-200 hover:bg-white/5" : "cursor-not-allowed text-slate-600"}`}>
                <span aria-hidden="true" className={`tabular inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${state === "done" ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200" : state === "current" ? "border-emerald-300/70 text-emerald-200" : "border-white/10"}`}>
                  {state === "done" ? <CheckIcon className="h-3 w-3" /> : index + 1}
                </span>
                <span className="truncate">{stepLabels[key]}</span>
                <span className="sr-only">{state === "done" ? " (completed)" : state === "locked" ? " (not available yet)" : " (current step)"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Copies text and confirms in place. Copying never sends anything to the client. */
export function CopyButton({ text, label, className = secondaryClass, disabled = false }: { text: string; label: string; className?: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }
  return (
    <>
      <button type="button" className={`${className} ${state === "copied" ? "border-emerald-300/50 text-emerald-100" : ""}`} disabled={disabled || !text.trim()} onClick={() => void copy()}>
        {state === "copied" ? <><CheckIcon className="pop h-3.5 w-3.5" />Copied</> : label}
      </button>
      <span role="status" className="sr-only">{state === "copied" ? "Copied to the clipboard. Review it before sharing it with your client." : state === "failed" ? "Clipboard access failed. Select the text and copy it manually." : ""}</span>
      {state === "failed" && <span className="text-xs text-rose-200">Clipboard access failed. Select the text and copy it manually.</span>}
    </>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-500">{children}</p>;
}
