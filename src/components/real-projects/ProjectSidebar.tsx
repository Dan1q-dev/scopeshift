"use client";

import Link from "next/link";
import { formatUsd } from "@/lib/client/real-project-ui";
import type { RealProjectSummary } from "@/types/real-project";
import { cardClass, quietButton } from "./ui";

export function ProjectSidebar({ projects, activeId, loading, disabled, onOpen, onNew }: {
  projects: RealProjectSummary[];
  activeId: string | null;
  loading: boolean;
  disabled: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside aria-label="Private project history" className={`${cardClass} min-w-0 space-y-4 p-4 lg:sticky lg:top-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold">Your projects</h2>
        <button type="button" className={quietButton} disabled={disabled} onClick={onNew}><span aria-hidden="true">+</span>New project</button>
      </div>
      {loading ? (
        <div className="space-y-2" aria-hidden="true">{[0, 1].map((key) => <div key={key} className="skeleton h-14 rounded-lg" />)}</div>
      ) : projects.length === 0 ? (
        <p className="m-0 py-2 text-sm text-slate-500">No saved projects yet.</p>
      ) : (
        <ul className="stagger -mx-1 m-0 flex list-none gap-2 overflow-x-auto p-1 lg:mx-0 lg:block lg:space-y-2 lg:overflow-visible lg:p-0">
          {projects.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id} className="min-w-[200px] lg:min-w-0">
                <button type="button" aria-current={active ? "true" : undefined} disabled={disabled} onClick={() => onOpen(item.id)}
                  className={`chip w-full rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-emerald-300/40 bg-emerald-300/[0.07]" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"}`}>
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="tabular mt-1 block text-xs text-slate-500">{formatUsd(item.originalFeeCents)} / {item.originalEstimatedHours}h / rev {item.sourceRevision}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="m-0 text-xs leading-5 text-slate-500">History is linked to this browser&apos;s anonymous cookie. No login or cross-device recovery is provided.</p>
      <Link className="chip block rounded-xl border border-white/10 p-3 text-sm text-slate-300 no-underline hover:border-emerald-300/30 hover:bg-white/5" href="/simulation">
        Practice with a fictional client
        <span className="mt-1 block text-xs text-slate-500">Your real project data is not transferred.</span>
      </Link>
    </aside>
  );
}
