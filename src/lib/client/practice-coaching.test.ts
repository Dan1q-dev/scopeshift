import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { improvementHref, practiceFocus, preparePracticeRewrite } from "./practice-coaching";
import { newAttempt, type Session } from "./session";

const history = [
  { turnId: "paid", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." },
  { turnId: "rush", eventId: "earlier-delivery", userMessage: "I can deliver two days earlier for an extra $900." },
];
const response = negotiateHistory(websiteProjectScenario, history);
const source = { ...newAttempt(history), response };
const session: Session = { attempts: [source], activeId: source.id };

describe("targeted practice feedback", () => {
  it("identifies a concrete reply with a client counteroffer without guessing hidden limits", () => {
    const focus = practiceFocus(response)!;
    expect(focus.turn.turnId).toBe("rush");
    expect(focus.challenge).toContain("scope, fee and deadline");
    expect(focus.challenge).not.toContain("150");
  });
  it("treats free work as a trade-off rather than an automatic mistake", () => {
    const free = negotiateHistory(websiteProjectScenario, [{ ...history[0], userMessage: "I can add it for free with no change to the deadline." }]);
    expect(practiceFocus(free)?.challenge).toContain("You can choose free work");
  });
  it("prioritizes unresolved proposals and keeps exact source text", () => {
    const unresolved = negotiateHistory(websiteProjectScenario, [{ ...history[0], userMessage: "Maybe later." }]);
    expect(practiceFocus(unresolved)).toMatchObject({ title: "Make the proposal explicit", turn: { userMessage: "Maybe later." } });
  });
  it("creates a new branch before the chosen turn, preserving the original and requiring a typed resend", () => {
    const original = structuredClone(session);
    const rewrite = preparePracticeRewrite(session, source.id, "rush")!;
    expect(rewrite.attempt.history).toEqual(history.slice(0, 1));
    expect(rewrite.attempt.response).toBeNull();
    expect(rewrite.originalReply).toBe(history[1].userMessage);
    expect(rewrite.session.attempts[0]).toEqual(source);
    expect(session).toEqual(original);
  });
  it("does not accept stale, forged or unavailable turn references", () => {
    expect(preparePracticeRewrite(session, "another-session", "rush")).toBeNull();
    expect(preparePracticeRewrite(session, source.id, "missing")).toBeNull();
    const altered = { ...source, history: history.map((entry) => ({ ...entry, userMessage: "Altered" })) };
    expect(preparePracticeRewrite({ ...session, attempts: [altered] }, source.id, "rush")).toBeNull();
  });
  it("keeps the source even when the browser's attempt list reaches its bound", () => {
    const full = { ...session, attempts: [source, ...Array.from({ length: 19 }, () => newAttempt())] };
    const rewrite = preparePracticeRewrite(full, source.id, "paid")!;
    expect(rewrite.session.attempts).toHaveLength(20);
    expect(rewrite.session.attempts).toContain(source);
    expect(rewrite.attempt.history).toEqual([]);
    const url = improvementHref(source.id, "rush");
    expect(url).toContain("improveTurn=rush"); expect(url).not.toContain("900");
  });
});
