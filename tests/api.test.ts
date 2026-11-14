import { describe, expect, it } from "vitest";
import { GET as listScenarios } from "@/app/api/scenarios/route";
import { GET as getScenario } from "@/app/api/scenarios/[scenarioId]/route";
import { POST } from "@/app/api/negotiate/route";
import { negotiateResponseSchema, publicScenarioSchema, scenarioSummarySchema } from "@/types/scope";

const valid = {
  scenarioId: "web-project-01",
  history: [{ turnId: "turn-1", eventId: "booking-request", userMessage: "Could you clarify the booking requirements?" }],
};
function request(body: unknown) {
  return new Request("http://localhost/api/negotiate", { method: "POST", body: JSON.stringify(body) });
}

describe("simulation API", () => {
  it("serves public summaries and detail without client rules", async () => {
    const list = await listScenarios().json();
    expect(list.scenarios).toHaveLength(1);
    expect(scenarioSummarySchema.safeParse(list.scenarios[0]).success).toBe(true);
    const detail = await getScenario(new Request("http://localhost"), { params: Promise.resolve({ scenarioId: valid.scenarioId }) });
    const body = await detail.json();
    expect(publicScenarioSchema.safeParse(body.scenario).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("clientRules");
    expect(JSON.stringify(body)).not.toContain("maxAdditionalFeeCents");
  });
  it("returns a real rules-based clarification without changing the contract", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    const result = negotiateResponseSchema.parse(await response.json());
    expect(result.project).toMatchObject({ totalFeeCents: 150_000, estimatedHours: 20, deadlineDays: 7 });
    expect(result.turns[0].action.kind).toBe("clarify");
    expect(result.turns[0].agreement).toBeNull();
    expect(response.headers.get("X-ScopeShift-Interpreter")).toBe("rules-v1");
    expect(response.headers.get("X-ScopeShift-Evaluation")).toBe("evidence-v2");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(result.evaluation.criteria.length).toBeGreaterThan(0);
  });

  it("applies a real accepted change once and rejects changing an existing turn", async () => {
    const body = { ...valid, history: [{ ...valid.history[0], turnId: crypto.randomUUID(), userMessage: "I can add booking for an extra $400 and two more days. Would that work?" }] };
    const first = await POST(request(body));
    const result = await first.json();
    expect(first.status).toBe(200);
    expect(result.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9, effectiveHourlyRateCents: 7308 });
    expect(result.turns[0].agreement.status).toBe("accepted");
    const headers = { cookie: first.headers.get("set-cookie")!.split(";")[0] };
    const again = await POST(new Request("http://localhost/api/negotiate", { method: "POST", headers, body: JSON.stringify(body) }));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(result);
    const changed = await POST(new Request("http://localhost/api/negotiate", { method: "POST", headers, body: JSON.stringify({ ...body, history: [{ ...body.history[0], userMessage: "I can add it for free." }] }) }));
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe("INVALID_HISTORY");
  });
  it("rejects tampered state, duplicate turns and unknown events", async () => {
    for (const body of [
      { ...valid, totalFeeCents: 999_999 },
      { ...valid, history: [...valid.history, ...valid.history] },
      { ...valid, history: [{ ...valid.history[0], eventId: "missing-event" }] },
    ]) expect((await POST(request(body))).status).toBe(400);
  });
  it("rejects malformed and oversized JSON bodies", async () => {
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "x".repeat(131_073) }))).status).toBe(413);
  });
  it("returns 404 for an unknown scenario", async () => {
    expect((await POST(request({ ...valid, scenarioId: "missing" }))).status).toBe(404);
    expect((await getScenario(new Request("http://localhost"), { params: Promise.resolve({ scenarioId: "missing" }) })).status).toBe(404);
  });
});
