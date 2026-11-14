import { afterEach, describe, expect, it, vi } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { negotiate } from "./api";

const request = { scenarioId: "web-project-01", history: [{ turnId: "client-bootstrap", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." }] };
const result = negotiateHistory(websiteProjectScenario, request.history);

afterEach(() => vi.unstubAllGlobals());

describe("client session bootstrap", () => {
  it("establishes one identity before concurrent initial negotiation posts", async () => {
    let resolveSession!: (response: Response) => void;
    const session = new Promise<Response>((resolve) => { resolveSession = resolve; });
    const fetchMock = vi.fn<typeof fetch>((input) => input === "/api/session" ? session : Promise.resolve(Response.json(result)));
    vi.stubGlobal("fetch", fetchMock);
    const first = negotiate(request);
    const concurrent = negotiate(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/session");
    resolveSession(Response.json({ mode: "openai" }));
    expect(await first).toEqual(result);
    expect(await concurrent).toEqual(result);
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual(["/api/session", "/api/negotiate", "/api/negotiate"]);
  });

  it("does not send a paid request after failed initialization and allows a retry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: { code: "AI_UNAVAILABLE", message: "Server configuration is incomplete." } }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(negotiate(request)).rejects.toMatchObject({ code: "AI_UNAVAILABLE", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(Response.json({ mode: "openai" })).mockResolvedValueOnce(Response.json(result));
    expect(await negotiate(request)).toEqual(result);
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual(["/api/session", "/api/session", "/api/negotiate"]);
  });
});
