import { describe, expect, it } from "vitest";
import { websiteProjectScenario as scenario } from "@/data/scenarios/website-project";
import { initialState } from "./engine";
import { negotiateHistory } from "./negotiate";

const reply = (userMessage: string) => negotiateHistory(scenario, [{ turnId: "free-form-refusal", eventId: scenario.events[0].id, userMessage }]);

describe("explicit natural-language refusal regression", () => {
  it.each([
    "I have to decline this request. Booking is not part of our contract…",
    "I have to decline this request. Booking is not part of our contract.",
    "We need to reject this change. Booking is outside the agreed scope.",
    "I must decline your request. Our contract remains unchanged.",
  ])("advances without amending the contract: %s", (message) => {
    const result = reply(message);
    expect(result.turns[0].action).toEqual({ kind: "decline", reason: message });
    expect(result.project).toEqual(initialState(scenario).project);
    expect(result.currentEventId).toBe(scenario.events[1].id);
    expect(result.completed).toBe(false);
  });

  it.each([
    "I have to decline this request if the deadline stays unchanged.",
    "I have to decline this request unless we add booking for $400.",
    "I have to decline this request, but I can add booking for $400.",
    "I may have to decline this request.",
    "I don't have to decline this request.",
    'The client said "I have to decline this request."',
    "If you cannot change the deadline, I have to decline this request.",
  ])("keeps ambiguous, negated or quoted intent unresolved: %s", (message) => {
    const result = reply(message);
    expect(result.turns[0].action.kind).toBe("unresolved");
    expect(result.project).toEqual(initialState(scenario).project);
    expect(result.currentEventId).toBe(scenario.events[0].id);
  });
});
