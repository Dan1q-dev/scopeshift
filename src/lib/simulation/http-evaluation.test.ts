import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as initializeSession } from "@/app/api/session/route";
import { POST } from "@/app/api/negotiate/route";
import { createOpenAIInterpreter, OpenAIProviderError } from "@/lib/ai/openai-interpreter";
import { createOpenAIClientReplyGenerator } from "@/lib/ai/openai-client-reply";
import { EVALUATOR_VERSION } from "@/lib/evaluation/simulation-evaluator";
import type { NegotiationAction } from "@/types/scope";

vi.mock("@/lib/ai/openai-interpreter", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-interpreter")>(),
  createOpenAIInterpreter: vi.fn(),
}));
vi.mock("@/lib/ai/openai-client-reply", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-client-reply")>(),
  createOpenAIClientReplyGenerator: vi.fn(),
}));

const directories: string[] = [];
const prefix = "scopeshift-http-evaluation-";

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of directories.splice(0)) {
    const target = resolve(directory);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith(prefix)) throw new Error("Unsafe temporary replay cleanup target");
    await rm(target, { recursive: true, force: true });
  }
});

async function openaiSession() {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  vi.stubEnv("SCOPESHIFT_AI_MODE", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-a-real-credential");
  vi.stubEnv("SCOPESHIFT_SESSION_SECRET", "test-session-secret-".repeat(4));
  vi.stubEnv("SCOPESHIFT_REPLAY_DIR", directory);
  vi.stubEnv("VERCEL", "");
  return initializeSession(new Request("http://localhost/api/session")).headers.get("set-cookie")!.split(";")[0];
}

function request(cookie: string, history: Array<{ turnId: string; eventId: string; userMessage: string }>) {
  return new Request("http://localhost/api/negotiate", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ scenarioId: "web-project-01", history }),
  });
}

describe("HTTP evidence evaluator in OpenAI mode", () => {
  it("evaluates accepted model actions and returns the same generated client reply on cached retry", async () => {
    const cookie = await openaiSession();
    const action: NegotiationAction = { kind: "propose", change: { feeDeltaCents: 40_000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } };
    const replyText = "That works for me - consultation booking is added for $1,900 total across 26 hours with delivery on day 9.";
    const interpret = vi.fn().mockResolvedValue(action);
    const generateReply = vi.fn().mockResolvedValue(replyText);
    vi.mocked(createOpenAIInterpreter).mockReturnValue(interpret);
    vi.mocked(createOpenAIClientReplyGenerator).mockReturnValue(generateReply);
    const message = "I propose booking for four hundred dollars extra and two additional days.";
    const history = [{ turnId: "evaluated-turn", eventId: "booking-request", userMessage: message }];
    const response = await POST(request(cookie, history));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-ScopeShift-Evaluation")).toBe(EVALUATOR_VERSION);
    expect(response.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("2");
    const result = await response.json();
    expect(result.turns[0].clientReply).toBe(replyText);
    expect(result.evaluation.criteria).toHaveLength(3);
    expect(result.evaluation.criteria.every((criterion: { evidence: { turnId: string }[] }) => criterion.evidence.every((evidence) => evidence.turnId === "evaluated-turn"))).toBe(true);
    expect(result.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26 });
    const retry = await POST(request(cookie, history));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(result);
    expect(retry.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("0");
    expect(interpret).toHaveBeenCalledTimes(1);
    expect(generateReply).toHaveBeenCalledTimes(1);
  });

  it("answers a model-interpreted question using bounded generated replies without mutating contract terms", async () => {
    const cookie = await openaiSession();
    const replyText = "I need name and email on the booking form, while automatic calendar confirmation is not yet agreed and our contract remains unchanged.";
    vi.mocked(createOpenAIInterpreter).mockReturnValue(vi.fn().mockResolvedValue({ kind: "clarify", question: "Which fields should booking collect?" }));
    vi.mocked(createOpenAIClientReplyGenerator).mockReturnValue(vi.fn().mockResolvedValue(replyText));
    const response = await POST(request(cookie, [{ turnId: "evaluated-turn", eventId: "booking-request", userMessage: "Which fields should the booking form collect?" }]));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.turns[0].clientReply).toBe(replyText);
    expect(result.evaluation.criteria).toHaveLength(1);
    expect(result.evaluation.criteria[0].category).toBe("clarification");
    expect(result.project.acceptedAgreementIds).toEqual([]);
  });

  it("recovers from a Step 2 reply failure without re-running Step 1 interpretation and never falls back to templates", async () => {
    const cookie = await openaiSession();
    const interpret = vi.fn()
      .mockResolvedValueOnce({ kind: "propose", change: { feeDeltaCents: 100_000, deadlineDeltaDays: 0, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } })
      .mockResolvedValueOnce({ kind: "propose", change: { feeDeltaCents: 30_000, deadlineDeltaDays: 1, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } });
    const generateReply = vi.fn()
      .mockResolvedValueOnce("I cannot approve $1,000 extra for booking, though I can counteroffer $400 extra with delivery by day 7.")
      .mockRejectedValueOnce(new OpenAIProviderError("rate_limit", "OpenAI is temporarily rate limited. Please try again later."))
      .mockResolvedValueOnce("Agreed - $300 extra and one additional day works, bringing the project to $1,800, 26 hours, and day 8.");
    vi.mocked(createOpenAIInterpreter).mockReturnValue(interpret);
    vi.mocked(createOpenAIClientReplyGenerator).mockReturnValue(generateReply);

    const turn1 = { turnId: "turn-counter", eventId: "booking-request", userMessage: "Adding booking takes an extra $1,000." };
    const firstResponse = await POST(request(cookie, [turn1]));
    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.turns[0].agreement?.status).toBe("counteroffered");
    expect(firstResponse.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("2");

    const turn2 = { turnId: "turn-offer-question", eventId: "booking-request", userMessage: "Would you accept an extra $300 and one additional day?" };
    const failedReply = await POST(request(cookie, [turn1, turn2]));
    expect(failedReply.status).toBe(429);
    const errorBody = await failedReply.json();
    expect(errorBody.error.code).toBe("RATE_LIMITED");
    expect(interpret).toHaveBeenCalledTimes(2);

    const retried = await POST(request(cookie, [turn1, turn2]));
    expect(retried.status).toBe(200);
    expect(retried.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("1");
    const retriedBody = await retried.json();
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(generateReply).toHaveBeenCalledTimes(3);
    expect(retriedBody.project).toMatchObject({ totalFeeCents: 180_000, estimatedHours: 26, deadlineDays: 8 });
    expect(retriedBody.turns[1].clientReply).toContain("$1,800");

    const cachedRetry = await POST(request(cookie, [turn1, turn2]));
    expect(cachedRetry.status).toBe(200);
    expect(cachedRetry.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("0");
    expect(await cachedRetry.json()).toEqual(retriedBody);
  });
});
