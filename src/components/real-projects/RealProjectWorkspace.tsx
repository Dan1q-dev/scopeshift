"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ZodError } from "zod";
import { getSessionInfo } from "@/lib/client/api";
import { realProjectApi, RealProjectApiError } from "@/lib/client/real-project-api";
import {
  REAL_PROJECT_LIMITS, draftStyleSchema, type ChangeOrder, type DraftStyle,
  type NegotiationDraft, type RealClientRequest, type RealProject,
  type RealProjectCreateInput, type RealProjectSummary,
} from "@/types/real-project";
import { AnalysisReview } from "./AnalysisReview";
import { ImpactForm } from "./ImpactForm";

const fieldClass = "mt-1 w-full rounded-lg border border-white/15 bg-[#0c1216] px-3 py-2.5 text-sm placeholder:text-slate-600";
const primaryClass = "rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-40";
const secondaryClass = "rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-40";
const panelClass = "space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function ProjectForm({ project, disabled, onSave, onCancel }: {
  project: RealProject | null;
  disabled: boolean;
  onSave: (input: RealProjectCreateInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [fee, setFee] = useState(project ? String(project.originalFeeCents / 100) : "");
  const [hours, setHours] = useState(project ? String(project.originalEstimatedHours) : "");
  const [deadline, setDeadline] = useState(project?.originalDeadline ?? "");
  const [agreement, setAgreement] = useState(project?.documents.find((document) => document.kind === "agreement")?.canonicalText ?? "");
  const [amendments, setAmendments] = useState(project?.documents.find((document) => document.kind === "amendment")?.canonicalText ?? "");
  const [saveConsent, setSaveConsent] = useState(false);
  function sample() {
    const delivery = new Date(); delivery.setUTCDate(delivery.getUTCDate() + 14);
    setName("Fictional studio website"); setFee("1500"); setHours("20"); setDeadline(delivery.toISOString().slice(0, 10));
    setAgreement("Develop a responsive five-page business website with a contact form. The form includes name, email, message, and an email notification. Appointment scheduling, payment processing, and calendar integration are excluded. Agreed fee: $1,500. Estimated effort: 20 hours.");
    setAmendments("Approved amendment: replace the portfolio gallery with a testimonials page at the same price and delivery date.");
    setSaveConsent(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ name, originalFeeCents: Math.round(Number(fee) * 100), originalEstimatedHours: Number(hours), originalDeadline: deadline, agreementText: agreement, amendmentsText: amendments });
  }
  return <section className={panelClass} aria-labelledby="project-form-title">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">1. Establish your baseline</p><h2 id="project-form-title" className="mt-2 text-xl font-semibold">{project ? "Edit the agreement snapshot" : "Bring a real project"}</h2></div>
    <p className="text-sm leading-6 text-slate-400">Paste the agreed scope and any approved amendments. Remove client names, contact details, credentials, and confidential information before saving. PDF, DOCX, and image uploads are not available in this version.</p>
    {!project && <div className="flex flex-wrap items-center gap-3"><button type="button" className={secondaryClass} disabled={disabled} onClick={sample}>Use fictional sample</button><p className="text-xs text-slate-500">Fills editable fields only. Nothing is saved or sent to AI.</p></div>}
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm">Project name<input className={fieldClass} maxLength={160} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Use a non-confidential project name" /></label>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Agreed fee (USD)<input className={fieldClass} type="number" min="0" max="1000000" step="0.01" required value={fee} onChange={(event) => setFee(event.target.value)} /></label><label className="text-sm">Original estimated hours<input className={fieldClass} type="number" min="0.01" max="10000" step="0.01" required value={hours} onChange={(event) => setHours(event.target.value)} /></label><label className="text-sm">Agreed delivery date<input className={fieldClass} type="date" required value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div>
      <label className="block text-sm">Agreement / statement of work<textarea className={`${fieldClass} min-h-40`} required maxLength={REAL_PROJECT_LIMITS.agreementCharacters} value={agreement} onChange={(event) => setAgreement(event.target.value)} placeholder="Paste the source text, then redact anything sensitive." /><span className="mt-1 block text-xs text-slate-500">{agreement.length.toLocaleString()} / {REAL_PROJECT_LIMITS.agreementCharacters.toLocaleString()} characters</span></label>
      <label className="block text-sm">Approved amendments (optional)<textarea className={`${fieldClass} min-h-24`} maxLength={REAL_PROJECT_LIMITS.amendmentsCharacters} value={amendments} onChange={(event) => setAmendments(event.target.value)} placeholder="Include only changes already agreed with the client." /></label>
      <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4 text-sm leading-6 text-slate-300"><p>Saving stores this text and your project history on our server, linked to this browser&apos;s anonymous session. Clearing the browser cookie can remove your access; it does not delete server data. Editing or redacting a source creates a new revision and retains earlier snapshots in history. Use Delete project to remove this project and all its associated history from our application.</p><p className="mt-2">Analysis and draft generation send the relevant pasted text to OpenAI only when you explicitly authorize those actions. Review and redact your sources first.</p></div>
      <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-emerald-400" checked={saveConsent} onChange={(event) => setSaveConsent(event.target.checked)} /><span>I have reviewed this text and agree to save it and the project history on the server for this browser session.</span></label>
      <div className="flex flex-wrap gap-3"><button type="submit" className={primaryClass} disabled={!saveConsent}>{project ? "Save new source revision" : "Save project"}</button>{onCancel && <button type="button" className={secondaryClass} onClick={onCancel}>Cancel</button>}</div>
    </fieldset></form>
  </section>;
}

