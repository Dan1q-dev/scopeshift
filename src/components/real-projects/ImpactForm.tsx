"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  daysBetween, formatDate, formatHours, formatRate, formatSignedDays, formatSignedHours, formatSignedRate,
  formatSignedUsd, formatUsd, impactValuesFromRequest, parseImpactValues, previewImpact,
  type ImpactFormValues, type StepState,
} from "@/lib/client/real-project-ui";
import { scopeClassificationLabels, type FinancialImpact, type FinancialImpactInput, type RealClientRequest } from "@/types/real-project";
import { checkboxClass, fieldClass, primaryClass, quietButton, SectionCard, Spinner } from "./ui";

function deltaTone(value: number, higherIsBetter: boolean) {
  if (value === 0) return "text-slate-500";
  return (value > 0) === higherIsBetter ? "text-emerald-300" : "text-rose-300";
}

/** Original versus proposed terms. Used for the live preview and for the saved server result. */
function Comparison({ impact }: { impact: FinancialImpact }) {
  const feeDelta = impact.proposedFeeCents - impact.originalFeeCents;
  const rateDelta = impact.updatedEffectiveHourlyRateCents - impact.originalEffectiveHourlyRateCents;
  const days = daysBetween(impact.originalDeadline, impact.proposedDeadline);
  const rows = [
    { label: "Total fee", from: formatUsd(impact.originalFeeCents), to: formatUsd(impact.proposedFeeCents), delta: formatSignedUsd(feeDelta), tone: deltaTone(feeDelta, true) },
    { label: "Estimated effort", from: formatHours(impact.originalEstimatedHours), to: formatHours(impact.updatedEstimatedHours), delta: formatSignedHours(impact.netAdditionalHours), tone: "text-slate-400" },
    { label: "Revenue per hour", from: formatRate(impact.originalEffectiveHourlyRateCents), to: formatRate(impact.updatedEffectiveHourlyRateCents), delta: formatSignedRate(rateDelta), tone: deltaTone(rateDelta, true) },
    { label: "Delivery", from: formatDate(impact.originalDeadline), to: formatDate(impact.proposedDeadline), delta: formatSignedDays(days), tone: "text-slate-400" },
  ];
  const max = Math.max(impact.originalEffectiveHourlyRateCents, impact.updatedEffectiveHourlyRateCents, 1);
  return (
    <div className="space-y-4">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="pb-2 font-medium">Term</th><th className="pb-2 font-medium">Original</th><th className="pb-2 font-medium">Proposed</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-white/5 align-top">
              <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-400">{row.label}</th>
              <td className="tabular py-2 pr-2 text-slate-400">{row.from}</td>
              <td className="tabular py-2"><span key={row.to} className="value-flash font-semibold text-slate-100">{row.to}</span><span className={`block text-xs ${row.tone}`}>{row.delta}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1.5" aria-hidden="true">
        {[{ label: "Original", value: impact.originalEffectiveHourlyRateCents, className: "bg-slate-500/60" }, { label: "Proposed", value: impact.updatedEffectiveHourlyRateCents, className: rateDelta >= 0 ? "bg-emerald-400" : "bg-rose-400" }].map((bar) => (
          <div key={bar.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[11px] text-slate-500">
            <span>{bar.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/5"><span className={`grow-bar block h-full rounded-full ${bar.className}`} style={{ width: `${(bar.value / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p className="m-0 text-xs leading-5 text-slate-500">Additional fee less new expenses: <span className="tabular text-slate-300">{formatSignedUsd(impact.additionalCompensationAfterExpensesCents)}</span>. Hourly figures show revenue before expenses and tax; the incremental amount is not the project&apos;s total profit.</p>
    </div>
  );
}

export function ImpactForm({ request, state, disabled, calculating, onCalculate }: {
  request: RealClientRequest;
  state: StepState;
  disabled: boolean;
  calculating: boolean;
  onCalculate: (input: FinancialImpactInput) => void;
}) {
  const review = request.review!;
  const [values, setValues] = useState<ImpactFormValues>(() => impactValuesFromRequest(request));
  const [checked, setChecked] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const preview = useMemo(() => previewImpact(request, values), [request, values]);
  const savedInputs = request.impact ? JSON.stringify(request.impact.input) : null;
  const inputsChanged = Boolean(savedInputs && preview.status === "ok" && JSON.stringify(preview.input) !== savedInputs);

  function set<K extends keyof ImpactFormValues>(key: K, value: ImpactFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setChecked(false);
    setSubmitMessage(null);
  }
  function setRemoved(index: number, patch: Partial<ImpactFormValues["removedScope"][number]>) {
    set("removedScope", values.removedScope.map((entry, position) => position === index ? { ...entry, ...patch } : entry));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseImpactValues(values, review.revision);
    if (parsed.status !== "ok") { setSubmitMessage(parsed.message); return; }
    if (preview.status === "invalid") { setSubmitMessage(preview.message); return; }
    onCalculate(parsed.input);
  }
  const titleOf = (id: string) => request.analysis?.items.find((source) => source.id === id)?.title ?? id;

  return (
    <SectionCard step="price" index={3} state={state} eyebrow="Price your proposal" title="Your estimates. Verified arithmetic."
      description="Enter your own effort and pricing assumptions. The preview updates as you type; the server then calculates and saves the proposal. It does not change the agreed contract or decide whether this work is billable.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="min-w-0">
          <fieldset disabled={disabled} className="m-0 space-y-5 border-0 p-0">
            <fieldset className="m-0 space-y-2 rounded-xl border border-white/10 p-4">
              <legend className="px-1 text-sm font-semibold">Items covered by this proposal</legend>
              {review.items.map((item) => (
                <label key={item.itemId} className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className={checkboxClass} checked={values.selected.includes(item.itemId)} onChange={(event) => set("selected", event.target.checked ? [...values.selected, item.itemId] : values.selected.filter((id) => id !== item.itemId))} />
                  <span>{titleOf(item.itemId)}<span className="ml-2 text-xs text-slate-500">{scopeClassificationLabels[item.classification]}</span></span>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-200">Additional estimated hours
                <input className={fieldClass} type="number" inputMode="decimal" min="0" max="10000" step="0.01" required value={values.additionalHours} onChange={(event) => set("additionalHours", event.target.value)} placeholder="6" />
              </label>
              <label className="block text-sm font-medium text-slate-200">Deadline extension (calendar days)
                <input className={fieldClass} type="number" inputMode="numeric" min="0" max="365" step="1" required value={values.days} onChange={(event) => set("days", event.target.value)} />
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm font-medium">Work removed from the original agreement</p>
                <button type="button" className={quietButton} disabled={values.removedScope.length >= 20} onClick={() => set("removedScope", [...values.removedScope, { description: "", estimatedHours: "" }])}><span aria-hidden="true">+</span>Add removed task</button>
              </div>
              {values.removedScope.length === 0 && <p className="m-0 text-xs text-slate-500">No deliverables removed. Add one for a scope swap.</p>}
              {values.removedScope.map((item, index) => (
                <div key={index} className="rise grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                  <label className="block text-xs text-slate-300">Removed task {index + 1}<input className={fieldClass} required maxLength={500} value={item.description} onChange={(event) => setRemoved(index, { description: event.target.value })} /></label>
                  <label className="block text-xs text-slate-300">Removed hours<input className={fieldClass} type="number" inputMode="decimal" min="0" step="0.01" max="10000" required value={item.estimatedHours} onChange={(event) => setRemoved(index, { estimatedHours: event.target.value })} /></label>
                  <button type="button" aria-label={`Remove removed task ${index + 1}`} className="self-end rounded-md px-2 py-2.5 text-sm text-rose-200 hover:bg-rose-300/10" onClick={() => set("removedScope", values.removedScope.filter((_, position) => position !== index))}>Remove</button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div role="radiogroup" aria-label="Pricing method" className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 text-sm">
                {([["fixed", "Fixed fee / credit"], ["hourly", "Hourly rate"]] as const).map(([mode, label]) => (
                  <button key={mode} type="button" role="radio" aria-checked={values.pricingMode === mode} onClick={() => set("pricingMode", mode)}
                    className={`rounded-full px-3.5 py-1.5 transition ${values.pricingMode === mode ? "bg-emerald-400/15 text-emerald-100 shadow-[inset_0_0_0_1px_rgb(110_231_183/0.35)]" : "text-slate-400 hover:text-white"}`}>{label}</button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-200">{values.pricingMode === "fixed" ? "Additional fee / credit (USD)" : "Hourly rate (USD)"}
                    <input className={fieldClass} type="number" inputMode="decimal" min={values.pricingMode === "hourly" ? 0 : -1000000} max="1000000" step="0.01" required value={values.amount} aria-describedby="impact-amount-hint" onChange={(event) => set("amount", event.target.value)} placeholder={values.pricingMode === "fixed" ? "400" : "75"} />
                  </label>
                  <p id="impact-amount-hint" className="m-0 mt-1 text-xs text-slate-500">{values.pricingMode === "fixed" ? "A negative amount is a credit to the client." : "Multiplied by net additional hours."}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">Additional expenses (USD)
                    <input className={fieldClass} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={values.expenses} aria-describedby="impact-expenses-hint" onChange={(event) => set("expenses", event.target.value)} />
                  </label>
                  <p id="impact-expenses-hint" className="m-0 mt-1 text-xs text-slate-500">New costs you take on, such as a plugin licence.</p>
                </div>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-200">Assumptions and unresolved details (one per line)
              <textarea className={`${fieldClass} min-h-24 font-normal`} maxLength={10000} value={values.assumptions} onChange={(event) => set("assumptions", event.target.value)} placeholder="The client supplies available consultation slots." />
            </label>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input type="checkbox" className={checkboxClass} checked={checked} onChange={(event) => setChecked(event.target.checked)} />
                <span>I checked these estimates and the selected scope. These are proposed terms, pending client agreement.</span>
              </label>
              {submitMessage && <p role="alert" className="m-0 text-xs text-rose-200">{submitMessage}</p>}
              <button className={primaryClass} disabled={!checked || values.selected.length === 0} type="submit">{calculating && <Spinner />}Calculate proposed impact</button>
            </div>
          </fieldset>
        </form>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <section aria-label="Live preview of proposed terms" className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-semibold">Live preview</h3>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">Not saved</span>
            </div>
            {preview.status === "ok"
              ? <Comparison impact={preview.impact} />
              : <p className={`m-0 text-sm ${preview.status === "invalid" ? "text-rose-200" : "text-slate-500"}`} aria-live="polite">{preview.message}</p>}
            <p className="m-0 mt-3 text-[11px] leading-4 text-slate-600">Calculated in your browser with the same rules the server uses.</p>
          </section>

          {request.impact && (
            <section aria-label="Proposed project impact" className="rise space-y-3 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.05] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 font-semibold text-emerald-200">Proposed terms, not an accepted agreement</p>
                <span className="rounded-full border border-emerald-300/30 px-2 py-0.5 text-[11px] text-emerald-200">Saved</span>
              </div>
              {inputsChanged && <p className="m-0 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-2 text-xs text-amber-100">You changed the inputs. This saved result is for the previous values; calculate again to update it.</p>}
              <dl className="m-0 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-400">Proposed total fee</dt><dd className="tabular m-0 mt-0.5 text-lg font-semibold">{formatUsd(request.impact.proposedFeeCents)}</dd></div>
                <div><dt className="text-slate-400">Estimated total effort</dt><dd className="tabular m-0 mt-0.5 text-lg font-semibold">{request.impact.updatedEstimatedHours} hours</dd></div>
                <div><dt className="text-slate-400">Proposed delivery</dt><dd className="tabular m-0 mt-0.5 font-semibold">{formatDate(request.impact.proposedDeadline)}</dd></div>
                <div><dt className="text-slate-400">Proposed revenue per hour</dt><dd className="tabular m-0 mt-0.5 font-semibold">{formatRate(request.impact.updatedEffectiveHourlyRateCents)}</dd></div>
                <div><dt className="text-slate-400">Original revenue per hour</dt><dd className="tabular m-0 mt-0.5">{formatRate(request.impact.originalEffectiveHourlyRateCents)}</dd></div>
                <div><dt className="text-slate-400">Additional fee less new expenses</dt><dd className="tabular m-0 mt-0.5">{formatUsd(request.impact.additionalCompensationAfterExpensesCents)}</dd></div>
              </dl>
              <p className="m-0 text-xs leading-5 text-slate-400">Calculated and saved by the server from your confirmed review. Hourly figures show revenue before expenses and tax.</p>
            </section>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
