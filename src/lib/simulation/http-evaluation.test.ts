import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as initializeSession } from "@/app/api/session/route";
import { POST } from "@/app/api/negotiate/route";
import { createOpenAIInterpreter } from "@/lib/ai/openai-interpreter";
import { EVALUATOR_VERSION } from "@/lib/evaluation/simulation-evaluator";
import type { NegotiationAction } from "@/types/scope";

vi.mock("@/lib/ai/openai-interpreter", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-interpreter")>(),
  createOpenAIInterpreter: vi.fn(),
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

function request(cookie: string, message: string) {
  return new Request("http://localhost/api/negotiate", {
    method: "POST", headers: { cookie },
    body: JSON.stringify({ scenarioId: "web-project-01", history: [{ turnId: "evaluated-turn", eventId: "booking-request", userMessage: message }] }),
  });
}

describe("HTTP evidence evaluator in OpenAI mode", () => {
  it("evaluates accepted model actions and returns the same evidence on cached retry", async () => {
    const cookie = await openaiSession();
    const action: NegotiationAction = { kind: "propose", change: { feeDeltaCents: 40_000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } };
    const interpret = vi.fn().mockResolvedValue(action);
    vi.mocked(createOpenAIInterpreter).mockReturnValue(interpret);
    const message = "I propose booking for four hundred dollars extra and two additional days.";
    const response = await POST(request(cookie, message));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-ScopeShift-Evaluation")).toBe(EVALUATOR_VERSION);
    const result = await response.json();
    expect(result.evaluation.criteria).toHaveLength(3);
    expect(result.evaluation.criteria.every((criterion: { evidence: { turnId: string }[] }) => criterion.evidence.every((evidence) => evidence.turnId === "evaluated-turn"))).toBe(true);
    expect(result.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26 });
    const retry = await POST(request(cookie, message));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(result);
    expect(retry.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("0");
    expect(interpret).toHaveBeenCalledTimes(1);
  });

  it("answers a model-interpreted question using the same bounded scenario facts", async () => {
    const cookie = await openaiSession();
    vi.mocked(createOpenAIInterpreter).mockReturnValue(vi.fn().mockResolvedValue({ kind: "clarify", question: "Which fields should booking collect?" }));
    const response = await POST(request(cookie, "Which fields should the booking form collect?"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.turns[0].clientReply).toContain("name, email");
    expect(result.turns[0].clientReply).toContain("not yet agreed");
    expect(result.evaluation.criteria).toHaveLength(1);
    expect(result.evaluation.criteria[0].category).toBe("clarification");
    expect(result.project.acceptedAgreementIds).toEqual([]);
  });
});
