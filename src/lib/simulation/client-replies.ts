import type { ProjectState, Scenario } from "@/types/scope";

type ScenarioEvent = Scenario["events"][number];

/** Answer from public scenario facts. Unspecified behavior stays unagreed. */
export function clarificationReply(scenario: Scenario, event: ScenarioEvent, question: string) {
  const booking = event.availableScopeItems.find((item) => item.id === "consultation-booking");
  const contact = scenario.initialContract.scopeItems.find((item) => item.id === "contact-form");
  const text = question.toLowerCase();
  const parts: string[] = [];

  if (booking && contact && /\b(?:included|original|contract|scope|extra fee|additional fee|already|difference|contact form)\b/.test(text)) {
    parts.push(`The original contract already includes the contact form: ${contact.description} The requested booking feature is different: ${booking.description} It is listed as ${booking.estimatedHours} additional hours in this scenario. No additional fee or scope change has been agreed just by discussing it.`);
  }
  if (booking && /\b(?:fields?|details|name|email|form|reserv\w*|confirm\w*|availability|slots?|calendar|autom\w*|manually|manual)\b/.test(text)) {
    parts.push("For the booking form, I propose name, email and the selected consultation slot; the exact contact fields still need confirmation. The defined request includes slot selection, contact details and a confirmation email. Whether submission reserves a place immediately or I confirm availability manually, and where available slots come from, are not yet agreed. Please clarify that behavior before committing; do not assume automatic reservation, payments or calendar sync.");
  }

  if (!parts.length) {
    parts.push(`Here is the defined request: ${event.clientMessage} ${event.availableScopeItems.map((item) => item.description).join(" ")}`);
  }
  parts.push("Our current contract remains unchanged while we clarify. Please confirm any proposed scope, fee and delivery terms before we agree to a change.");
  return parts.join(" ");
}

export function unresolvedReply(event: ScenarioEvent, project: ProjectState, message: string) {
  if (event.availableScopeItems.length && /\b(?:replace|swap|exchange|remove|drop)\b/i.test(message)) {
    const active = project.activeScopeItems.map((item) => `${item.title} (${item.estimatedHours}h)`).join(", ");
    const available = event.availableScopeItems.map((item) => `${item.title} (${item.estimatedHours}h)`).join(", ");
    const from = project.activeScopeItems.slice(-2).map((item) => item.title).join(" and ");
    const to = event.availableScopeItems[0].title;
    return `Please name every active item to remove and every defined item to add, for example "Replace ${from} with ${to} at the same price and deadline." Current active scope: ${active}. Available for this request: ${available}. Unspecified or absent items cannot be exchanged. Our current contract remains unchanged.`;
  }
  return "I am not sure which terms you are proposing. Please state the work to add or remove, any additional fee, and the delivery date. Our current contract remains unchanged.";
}
