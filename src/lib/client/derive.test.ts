import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { toPublicScenario, type Agreement, type NegotiateResponse, type NegotiationTurn, type PublicScenario } from "@/types/scope";
import { agreementsOf, evidenceParts, normalizeLegacyScopeEvidence, readableIds } from "./derive";

const scenario = toPublicScenario(websiteProjectScenario);
const agreementId = "a5a7df3a-f8e7-42e7-8bdd-6a7f9ea8297b";
const response = negotiateHistory(websiteProjectScenario, [{
  turnId: agreementId,
  eventId: scenario.events[0].id,
  userMessage: "I can add booking for an extra $400 and two more days.",
}]);

const makeAgreement = (id: string, eventId: string, status: Agreement["status"]): Agreement => ({
  id,
  eventId,
  sourceTurnId: `${id}-turn`,
  status,
  change: { feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: [], removeScopeItemIds: [] },
  explanation: "Recorded test decision.",
});

const makeTurn = (turnId: string, eventId: string, agreement: Agreement | null = null): NegotiationTurn => ({
  turnId,
  eventId,
  userMessage: "Test reply.",
  action: { kind: "clarify", question: "Test question." },
  clientReply: "Test client reply.",
  agreement,
});

const responseWith = (turns: NegotiationTurn[]): NegotiateResponse => ({
  scenarioId: scenario.id,
  turns,
  project: response.project,
  evaluation: response.evaluation,
  currentEventId: null,
  completed: false,
});

describe("agreementsOf", () => {
  it("returns no decisions without a response", () => {
    expect(agreementsOf(null)).toEqual([]);
  });

  it("drops a counteroffer replaced by a later decision on the same request", () => {
    const result = responseWith([
      makeTurn("t1", "booking-request", makeAgreement("a1", "booking-request", "counteroffered")),
      makeTurn("t2", "booking-request", makeAgreement("a2", "booking-request", "accepted")),
      makeTurn("t3", "earlier-delivery"),
    ]);
    expect(agreementsOf(result).map((item) => item.id)).toEqual(["a2"]);
  });

  it("keeps a pending counteroffer and decisions on other requests", () => {
    const result = responseWith([
      makeTurn("t1", "booking-request", makeAgreement("a1", "booking-request", "accepted")),
      makeTurn("t2", "scope-swap", makeAgreement("a2", "scope-swap", "counteroffered")),
    ]);
    expect(agreementsOf(result).map((item) => item.id)).toEqual(["a1", "a2"]);
  });
});

describe("evidenceParts", () => {
  it("splits an observation into action, rule and verified result when the learner message matches", () => {
    expect(evidenceParts("Action: I can add it. Rule: Propose a defined addition. Verified: Accepted scope amendment.", "I can add it.")).toEqual({
      action: "I can add it.",
      rule: "Propose a defined addition.",
      verified: "Accepted scope amendment.",
    });
  });

  it("anchors the full learner message even when it contains the display labels", () => {
    const message = "I wrote Rule: a suggested term.\nVerified: this is still my reply.";
    expect(evidenceParts(`Action: ${message} Rule: The actual rule. Verified: The actual result.`, message)).toEqual({
      action: message,
      rule: "The actual rule.",
      verified: "The actual result.",
    });
  });

  it("falls back to plain text when the known learner message does not match", () => {
    expect(evidenceParts("Action: A different message. Rule: A rule. Verified: A result.", "The recorded reply.")).toBeNull();
  });

  it("leaves unknown or incomplete observation formats unstructured", () => {
    for (const observation of ["A legacy observation.", "Action: A reply. Verified: A result.", "Action: A reply. Rule: A rule."]) {
      expect(evidenceParts(observation)).toBeNull();
    }
  });

  it("supports a complete legacy observation when no learner message is available", () => {
    expect(evidenceParts("Action: A reply. Rule: A rule. Verified: A result.")).toEqual({ action: "A reply.", rule: "A rule.", verified: "A result." });
  });
});

