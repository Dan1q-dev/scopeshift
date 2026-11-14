import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { toPublicScenario, type PublicScenario } from "@/types/scope";
import { evidenceParts, readableIds } from "./derive";

const scenario = toPublicScenario(websiteProjectScenario);
const agreementId = "a5a7df3a-f8e7-42e7-8bdd-6a7f9ea8297b";
const response = negotiateHistory(websiteProjectScenario, [{
  turnId: agreementId,
  eventId: scenario.events[0].id,
  userMessage: "I can add booking for an extra $400 and two more days.",
}]);

describe("evidenceParts", () => {
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
});
