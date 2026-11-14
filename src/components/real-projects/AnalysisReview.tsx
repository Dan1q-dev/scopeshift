"use client";

import { useState } from "react";
import {
  scopeClassificationLabels, scopeClassificationSchema,
  type RealClientRequest, type ScopeClassification, type ScopeReviewInput,
} from "@/types/real-project";

const selectClass = "w-full rounded-lg border border-white/15 bg-[#0c1216] px-3 py-2 text-sm";

export function AnalysisReview({ request, disabled, onConfirm, onDirty }: {
  request: RealClientRequest;
  disabled: boolean;
  onConfirm: (input: ScopeReviewInput) => void;
  onDirty: () => void;
}) {
  const analysis = request.analysis!;
  const [items, setItems] = useState(() => analysis.items.map((item) => {
    const saved = request.review?.items.find((review) => review.itemId === item.id);
    return saved ?? { itemId: item.id, classification: item.classification, reason: "" };
  }));
  const [confirmed, setConfirmed] = useState(false);
  const canConfirm = confirmed && items.every((item) => item.classification === analysis.items.find((original) => original.id === item.itemId)?.classification || Boolean(item.reason.trim()));
  function change(id: string, patch: { classification?: ScopeClassification; reason?: string }) {
    setItems((previous) => previous.map((item) => item.itemId === id ? { ...item, ...patch } : item));
    setConfirmed(false);
    onDirty();
  }
  const documents = [...request.projectSnapshot.documents, request.requestDocument];
  return <section aria-labelledby="scope-analysis-title" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">2. Potential changes</p><h2 id="scope-analysis-title" className="mt-2 text-xl font-semibold">Review each requested change</h2></div>
    <p className="text-sm leading-6 text-slate-300">{analysis.summary}</p>
    <p className="text-sm text-amber-200">AI interpretation needs your review. Something missing from the agreement is not automatically excluded or billable.</p>
    {analysis.items.map((item, index) => {
      const reviewed = items[index];
      const changed = reviewed.classification !== item.classification;
      return <article key={item.id} className="space-y-3 rounded-xl border border-white/10 bg-[#0c1216]/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="rounded-full border border-sky-300/25 px-3 py-1 text-xs text-sky-200">AI: {scopeClassificationLabels[item.classification]}</span></div>
        <p className="text-sm text-slate-300">{item.requestedWork}</p>
        <p className="text-sm leading-6 text-slate-400">{item.explanation}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {([{ title: "Originally agreed source", quotes: item.contractEvidence }, { title: "Newly requested", quotes: item.requestEvidence }]).map((group) => <div key={group.title} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</h4>
            {group.quotes.length ? group.quotes.map((quote, quoteIndex) => {
              const document = documents.find((source) => source.id === quote.documentId);
              return <blockquote key={`${quote.passageId}-${quoteIndex}`} className="border-l-2 border-emerald-400/50 pl-3 text-sm">
                <p className="whitespace-pre-wrap break-words text-slate-200">&ldquo;{quote.quote}&rdquo;</p>
                <footer className="mt-1 text-xs text-slate-500">{document?.label ?? "Source"}, passage {quote.passageId.split("_p").at(-1)}, characters {quote.start}-{quote.end}</footer>
              </blockquote>;
            }) : <p className="text-sm text-slate-500">No exact agreement passage supports this classification.</p>}
          </div>)}
        </div>
        {item.unknowns.length > 0 && <div><h4 className="text-sm font-medium text-amber-200">Still unknown</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">{item.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}
        {item.clarificationQuestions.length > 0 && <div><h4 className="text-sm font-medium">Needs clarification</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">{item.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Your classification for {item.title}</span><select className={selectClass} value={reviewed.classification} disabled={disabled} onChange={(event) => change(item.id, { classification: event.target.value as ScopeClassification })}>{scopeClassificationSchema.options.map((classification) => <option key={classification} value={classification}>{scopeClassificationLabels[classification]}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>{changed ? "Reason for your correction (required)" : "Review note (optional)"}</span><textarea className={`${selectClass} min-h-20`} value={reviewed.reason} disabled={disabled} maxLength={2000} onChange={(event) => change(item.id, { reason: event.target.value })} /></label>
        </div>
      </article>;
    })}
    {analysis.limitations.length > 0 && <details className="rounded-lg border border-white/10 p-3 text-sm"><summary className="cursor-pointer text-slate-300">Analysis limitations</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">{analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>}
    <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-emerald-400" checked={confirmed} disabled={disabled} onChange={(event) => setConfirmed(event.target.checked)} /><span>I checked every item and the quoted sources. This records my interpretation, not the client&apos;s acceptance.</span></label>
    <button type="button" className="rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40" disabled={disabled || !canConfirm} onClick={() => onConfirm({ sourceRevision: request.sourceRevision, expectedReviewRevision: request.review?.revision ?? 0, items })}>{request.review ? "Save updated review" : "Confirm reviewed scope"}</button>
    {request.review && <p className="text-xs text-emerald-200">Review {request.review.revision} confirmed. Changing it will require a new impact calculation and draft.</p>}
  </section>;
}
