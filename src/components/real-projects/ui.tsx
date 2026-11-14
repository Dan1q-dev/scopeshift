"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ghostButton, primaryButton } from "@/components/ui/SiteHeader";
import { classificationStyle, stepLabels, stepOrder, type StepKey, type StepState } from "@/lib/client/real-project-ui";
import { scopeClassificationLabels, type ScopeClassification } from "@/types/real-project";
import {
  CalculatorIcon, ChatIcon, CheckCircleIcon, CopyIcon, HelpCircleIcon, InboxIcon, MinusCircleIcon, ScaleIcon, XCircleIcon,
} from "./icons";

export const fieldClass = "mt-1.5 block w-full rounded-lg border border-white/15 bg-[#0b1115] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60";
export const primaryClass = `${primaryButton} shine gap-2 px-4 py-2.5`;
export const secondaryClass = `${ghostButton} gap-2 py-2`;
export const quietButton = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-emerald-200 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40";
export const checkboxClass = "mt-0.5 h-4 w-4 shrink-0 accent-emerald-400";
export const cardClass = "glass rounded-2xl border border-white/10";

/** Each step has its own accent colour (RGB channels), used through the --accent CSS variable. */
export const stepAccent: Record<StepKey, string> = {
  request: "56 189 248",
  review: "167 139 250",
  price: "52 211 153",
  respond: "251 191 36",
};
export const accentStyle = (rgb: string) => ({ "--accent": rgb }) as CSSProperties;

const stepIcons: Record<StepKey, (props: { className?: string }) => React.ReactNode> = {
  request: InboxIcon, review: ScaleIcon, price: CalculatorIcon, respond: ChatIcon,
};
const classificationIcons: Record<ScopeClassification, (props: { className?: string }) => React.ReactNode> = {
  included: CheckCircleIcon, excluded: XCircleIcon, not_specified: MinusCircleIcon, ambiguous: HelpCircleIcon,
};

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

export function ClassificationIcon({ classification, className = "h-3.5 w-3.5" }: { classification: ScopeClassification; className?: string }) {
  const Icon = classificationIcons[classification];
  return <Icon className={className} />;
}

export function ClassificationPill({ classification, prefix }: { classification: ScopeClassification; prefix?: string }) {
  const style = classificationStyle[classification];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.pill}`}>
      <ClassificationIcon classification={classification} />
      {prefix && <span className="opacity-75">{prefix}</span>}{scopeClassificationLabels[classification]}
    </span>
  );
}

export function Metric({ label, value, hint, icon, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-3.5 py-3" style={accent ? accentStyle(accent) : undefined}>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">{icon && <span className="accent-text">{icon}</span>}{label}</dt>
      <dd className="tabular m-0 mt-1 text-lg font-semibold">{value}</dd>
      {hint && <p className="m-0 mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** One step of the flow, in its own accent colour. The heading takes focus when the flow moves here. */
export function SectionCard({ step, index, title, eyebrow, state, description, actions, children }: {
  step: StepKey; index: number; title: string; eyebrow: string; state: StepState; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  const Icon = stepIcons[step];
  return (
    <section id={`step-${step}`} aria-labelledby={`step-${step}-title`} style={accentStyle(stepAccent[step])}
      className={`accent-card glass section-enter scroll-mt-24 overflow-hidden rounded-2xl ${state === "current" ? "is-active" : ""}`}>
      <div aria-hidden="true" className="accent-line h-px" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="accent-chip relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <Icon className="h-5 w-5" />
              {state === "done" && <span className="absolute -right-1.5 -bottom-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><CheckIcon className="h-2.5 w-2.5" /></span>}
            </span>
            <div className="min-w-0">
              <p className="accent-text m-0 text-xs font-semibold uppercase tracking-widest">Step {index} - {eyebrow}</p>
              <h2 id={`step-${step}-title`} tabIndex={-1} className="m-0 mt-1 text-xl font-semibold tracking-tight focus:outline-none">{title}</h2>
            </div>
          </div>
          {actions}
        </div>
        {description && <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</div>}
        <div className="mt-5 space-y-5">{children}</div>
      </div>
    </section>
  );
}

/** Progress through Request, Review, Price, Respond. Locked steps cannot be opened yet. */
export function StepRail({ states, onJump }: { states: Record<StepKey, StepState>; onJump: (step: StepKey) => void }) {
  return (
    <nav aria-label="Workflow steps" className="sticky top-0 z-20 -mx-1 rounded-2xl border border-white/10 bg-[#0c1216]/85 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#0c1216]/70">
      <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0">
        {stepOrder.map((key) => {
          const state = states[key];
          const Icon = stepIcons[key];
          return (
            <li key={key} className="relative" style={accentStyle(stepAccent[key])}>
              <button type="button" disabled={state === "locked"} aria-current={state === "current" ? "step" : undefined} onClick={() => onJump(key)}
                className={`step-pill group flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition sm:flex-row sm:justify-start sm:gap-2 sm:px-2.5 sm:py-2 sm:text-sm ${state === "current" ? "accent-current" : state === "done" ? "text-slate-200 hover:bg-white/5" : "cursor-not-allowed text-slate-600"}`}>
                <span aria-hidden="true" className={`inline-flex h-6 w-6 shrink-0 items-center justify-center ${state === "locked" ? "" : "accent-text"}`}>
                  {state === "done" ? <CheckCircleIcon className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
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
      <button type="button" className={`${className} inline-flex items-center gap-1.5 ${state === "copied" ? "border-emerald-300/50 text-emerald-100" : ""}`} disabled={disabled || !text.trim()} onClick={() => void copy()}>
        {state === "copied" ? <><CheckIcon className="pop h-3.5 w-3.5" />Copied</> : <><CopyIcon className="h-4 w-4" />{label}</>}
      </button>
      <span role="status" className="sr-only">{state === "copied" ? "Copied to the clipboard. Review it before sharing it with your client." : state === "failed" ? "Clipboard access failed. Select the text and copy it manually." : ""}</span>
      {state === "failed" && <span className="text-xs text-rose-200">Clipboard access failed. Select the text and copy it manually.</span>}
    </>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-500">{children}</p>;
}
