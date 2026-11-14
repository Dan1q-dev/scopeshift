import { negotiate, ScopeShiftApiError } from "@/lib/client/api";
import { fixtureNegotiate } from "@/lib/client/fixture";
import type { NegotiateRequest, NegotiateResponse, PublicScenario } from "@/types/scope";

export type NegotiationSource = "backend" | "fixture";
export type NegotiationResult = { response: NegotiateResponse; source: NegotiationSource };

/**
 * Single entry point for the UI. Always calls the real backend first.
 * Only an explicit 501 NOT_IMPLEMENTED falls back to the labelled development fixture,
 * so the fixture leaves the execution path automatically once the engine is deployed.
 */
export async function runNegotiation(scenario: PublicScenario, request: NegotiateRequest, signal?: AbortSignal): Promise<NegotiationResult> {
  try {
    return { response: await negotiate(request, signal), source: "backend" };
  } catch (error) {
    if (error instanceof ScopeShiftApiError && error.code === "NOT_IMPLEMENTED") {
      return { response: fixtureNegotiate(scenario, request), source: "fixture" };
    }
    throw error;
  }
}

export function describeError(error: unknown) {
  if (error instanceof ScopeShiftApiError) {
    if (error.code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
    if (error.code === "AI_UNAVAILABLE") return "The client is temporarily unavailable. Your message was not lost - try again.";
    return error.message;
  }
  return "Could not reach the server. Check your connection and try again.";
}