function DraftEditor({ draft, disabled, onSave, onCopy }: { draft: NegotiationDraft; disabled: boolean; onSave: (body: string) => void; onCopy: (body: string) => void }) {
  const [body, setBody] = useState(draft.body);
  return <article className="space-y-3 rounded-xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium capitalize">{draft.style} response</h3><span className="text-xs text-amber-200">Draft proposal</span></div><label className="block text-sm">Editable response<textarea className={`${fieldClass} min-h-48`} maxLength={12000} value={body} disabled={disabled} onChange={(event) => setBody(event.target.value)} /></label><div className="flex flex-wrap gap-2"><button className={secondaryClass} disabled={disabled || !body.trim() || body === draft.body} onClick={() => onSave(body)}>Save edited draft</button><button className={secondaryClass} disabled={!body.trim()} onClick={() => onCopy(body)}>Copy response</button></div>{body !== draft.body && <p className="text-xs text-amber-200">Your edits are not saved yet.</p>}<details className="text-xs text-slate-500"><summary className="cursor-pointer">Original generated response</summary><p className="mt-2 whitespace-pre-wrap">{draft.generatedBody}</p></details></article>;
}

export function RealProjectWorkspace() {
  const [projects, setProjects] = useState<RealProjectSummary[]>([]);
  const [project, setProject] = useState<RealProject | null>(null);
  const [requests, setRequests] = useState<RealClientRequest[]>([]);
  const [request, setRequest] = useState<RealClientRequest | null>(null);
  const [drafts, setDrafts] = useState<NegotiationDraft[]>([]);
  const [changeOrder, setChangeOrder] = useState<ChangeOrder | null>(null);
  const [clientMessage, setClientMessage] = useState("");
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [draftConsent, setDraftConsent] = useState(false);
  const [style, setStyle] = useState<DraftStyle>("professional");
  const [editing, setEditing] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>("Loading private session");
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestOperation = useRef<{ projectId: string; revision: number; text: string; id: string } | null>(null);
  const draftOperations = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const session = await getSessionInfo();
        const ready = session.mode === "openai" && session.historyStorage === "postgres";
        if (!active) return;
        setAvailable(ready);
        if (!ready) { setNotice("Real Project Mode needs the server's OpenAI and persistent history configuration. Practice Mode is still available."); return; }
        const list = await realProjectApi.list();
        if (active) setProjects(list);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Your private history could not be loaded."); }
      finally { if (active) setBusy(null); }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(null); setNotice(null);
    try { await action(); }
    catch (cause) {
      if (cause instanceof ZodError) setError(cause.issues[0]?.message ?? "Check the form values.");
      else if (cause instanceof RealProjectApiError) setError(`${cause.message} (${cause.code})`);
      else setError(cause instanceof Error ? cause.message : "The action could not be completed. Please try again.");
    } finally { setBusy(null); }
  }
  function selectRequest(record: RealClientRequest) {
    setRequest(record); setChangeOrder(null); setDraftConsent(false); setDrafts([]);
    setReviewDirty(false);
    setRequests((previous) => [record, ...previous.filter((item) => item.id !== record.id)]);
  }
  async function openProject(id: string) {
    const [record, history] = await Promise.all([realProjectApi.get(id), realProjectApi.requests(id)]);
    setProject(record); setRequests(history); setRequest(null); setDrafts([]); setChangeOrder(null);
    setEditing(false); setDeleteArmed(false); setClientMessage(""); setAnalysisConsent(false);
  }
  function newProject() {
    setProject(null); setRequests([]); setRequest(null); setDrafts([]); setChangeOrder(null);
    setEditing(false); setDeleteArmed(false); setClientMessage(""); setAnalysisConsent(false); setError(null); setNotice(null);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Copied. Review the proposal before sharing it with your client."); }
    catch { setError("Clipboard access failed. Select the text and copy it manually."); }
  }
  const stale = Boolean(project && request && project.sourceRevision !== request.sourceRevision);
  const locked = Boolean(busy) || !available;
  const proposalLocked = locked || stale || reviewDirty;

  return <main className="min-h-screen bg-[#0c1216] text-slate-100">
    <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><Link href="/" className="text-xl font-bold tracking-tight">Scope<span className="text-emerald-300">Shift</span></Link><nav aria-label="Mode navigation" className="flex flex-wrap items-center gap-4 text-sm"><span className="rounded-full border border-emerald-300/25 bg-emerald-300/5 px-3 py-1 text-emerald-200">Real Project Mode</span><Link className="text-slate-300 hover:text-white" href="/simulation">Practice Mode</Link><Link className="text-slate-400 hover:text-white" href="/">Home</Link></nav></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="max-w-3xl space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Learn it. Apply it. Improve it.</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Handle scope changes with confidence.</h1><p className="text-base leading-7 text-slate-400">Check a client request against your actual agreement, review the evidence, and prepare a clear proposal. You stay in control of scope, estimates, and what you send.</p></div>
      {busy && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-200">{busy}...</p>}
      {error && <div role="alert" className="space-y-2 rounded-lg border border-rose-300/25 bg-rose-300/5 p-4 text-sm text-rose-200"><p>{error}</p><p className="text-xs text-slate-400">Retry the same action to recover a lost response. Analysis and draft retries reuse the same operation ID.</p><button className={secondaryClass} disabled={Boolean(busy)} onClick={() => void run("Refreshing private history", async () => { const session = await getSessionInfo(); setAvailable(session.mode === "openai" && session.historyStorage === "postgres"); setProjects(await realProjectApi.list()); })}>Refresh private history</button></div>}
      {notice && <p role="status" className="rounded-lg border border-sky-300/20 bg-sky-300/5 p-4 text-sm leading-6 text-sky-100">{notice}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Private project history" className="space-y-4 rounded-2xl border border-white/10 p-4 lg:sticky lg:top-6"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Your projects</h2><button className="text-sm text-emerald-200 disabled:opacity-40" disabled={Boolean(busy)} onClick={newProject}>New project</button></div><p className="text-xs leading-5 text-slate-500">History is linked to this browser&apos;s anonymous cookie. No login or cross-device recovery is provided.</p>{projects.length === 0 && <p className="py-3 text-sm text-slate-500">No saved projects yet.</p>}<ul className="space-y-2">{projects.map((item) => <li key={item.id}><button className={`w-full rounded-lg border p-3 text-left transition disabled:opacity-40 ${project?.id === item.id ? "border-emerald-300/35 bg-emerald-300/5" : "border-white/10 hover:bg-white/5"}`} disabled={Boolean(busy)} onClick={() => void run("Opening project", () => openProject(item.id))}><span className="block break-words text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs text-slate-500">{money(item.originalFeeCents)} / {item.originalEstimatedHours}h / rev {item.sourceRevision}</span></button></li>)}</ul><Link className="block rounded-lg border border-white/10 p-3 text-sm text-slate-300 hover:bg-white/5" href="/simulation">Practice with a fictional client<span className="mt-1 block text-xs text-slate-500">Your real project data is not transferred.</span></Link></aside>
        <div className="min-w-0 space-y-6">
          {(!project || editing) && <ProjectForm key={`${project?.id ?? "new"}-${project?.sourceRevision ?? 0}`} project={project} disabled={locked} onCancel={project ? () => setEditing(false) : undefined} onSave={(input) => void run(project ? "Saving source revision" : "Saving project", async () => { const saved = project ? await realProjectApi.update(project.id, { ...input, expectedSourceRevision: project.sourceRevision }) : await realProjectApi.create(input); setProject(saved); setEditing(false); setProjects(await realProjectApi.list()); setNotice(project ? "New source revision saved. Older analyses remain read-only snapshots; analyze the request again against the new text." : "Project saved. Paste a client request to start the analysis."); })} />}
          {project && !editing && <section className={panelClass} aria-label="Current project agreement"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-slate-500">Agreement snapshot / revision {project.sourceRevision}</p><h2 className="mt-2 break-words text-xl font-semibold">{project.name}</h2></div><button className={secondaryClass} disabled={locked} onClick={() => setEditing(true)}>Review / redact sources</button></div><dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Agreed fee</dt><dd className="mt-1 font-semibold">{money(project.originalFeeCents)}</dd></div><div><dt className="text-slate-500">Estimated effort</dt><dd className="mt-1 font-semibold">{project.originalEstimatedHours} hours</dd></div><div><dt className="text-slate-500">Agreed delivery</dt><dd className="mt-1 font-semibold">{project.originalDeadline}</dd></div></dl>{project.documents.map((document) => <details key={document.id} className="rounded-lg border border-white/10 p-3 text-sm"><summary className="cursor-pointer text-slate-300">{document.label}</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans leading-6 text-slate-400">{document.canonicalText}</pre></details>)}<div className="border-t border-white/10 pt-3">{deleteArmed ? <div className="space-y-3"><p className="text-sm text-rose-200">Delete this project, its sources, analyses, reviews, impacts, and drafts from our application? This cannot be undone.</p><div className="flex gap-3"><button className="rounded-lg border border-rose-300/40 px-3 py-2 text-sm text-rose-200 disabled:opacity-40" disabled={locked} onClick={() => void run("Deleting project and history", async () => { await realProjectApi.delete(project.id); newProject(); setProjects(await realProjectApi.list()); setNotice("Project and associated application history deleted."); })}>Confirm delete project</button><button className={secondaryClass} disabled={Boolean(busy)} onClick={() => setDeleteArmed(false)}>Keep project</button></div></div> : <button className="text-xs text-rose-200/80 disabled:opacity-40" disabled={locked} onClick={() => setDeleteArmed(true)}>Delete project and history</button>}</div></section>}
          {project && !editing && <section className={panelClass} aria-labelledby="client-request-title"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Analyze a change request</p><h2 id="client-request-title" className="mt-2 text-xl font-semibold">What did your client ask for?</h2></div><label className="block text-sm">Client request text<textarea className={`${fieldClass} min-h-32`} maxLength={REAL_PROJECT_LIMITS.clientMessageCharacters} value={clientMessage} disabled={locked} onChange={(event) => { setClientMessage(event.target.value); setAnalysisConsent(false); }} placeholder="Paste and redact the client's message. Each requested change will be checked separately." /></label><p className="text-xs leading-5 text-slate-500">Analysis sends this request and the current agreement/amendments to OpenAI. Saved text remains available in project history. Verify all conclusions before using them.</p><label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-emerald-400" disabled={locked} checked={analysisConsent} onChange={(event) => setAnalysisConsent(event.target.checked)} /><span>I reviewed the text and authorize sending this request and these sources to OpenAI for analysis.</span></label><button className={primaryClass} disabled={locked || !analysisConsent || !clientMessage.trim()} onClick={() => void run("Analyzing request against source text", async () => { let operation = requestOperation.current; if (!operation || operation.projectId !== project.id || operation.revision !== project.sourceRevision || operation.text !== clientMessage) { operation = { projectId: project.id, revision: project.sourceRevision, text: clientMessage, id: crypto.randomUUID() }; requestOperation.current = operation; } const record = await realProjectApi.analyze(project.id, { requestId: operation.id, clientMessage, aiConsent: true }); selectRequest(record); setDrafts(await realProjectApi.drafts(project.id, record.id)); if (record.status === "failed") setError(record.error?.message ?? "The analysis failed. Start a new analysis explicitly to try again."); })}>Analyze request</button><p className="text-xs text-slate-500">An analysis is an interpretation of your text, not legal advice or client acceptance.</p></section>}
          {project && requests.length > 0 && <section aria-label="Request history" className="space-y-3"><h2 className="text-sm font-semibold text-slate-400">Request history</h2><div className="flex flex-wrap gap-2">{requests.map((record) => <button key={record.id} className={`${secondaryClass} max-w-full text-left ${record.id === request?.id ? "border-emerald-300/40 bg-emerald-300/5" : ""}`} disabled={Boolean(busy)} onClick={() => void run("Opening saved analysis", async () => { const current = await realProjectApi.request(project.id, record.id); selectRequest(current); setDrafts(await realProjectApi.drafts(project.id, record.id)); })}><span className="block max-w-72 truncate">{record.clientMessage}</span><span className="mt-1 block text-xs text-slate-500">{record.status} / source {record.sourceRevision}{record.sourceRevision !== project.sourceRevision ? " / previous snapshot" : ""}</span></button>)}</div></section>}
          {request && <section className="space-y-2 rounded-xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Selected client request / source revision {request.sourceRevision}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{request.clientMessage}</p>
            {stale && <p role="status" className="text-sm leading-6 text-amber-200">Read-only historical snapshot. The project sources have changed. Paste this request above and run a new analysis before reviewing, calculating, or drafting.</p>}
            {(request.status === "pending" || request.status === "failed") && <div className="space-y-3">
              <p className="text-sm text-amber-200">{request.status === "pending" ? "Analysis is still pending. Refresh its stored status before starting a separate analysis; this does not start another AI call." : request.error?.message ?? "Analysis could not be completed."}</p>
              <div className="flex flex-wrap gap-2"><button className={secondaryClass} disabled={locked} onClick={() => void run("Refreshing stored analysis", async () => selectRequest(await realProjectApi.request(request.projectId, request.id)))}>Refresh analysis status</button>
                {!stale && <button className={secondaryClass} disabled={locked} onClick={() => {
                  setClientMessage(request.clientMessage); setAnalysisConsent(false); requestOperation.current = null;
                  setNotice("Review the text and authorize a new analysis above. This creates a separate operation and may make another paid OpenAI request, even if the earlier operation later completes.");
                }}>Prepare a new analysis</button>}
              </div>
            </div>}
          </section>}
          {request?.analysis && <AnalysisReview
            key={`${request.id}-${request.review?.revision ?? 0}`} request={request} disabled={locked || stale}
            onDirty={() => setReviewDirty(true)}
            onConfirm={(input) => void run("Saving your scope review", async () => {
              const saved = await realProjectApi.review(request.projectId, request.id, input);
              selectRequest(saved); setDrafts(await realProjectApi.drafts(request.projectId, request.id));
              setNotice("Your interpretation is recorded. Enter your own hours and pricing to calculate proposed terms.");
            })}
          />}
          {reviewDirty && request?.review && <p role="status" className="rounded-lg border border-amber-200/20 p-4 text-sm text-amber-200">Your scope review has unsaved changes. Confirm and save it before calculating or generating a new proposal.</p>}
          {request?.review && <ImpactForm
            key={`${request.id}-${request.review.revision}-${request.impactHash ?? "new"}`} request={request} disabled={proposalLocked}
            onCalculate={(input) => void run("Calculating proposed terms", async () => {
              const result = await realProjectApi.impact(request.projectId, request.id, input);
              selectRequest(result.request); setChangeOrder(result.changeOrder);
              setDrafts(await realProjectApi.drafts(request.projectId, request.id)); setDraftConsent(false);
            })}
          />}
          {request?.impact && <section aria-labelledby="response-draft-title" className={panelClass}>
            <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">4. Respond clearly</p><h2 id="response-draft-title" className="mt-2 text-xl font-semibold">Prepare the conversation</h2></div>
            <p className="text-sm leading-6 text-slate-400">Your reviewed scope and calculated terms guide the English response. Every response stays editable and proposed. Nothing is sent to your client.</p>
            <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Response tone<select className={fieldClass} value={style} disabled={proposalLocked} onChange={(event) => { setStyle(event.target.value as DraftStyle); setDraftConsent(false); }}>{draftStyleSchema.options.map((tone) => <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>)}</select></label></div>
            <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-emerald-400" checked={draftConsent} disabled={proposalLocked} onChange={(event) => setDraftConsent(event.target.checked)} /><span>I authorize sending the source text, request, reviewed scope, and proposed terms to OpenAI to generate this response.</span></label>
            <div className="flex flex-wrap gap-3"><button className={primaryClass} disabled={proposalLocked || !draftConsent} onClick={() => void run("Generating your editable response", async () => {
              const key = `${request.id}:${request.review!.revision}:${request.impactHash}:${style}`;
              let id = draftOperations.current.get(key);
              if (!id) { id = crypto.randomUUID(); draftOperations.current.set(key, id); }
              const draft = await realProjectApi.draft(request.projectId, request.id, { draftId: id, style, reviewRevision: request.review!.revision, impactHash: request.impactHash!, aiConsent: true });
              setDrafts((previous) => [draft, ...previous.filter((item) => item.id !== draft.id)]);
            })}>Generate draft</button><button className={secondaryClass} disabled={locked} onClick={() => void run("Refreshing saved drafts", async () => setDrafts(await realProjectApi.drafts(request.projectId, request.id)))}>Refresh saved drafts</button>
              <button className={secondaryClass} disabled={proposalLocked} onClick={() => {
                draftOperations.current.delete(`${request.id}:${request.review!.revision}:${request.impactHash}:${style}`);
                setDraftConsent(false);
                setNotice("A separate draft is prepared. Check saved draft history first, then authorize generation again. This may make another paid OpenAI request, even if an earlier operation later completes.");
              }}>Prepare a new draft</button>
            </div>
            {drafts.map((draft) => <div key={`${draft.id}-${draft.updatedAt}`}>
              <p className="mb-2 text-xs text-slate-500">Source {draft.sourceRevision} / review {draft.reviewRevision}{draft.impactHash !== request.impactHash || draft.reviewRevision !== request.review?.revision ? " / earlier proposal (read-only)" : ""}</p>
              <DraftEditor draft={draft} disabled={proposalLocked || draft.reviewRevision !== request.review?.revision || draft.impactHash !== request.impactHash}
                onSave={(body) => void run("Saving edited response", async () => {
                  const saved = await realProjectApi.editDraft(request.projectId, request.id, draft.id, body, draft.updatedAt);
                  setDrafts((previous) => previous.map((item) => item.id === saved.id ? saved : item));
                })} onCopy={(body) => void copy(body)} />
            </div>)}
            <div className="space-y-3 border-t border-white/10 pt-4"><h3 className="font-medium">Proposed Change Order</h3>{changeOrder ? <><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 p-4 font-sans text-sm leading-6 text-slate-300">{changeOrder.body}</pre><button className={secondaryClass} onClick={() => void copy(changeOrder.body)}>Copy proposed Change Order</button></> : <p className="text-sm text-slate-500">Calculate the current proposal above to create a source-linked Change Order. This document does not record client acceptance.</p>}</div>
          </section>}
        </div>
      </div>
    </div>
  </main>;
}
