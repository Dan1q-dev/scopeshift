import { evaluationResultSchema, type EvaluationResult } from "@/types/scope";
import type { SimulationEvaluator } from "@/lib/simulation/evaluation-port";
import { initialState, processTurn } from "@/lib/simulation/engine";

export const EVALUATOR_VERSION = "evidence-v2";

// Keep the full learner message while bounding rule and verified summaries
// within the shared observation limit (4000 characters).
function boundedEvidence(value: string) {
  return value.length <= 900 ? value : `${value.slice(0, 897)}...`;
}

/** Scores verified outcomes, not inferred personality or hidden willingness to pay.
 * Each emitted criterion is one observable check worth one point. Missing checks
 * are unassessed; consumers must not turn the returned subset into an overall grade.
 */
export const evaluateSimulation: SimulationEvaluator = ({ scenario, turns, project }) => {
  const criteria: EvaluationResult["criteria"] = [];
  const strengths: string[] = [];
  const improvements: string[] = [];
  let snapshot = initialState(scenario);
  for (const turn of turns) {
    const before = snapshot.project;
    snapshot = processTurn(scenario, snapshot, { ...turn, action: turn.action });
    const verified = snapshot.turns.at(-1)!;
    if (JSON.stringify(verified) !== JSON.stringify(turn)) throw new Error("Unverified evaluation turn");
    const event = scenario.events.find(e => e.id === turn.eventId)!;
    const add = (category: EvaluationResult["criteria"][number]["category"], ruleId: string, observation: string, advice: string) => {
      const rule = event.clientRules.evaluationRules.find(r => r.id === ruleId && r.category === category);
      if (!rule || criteria.some(c => c.evidence.some(e => e.ruleId === ruleId))) return;
      criteria.push({ category, earnedPoints: 1, maxPoints: 1,
        evidence: [{ turnId: turn.turnId, ruleId,
          observation: `Action: ${turn.userMessage} Rule: ${boundedEvidence(rule.observableCriterion)} Verified: ${boundedEvidence(observation)}` }], advice });
    };
    if (turn.action.kind === "clarify" && /\b(fields?|requirements?|included|scope|reser\w*|confirm\w*|deadline|date)\b/i.test(turn.userMessage)) {
      // One inquiry check per event; no claim that the client's answer resolved it.
      if (!criteria.some(c => c.evidence[0].ruleId === (event.id === "booking-request" ? "booking-inquiry" : "rush-clarification"))) {
        add("clarification", (event.id === "booking-request" ? "booking-inquiry" : "rush-clarification"), `Asked a requirements question: ${turn.userMessage}`,
          "Check that the client actually answers before committing. Asking alone does not resolve requirements.");
      }
    }
    if (turn.agreement?.status !== "accepted") continue;
    const after = snapshot.project;
    const change = turn.agreement.change;
    if (change.addScopeItemIds.length > 0 && (event.id === "booking-request" || (change.removeScopeItemIds.includes("portfolio-gallery") && before.activeScopeItems.some(i => i.id === "portfolio-gallery")))) add("scope_management", (event.id === "booking-request" ? "booking-scope" : "swap-active-scope"),
      `Accepted catalog amendment: added [${change.addScopeItemIds.join(", ")}], removed [${change.removeScopeItemIds.join(", ")}].`,
      "Keep the itemized scope and exclusions visible in the written amendment.");
    add("explicit_agreement", (event.id === "booking-request" ? "booking-documentation" : event.id === "earlier-delivery" ? "rush-documentation" : "swap-documentation"),
      `Client explicitly replied: ${turn.clientReply} Agreement ${turn.agreement.id} is recorded once.`,
      "This verifies client acceptance and the engine record, not that every term was stated in the learner's message.");
    add("feasibility", (event.id === "booking-request" ? "booking-capacity" : event.id === "earlier-delivery" ? "rush-capacity" : "swap-capacity"),
      `Accepted ${after.estimatedHours} hours by day ${after.deadlineDays}; scenario capacity is ${event.clientRules.maximumHoursPerDay} hours per day.`,
      "This planning model does not account for elapsed work, approvals or real calendar availability.");
    const rate = (after.effectiveHourlyRateCents / 100).toFixed(2);
    const impact = `Agreement ${turn.agreement.id}: $${(before.totalFeeCents / 100).toFixed(2)} / ${before.estimatedHours}h to $${(after.totalFeeCents / 100).toFixed(2)} / ${after.estimatedHours}h; estimated revenue $${rate}/hour, before expenses and taxes.`;
    improvements.push(`Review the cost of this choice. ${impact} Compare the scope and time trade-off; a higher fee alone does not prove better judgment.`);
    if (change.feeDeltaCents === 0 && change.addScopeItemIds.length && change.removeScopeItemIds.length && before.estimatedHours === after.estimatedHours) {
      if (/same (?:price|fee)|no (?:extra|additional) (?:fee|cost)|(?:price|fee)\s+(?:and\s+(?:the\s+)?(?:delivery(?:\s+(?:day|date))?|deadline)\s+)?unchanged|(?:price|fee)\s+(?:stays|remains)\s+(?:the\s+)?same/i.test(turn.userMessage)) {
        add("economic_decision", "swap-economics", `Explicit no-fee exchange preserves ${after.estimatedHours} hours.`,
          "An equal-effort exchange can preserve price; check both deliverables and client acceptance.");
      }
      strengths.push("You reached a documented equal-effort exchange without increasing hours. A no-fee exchange is a defensible outcome.");
    } else strengths.push(`You reached an explicitly accepted, capacity-checked amendment (${turn.agreement.id}).`);
  }
  if (JSON.stringify(snapshot.project) !== JSON.stringify(project)) throw new Error("Unverified evaluation project");
  // Shared schema limits are respected for histories up to the supported 50 turns.
  const grouped: EvaluationResult["criteria"] = [];
  for (const criterion of criteria) {
    const existing = grouped.find(c => c.category === criterion.category);
    if (!existing) grouped.push({ ...criterion, evidence: [...criterion.evidence] });
    else {
      existing.earnedPoints += criterion.earnedPoints;
      existing.maxPoints += criterion.maxPoints;
      existing.evidence.push(...criterion.evidence);
      if (!existing.advice.includes(criterion.advice)) existing.advice += ` ${criterion.advice}`;
    }
  }
  return evaluationResultSchema.parse({ criteria: grouped, strengths: strengths.slice(-20), improvements: improvements.slice(-20) });
};
