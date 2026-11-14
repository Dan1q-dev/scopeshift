import { findScenario } from "@/lib/simulation/scenarios";
import { toPublicScenario, type ApiError } from "@/types/scope";

export async function GET(_request: Request, context: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await context.params;
  const scenario = findScenario(scenarioId);
  if (!scenario) {
    return Response.json({ error: { code: "SCENARIO_NOT_FOUND", message: "Scenario not found." } } satisfies ApiError, { status: 404 });
  }
  return Response.json({ scenario: toPublicScenario(scenario) });
}
