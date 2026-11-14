import { scenarios } from "@/lib/simulation/scenarios";
import { toScenarioSummary } from "@/types/scope";

export function GET() {
  return Response.json({ scenarios: scenarios.map(toScenarioSummary) });
}
