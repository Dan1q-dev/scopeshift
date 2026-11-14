import "server-only";
import { websiteProjectScenario } from "@/data/scenarios/website-project";

export const scenarios = [websiteProjectScenario] as const;

export function findScenario(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId);
}
