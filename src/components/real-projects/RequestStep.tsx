"use client";

import { formatDate, formatUsd, type StepState } from "@/lib/client/real-project-ui";
import { REAL_PROJECT_LIMITS, type RealClientRequest, type RealProject } from "@/types/real-project";
import { checkboxClass, fieldClass, primaryClass, quietButton, secondaryClass, SectionCard, Spinner } from "./ui";

const sampleRequest = "Hi! Could you also add appointment booking so visitors can pick a consultation time, sync it with my calendar, and add two more pages for our new services? We would still like to launch on the same date.";

const statusStyle: Record<RealClientRequest["status"], string> = {
  pending: "border-amber-300/30 text-amber-200",
  ready: "border-sky-300/30 text-sky-200",
  confirmed: "border-emerald-300/40 text-emerald-200",
  failed: "border-rose-300/40 text-rose-200",
};

export function RequestStep(props: {
  project: RealProject;
  state: StepState;
  request: RealClientRequest | null;
  requests: RealClientRequest[];
  stale: boolean;
  locked: boolean;
  analyzing: boolean;
  message: string;
  consent: boolean;
  onMessage: (value: string) => void;
  onConsent: (value: boolean) => void;
  onAnalyze: () => void;
  onOpen: (record: RealClientRequest) => void;
  onNewRequest: () => void;
  onRefreshStatus: () => void;
  onPrepareReanalysis: () => void;
}) {
  const { project, request, requests, stale, locked } = props;
  return (
    <SectionCard step="request" index={1} state={props.state} eyebrow="Analyze a change request" title="What did your client ask for?"
      description="Each requested change is checked separately against your saved agreement, with quotes you can verify."
      actions={request ? <button type="button" className={secondaryClass} disabled={locked} onClick={props.onNewRequest}>Analyze a new request</button> : undefined}>
      {!request ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200">Client request text
              <textarea className={`${fieldClass} min-h-32 font-normal leading-6`} maxLength={REAL_PROJECT_LIMITS.clientMessageCharacters} value={props.message} disabled={locked}
                onChange={(event) => props.onMessage(event.target.value)} placeholder="Paste and redact the client's message. Each requested change will be checked separately." />
            </label>
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <button type="button" className="p-0 text-emerald-200/90 underline-offset-2 hover:underline disabled:opacity-40" disabled={locked} onClick={() => props.onMessage(sampleRequest)}>Use fictional sample request</button>
              <span className="tabular">{props.message.length.toLocaleString()} / {REAL_PROJECT_LIMITS.clientMessageCharacters.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="m-0 text-xs leading-5 text-slate-400">Analysis sends this request and the current agreement/amendments to OpenAI. Saved text remains available in project history. Verify all conclusions before using them.</p>
            <label className="mt-3 flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" className={checkboxClass} disabled={locked} checked={props.consent} onChange={(event) => props.onConsent(event.target.checked)} />
              <span>I reviewed the text and authorize sending this request and these sources to OpenAI for analysis.</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryClass} disabled={locked || !props.consent || !props.message.trim()} onClick={props.onAnalyze}>
              {props.analyzing && <Spinner />}Analyze request
            </button>
            <p className="m-0 text-xs text-slate-500">An analysis is an interpretation of your text, not legal advice or client acceptance.</p>
          </div>
        </div>
      ) : (
        <div className="rise space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="m-0 text-xs uppercase tracking-wider text-slate-500">Selected client request / source revision {request.sourceRevision}</p>
          <blockquote className="m-0 border-l-2 border-sky-300/50 pl-3 text-sm leading-6 whitespace-pre-wrap break-words text-slate-200">{request.clientMessage}</blockquote>
          {stale && (
            <div role="status" className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
              <p className="m-0">Read-only historical snapshot. The project sources have changed since this analysis. Run a new analysis before reviewing, calculating, or drafting.</p>
              <button type="button" className={secondaryClass} disabled={locked} onClick={props.onPrepareReanalysis}>Analyze again with current sources</button>
            </div>
          )}
          {(request.status === "pending" || request.status === "failed") && (
            <div className="space-y-3">
              <p className="m-0 text-sm text-amber-200">{request.status === "pending" ? "Analysis is still pending. Refresh its stored status before starting a separate analysis; this does not start another AI call." : request.error?.message ?? "Analysis could not be completed."}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} disabled={locked} onClick={props.onRefreshStatus}>Refresh analysis status</button>
                {!stale && <button type="button" className={secondaryClass} disabled={locked} onClick={props.onPrepareReanalysis}>Prepare a new analysis</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {requests.length > 0 && (
        <section aria-label="Request history" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-sm font-semibold text-slate-300">Request history</h3>
            <span className="text-xs text-slate-500">{requests.length} saved</span>
          </div>
          <ol className="stagger m-0 list-none space-y-2 p-0">
            {requests.map((record) => {
              const selected = record.id === request?.id;
              const previous = record.sourceRevision !== project.sourceRevision;
              return (
                <li key={record.id}>
                  <button type="button" disabled={locked} onClick={() => props.onOpen(record)} aria-current={selected ? "true" : undefined}
                    className={`chip group grid w-full gap-2 rounded-xl border p-3 text-left sm:grid-cols-[1fr_auto] sm:items-center disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-emerald-300/40 bg-emerald-300/[0.06]" : "border-white/10 hover:border-white/20 hover:bg-white/5"}`}>
                    <span className="line-clamp-2 min-w-0 text-sm break-words text-slate-200">{record.clientMessage}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span className={`rounded-full border px-2 py-0.5 capitalize ${statusStyle[record.status]}`}>{record.status}</span>
                      <span className="tabular">source {record.sourceRevision}</span>
                      {previous && <span className="rounded-full border border-amber-300/25 px-2 py-0.5 text-amber-200">previous snapshot</span>}
                      {record.impact && <span className="tabular rounded-full border border-white/10 px-2 py-0.5">proposed {formatUsd(record.impact.proposedFeeCents)}</span>}
                      <span className="tabular text-slate-500">{formatDate(record.createdAt.slice(0, 10))}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {request && <button type="button" className={quietButton} disabled={locked} onClick={props.onNewRequest}><span aria-hidden="true">+</span>Analyze another request</button>}
        </section>
      )}
    </SectionCard>
  );
}
