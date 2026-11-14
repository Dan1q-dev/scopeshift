"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, formatHours, formatRate, formatUsd, practiceSuggestion, type StepState } from "@/lib/client/real-project-ui";
import type { ChangeOrder, DraftStyle, NegotiationDraft, RealClientRequest } from "@/types/real-project";
import { checkboxClass, CopyButton, fieldClass, primaryClass, SectionCard, secondaryClass, Spinner } from "./ui";

const tones: { value: DraftStyle; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly and collaborative", hint: "Warm, relationship first" },
  { value: "professional", label: "Clear and professional", hint: "Neutral and precise" },
  { value: "firm", label: "Firm but respectful", hint: "Holds the boundary" },
];

function DraftEditor({ draft, disabled, readOnlyReason, onSave }: { draft: NegotiationDraft; disabled: boolean; readOnlyReason: string | null; onSave: (body: string) => void }) {
  const [body, setBody] = useState(draft.body);
  const dirty = body !== draft.body;
  const tone = tones.find((item) => item.value === draft.style);
  return (
    <article className="rise space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{tone?.label ?? draft.style} response</h3>
        <span className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-amber-200">Draft proposal</span>
          <span className="tabular text-slate-500">Source {draft.sourceRevision} / review {draft.reviewRevision}</span>
        </span>
      </div>
      {readOnlyReason && <p className="m-0 text-xs text-amber-200">{readOnlyReason}</p>}
      <label className="block text-sm text-slate-200">Editable response
        <textarea className={`${fieldClass} min-h-52 leading-6`} maxLength={12000} value={body} disabled={disabled} onChange={(event) => setBody(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryClass} disabled={disabled || !body.trim() || !dirty} onClick={() => onSave(body)}>Save edited draft</button>
        <CopyButton text={body} label="Copy response" />
        {dirty && <button type="button" className="text-xs text-slate-400 underline-offset-2 hover:underline" onClick={() => setBody(draft.body)}>Discard edits</button>}
        <span className="tabular ml-auto text-xs text-slate-500">{body.length.toLocaleString()} / 12,000</span>
      </div>
      {dirty && <p className="m-0 text-xs text-amber-200">Your edits are not saved yet.</p>}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">Original generated response</summary>
        <p className="m-0 mt-2 whitespace-pre-wrap">{draft.generatedBody}</p>
      </details>
    </article>
  );
}

export function ResponseStudio(props: {
  request: RealClientRequest;
  state: StepState;
  locked: boolean;
  proposalLocked: boolean;
  generating: boolean;
  drafts: NegotiationDraft[];
  changeOrder: ChangeOrder | null;
  style: DraftStyle;
  consent: boolean;
  onStyle: (style: DraftStyle) => void;
  onConsent: (value: boolean) => void;
  onGenerate: () => void;
  onRefreshDrafts: () => void;
  onPrepareNewDraft: () => void;
  onSaveDraft: (draft: NegotiationDraft, body: string) => void;
}) {
  const { request, proposalLocked } = props;
  const impact = request.impact!;
  const selected = request.analysis?.items.filter((item) => impact.input.selectedItemIds.includes(item.id)) ?? [];
  const openQuestions = [...new Set(selected.flatMap((item) => item.clarificationQuestions))];
  const practice = practiceSuggestion(request);
  const current = (draft: NegotiationDraft) => draft.reviewRevision === request.review?.revision && draft.impactHash === request.impactHash;

  return (
    <SectionCard step="respond" index={4} state={props.state} eyebrow="Respond clearly" title="Prepare the conversation"
      description="Your reviewed scope and calculated terms guide the English response. Every response stays editable and proposed. Nothing is sent to your client.">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Proposed fee", formatUsd(impact.proposedFeeCents)],
          ["Total effort", formatHours(impact.updatedEstimatedHours)],
          ["Delivery", formatDate(impact.proposedDeadline)],
          ["Revenue per hour", formatRate(impact.updatedEffectiveHourlyRateCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-black/25 px-3.5 py-3"><p className="m-0 text-[11px] uppercase tracking-wider text-slate-500">{label}</p><p className="tabular m-0 mt-1 font-semibold">{value}</p></div>
        ))}
      </div>

      {(openQuestions.length > 0 || impact.input.assumptions.length > 0) && (
        <div className="grid gap-4 rounded-xl border border-sky-300/15 bg-sky-300/[0.04] p-4 text-sm md:grid-cols-2">
          {openQuestions.length > 0 && <div><p className="m-0 font-medium text-sky-100">Still open with the client ({openQuestions.length})</p><ul className="mt-1 mb-0 list-disc space-y-1 pl-5 text-slate-300">{openQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>}
          {impact.input.assumptions.length > 0 && <div><p className="m-0 font-medium text-sky-100">Your assumptions</p><ul className="mt-1 mb-0 list-disc space-y-1 pl-5 text-slate-300">{impact.input.assumptions.map((note) => <li key={note}>{note}</li>)}</ul></div>}
        </div>
      )}

      <fieldset disabled={proposalLocked} className="m-0 space-y-4 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Response tone</legend>
        <div role="radiogroup" aria-label="Response tone" className="grid gap-2 sm:grid-cols-3">
          {tones.map((tone) => {
            const active = props.style === tone.value;
            return (
              <button key={tone.value} type="button" role="radio" aria-checked={active} onClick={() => props.onStyle(tone.value)}
                className={`chip rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-emerald-300/50 bg-emerald-300/[0.07]" : "border-white/10 hover:border-white/20 hover:bg-white/5"}`}>
                <span className="block text-sm font-medium">{tone.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{tone.hint}</span>
              </button>
            );
          })}
        </div>
        <label className="flex items-start gap-3 text-sm text-slate-300">
          <input type="checkbox" className={checkboxClass} checked={props.consent} onChange={(event) => props.onConsent(event.target.checked)} />
          <span>I authorize sending the source text, request, reviewed scope, and proposed terms to OpenAI to generate this response.</span>
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primaryClass} disabled={proposalLocked || !props.consent} onClick={props.onGenerate}>{props.generating && <Spinner />}Generate draft</button>
        <button type="button" className={secondaryClass} disabled={props.locked} onClick={props.onRefreshDrafts}>Refresh saved drafts</button>
        <button type="button" className={secondaryClass} disabled={proposalLocked} onClick={props.onPrepareNewDraft}>Prepare a new draft</button>
      </div>

      {props.drafts.length > 0 && (
        <div className="space-y-4">
          {props.drafts.map((draft) => (
            <DraftEditor key={`${draft.id}-${draft.updatedAt}`} draft={draft}
              disabled={proposalLocked || !current(draft)}
              readOnlyReason={current(draft) ? null : "Earlier proposal (read-only): it was written for a previous review or calculation."}
              onSave={(body) => props.onSaveDraft(draft, body)} />
          ))}
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-base font-semibold">Proposed Change Order</h3>
          <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-[11px] text-amber-200">Proposed, not accepted</span>
        </div>
        {props.changeOrder ? (
          <>
            <pre className="paper m-0 max-h-96 overflow-auto rounded-xl border border-white/10 p-4 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words text-slate-300">{props.changeOrder.body}</pre>
            <CopyButton text={props.changeOrder.body} label="Copy proposed Change Order" />
          </>
        ) : (
          <p className="m-0 text-sm text-slate-500">Calculate the current proposal above to create a source-linked Change Order. This document does not record client acceptance.</p>
        )}
      </div>

      <aside aria-label="Practice negotiating a change request" className="flex flex-col gap-3 rounded-xl border border-emerald-300/20 bg-gradient-to-r from-emerald-300/[0.07] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-widest text-emerald-300">Rehearse first - {practice.focus}</p>
          <p className="m-0 mt-1 text-sm font-medium">{practice.title}</p>
          <p className="m-0 mt-1 max-w-xl text-xs leading-5 text-slate-400">{practice.body} The practice project is fictional; your agreement and client message are not transferred.</p>
        </div>
        <Link href="/simulation" className={`${secondaryClass} shrink-0`}>Practice negotiating a change request</Link>
      </aside>
    </SectionCard>
  );
}