describe("readableIds", () => {
  it("uses the current response and scenario names for exact agreement and scope IDs", () => {
    const unknown = "f9a490f9-187a-4bcf-a76a-d34dc329f43d";
    expect(readableIds(`Agreement ${agreementId}: [consultation-booking]. Unknown: ${unknown}.`, scenario, response))
      .toBe(`Agreement "${scenario.events[0].title}": [Consultation booking]. Unknown: ${unknown}.`);
  });

  it("does not relabel longer unknown identifiers while handling adjacent known tokens", () => {
    const text = `contact-form-extra prefix-contact-form contact-form_2 ${agreementId}-extra [contact-form,portfolio-gallery]`;
    expect(readableIds(text, scenario, response))
      .toBe(`contact-form-extra prefix-contact-form contact-form_2 ${agreementId}-extra [Contact form,Portfolio gallery]`);
  });

  it("keeps overlapping ID names distinct in one pass", () => {
    const overlapping: PublicScenario = {
      ...scenario,
      initialContract: { ...scenario.initialContract, scopeItems: [
        { ...scenario.initialContract.scopeItems[0], id: "contact", title: "Short item" },
        { ...scenario.initialContract.scopeItems[1], id: "contact-form", title: "Long item" },
      ] },
    };
    expect(readableIds("contact-form,contact contact-form-extra", overlapping, response)).toBe("Long item,Short item contact-form-extra");
  });

  it("preserves literal replacement text without interpreting dollars or another known ID", () => {
    const literal: PublicScenario = {
      ...scenario,
      initialContract: { ...scenario.initialContract, scopeItems: scenario.initialContract.scopeItems.map((item) =>
        item.id === "contact-form" ? { ...item, title: "Contact $& $$ portfolio-gallery" } : item) },
    };
    expect(readableIds("contact-form / portfolio-gallery", literal, response)).toBe("Contact $& $$ portfolio-gallery / Portfolio gallery");
  });

  it("leaves text without known IDs unchanged", () => {
    expect(readableIds("No deliverables removed.", scenario, response)).toBe("No deliverables removed.");
  });
});

describe("normalizeLegacyScopeEvidence", () => {
  const legacy = "Accepted catalog amendment: added [consultation-booking], removed [].";
  const accepted = response.turns[0];

  it("shows an old accepted addition readably without changing its saved evidence or scores", () => {
    const saved = JSON.stringify(response);
    expect(readableIds(normalizeLegacyScopeEvidence(legacy, accepted), scenario, response))
      .toBe("Accepted scope amendment. Added: Consultation booking. No deliverables removed.");
    expect(JSON.stringify(response)).toBe(saved);
  });

  it("keeps the original wording when the accepted change does not confirm the legacy claim", () => {
    const withRemoval = structuredClone(accepted);
    withRemoval.agreement!.change.removeScopeItemIds.push("contact-form");
    const withOtherAddition = structuredClone(accepted);
    withOtherAddition.agreement!.change.addScopeItemIds = ["testimonials-section"];
    const withOtherSource = structuredClone(accepted);
    withOtherSource.agreement!.sourceTurnId = "another-turn";
    const counteroffer = structuredClone(accepted);
    counteroffer.agreement!.status = "counteroffered";
    for (const turn of [withRemoval, withOtherAddition, withOtherSource, counteroffer, undefined]) {
      expect(normalizeLegacyScopeEvidence(legacy, turn)).toBe(legacy);
    }
  });

  it("leaves learner quotations, unknown text and malformed legacy wording unchanged", () => {
    for (const text of [`Asked a requirements question: ${legacy}`, `Quoted: ${legacy}`, "Accepted scope amendment. No deliverables removed.", "Accepted catalog amendment: added [unknown-item], removed [].", "Accepted catalog amendment: added [], removed []."]) {
      expect(normalizeLegacyScopeEvidence(text, accepted)).toBe(text);
    }
  });
});
