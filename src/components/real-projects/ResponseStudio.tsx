"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatHours, formatRate, formatSignedUsd, formatUsd, practiceSuggestion, type StepState } from "@/lib/client/real-project-ui";
import type { ChangeOrder, DraftStyle, NegotiationDraft, RealClientRequest } from "@/types/real-project";
import { checkboxClass, CopyButton, fieldClass, primaryClass, SectionCard, secondaryClass, Spinner } from "./ui";

const tones: { value: DraftStyle; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly and collaborative", hint: "Warm, relationship first" },
  { value: "professional", label: "Clear and professional", hint: "Neutral and precise" },
  { value: "firm", label: "Firm but respectful", hint: "Holds the boundary" },
];

const draftTime = (value: string) => new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toneLabel = (style: DraftStyle) => tones.find((item) => item.value === style)?.label ?? style;

/** The editable draft. Snippets insert verified terms at the cursor; Ctrl/Cmd+S saves. */
function DraftEditor({ draft, disabled, snippets, onSave, onDirtyChange }: {
  draft: NegotiationDraft;
  disabled: boolean;
  snippets: { label: string; text: string }[];
  onSave: (draft: NegotiationDraft, body: string) => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
}) {
  const [edit, setEdit] = useState(() => ({ draft, body: draft.body }));
  const { body } = edit;
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = body !== edit.draft.body;
  // Keep the original version while dirty so a refresh cannot bypass a conflict.
  // A matching saved body acknowledges this edit; clean editors follow the server.
  if (edit.draft.updatedAt !== draft.updatedAt && (!dirty || body === draft.body)) {
    setEdit({ draft, body: draft.body });
  }
  const setBody = (next: string) => setEdit((previous) => ({ ...previous, body: next }));
  const canSave = !disabled && Boolean(body.trim()) && dirty;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  useEffect(() => { onDirtyChange(draft.id, dirty); }, [draft.id, dirty, onDirtyChange]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Grow with the text so the whole reply is visible while editing.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight + 2, 208), 640)}px`;
  }, [body]);

  function insert(text: string) {
    const element = area.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    const before = body.slice(0, start);
    const spacer = before && !before.endsWith("\n") ? "\n\n" : "";
    const next = `${before}${spacer}${text}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      element?.focus();
      const caret = before.length + spacer.length + text.length;
      element?.setSelectionRange(caret, caret);
    });
  }

  return (
    <article className="rise space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{toneLabel(draft.style)} response</h3>
        <span className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-amber-200">Draft proposal</span>
          <span className="tabular text-slate-500">Source {draft.sourceRevision} / review {draft.reviewRevision} / {draftTime(draft.updatedAt)}</span>
        </span>
      </div>
      {snippets.length > 0 && !disabled && (
        <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Insert into the response">
          <span className="text-slate-500">Insert:</span>
          {snippets.map((snippet) => (
            <button key={snippet.label} type="button" className="chip rounded-full border border-white/15 px-2.5 py-1 text-slate-300 hover:border-emerald-300/40 hover:text-emerald-100" onClick={() => insert(snippet.text)}>+ {snippet.label}</button>
          ))}
        </div>
      )}
      <label className="block text-sm text-slate-200">Editable response
        <textarea ref={area} className={`${fieldClass} min-h-52 resize-y leading-6`} maxLength={12000} value={body} disabled={disabled}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (canSave) onSave(edit.draft, body); } }} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryClass} disabled={!canSave} onClick={() => onSave(edit.draft, body)}>Save edited draft</button>
        <CopyButton text={body} label="Copy response" />
        {dirty && <button type="button" className="text-xs text-slate-400 underline-offset-2 hover:underline" onClick={() => setEdit({ draft, body: draft.body })}>Discard edits</button>}
        <span className="tabular ml-auto text-xs text-slate-500">{words} words / {body.length.toLocaleString()} of 12,000 characters</span>
      </div>
      {dirty
        ? <p className="m-0 text-xs text-amber-200">Your edits are not saved yet.</p>
        : !disabled && <p className="m-0 text-[11px] text-slate-600">Tip: press Ctrl+S (Cmd+S on Mac) to save edits.</p>}
      {dirty && edit.draft.updatedAt !== draft.updatedAt && <p role="status" className="m-0 text-xs text-amber-200">A newer saved version is available. Your unsaved text is preserved. Copy it before discarding edits to load the newer version.</p>}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">Original generated response</summary>
        <p className="m-0 mt-2 whitespace-pre-wrap">{draft.generatedBody}</p>
        {draft.generatedBody !== body && <button type="button" className="mt-2 p-0 text-emerald-200/90 underline-offset-2 hover:underline disabled:opacity-40" disabled={disabled} onClick={() => setBody(draft.generatedBody)}>Restore the generated text</button>}
      </details>
    </article>
  );
}

