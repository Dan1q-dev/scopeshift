import type { NegotiateResponse, NegotiationTurn } from "@/types/scope";
import { newAttempt, type Session } from "./session";

export type PracticeFocus = { turn: NegotiationTurn; title: string; observation: string; challenge: string };

/** An observable next exercise, not a score or a claim that a higher fee is better. */
export function practiceFocus(response: NegotiateResponse): PracticeFocus | null {
  const unresolved = response.turns.findLast((turn) => turn.action.kind === "unresolved");
  if (unresolved) return { turn: unresolved, title: "Make the proposal explicit", observation: "This reply did not establish a clear agreement.", challenge: "Clarify uncertain requirements, then state the work, fee adjustment and delivery deadline you are proposing." };
  const counter = response.turns.findLast((turn) => turn.agreement?.status === "counteroffered" || turn.agreement?.status === "rejected");
  if (counter) return { turn: counter, title: "Respond to the negotiation", observation: "The client did not accept these proposed terms.", challenge: "Try another defensible proposal. State your scope, fee and deadline clearly, or ask what needs clarification. An offer is not an agreement." };
  const free = response.turns.findLast((turn) => turn.agreement?.status === "accepted" && turn.agreement.change.addScopeItemIds.length > 0 && turn.agreement.change.feeDeltaCents === 0 && turn.agreement.change.removeScopeItemIds.length === 0);
  if (free) return { turn: free, title: "Make the trade-off deliberate", observation: "You accepted additional work without changing the fee or removing existing work.", challenge: "Try explaining the trade-off. You can choose free work, propose compensation, trade scope or decline. Compare the consequences rather than judging the fee alone." };
  const turn = response.turns.at(-1);
  return turn ? { turn, title: "Try another defensible approach", observation: "You can revisit this reply while preserving your original attempt.", challenge: "Choose a different approach: clarify, propose terms, trade scope or decline. Explain your choice, then compare the outcomes." } : null;
}

export function improvementHref(attemptId: string, turnId: string) {
  return `/simulation?improveAttempt=${encodeURIComponent(attemptId)}&improveTurn=${encodeURIComponent(turnId)}`;
}

/** Only a reply already present in this browser's validated attempt may be replayed. */
export function preparePracticeRewrite(session: Session, attemptId: string, turnId: string) {
  const source = session.attempts.find((attempt) => attempt.id === attemptId);
  const index = source?.history.findIndex((entry) => entry.turnId === turnId) ?? -1;
  const turn = source?.response?.turns.find((item) => item.turnId === turnId);
  if (!source || index < 0 || !turn || source.history[index].userMessage !== turn.userMessage || source.history[index].eventId !== turn.eventId) return null;
  const attempt = newAttempt(source.history.slice(0, index));
  const attempts = [...session.attempts, attempt];
  while (attempts.length > 20) attempts.splice(attempts.findIndex((item) => item.id !== source.id && item.id !== attempt.id), 1);
  return { session: { attempts, activeId: attempt.id }, attempt, originalReply: turn.userMessage,
    challenge: practiceFocus({ ...source.response!, turns: [turn] })!.challenge };
}
