"use client";

import { useId, useState } from "react";
import { classificationCounts, classificationOrder, classificationStyle, quoteContext, type StepState } from "@/lib/client/real-project-ui";
import {
  scopeClassificationLabels, scopeClassificationSchema,
  type RealClientRequest, type ScopeClassification, type ScopeReviewInput, type SourceDocument, type SourceQuote,
} from "@/types/real-project";
import { checkboxClass, ClassificationPill, fieldClass, primaryClass, SectionCard, Spinner } from "./ui";

/** A cited quote, with the surrounding source text on demand so the user can verify it. */
function Quote({ quote, document, tone }: { quote: SourceQuote; document: SourceDocument | undefined; tone: "contract" | "request" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const context = document ? quoteContext(document, quote.start, quote.end) : null;
  return (
    <blockquote className={`m-0 rounded-lg border-l-2 bg-black/20 py-2 pr-3 pl-3 text-sm ${tone === "contract" ? "border-emerald-400/60" : "border-sky-400/60"}`}>
      <p className="m-0 whitespace-pre-wrap break-words text-slate-200">&ldquo;{quote.quote}&rdquo;</p>
      <footer className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{document?.label ?? "Source"}, passage {quote.passageId.split("_p").at(-1)}, characters {quote.start}-{quote.end}</span>
        {context && <button type="button" aria-expanded={open} aria-controls={id} className="p-0 text-emerald-200/90 underline-offset-2 hover:underline" onClick={() => setOpen((value) => !value)}>{open ? "Hide context" : "Show in source"}</button>}
      </footer>
      {open && context && (
        <p id={id} className="rise m-0 mt-2 rounded-md border border-white/10 bg-[#0b1115] p-2.5 text-xs leading-5 whitespace-pre-wrap break-words text-slate-400">
          {context.leadingCut && "..."}{context.before}<mark className="rounded bg-emerald-300/25 px-0.5 text-emerald-50">{context.quote}</mark>{context.after}{context.trailingCut && "..."}
        </p>
      )}
    </blockquote>
  );
}

export function AnalysisReview({ request, state, disabled, saving, onConfirm, onDirty }: {
  request: RealClientRequest;
  state: StepState;
  disabled: boolean;
  saving: boolean;
  onConfirm: (input: ScopeReviewInput) => void;
  onDirty: () => void;
}) {
  const analysis = request.analysis!;
  const [items, setItems] = useState(() => analysis.items.map((item) => {
    const saved = request.review?.items.find((review) => review.itemId === item.id);
    return saved ?? { itemId: item.id, classification: item.classification, reason: "" };
  }));
  const [confirmed, setConfirmed] = useState(false);
  // Compact by default: short analyses stay fully open; longer ones open the first item that needs a decision.
  const [open, setOpen] = useState<Set<string>>(() => {
    if (analysis.items.length <= 2) return new Set(analysis.items.map((item) => item.id));
    const first = analysis.items.find((item) => item.classification !== "included") ?? analysis.items[0];
    return new Set([first.id]);
  });
  const [filter, setFilter] = useState<ScopeClassification | null>(null);
  const needsReason = (itemId: string) => {
    const reviewed = items.find((item) => item.itemId === itemId)!;
    return reviewed.classification !== analysis.items.find((original) => original.id === itemId)?.classification && !reviewed.reason.trim();
  };
  const missingReasonIds = items.filter((item) => needsReason(item.itemId)).map((item) => item.itemId);
  const missingReasons = missingReasonIds.length;
  const canConfirm = confirmed && missingReasons === 0;
  const counts = classificationCounts(items);
  const corrections = items.filter((item, index) => item.classification !== analysis.items[index].classification).length;
  const allOpen = open.size === analysis.items.length;
  const toggle = (id: string) => setOpen((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  function change(id: string, patch: { classification?: ScopeClassification; reason?: string }) {
    setItems((previous) => previous.map((item) => item.itemId === id ? { ...item, ...patch } : item));
    setConfirmed(false);
    onDirty();
  }
  const documents = [...request.projectSnapshot.documents, request.requestDocument];

  return (
    <SectionCard step="review" index={2} state={state} eyebrow="Potential changes" title="Review each requested change"
      description={<>
        <p className="m-0 text-slate-300">{analysis.summary}</p>
        <p className="m-0 mt-2 text-amber-200">AI interpretation needs your review. Something missing from the agreement is not automatically excluded or billable.</p>
      </>}>
      <div className="space-y-2">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
          {classificationOrder.map((key) => counts[key] > 0 && <span key={key} className={`grow-bar ${classificationStyle[key].bar}`} style={{ width: `${(counts[key] / items.length) * 100}%` }} />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Filter items by your classification">
            <span className="mr-1 font-medium text-slate-300">{items.length} {items.length === 1 ? "item" : "items"}</span>
            {classificationOrder.map((key) => counts[key] > 0 && (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(filter === key ? null : key)}
                className={`chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${filter === key ? classificationStyle[key].pill : "border-white/10 text-slate-400 hover:text-white"}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${classificationStyle[key].dot}`} />{counts[key]} {classificationStyle[key].short}
              </button>
            ))}
            {corrections > 0 && <span className="ml-1 text-amber-200">{corrections} corrected by you</span>}
          </div>
          {analysis.items.length > 1 && (
            <button type="button" className="text-xs text-emerald-200/90 underline-offset-2 hover:underline" onClick={() => setOpen(allOpen ? new Set() : new Set(analysis.items.map((item) => item.id)))}>
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        {filter && <p className="m-0 text-xs text-slate-500">Showing {counts[filter]} of {items.length}. Hidden items keep their review choices. <button type="button" className="p-0 text-emerald-200/90 underline-offset-2 hover:underline" onClick={() => setFilter(null)}>Show all</button></p>}
      </div>

      <ol className="stagger m-0 list-none space-y-3 p-0">
        {analysis.items.map((item, index) => {
          const reviewed = items[index];
          const changed = reviewed.classification !== item.classification;
          if (filter && reviewed.classification !== filter) return null;
          const isOpen = open.has(item.id);
          const bodyId = `review-item-${item.id}`;
          return (
            <li key={item.id}>
              <article className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0b1115]/70 pl-1">
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${classificationStyle[reviewed.classification].bar} transition-colors`} />
                <div className="flex flex-wrap items-start justify-between gap-2 p-4 pb-0">
                  <h3 className="m-0 min-w-0 flex-1 text-base font-semibold">
                    <button type="button" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(item.id)} className="group flex w-full items-start gap-2 text-left">
                      <span aria-hidden="true" className={`mt-1.5 inline-block h-2 w-2 shrink-0 border-r-2 border-b-2 border-slate-500 transition-transform ${isOpen ? "rotate-45" : "-rotate-45"}`} />
                      <span className="min-w-0">
                        <span className="block group-hover:text-emerald-100">{item.title}</span>
                        <span className={`block text-sm font-normal text-slate-400 ${isOpen ? "" : "line-clamp-1"}`}>{item.requestedWork}</span>
                      </span>
                    </button>
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ClassificationPill classification={item.classification} prefix="AI: " />
                    {changed && <ClassificationPill classification={reviewed.classification} prefix="You: " />}
                    {!isOpen && needsReason(item.id) && <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-200">Reason needed</span>}
                    {!isOpen && item.clarificationQuestions.length > 0 && <span className="rounded-full border border-sky-300/30 px-2 py-0.5 text-[11px] text-sky-200">{item.clarificationQuestions.length} {item.clarificationQuestions.length === 1 ? "question" : "questions"}</span>}
                  </div>
                </div>
                {!isOpen && <div className="h-4" />}
                {isOpen && (
                <div id={bodyId} className="rise p-4 pt-2">
                <p className="m-0 text-sm leading-6 text-slate-400">{item.explanation}</p>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Originally agreed source</h4>
                    {item.contractEvidence.length
                      ? item.contractEvidence.map((quote, quoteIndex) => <Quote key={`${quote.passageId}-${quoteIndex}`} quote={quote} tone="contract" document={documents.find((source) => source.id === quote.documentId)} />)
                      : <p className="m-0 text-sm text-slate-500">No exact agreement passage supports this classification.</p>}
                  </div>
                  <div className="space-y-2">
                    <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Newly requested</h4>
                    {item.requestEvidence.map((quote, quoteIndex) => <Quote key={`${quote.passageId}-${quoteIndex}`} quote={quote} tone="request" document={documents.find((source) => source.id === quote.documentId)} />)}
                  </div>
                </div>

                {(item.unknowns.length > 0 || item.clarificationQuestions.length > 0) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {item.unknowns.length > 0 && <div><h4 className="m-0 text-sm font-medium text-amber-200">Still unknown</h4><ul className="mt-1 mb-0 list-disc space-y-1 pl-5 text-sm text-slate-300">{item.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}
                    {item.clarificationQuestions.length > 0 && <div><h4 className="m-0 text-sm font-medium text-sky-200">Needs clarification</h4><ul className="mt-1 mb-0 list-disc space-y-1 pl-5 text-sm text-slate-300">{item.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>}
                  </div>
                )}

                <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2">
                  <label className="block text-sm text-slate-200"><span>Your classification for {item.title}</span>
                    <select className={fieldClass} value={reviewed.classification} disabled={disabled} onChange={(event) => change(item.id, { classification: event.target.value as ScopeClassification })}>
                      {scopeClassificationSchema.options.map((classification) => <option key={classification} value={classification}>{scopeClassificationLabels[classification]}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-200"><span className={changed && !reviewed.reason.trim() ? "text-amber-200" : undefined}>{changed ? "Reason for your correction (required)" : "Review note (optional)"}</span>
                    <textarea className={`${fieldClass} min-h-20`} value={reviewed.reason} disabled={disabled} maxLength={2000} aria-invalid={changed && !reviewed.reason.trim()} onChange={(event) => change(item.id, { reason: event.target.value })} />
                  </label>
                </div>
                </div>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      {analysis.limitations.length > 0 && (
        <details className="rounded-xl border border-white/10 p-3 text-sm">
          <summary className="cursor-pointer text-slate-300">Analysis limitations</summary>
          <ul className="mt-2 mb-0 list-disc space-y-1 pl-5 text-slate-400">{analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </details>
      )}

      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-300">
          <input type="checkbox" className={checkboxClass} checked={confirmed} disabled={disabled} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I checked every item and the quoted sources. This records my interpretation, not the client&apos;s acceptance.</span>
        </label>
        {missingReasons > 0 && (
          <p className="m-0 text-xs text-amber-200">
            Add a reason for {missingReasons === 1 ? "your correction" : `each of your ${missingReasons} corrections`} before confirming.{" "}
            <button type="button" className="p-0 text-amber-100 underline underline-offset-2" onClick={() => { setFilter(null); setOpen((previous) => new Set([...previous, ...missingReasonIds])); }}>Show {missingReasons === 1 ? "it" : "them"}</button>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primaryClass} disabled={disabled || !canConfirm} onClick={() => onConfirm({ sourceRevision: request.sourceRevision, expectedReviewRevision: request.review?.revision ?? 0, items })}>
            {saving && <Spinner />}{request.review ? "Save updated review" : "Confirm reviewed scope"}
          </button>
          {request.review && <p className="m-0 text-xs text-emerald-200">Review {request.review.revision} confirmed. Changing it will require a new impact calculation and draft.</p>}
        </div>
      </div>
    </SectionCard>
  );
}