/** A draft written for an earlier review or calculation. Kept for reference only. */
function EarlierDraft({ draft }: { draft: NegotiationDraft }) {
  return (
    <li className="space-y-2 rounded-lg border border-white/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-300">{toneLabel(draft.style)}</span>
        <span className="tabular text-slate-500">Source {draft.sourceRevision} / review {draft.reviewRevision} / {draftTime(draft.updatedAt)}</span>
      </div>
      <p className="m-0 line-clamp-4 text-xs leading-5 whitespace-pre-wrap text-slate-400">{draft.body}</p>
      <CopyButton text={draft.body} label="Copy" className="text-xs text-emerald-200/90 underline-offset-2 hover:underline disabled:opacity-40" />
    </li>
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
  const currentDrafts = props.drafts.filter(current);
  const earlierDrafts = props.drafts.filter((draft) => !current(draft));
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [dirtyDrafts, setDirtyDrafts] = useState<Record<string, boolean>>({});
  const onDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyDrafts((previous) => previous[id] === dirty ? previous : { ...previous, [id]: dirty });
  }, []);
  const activeDraft = currentDrafts.find((draft) => draft.id === selectedDraftId) ?? currentDrafts[0] ?? null;
  // Snippets come from the server-verified terms, never from the model.
  const feeDelta = impact.proposedFeeCents - impact.originalFeeCents;
  const snippets = [
    { label: "Proposed terms", text: `Proposed terms: ${formatUsd(impact.proposedFeeCents)} in total (${formatSignedUsd(feeDelta)} on the agreed fee), delivery by ${formatDate(impact.proposedDeadline)}. These terms apply once you confirm them.` },
    ...(openQuestions.length > 0 ? [{ label: "Open questions", text: `Before I start, could you confirm:\n${openQuestions.map((question) => `- ${question}`).join("\n")}` }] : []),
    ...(impact.input.assumptions.length > 0 ? [{ label: "Assumptions", text: `This proposal assumes:\n${impact.input.assumptions.map((note) => `- ${note}`).join("\n")}` }] : []),
  ];

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

      {currentDrafts.length > 0 && (
        <div className="space-y-3">
          {currentDrafts.length > 1 && (
            <div role="tablist" aria-label="Drafts for these terms" className="flex flex-wrap gap-1.5">
              {currentDrafts.map((draft) => (
                <button key={draft.id} type="button" role="tab" aria-selected={draft.id === activeDraft?.id} onClick={() => setSelectedDraftId(draft.id)}
                  className={`chip rounded-full border px-3 py-1 text-xs ${draft.id === activeDraft?.id ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100" : "border-white/10 text-slate-400 hover:text-white"}`}>
                  {toneLabel(draft.style)} <span className="tabular opacity-70">{draftTime(draft.createdAt)}</span>
                  {dirtyDrafts[draft.id] && <span className="ml-1 text-amber-200">Unsaved</span>}
                </button>
              ))}
            </div>
          )}
          {currentDrafts.map((draft) => (
            <div key={draft.id} hidden={draft.id !== activeDraft?.id}>
              <DraftEditor draft={draft} disabled={proposalLocked} snippets={snippets}
                onSave={props.onSaveDraft} onDirtyChange={onDirtyChange} />
            </div>
          ))}
        </div>
      )}
      {earlierDrafts.length > 0 && (
        <details className="rounded-xl border border-white/10 p-3 text-sm">
          <summary className="cursor-pointer text-slate-300">Earlier drafts ({earlierDrafts.length}), written for a previous review or calculation</summary>
          <ul className="m-0 mt-3 list-none space-y-2 p-0">{earlierDrafts.map((draft) => <EarlierDraft key={`${draft.id}-${draft.updatedAt}`} draft={draft} />)}</ul>
        </details>
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
