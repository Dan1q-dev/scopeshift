import { findScopeItem } from "@/lib/client/derive";
import { formatSigned, formatSignedMoney } from "@/lib/client/format";
import type { PublicScenario, ScopeChange } from "@/types/scope";

/** One line per term of a proposed or agreed change. Values come straight from the API response. */
export function ChangeSummary({ change, scenario }: { change: ScopeChange; scenario: PublicScenario }) {
  const name = (id: string) => findScopeItem(scenario, id)?.title ?? id;
  return (
    <ul className="tabular m-0 list-none space-y-0.5 p-0 text-xs text-slate-300">
      <li>Fee: {change.feeDeltaCents === 0 ? "no change" : formatSignedMoney(change.feeDeltaCents)}</li>
      <li>Deadline: {change.deadlineDeltaDays === 0 ? "no change" : formatSigned(change.deadlineDeltaDays, Math.abs(change.deadlineDeltaDays) === 1 ? "day" : "days")}</li>
      {change.addScopeItemIds.map((id) => <li key={id}>Added: {name(id)}</li>)}
      {change.removeScopeItemIds.map((id) => <li key={id}>Removed: {name(id)}</li>)}
    </ul>
  );
}
