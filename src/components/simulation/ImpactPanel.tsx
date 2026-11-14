import { ChangeSummary } from "@/components/ui/ChangeSummary";
import { panel } from "@/components/ui/SiteHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { initialProject } from "@/lib/client/derive";
import { formatDays, formatHours, formatMoney, formatRate, formatSigned, formatSignedMoney } from "@/lib/client/format";
import type { Agreement, ProjectState, PublicScenario } from "@/types/scope";

function Metric({ label, value, delta, tone }: { label: string; value: string; delta: string | null; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-slate-400";
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      {/* key restarts the highlight animation whenever the backend value changes */}
      <dd key={value} className="value-flash tabular m-0 text-lg font-semibold">{value}</dd>
      <p className={`tabular m-0 text-[11px] ${delta ? color : "text-slate-600"}`}>{delta ?? "No change"}</p>
    </div>
  );
}

export function ImpactPanel({ scenario, project, agreements }: { scenario: PublicScenario; project: ProjectState; agreements: Agreement[] }) {
  const start = initialProject(scenario);
  const fee = project.totalFeeCents - start.totalFeeCents;
  const hours = project.estimatedHours - start.estimatedHours;
  const days = project.deadlineDays - start.deadlineDays;
  const rate = project.effectiveHourlyRateCents - start.effectiveHourlyRateCents;
  const tone = (value: number) => (value > 0 ? "good" : value < 0 ? "bad" : "neutral");
  const eventTitle = (id: string) => scenario.events.find((event) => event.id === id)?.title ?? id;

  return (
    <section aria-labelledby="impact-title" className={`${panel} p-4`}>
      <h2 id="impact-title" className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Project impact</h2>
      <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-3" aria-live="polite">
        <p className="m-0 text-[11px] text-slate-400">Effective hourly rate</p>
        <p key={project.effectiveHourlyRateCents} className="value-flash tabular m-0 text-3xl font-semibold tracking-tight">{formatRate(project.effectiveHourlyRateCents)}</p>
        <p className={`tabular m-0 text-xs ${rate > 0 ? "text-emerald-300" : rate < 0 ? "text-rose-300" : "text-slate-500"}`}>
          {rate === 0 ? `Same as the original contract (${formatRate(start.effectiveHourlyRateCents)})` : `${rate > 0 ? "+" : "-"}${formatRate(Math.abs(rate))} vs original ${formatRate(start.effectiveHourlyRateCents)}`}
        </p>
      </div>
      <dl className="m-0 mt-2 grid grid-cols-3 gap-2">
        <Metric label="Total fee" value={formatMoney(project.totalFeeCents)} delta={fee ? formatSignedMoney(fee) : null} tone={tone(fee)} />
        <Metric label="Est. hours" value={formatHours(project.estimatedHours)} delta={hours ? formatSigned(hours, "h") : null} tone="neutral" />
        <Metric label="Deadline" value={formatDays(project.deadlineDays)} delta={days ? formatSigned(days, "days") : null} tone="neutral" />
      </dl>

      <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Contract changes</h3>
      {agreements.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-white/10 px-3 py-3 text-sm text-slate-500">No agreed amendments yet. Only an accepted proposal changes the contract.</p>
      ) : (
        <ol className="m-0 list-none space-y-2 p-0">
          {agreements.map((agreement) => (
            <li key={agreement.id} className={`rise rounded-lg border px-3 py-2 ${agreement.status === "accepted" ? "border-emerald-400/25" : "border-white/10"}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{eventTitle(agreement.eventId)}</span>
                <StatusChip status={agreement.status} />
              </div>
              <ChangeSummary change={agreement.change} scenario={scenario} />
              <p className="mt-1 mb-0 text-xs leading-4 text-slate-500">{agreement.explanation}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
