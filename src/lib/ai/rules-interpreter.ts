import type { Agreement, NegotiationAction, ProjectState, Scenario, ScopeItem } from "@/types/scope";

export const INTERPRETER_VERSION = "rules-v2";

export interface InterpretationContext {
  message: string;
  scenario: Scenario;
  event: Scenario["events"][number];
  project: ProjectState;
  pendingProposal?: Agreement | null;
}

const numberWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};
const numberPattern = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)";
const commitment = /^(?:(?:yes|okay|ok|sure)[,.!]\s*)?(?:(?:i|we)\s+(?:can|will|propose|offer)\b|(?:i'll|we'll|let's|let us)\b)/;

function unresolved(reason: string): NegotiationAction {
  return { kind: "unresolved", reason };
}

function aliases(item: ScopeItem): string[] {
  const title = item.title.toLowerCase();
  const result = [title, item.id.replaceAll("-", " ").toLowerCase()];
  // Seed vocabulary aliases are names for existing items, never new scope.
  if (/booking/.test(title)) result.push("booking", "appointment booking", "consultation booking");
  if (/gallery/.test(title)) result.push("gallery", "portfolio gallery");
  if (/testimonials?/.test(title)) result.push("testimonials", "testimonial section", "testimonials section");
  if (/contact form/.test(title)) result.push("contact form");
  if (/core.*pages/.test(title)) result.push("core pages", "website pages");
  return [...new Set(result)].sort((a, b) => b.length - a.length);
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function references(text: string, item: ScopeItem) {
  return aliases(item).some((alias) => new RegExp(`\\b${escapeRegex(alias)}\\b`).test(text));
}

function cents(text: string): { value?: number; error?: string } {
  const matches = [...text.matchAll(/\$\s*([+-]?\d[\d,]*(?:\.\d+)?)|([+-]?\d[\d,]*(?:\.\d+)?)\s*(?:usd|dollars)\b/g)];
  if (matches.length > 1) return { error: "Please propose one additional fee, rather than multiple prices." };
  if (!matches.length) {
    if (/\$|\b(?:usd|dollars|cents)\b/.test(text)) return { error: "Please write one explicit additional fee in USD, such as $400." };
    return {};
  }
  const match = matches[0];
  const amount = match[1] ?? match[2];
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)) {
    return { error: "Use a non-negative USD amount with at most two decimal places." };
  }
  const suffix = text.slice((match.index ?? 0) + match[0].length);
  if (/^\.\d/.test(suffix)) return { error: "Please write a single valid USD amount." };
  if (/^[a-z]/.test(suffix)) return { error: "Please write the full USD amount without abbreviations." };
  if (/^\s*(?:\/\s*(?:h|hr|hour)|per\s+(?:h|hr|hour)|an?\s+hour)\b/.test(suffix)) {
    return { error: "Please state a fixed additional fee, rather than an hourly rate." };
  }
  if (/^\s*(?:in\s+)?(?:total|overall)\b/.test(suffix) || /\b(?:tax|vat|discount|refund)\b/.test(text)) {
    return { error: "Please state the additional fee without totals, taxes, refunds, or discounts." };
  }
  const prefix = text.slice(Math.max(0, (match.index ?? 0) - 45), match.index);
  if (/\b(?:up to|less than|more than|at least|at most|starting from|approximately|about|around|under|over)\s*$/.test(prefix)) {
    return { error: "Please state one exact additional fee, rather than a range or estimate." };
  }
  if (/\b(?:total|overall|original|current|existing|budget|contract|worth|save|discount|reduc\w*)\b/.test(prefix)) {
    return { error: "Please state the additional fee, rather than a total, budget, discount, or comparison." };
  }
  if (/\b(?:not|never|isn't|is not|won't|wouldn't|can't|cannot)\b/.test(prefix)) {
    return { error: "The proposed fee is negated. Please state one offer explicitly." };
  }
  const [whole, fraction = ""] = amount.replaceAll(",", "").split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value > 100_000_000) return { error: "The additional fee is outside supported limits." };
  return { value };
}

