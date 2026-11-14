"use client";

import { useState } from "react";
import { baselineRateCents, formatDate, formatRate, formatUsd } from "@/lib/client/real-project-ui";
import type { RealProject } from "@/types/real-project";
import { cardClass, Metric, secondaryClass } from "./ui";

export function ProjectOverview({ project, locked, busy, onEdit, onDelete }: {
  project: RealProject;
  locked: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  return (
    <section className={`${cardClass} section-enter overflow-hidden`} aria-label="Current project agreement">
      <div className="hero-backdrop flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <p className="m-0 text-xs uppercase tracking-widest text-slate-500">Agreement snapshot / revision {project.sourceRevision}</p>
          <h2 className="m-0 mt-1 break-words text-2xl font-semibold tracking-tight">{project.name}</h2>
          <p className="m-0 mt-1 text-xs text-slate-500">Saved {formatDate(project.updatedAt.slice(0, 10))}. Your baseline; analyses never change it.</p>
        </div>
        <button type="button" className={secondaryClass} disabled={locked} onClick={onEdit}>Review / redact sources</button>
      </div>
      <dl className="stagger m-0 grid grid-cols-2 gap-2 px-5 pt-4 sm:grid-cols-4 sm:px-6">
        <Metric label="Agreed fee" value={formatUsd(project.originalFeeCents)} />
        <Metric label="Estimated effort" value={`${project.originalEstimatedHours} hours`} />
        <Metric label="Agreed delivery" value={formatDate(project.originalDeadline)} />
        <Metric label="Revenue per hour" value={formatRate(baselineRateCents(project.originalFeeCents, project.originalEstimatedHours))} hint="Before expenses and tax" />
      </dl>
      <div className="space-y-2 px-5 pt-4 sm:px-6">
        {project.documents.map((document) => (
          <details key={document.id} className="source-doc rounded-xl border border-white/10 bg-black/15 text-sm">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-slate-300">
              <span>{document.label}</span>
              <span className="tabular text-xs text-slate-500">{document.canonicalText.length.toLocaleString()} characters</span>
            </summary>
            <pre className="m-0 max-h-80 overflow-auto border-t border-white/10 px-3.5 py-3 font-sans text-sm leading-6 whitespace-pre-wrap break-words text-slate-400">{document.canonicalText}</pre>
          </details>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 px-5 py-3 sm:px-6">
        {deleteArmed ? (
          <div className="rise space-y-3" role="group" aria-label="Confirm project deletion">
            <p className="m-0 text-sm text-rose-200">Delete this project, its sources, analyses, reviews, impacts, and drafts from our application? This cannot be undone.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="chip rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-100 disabled:opacity-40" disabled={locked} onClick={onDelete}>Confirm delete project</button>
              <button type="button" className={secondaryClass} disabled={busy} onClick={() => setDeleteArmed(false)}>Keep project</button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-xs text-rose-200/80 transition hover:text-rose-100 disabled:opacity-40" disabled={locked} onClick={() => setDeleteArmed(true)}>Delete project and history</button>
        )}
      </div>
    </section>
  );
}
