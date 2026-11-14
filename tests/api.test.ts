import { describe, expect, it } from "vitest";
import { GET as listScenarios } from "@/app/api/scenarios/route";
import { GET as getScenario } from "@/app/api/scenarios/[scenarioId]/route";
import { POST } from "@/app/api/negotiate/route";
import { apiErrorSchema, publicScenarioSchema, scenarioSummarySchema } from "@/types/scope";

const valid = {
  scenarioId: "web-project-01",
  history: [{ turnId: "turn-1", eventId: "booking-request", userMessage: "Could you clarify the booking requirements?" }],
};
function request(body: unknown) {
  return new Request("http://localhost/api/negotiate", { method: "POST", body: JSON.stringify(body) });
}

describe("foundation API", () => {
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
  it("reports negotiation as unfinished instead of fabricating success", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(501);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("NOT_IMPLEMENTED");
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