function deadline(text: string, currentDays: number): { delta?: number; error?: string } {
  const matches: Array<{ start: number; end: number; delta: number }> = [];
  const patterns: Array<{ expression: string; kind: "later" | "earlier" | "absolute" }> = [
    { expression: `(${numberPattern})\\s+(?:more|extra|additional)\\s+days?`, kind: "later" },
    { expression: `(${numberPattern})[ -]+days?\\s+(?:extension|later)`, kind: "later" },
    { expression: `(?:extend(?:\\s+(?:the\\s+)?deadline)?\\s+by|extension\\s+of)\\s+(${numberPattern})\\s+days?`, kind: "later" },
    { expression: `(${numberPattern})\\s+days?\\s+(?:earlier|sooner)`, kind: "earlier" },
    { expression: `(?:by\\s+day|deadline\\s+(?:of\\s+)?day)\\s+(${numberPattern})`, kind: "absolute" },
    { expression: `(?:deliver|finish|complete)(?:\\s+(?:it|this|the\\s+project))?\\s+in\\s+(${numberPattern})\\s+days?`, kind: "absolute" },
  ];
  for (const { expression, kind } of patterns) {
    for (const match of text.matchAll(new RegExp(expression, "g"))) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (matches.some((previous) => previous.start < end && previous.end > start)) continue;
      const days = numberWords[match[1]] ?? Number(match[1]);
      matches.push({ start, end, delta: kind === "absolute" ? days - currentDays : kind === "earlier" ? -days : days });
    }
  }
  const unchanged = /\b(?:same|unchanged|existing)\s+(?:(?:price|fee)\s+and\s+)?deadline\b|\bno\s+change\s+to\s+(?:the\s+)?deadline\b|\b(?:keep|leave)\s+(?:the\s+)?deadline\s+(?:unchanged|the same)\b/.test(text);
  if (matches.length > 1 || (matches.length && unchanged)) return { error: "Please propose one unambiguous delivery date." };
  if (matches.length) {
    const value = matches[0].delta;
    if (!Number.isInteger(value) || Math.abs(value) > 365) return { error: "The deadline change is outside supported limits." };
    if (/\b(?:business|working)\s+days?\b/.test(text)) return { error: "Please state the delivery date in scenario days." };
    return { delta: value };
  }
  if (unchanged) return { delta: 0 };
  if (/\b(?:deadline|days?|weeks?|months?|earlier|sooner|later|extension|tomorrow|today|rush|urgent)\b/.test(text)) {
    return { error: "Please state the deadline explicitly, for example two more days or by day 9." };
  }
  return {};
}

function requestedItems(text: string, event: InterpretationContext["event"]): ScopeItem[] | null {
  const named = event.availableScopeItems.filter((item) => references(text, item));
  if (named.length) return named;
  if (event.availableScopeItems.length === 1 && /\b(?:it|that|this|the request|the requested (?:change|feature)|your request)\b/.test(text)) {
    return [event.availableScopeItems[0]];
  }
  return null;
}

/**
 * A bounded English command interpreter for integration without an LLM key.
 * It accepts explicit offers, never claims to understand arbitrary English.
 * Unmentioned fee/date terms stay unchanged only for an otherwise explicit
 * scope swap or deadline offer; adding work needs explicit fee/free terms.
 */
