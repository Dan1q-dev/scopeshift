"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getSessionInfo } from "@/lib/client/api";
import { realProjectApi, RealProjectApiError } from "@/lib/client/real-project-api";
import { errorGuidance, refreshAfterCodes, stepStates, type StepKey } from "@/lib/client/real-project-ui";
import type { ChangeOrder, DraftStyle, NegotiationDraft, RealClientRequest, RealProject, RealProjectSummary } from "@/types/real-project";
import { AnalysisReview } from "./AnalysisReview";
import { ImpactForm } from "./ImpactForm";
import { ProjectForm } from "./ProjectForm";
import { ProjectOverview } from "./ProjectOverview";
import { ProjectSidebar } from "./ProjectSidebar";
import { RequestStep } from "./RequestStep";
import { ResponseStudio } from "./ResponseStudio";
import { cardClass, secondaryClass, Spinner, StepRail } from "./ui";

type Failure = { message: string; code: string | null; guidance: string | null };

const flow = [
  { title: "Paste agreement", text: "Save the scope you agreed, as plain text." },
  { title: "Analyze request", text: "AI matches each ask to quotes from your agreement." },
  { title: "Review", text: "You confirm or correct every classification." },
  { title: "Price", text: "Your hours and rates, server-checked arithmetic." },
  { title: "Respond", text: "Edit a draft reply and a proposed change order." },
];

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
  const [reviewDirty, setReviewDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>("Loading private session");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestOperation = useRef<{ projectId: string; revision: number; text: string; id: string } | null>(null);
  const draftOperations = useRef(new Map<string, string>());
  const projectRef = useRef<RealProject | null>(null);
  const requestRef = useRef<RealClientRequest | null>(null);
  useEffect(() => { projectRef.current = project; requestRef.current = request; }, [project, request]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const session = await getSessionInfo();
        const ready = session.mode === "openai" && session.historyStorage === "postgres";
        if (!active) return;
        setAvailable(ready);
        if (!ready) return;
        const list = await realProjectApi.list();
        if (active) setProjects(list);
      } catch (cause) {
        if (active) setError({ message: cause instanceof Error ? cause.message : "Your private history could not be loaded.", code: null, guidance: null });
      } finally {
        if (active) setBusy(null);
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  /** Moves the user to a step after the flow advances. Focus follows for keyboard and screen reader users. */
  function jumpTo(step: StepKey) {
    window.setTimeout(() => {
      const section = document.getElementById(`step-${step}`);
      if (!section) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      document.getElementById(`step-${step}-title`)?.focus({ preventScroll: true });
    }, 60);
  }

  async function refreshSaved() {
    const current = projectRef.current;
    if (!current) return;
    const [record, history] = await Promise.all([realProjectApi.get(current.id), realProjectApi.requests(current.id)]);
    setProject(record);
    setRequests(history);
    const selected = requestRef.current && history.find((item) => item.id === requestRef.current!.id);
    if (selected) { setRequest(selected); setReviewDirty(false); setDrafts(await realProjectApi.drafts(current.id, selected.id)); }
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(null); setNotice(null);
    try {
      await action();
    } catch (cause) {
      if (cause instanceof ZodError) setError({ message: cause.issues[0]?.message ?? "Check the form values.", code: null, guidance: null });
      else if (cause instanceof RealProjectApiError) {
        setError({ message: `${cause.message} (${cause.code})`, code: cause.code, guidance: errorGuidance(cause.code) });
        if (refreshAfterCodes.has(cause.code)) { try { await refreshSaved(); } catch { /* the error above already explains the state */ } }
      } else setError({ message: cause instanceof Error ? cause.message : "The action could not be completed. Please try again.", code: null, guidance: null });
    } finally {
      setBusy(null);
    }
  }

  function selectRequest(record: RealClientRequest) {
    setRequest(record); setChangeOrder(null); setDraftConsent(false); setDrafts([]);
    setReviewDirty(false);
    setRequests((previous) => [record, ...previous.filter((item) => item.id !== record.id)]);
  }
  async function openProject(id: string) {
    const [record, history] = await Promise.all([realProjectApi.get(id), realProjectApi.requests(id)]);
    setProject(record); setRequests(history); setRequest(null); setDrafts([]); setChangeOrder(null);
    setEditing(false); setClientMessage(""); setAnalysisConsent(false);
  }
  function newProject() {
    setProject(null); setRequests([]); setRequest(null); setDrafts([]); setChangeOrder(null);
    setEditing(false); setClientMessage(""); setAnalysisConsent(false); setError(null); setNotice(null);
  }
  function newRequest() {
    setRequest(null); setDrafts([]); setChangeOrder(null); setReviewDirty(false);
    setClientMessage(""); setAnalysisConsent(false); requestOperation.current = null;
    jumpTo("request");
  }

  const stale = Boolean(project && request && project.sourceRevision !== request.sourceRevision);
  const locked = Boolean(busy) || !available;
  const proposalLocked = locked || stale || reviewDirty;
  const steps = stepStates({ request, draftCount: drafts.filter((draft) => draft.impactHash === request?.impactHash).length, stale, reviewDirty });
  const busyIs = (prefix: string) => Boolean(busy?.startsWith(prefix));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Real Project Mode - Learn it. Apply it. Improve it.</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Handle scope changes with confidence.</h1>
            <p className="m-0 mt-3 text-base leading-7 text-slate-400">Check a client request against your actual agreement, review the evidence, and prepare a clear proposal. You stay in control of scope, estimates, and what you send.</p>
          </div>
        </div>

        <div aria-live="polite" className="space-y-3">
          {busy && <p role="status" className="rise m-0 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-sm text-emerald-200"><Spinner />{busy}...</p>}
          {notice && <p role="status" className="rise m-0 rounded-xl border border-sky-300/20 bg-sky-300/[0.05] p-4 text-sm leading-6 text-sky-100">{notice}</p>}
        </div>
        {error && (
          <div role="alert" className="rise space-y-2 rounded-xl border border-rose-300/25 bg-rose-300/[0.05] p-4 text-sm text-rose-100">
            <p className="m-0 font-medium">{error.message}</p>
            <p className="m-0 text-xs leading-5 text-slate-300">{error.guidance ?? "Retry the same action to recover a lost response. Analysis and draft retries reuse the same operation ID."}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryClass} disabled={Boolean(busy)} onClick={() => void run("Refreshing private history", async () => { const session = await getSessionInfo(); setAvailable(session.mode === "openai" && session.historyStorage === "postgres"); setProjects(await realProjectApi.list()); await refreshSaved(); })}>Refresh private history</button>
              <button type="button" className="text-xs text-slate-400 underline-offset-2 hover:underline" onClick={() => setError(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {available === false ? (
          <section className={`${cardClass} p-6 sm:p-8`} aria-labelledby="unavailable-title">
            <h2 id="unavailable-title" className="m-0 text-xl font-semibold">Real Project Mode is not available on this server</h2>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-slate-400">Real Project Mode needs the server&apos;s OpenAI and persistent history configuration. Nothing is shown here instead of a real analysis. Practice Mode is still available.</p>
            <Link href="/simulation" className={`${secondaryClass} mt-5`}>Open Practice Mode</Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <ProjectSidebar projects={projects} activeId={project?.id ?? null} loading={available === null} disabled={Boolean(busy)}
              onOpen={(id) => void run("Opening project", () => openProject(id))} onNew={newProject} />

            <div className="min-w-0 space-y-6">
              {!project && !editing && (
                <ol className="stagger m-0 grid list-none gap-2 p-0 sm:grid-cols-5" aria-label="How Real Project Mode works">
                  {flow.map((item, index) => (
                    <li key={item.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <span className="tabular text-xs font-semibold text-emerald-300">0{index + 1}</span>
                      <p className="m-0 mt-1 text-sm font-medium">{item.title}</p>
                      <p className="m-0 mt-0.5 text-xs leading-5 text-slate-500">{item.text}</p>
                    </li>
                  ))}
                </ol>
              )}

              {(!project || editing) && (
                <ProjectForm key={`${project?.id ?? "new"}-${project?.sourceRevision ?? 0}`} project={project} disabled={locked} busy={busyIs("Saving")}
                  onCancel={project ? () => setEditing(false) : undefined}
                  onSave={(input) => void run(project ? "Saving source revision" : "Saving project", async () => {
                    const saved = project ? await realProjectApi.update(project.id, { ...input, expectedSourceRevision: project.sourceRevision }) : await realProjectApi.create(input);
                    setProject(saved); setEditing(false); setProjects(await realProjectApi.list());
                    setNotice(project ? "New source revision saved. Older analyses remain read-only snapshots; analyze the request again against the new text." : "Project saved. Paste a client request to start the analysis.");
                    jumpTo("request");
                  })} />
              )}

              {project && !editing && (
                <>
                  <ProjectOverview key={project.id} project={project} locked={locked} busy={Boolean(busy)} onEdit={() => setEditing(true)}
                    onDelete={() => void run("Deleting project and history", async () => {
                      await realProjectApi.delete(project.id); newProject(); setProjects(await realProjectApi.list());
                      setNotice("Project and associated application history deleted.");
                    })} />

                  <StepRail states={steps} onJump={jumpTo} />

                  <RequestStep project={project} state={steps.request} request={request} requests={requests} stale={stale} locked={locked} analyzing={busyIs("Analyzing")}
                    message={clientMessage} consent={analysisConsent}
                    onMessage={(value) => { setClientMessage(value); setAnalysisConsent(false); }}
                    onConsent={setAnalysisConsent}
                    onNewRequest={newRequest}
                    onAnalyze={() => void run("Analyzing request against source text", async () => {
                      let operation = requestOperation.current;
                      if (!operation || operation.projectId !== project.id || operation.revision !== project.sourceRevision || operation.text !== clientMessage) {
                        operation = { projectId: project.id, revision: project.sourceRevision, text: clientMessage, id: crypto.randomUUID() };
                        requestOperation.current = operation;
                      }
                      const record = await realProjectApi.analyze(project.id, { requestId: operation.id, clientMessage, aiConsent: true });
                      selectRequest(record); setDrafts(await realProjectApi.drafts(project.id, record.id));
                      if (record.status === "failed") setError({ message: record.error?.message ?? "The analysis failed. Start a new analysis explicitly to try again.", code: record.error?.code ?? null, guidance: record.error ? errorGuidance(record.error.code) : null });
                      else if (record.analysis) jumpTo("review");
                    })}
                    onOpen={(record) => void run("Opening saved analysis", async () => {
                      const current = await realProjectApi.request(project.id, record.id);
                      selectRequest(current); setDrafts(await realProjectApi.drafts(project.id, record.id));
                    })}
                    onRefreshStatus={() => request && void run("Refreshing stored analysis", async () => selectRequest(await realProjectApi.request(request.projectId, request.id)))}
                    onPrepareReanalysis={() => {
                      if (!request) return;
                      const text = request.clientMessage;
                      setRequest(null); setDrafts([]); setChangeOrder(null); setReviewDirty(false);
                      setClientMessage(text); setAnalysisConsent(false); requestOperation.current = null;
                      setNotice("Review the text and authorize a new analysis. This creates a separate operation and may make another paid OpenAI request, even if the earlier operation later completes.");
                      jumpTo("request");
                    }} />

                  {request?.analysis && (
                    <AnalysisReview key={`${request.id}-${request.review?.revision ?? 0}`} request={request} state={steps.review} disabled={locked || stale} saving={busyIs("Saving your scope review")}
                      onDirty={() => setReviewDirty(true)}
                      onConfirm={(input) => void run("Saving your scope review", async () => {
                        const saved = await realProjectApi.review(request.projectId, request.id, input);
                        selectRequest(saved); setDrafts(await realProjectApi.drafts(request.projectId, request.id));
                        setNotice("Your interpretation is recorded. Enter your own hours and pricing to calculate proposed terms.");
                        jumpTo("price");
                      })} />
                  )}
                  {reviewDirty && request?.review && <p role="status" className="m-0 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] p-4 text-sm text-amber-200">Your scope review has unsaved changes. Confirm and save it before calculating or generating a new proposal.</p>}

                  {request?.review && (
                    <ImpactForm key={`${request.id}-${request.review.revision}-${request.impactHash ?? "new"}`} request={request} state={steps.price} disabled={proposalLocked} calculating={busyIs("Calculating")}
                      onCalculate={(input) => void run("Calculating proposed terms", async () => {
                        const result = await realProjectApi.impact(request.projectId, request.id, input);
                        selectRequest(result.request); setChangeOrder(result.changeOrder);
                        setDrafts(await realProjectApi.drafts(request.projectId, request.id)); setDraftConsent(false);
                        jumpTo("respond");
                      })} />
                  )}

                  {request?.impact && (
                    <ResponseStudio request={request} state={steps.respond} locked={locked} proposalLocked={proposalLocked} generating={busyIs("Generating")}
                      drafts={drafts} changeOrder={changeOrder} style={style} consent={draftConsent}
                      onStyle={(value) => { setStyle(value); setDraftConsent(false); }}
                      onConsent={setDraftConsent}
                      onGenerate={() => void run("Generating your editable response", async () => {
                        const key = `${request.id}:${request.review!.revision}:${request.impactHash}:${style}`;
                        let id = draftOperations.current.get(key);
                        if (!id) { id = crypto.randomUUID(); draftOperations.current.set(key, id); }
                        const draft = await realProjectApi.draft(request.projectId, request.id, { draftId: id, style, reviewRevision: request.review!.revision, impactHash: request.impactHash!, aiConsent: true });
                        setDrafts((previous) => [draft, ...previous.filter((item) => item.id !== draft.id)]);
                      })}
                      onRefreshDrafts={() => void run("Refreshing saved drafts", async () => setDrafts(await realProjectApi.drafts(request.projectId, request.id)))}
                      onPrepareNewDraft={() => {
                        draftOperations.current.delete(`${request.id}:${request.review!.revision}:${request.impactHash}:${style}`);
                        setDraftConsent(false);
                        setNotice("A separate draft is prepared. Check saved draft history first, then authorize generation again. This may make another paid OpenAI request, even if an earlier operation later completes.");
                      }}
                      onSaveDraft={(draft, body) => void run("Saving edited response", async () => {
                        const saved = await realProjectApi.editDraft(request.projectId, request.id, draft.id, body, draft.updatedAt);
                        setDrafts((previous) => previous.map((item) => item.id === saved.id ? saved : item));
                      })} />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
