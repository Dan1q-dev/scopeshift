"use client";

import Link from "next/link";
import { useState } from "react";
import { ChangeSummary } from "@/components/ui/ChangeSummary";
import { ghostButton, navLink, panel, primaryButton, SiteHeader } from "@/components/ui/SiteHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { agreementsOf, evidenceParts, initialProject, readableIds } from "@/lib/client/derive";
import { formatDays, formatHours, formatMoney, formatRate } from "@/lib/client/format";
import { useSimulation } from "@/lib/client/use-simulation";
import type { EvaluationCategory } from "@/types/scope";

const categoryLabels: Record<EvaluationCategory, string> = {
  clarification: "Clarifying requirements",
  scope_management: "Scope management",
  economic_decision: "Commercial decision",
  explicit_agreement: "Explicit agreements",
  feasibility: "Realistic planning",
};

export function ResultsView() {
  const sim = useSimulation();
  const [picked, setPicked] = useState<string[] | null>(null);
  const { scenario, session } = sim;

  if (sim.loadError) {
    return <main className="mx-auto max-w-md px-6 py-24 text-center"><h1 className="text-xl font-semibold">Results could not be loaded</h1><p role="alert" className="text-sm text-slate-400">{sim.loadError}</p><button type="button" onClick={sim.reload} className={primaryButton}>Try again</button></main>;
  }
  if (!scenario || !session) return <main className="px-6 py-24 text-center text-sm text-slate-400" role="status">Loading results...</main>;

  const played = session.attempts.map((attempt, index) => ({ attempt, label: `Attempt ${index + 1}` })).filter(({ attempt }) => attempt.response);
  const shownIds = picked ?? played.slice(-2).map(({ attempt }) => attempt.id);
  const shown = played.filter(({ attempt }) => shownIds.includes(attempt.id));
  const start = initialProject(scenario);
  const toggle = (id: string) => setPicked(shownIds.includes(id) ? shownIds.filter((value) => value !== id) : [...shownIds, id].slice(-2));
  const best = shown.length === 2 ? Math.max(...shown.map(({ attempt }) => attempt.response!.project.effectiveHourlyRateCents)) : null;

  return (
    <div className="min-h-screen">
      <SiteHeader><Link href="/simulation" className={navLink}>Back to simulation</Link></SiteHeader>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Results: {scenario.title}</h1>
          <p className="mt-1 mb-0 text-sm text-slate-400">Original contract: {formatMoney(start.totalFeeCents)} for {formatHours(start.estimatedHours)} in {formatDays(start.deadlineDays)} - {formatRate(start.effectiveHourlyRateCents)}.</p>
        </div>

        {played.length === 0 ? (
          <div className={`${panel} p-6 text-center`}>
            <p className="mt-0 text-sm text-slate-400">You have not answered any client request yet. Results appear after your first reply.</p>
            <Link href="/simulation" className={primaryButton}>Start the simulation</Link>
          </div>
        ) : (
          <>
            {played.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Compare up to two attempts:</span>
                {played.map(({ attempt, label }) => (
                  <button key={attempt.id} type="button" aria-pressed={shownIds.includes(attempt.id)} onClick={() => toggle(attempt.id)}
                    className={`cursor-pointer rounded-full border px-3 py-1 ${shownIds.includes(attempt.id) ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-transparent text-slate-400 hover:text-white"}`}>{label}</button>
                ))}
              </div>
            )}
            <div className={`grid gap-4 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}>
              {shown.map(({ attempt, label }) => {
                const response = attempt.response!;
                const project = response.project;
                const agreements = agreementsOf(response);
                const readable = (text: string) => readableIds(text, scenario, response);
                return (
                  <section key={attempt.id} aria-label={label} className={`${panel} p-5 ${best !== null && project.effectiveHourlyRateCents === best && shown[0].attempt.response!.project.effectiveHourlyRateCents !== shown[1].attempt.response!.project.effectiveHourlyRateCents ? "border-emerald-400/40" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="m-0 text-sm font-semibold">{label}</h2>
                      <span className="text-[11px] text-slate-500">{response.completed ? "Completed" : "In progress"}</span>
                    </div>
                    <p className="tabular mt-3 mb-0 text-4xl font-semibold tracking-tight">{formatRate(project.effectiveHourlyRateCents)}</p>
                    <p className="m-0 text-xs text-slate-500">Effective hourly rate</p>
                    <dl className="tabular m-0 mt-4 grid grid-cols-3 gap-2 text-sm">
                      {[["Total fee", formatMoney(project.totalFeeCents)], ["Est. hours", formatHours(project.estimatedHours)], ["Deadline", formatDays(project.deadlineDays)]].map(([name, value]) => (
                        <div key={name} className="rounded-lg bg-black/25 px-2.5 py-2"><dt className="text-[11px] text-slate-500">{name}</dt><dd className="m-0 font-semibold">{value}</dd></div>
                      ))}
                    </dl>

                    <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Decisions</h3>
                    {agreements.length === 0 ? <p className="m-0 text-sm text-slate-500">No proposals were made in this attempt.</p> : (
                      <ol className="m-0 list-none space-y-2 p-0">
                        {agreements.map((agreement) => (
                          <li key={agreement.id} className="rounded-lg border border-white/10 px-3 py-2">
                            <div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-medium">{scenario.events.find((event) => event.id === agreement.eventId)?.title ?? agreement.eventId}</span><StatusChip status={agreement.status} /></div>
                            <ChangeSummary change={agreement.change} scenario={scenario} />
                          </li>
                        ))}
                      </ol>
                    )}

                    <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Skills feedback</h3>
                    {response.evaluation.criteria.length === 0 && response.evaluation.strengths.length === 0 && response.evaluation.improvements.length === 0 ? (
                      <p className="m-0 text-sm text-slate-500">No assessed evidence yet. Unassessed skills are not a zero score.</p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        {response.evaluation.criteria.map((criterion) => (
                          <div key={`${criterion.category}:${criterion.evidence.map((item) => `${item.turnId}:${item.ruleId}`).join("|")}`} className="rounded-lg border border-white/10 px-3 py-2">
                            <div className="flex items-center justify-between gap-2"><span className="font-medium">{categoryLabels[criterion.category]}</span><span className="tabular text-xs text-slate-400">{criterion.earnedPoints} / {criterion.maxPoints}</span></div>
                            <ul className="m-0 mt-2 list-none space-y-2 p-0 text-xs">
                              {criterion.evidence.map((evidence) => {
                                const parts = evidenceParts(evidence.observation, response.turns.find((turn) => turn.turnId === evidence.turnId)?.userMessage);
                                return (
                                  <li key={`${evidence.turnId}-${evidence.ruleId}`} className="border-l-2 border-emerald-400/30 pl-2.5 text-slate-400">
                                    {parts ? (
                                      <dl className="m-0 space-y-1">
                                        <div><dt className="inline font-medium text-slate-300">Your reply: </dt><dd className="m-0 inline">{parts.action}</dd></div>
                                        <div><dt className="inline font-medium text-slate-300">Scenario rule: </dt><dd className="m-0 inline">{readable(parts.rule)}</dd></div>
                                        <div><dt className="inline font-medium text-slate-300">Verified: </dt><dd className="m-0 inline">{readable(parts.verified)}</dd></div>
                                      </dl>
                                    ) : readable(evidence.observation)}
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="mt-2 mb-0 text-xs text-slate-300">{readable(criterion.advice)}</p>
                          </div>
                        ))}
                        {response.evaluation.strengths.length > 0 && <div><p className="m-0 text-xs font-semibold text-emerald-300">Strengths</p><ul className="mt-1 mb-0 pl-4 text-xs text-slate-300">{response.evaluation.strengths.map((text) => <li key={text}>{readable(text)}</li>)}</ul></div>}
                        {response.evaluation.improvements.length > 0 && <div><p className="m-0 text-xs font-semibold text-amber-300">To improve</p><ul className="mt-1 mb-0 pl-4 text-xs text-slate-300">{response.evaluation.improvements.map((text) => <li key={text}>{readable(text)}</li>)}</ul></div>}
                      </div>
                    )}
                    <Link href="/simulation" onClick={() => sim.selectAttempt(attempt.id)} className={`${ghostButton} mt-5`}>Open this attempt</Link>
                  </section>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/simulation" onClick={sim.startOver} className={primaryButton}>Try a different strategy</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
