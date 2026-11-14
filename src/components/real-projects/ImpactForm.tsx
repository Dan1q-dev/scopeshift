"use client";

import { useState, type FormEvent } from "react";
import { scopeClassificationLabels, type FinancialImpactInput, type RealClientRequest } from "@/types/real-project";

const inputClass = "mt-1 w-full rounded-lg border border-white/15 bg-[#0c1216] px-3 py-2 text-sm";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function ImpactForm({ request, disabled, onCalculate }: { request: RealClientRequest; disabled: boolean; onCalculate: (input: FinancialImpactInput) => void }) {
  const previous = request.impact?.input;
  const review = request.review!;
  const [selected, setSelected] = useState(previous?.selectedItemIds ?? review.items.filter((item) => item.classification !== "included").map((item) => item.itemId));
  const [additionalHours, setAdditionalHours] = useState(String(previous?.additionalEstimatedHours ?? ""));
  const [removedScope, setRemovedScope] = useState(previous?.removedScope.map((item) => ({ description: item.description, estimatedHours: String(item.estimatedHours) })) ?? []);
  const [pricingMode, setPricingMode] = useState<"fixed" | "hourly">(previous?.pricing.mode ?? "fixed");
  const [fee, setFee] = useState(previous ? String((previous.pricing.mode === "fixed" ? previous.pricing.feeDeltaCents : previous.pricing.hourlyRateCents) / 100) : "");
  const [expenses, setExpenses] = useState(String((previous?.additionalExpensesCents ?? 0) / 100));
  const [days, setDays] = useState(String(previous?.deadlineExtensionDays ?? 0));
  const [assumptions, setAssumptions] = useState(previous?.assumptions.join("\n") ?? "");
  const [checked, setChecked] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    onCalculate({
      reviewRevision: review.revision, selectedItemIds: selected, additionalEstimatedHours: Number(additionalHours),
      removedScope: removedScope.map((item) => ({ description: item.description, estimatedHours: Number(item.estimatedHours) })),
      pricing: pricingMode === "fixed" ? { mode: "fixed", feeDeltaCents: Math.round(Number(fee) * 100) } : { mode: "hourly", hourlyRateCents: Math.round(Number(fee) * 100) },
      additionalExpensesCents: Math.round(Number(expenses) * 100), deadlineExtensionDays: Number(days),
      assumptions: assumptions.split("\n").map((note) => note.trim()).filter(Boolean),
    });
  }
  return <section aria-labelledby="impact-title" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">3. Price your proposal</p><h2 id="impact-title" className="mt-2 text-xl font-semibold">Your estimates. Verified arithmetic.</h2></div>
    <p className="text-sm leading-6 text-slate-400">Enter your own effort and pricing assumptions. The server calculates a proposal; it does not change the agreed contract or decide whether this work is billable.</p>
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Items covered by this proposal</legend>{review.items.map((item) => <label key={item.itemId} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-emerald-400" checked={selected.includes(item.itemId)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, item.itemId] : ids.filter((id) => id !== item.itemId))} /><span>{request.analysis?.items.find((source) => source.id === item.itemId)?.title}<span className="ml-2 text-xs text-slate-500">{scopeClassificationLabels[item.classification]}</span></span></label>)}</fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Additional estimated hours<input className={inputClass} type="number" min="0" max="10000" step="0.01" required value={additionalHours} onChange={(event) => setAdditionalHours(event.target.value)} /></label><label className="text-sm">Deadline extension (calendar days)<input className={inputClass} type="number" min="0" max="365" step="1" required value={days} onChange={(event) => setDays(event.target.value)} /></label></div>
      <div className="space-y-3 rounded-xl border border-white/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Work removed from the original agreement</p><button type="button" className="text-sm text-emerald-200 underline disabled:opacity-40" disabled={removedScope.length >= 20} onClick={() => setRemovedScope((items) => [...items, { description: "", estimatedHours: "" }])}>Add removed task</button></div>{removedScope.length === 0 && <p className="text-xs text-slate-500">No deliverables removed.</p>}{removedScope.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"><label className="text-xs">Removed task {index + 1}<input className={inputClass} required maxLength={500} value={item.description} onChange={(event) => setRemovedScope((items) => items.map((entry, position) => position === index ? { ...entry, description: event.target.value } : entry))} /></label><label className="text-xs">Removed hours<input className={inputClass} type="number" min="0" step="0.01" max="10000" required value={item.estimatedHours} onChange={(event) => setRemovedScope((items) => items.map((entry, position) => position === index ? { ...entry, estimatedHours: event.target.value } : entry))} /></label><button type="button" aria-label={`Remove removed task ${index + 1}`} className="self-end px-2 py-2 text-sm text-rose-200" onClick={() => setRemovedScope((items) => items.filter((_, position) => position !== index))}>Remove</button></div>)}</div>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Pricing method<select className={inputClass} value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "fixed" | "hourly")}><option value="fixed">Fixed additional fee / credit</option><option value="hourly">Rate x net additional hours</option></select></label><label className="text-sm">{pricingMode === "fixed" ? "Additional fee / credit (USD)" : "Hourly rate (USD)"}<input className={inputClass} type="number" min={pricingMode === "hourly" ? 0 : -1000000} max="1000000" step="0.01" required value={fee} onChange={(event) => setFee(event.target.value)} /></label><label className="text-sm">Additional expenses (USD)<input className={inputClass} type="number" min="0" max="1000000" step="0.01" required value={expenses} onChange={(event) => setExpenses(event.target.value)} /></label></div>
      <label className="block text-sm">Assumptions and unresolved details (one per line)<textarea className={`${inputClass} min-h-24`} maxLength={10000} value={assumptions} onChange={(event) => setAssumptions(event.target.value)} /></label>
      <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-emerald-400" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>I checked these estimates and the selected scope. These are proposed terms, pending client agreement.</span></label>
      <button className="rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40" disabled={!checked || selected.length === 0} type="submit">Calculate proposed impact</button>
    </fieldset></form>
    {request.impact && <div aria-label="Proposed project impact" className="space-y-3 rounded-xl border border-emerald-300/25 bg-emerald-300/5 p-4"><p className="font-semibold text-emerald-200">Proposed terms, not an accepted agreement</p><dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-slate-400">Proposed total fee</dt><dd className="mt-1 text-lg font-semibold">{money(request.impact.proposedFeeCents)}</dd></div><div><dt className="text-slate-400">Estimated total effort</dt><dd className="mt-1 text-lg font-semibold">{request.impact.updatedEstimatedHours} hours</dd></div><div><dt className="text-slate-400">Proposed delivery</dt><dd className="mt-1 text-lg font-semibold">{request.impact.proposedDeadline}</dd></div><div><dt className="text-slate-400">Original revenue per hour</dt><dd className="mt-1">{money(request.impact.originalEffectiveHourlyRateCents)}/h</dd></div><div><dt className="text-slate-400">Proposed revenue per hour</dt><dd className="mt-1">{money(request.impact.updatedEffectiveHourlyRateCents)}/h</dd></div><div><dt className="text-slate-400">Additional fee less new expenses</dt><dd className="mt-1">{money(request.impact.additionalCompensationAfterExpensesCents)}</dd></div></dl><p className="text-xs leading-5 text-slate-400">Hourly figures show revenue before expenses and tax. The incremental amount is not the project&apos;s total profit.</p></div>}
  </section>;
}