export function interpretMessage(context: InterpretationContext): NegotiationAction {
  const { scenario, event, project, pendingProposal } = context;
  const message = context.message.trim();
  const text = message.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  if (!text || text.length > 2_000) return unresolved("Please provide a message of 1-2000 characters.");
  if (project.scenarioId !== scenario.id || !scenario.events.some((item) => item.id === event.id)) {
    return unresolved("The active scenario context is inconsistent.");
  }

  const accept = /^(?:yes[,!.]?\s*)?(?:i|we)\s+(?:accept|agree(?:\s+to)?|confirm)(?:\s+(?:your|the|this|that|those))?\s+(?:offer|proposal|counteroffer|terms|change|amendment)[.!]?$/.test(text)
    || /^(?:yes[,!.]?\s*)?(?:i|we) agree[.!]?$/.test(text);
  if (accept) {
    if (pendingProposal && pendingProposal.eventId === event.id && ["proposed", "counteroffered"].includes(pendingProposal.status)) {
      return { kind: "accept", proposalId: pendingProposal.id };
    }
    return unresolved("There is no pending client proposal to accept. Please state your terms explicitly.");
  }

  if (/^(?:could|can|would|what|which|how|when|why|should|is|are|do|does|will)\b/.test(text)) {
    return { kind: "clarify", question: message };
  }

  const keepContract = /\b(?:keep|retain|stick to|stay with)\s+(?:the\s+|our\s+)?(?:original|current|existing|agreed)\s+(?:contract|terms|scope|deadline)\b/.test(text);
  const declineRequest = /\b(?:i|we)\s+(?:decline|reject)\s+(?:this|the|your)\s+(?:request|change)\b/.test(text)
    || /\b(?:i|we)\s+(?:cannot|can't|won't)\s+(?:take\s+(?:this|that|it)\s+on|do\s+(?:this|that|it)|meet\s+(?:the|your|this)\s+(?:earlier\s+)?deadline|accommodate\s+(?:this|that|your)\s+request)\b/.test(text);
  if (keepContract || declineRequest) {
    const ownRefusal = commitment.test(text)
      || /^(?:no[,.!]?\s*)?(?:i|we)\s+(?:cannot|can't|won't|decline|reject)\b/.test(text)
      || /^(?:keep|retain|stick to|stay with)\s/.test(text);
    if (!ownRefusal) return unresolved("Please state whether you personally decline the request or are quoting another message.");
    if (/\b(?:but|however|unless|instead|if)\b|\$|\b(?:add|replace|swap|remove)\b/.test(text)) {
      return unresolved("Please separate a declined request from an alternative offer.");
    }
    return { kind: "decline", reason: message };
  }

  const explicitCommitment = commitment.test(text) || /^(?:replace|swap|exchange)\b/.test(text);
  if (!explicitCommitment) {
    if (text.endsWith("?") || /^(?:could|can|would|what|which|how|when|why|please clarify|please explain)\b/.test(text)) {
      return { kind: "clarify", question: message };
    }
    return unresolved("Please state a specific offer, clarification question, or refusal.");
  }

  if (/\b(?:not|cannot|can't|won't|wouldn't|don't|never)\b/.test(text)) {
    return unresolved("The commitment is negated or conditional. Please state one clear offer.");
  }
  if (/\b(?:if|unless|provided|assuming|subject to|depending|once|as long as|after approval)\b/.test(text)
    && !/\b(?:remove|replace|swap|exchange|drop)\b/.test(text)) {
    return unresolved("Please make the conditions explicit before agreeing to a change.");
  }

  const price = cents(text);
  if (price.error) return unresolved(price.error);
  const free = /\b(?:for free|at no (?:extra |additional )?cost|no (?:additional|extra) (?:fee|charge|cost)|same (?:price|fee)|(?:price|fee) (?:stays|remains) (?:the )?same)\b/.test(text);
  if (price.value !== undefined && free && price.value !== 0) return unresolved("The message contains both a charge and no-charge terms. Please choose one.");

  const date = deadline(text, project.deadlineDays);
  if (date.error) return unresolved(date.error);

  const swap = /\b(?:replace|swap|exchange|instead of)\b|\b(?:remove|drop)\b/.test(text);
  const scopeVerb = /\b(?:add|implement|build|include|create|develop|set up|integrate|replace|swap|exchange)\b/.test(text);
  const genericWork = /\b(?:do|handle|take on)\s+(?:it|that|this|the request|your request)\b/.test(text);
  const adding = scopeVerb || (event.availableScopeItems.length > 0 && genericWork);

  // These excluded capabilities cannot silently become a known feature. They
  // require a new scenario item with its own effort estimate before acceptance.
  if (adding && /\b(?:payments?|calendar\s+sync|calendar\s+integration|authentication|login|ecommerce|e-commerce|online\s+store|dashboard|chatbot|analytics|crm|stripe)\b/.test(text)) {
    return unresolved("That message includes capabilities outside the defined change request. Please clarify the exact scope.");
  }
  if (adding && !swap) {
    for (const match of text.matchAll(/\b(?:and|plus|with|including)\s+(?:(?:a|an|the)\s+)?/g)) {
      const knownTerms = new RegExp(`^(?:${numberPattern}(?:[ -]+(?:more|extra|additional))?[ -]+days?\\b|no\\b|same\\b|unchanged\\b|deadline\\b|delivery\\b|price\\b|fee\\b|(?:i|we)\\s+(?:can|will)\\b|(?:deliver|finish|complete)\\b)`);
      if (!knownTerms.test(text.slice((match.index ?? 0) + match[0].length))) {
        return unresolved("Please clarify the additional capabilities mentioned after the scope item.");
      }
    }
  }

  let addScopeItemIds: string[] = [];
  let removeScopeItemIds: string[] = [];
  if (adding || swap) {
    const items = requestedItems(text, event);
    if (!items) return unresolved("Please identify the offered scope item from the current client request.");
    addScopeItemIds = items.map((item) => item.id);
    if (swap) {
      const direction = text.match(/\b(?:replace|swap|exchange)\s+(.+?)\s+(?:with|for)\s+(.+?)(?=\s+(?:at|for|by)\b|[.!?]|$)/);
      if (!direction || !items.every((item) => references(direction[2], item))) {
        return unresolved("Please state the swap as replace the active item with the requested new item.");
      }
      const removed = project.activeScopeItems.filter((item) => references(direction[1], item));
      if (!removed.length) return unresolved("Please name the active scope items to replace.");
      removeScopeItemIds = removed.map((item) => item.id);
      let removal = direction[1];
      for (const item of removed) {
        for (const alias of aliases(item)) removal = removal.replace(new RegExp(`\\b${escapeRegex(alias)}\\b`, "g"), " ");
      }
      removal = removal.replace(/\b(?:the|a|an|current|existing|agreed|and|plus|both)\b/g, " ").replace(/[^a-z0-9]+/g, "");
      if (removal) return unresolved("Please name only existing active scope items being replaced, without unspecified tasks or alternatives.");
      let replacement = direction[2];
      for (const item of items) {
        for (const alias of aliases(item)) replacement = replacement.replace(new RegExp(`\\b${escapeRegex(alias)}\\b`, "g"), " ");
      }
      replacement = replacement.replace(/\b(?:the|a|an|requested|new|feature|functionality|function|system|section|please)\b/g, " ").replace(/[^a-z0-9]+/g, "");
      if (replacement) return unresolved("Please identify only the defined replacement scope item.");
    }

    // Reject unrecognised objects after a scope verb instead of treating any
    // sentence containing the word booking as the supported booking feature.
    const objects = [...text.matchAll(/\b(?:add|implement|build|include|create|develop|integrate)\s+(.+?)(?=\s+(?:for|with|at|by|if|provided|in)\b|[.!?]|$)/g)];
    for (const [, object] of objects) {
      let remainder = object;
      for (const item of items) {
        for (const alias of aliases(item)) remainder = remainder.replace(new RegExp(`\\b${escapeRegex(alias)}\\b`, "g"), " ");
      }
      remainder = remainder.replace(/\b(?:the|a|an|requested|new|feature|functionality|function|system|section|it|that|this|your|and|please)\b/g, " ").replace(/[^a-z0-9]+/g, "").trim();
      if (remainder) return unresolved("Please separate the defined scope item from any additional or unfamiliar work.");
    }
    if (!swap && price.value === undefined && !free) {
      return unresolved("Please specify the additional fee, or explicitly state that the extra work is free.");
    }
  }

  const feeDeltaCents = price.value ?? 0;
  const deadlineDeltaDays = date.delta ?? 0;
  if (!addScopeItemIds.length && !removeScopeItemIds.length && date.delta === undefined) {
    return unresolved("Please explain what work or deadline the additional fee would change.");
  }
  if (!addScopeItemIds.length && !removeScopeItemIds.length && deadlineDeltaDays === 0 && feeDeltaCents === 0) {
    return unresolved("No contract change was specified. Please clarify the request or explicitly keep the current contract.");
  }

  return { kind: "propose", change: { feeDeltaCents, deadlineDeltaDays, addScopeItemIds, removeScopeItemIds } };
}
