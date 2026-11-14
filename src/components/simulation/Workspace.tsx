"use client";

import Link from "next/link";
import { useState } from "react";
import { ChatPanel } from "@/components/simulation/ChatPanel";
import { ContractPanel } from "@/components/simulation/ContractPanel";
import { ImpactPanel } from "@/components/simulation/ImpactPanel";
import { ghostButton, navLink, primaryButton, SiteHeader } from "@/components/ui/SiteHeader";
import { agreementsOf, initialProject } from "@/lib/client/derive";
import { useSimulation } from "@/lib/client/use-simulation";
import type { InterpreterMode } from "@/lib/client/api";

export function InterpreterNote({ mode }: { mode: InterpreterMode }) {
  return (
    <p role="note" className="m-0 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-center text-xs text-slate-400">
      {mode === "openai"
        ? "OpenAI interprets your messages and voices client replies. The simulation engine verifies and determines all contract outcomes."
        : "The rules-v2 interpreter reads your proposals. The simulation engine determines client replies and outcomes. State exact terms - price, days, and scope."}
    </p>
  );
}

export function Workspace() {
  const sim = useSimulation();
  const { scenario, session, active } = sim;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (sim.loadError) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">The scenario could not be loaded</h1>
        <p role="alert" className="text-sm text-slate-400">{sim.loadError}</p>
        <button type="button" onClick={sim.reload} className={primaryButton}>Try again</button>
      </main>
    );
  }
  if (!scenario || !session || !active || !sim.interpreterMode) return <main className="px-6 py-24 text-center text-sm text-slate-400" role="status">Loading project...</main>;

  const response = active.response;
  const project = response?.project ?? initialProject(scenario);
  const error = sim.failed && sim.failed.attemptId === active.id ? sim.failed.error : null;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <SiteHeader>
        <button type="button" onClick={sim.startOver} disabled={sim.sending} className={ghostButton}>New attempt</button>
        {sim.sending
          ? <button type="button" disabled aria-busy="true" aria-label="Results unavailable while the client is replying" className={`${navLink} cursor-wait opacity-40`}>Results</button>
          : <Link href="/results" className={response?.completed ? primaryButton : navLink}>Results</Link>}
      </SiteHeader>
      <InterpreterNote mode={sim.interpreterMode} />
      {sim.historyWarning && <p role="alert" className="m-0 border-b border-amber-300/20 bg-amber-300/5 px-4 py-2 text-center text-xs text-amber-200">{sim.historyWarning}</p>}
      <h1 className="sr-only">Simulation workspace</h1>
      {(session.attempts.length > 1 || active.history.length > 0) && (
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" role="tablist" aria-label="Attempts">
            <span className="shrink-0 text-slate-500">Attempts:</span>
            {session.attempts.map((attempt, index) => (
              <button key={attempt.id} type="button" role="tab" aria-selected={attempt.id === active.id} disabled={sim.sending} onClick={() => { setConfirmDeleteId(null); sim.selectAttempt(attempt.id); }}
                className={`chip shrink-0 cursor-pointer rounded-full border px-3 py-1 disabled:cursor-not-allowed ${attempt.id === active.id ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-transparent text-slate-400 hover:text-white"}`}>
                Attempt {index + 1}
              </button>
            ))}
          </div>
          {confirmDeleteId === active.id ? (
            <span className="rise flex shrink-0 items-center gap-2">
              <span className="hidden text-slate-400 sm:inline">Delete this attempt?</span>
              <button type="button" disabled={sim.sending} onClick={() => { setConfirmDeleteId(null); sim.deleteAttempt(active.id); }} className="chip cursor-pointer rounded-full border border-rose-400/50 bg-rose-400/10 px-3 py-1 text-rose-100 disabled:cursor-not-allowed">Delete</button>
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="chip cursor-pointer rounded-full border border-white/15 bg-transparent px-3 py-1 text-slate-300">Cancel</button>
            </span>
          ) : (
            <button type="button" disabled={sim.sending} onClick={() => setConfirmDeleteId(active.id)} className="chip shrink-0 cursor-pointer rounded-full border border-white/10 bg-transparent px-3 py-1 text-slate-400 hover:border-rose-400/40 hover:text-rose-200 disabled:cursor-not-allowed">Delete attempt</button>
          )}
        </div>
      )}
      {sim.coaching && <aside aria-label="Rewrite practice" role="note" className="space-y-1 border-b border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm sm:px-6">
        <p className="m-0 font-semibold text-emerald-200">Improve this reply</p>
        <p className="m-0 text-slate-300">{sim.coaching.challenge}</p>
        <p className="m-0 text-xs text-slate-400">Your original reply is in the editor. Your rewritten reply is not sent until you press Send. Your original attempt is preserved.</p>
      </aside>}
      <main key={active.id} className="stagger grid flex-1 gap-4 p-4 sm:p-6 lg:min-h-0 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(280px,340px)]">
        <div className="lg:overflow-y-auto"><ContractPanel scenario={scenario} project={project} /></div>
        <ChatPanel scenario={scenario} turns={response?.turns ?? []} currentEventId={sim.currentEventId} completed={response?.completed ?? false} initialDraft={sim.coaching?.originalReply}
          sending={sim.sending} pendingMessage={sim.pendingMessage} error={error} onSend={sim.send} onRetry={sim.retry} onReplay={sim.replayFrom} />
        <div className="lg:overflow-y-auto"><ImpactPanel scenario={scenario} project={project} agreements={agreementsOf(response)} /></div>
      </main>
    </div>
  );
}
