import "server-only";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import type { HistoryEntry, Scenario } from "@/types/scope";
import { evaluateSimulation } from "./simulation-evaluator";

/** Engine integration through Danila's existing dependency-injection port.
 * HTTP route adoption is a two-line handoff to its owner; no API rewrite needed.
 */
export function negotiateWithEvaluation(scenario: Scenario, history: readonly HistoryEntry[]) {
  return negotiateHistory(scenario, history, evaluateSimulation);
}
