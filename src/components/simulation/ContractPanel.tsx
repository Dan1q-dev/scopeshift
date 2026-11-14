import { panel } from "@/components/ui/SiteHeader";
import { scopeDiff } from "@/lib/client/derive";
import { formatDays, formatHours, formatMoney } from "@/lib/client/format";
import type { ProjectState, PublicScenario } from "@/types/scope";

export function ContractPanel({ scenario, project }: { scenario: PublicScenario; project: ProjectState }) {
  const contract = scenario.initialContract;
  return (
    <section aria-labelledby="contract-title" className={`${panel} p-4`}>
      <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-slate-500">Current project</p>
      <h2 id="contract-title" className="mt-1 mb-0 text-base font-semibold">{scenario.title}</h2>
      <p className="mt-1 mb-0 text-sm leading-5 text-slate-400">{scenario.description}</p>

      <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Original contract</h3>
      <dl className="tabular m-0 grid grid-cols-3 gap-2 text-sm">
        {[["Fee", formatMoney(contract.feeCents)], ["Deadline", formatDays(contract.deadlineDays)], ["Est. hours", formatHours(contract.estimatedHours)]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-black/25 px-2.5 py-2">
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className="m-0 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Agreed scope</h3>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {scopeDiff(scenario, project).map(({ item, state }) => (
          <li key={item.id} className={`rounded-lg border px-2.5 py-2 text-sm ${state === "added" ? "border-emerald-400/30 bg-emerald-400/[0.06]" : state === "removed" ? "border-white/5 opacity-50" : "border-white/10"}`}>
            <div className="flex items-start justify-between gap-2">
              <span className={state === "removed" ? "line-through" : "font-medium"}>{item.title}</span>
              <span className="tabular shrink-0 text-xs text-slate-400">{formatHours(item.estimatedHours)}</span>
            </div>
            <p className="mt-0.5 mb-0 text-xs leading-4 text-slate-500">{item.description}</p>
            {state !== "original" && <p className={`mt-1 mb-0 text-[11px] font-medium ${state === "added" ? "text-emerald-300" : "text-slate-400"}`}>{state === "added" ? "Added by agreement" : "Removed by agreement"}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
