import "server-only";
import { scenarioSchema } from "@/types/scope";

// Seed for Albina to refine. Fictional constraints, not validated learning content.
// Import this module only from server code. Use toPublicScenario for browser data.
export const websiteProjectScenario = scenarioSchema.parse({
  id: "web-project-01",
  title: "Sarah Mitchell - Website Project",
  description: "Practice negotiating scope, delivery dates, and changes to a fixed-fee website project.",
  clientName: "Sarah Mitchell",
  currency: "USD",
  initialContract: {
    feeCents: 150_000,
    estimatedHours: 20,
    deadlineDays: 7,
    scopeItems: [
      { id: "core-pages", title: "Core website pages", description: "Home, about, and services pages using supplied copy.", estimatedHours: 12 },
      { id: "contact-form", title: "Contact form", description: "Name, email, message, and an email notification. No appointment scheduling.", estimatedHours: 4 },
      { id: "portfolio-gallery", title: "Portfolio gallery", description: "A static gallery of up to six supplied images.", estimatedHours: 4 },
    ],
  },
  events: [
    {
      id: "booking-request",
      title: "An extra booking feature",
      clientMessage: "Could we add consultation booking? Visitors should choose a time, leave their details, and receive a confirmation email.",
      availableScopeItems: [
        { id: "consultation-booking", title: "Consultation booking", description: "Available-slot selection, contact details, and a confirmation email. No payments or calendar sync.", estimatedHours: 6 },
      ],
      learningObjectives: ["Distinguish new scope from the original contact form.", "Compare a paid amendment, a free addition, and a scope trade-off."],
      clientRules: {
        maxAdditionalFeeCents: 40_000,
        earliestDeadlineDays: 7,
        latestDeadlineDays: 9,
        minimumHoursPerDay: 1,
        maximumHoursPerDay: 4,
        validStrategies: ["clarify", "paid_change", "free_change", "scope_swap", "decline"],
        facts: ["Booking is outside the original contract and adds six hours.", "Sarah can approve at most $400 extra for this request.", "A revised delivery date up to day nine is acceptable.", "A free addition is allowed if the freelancer explicitly accepts the economic cost and can deliver."],
        evaluationRules: [
          { id: "booking-inquiry", category: "clarification", observableCriterion: "Ask a specific question about fields, reservation behavior or the included scope; this checks inquiry, not resolution." },
          { id: "booking-capacity", category: "feasibility", observableCriterion: "Accept only a commitment within four estimated hours per scenario day." },
          { id: "booking-scope", category: "scope_management", observableCriterion: "Propose a defined catalog booking addition and apply it only on client acceptance." },
          { id: "booking-documentation", category: "explicit_agreement", observableCriterion: "Apply fee, scope, and deadline changes only after explicit acceptance of a defined proposal." },
        ],
      },
    },
    {
      id: "earlier-delivery",
      title: "A request to deliver earlier",
      clientMessage: "Our launch plans changed. Can you deliver two days earlier than our current agreed date? Please tell me what would make that possible.",
      availableScopeItems: [],
      learningObjectives: ["Check the currently agreed work and capacity before promising a faster delivery.", "Make a feasible counteroffer or retain the agreed date."],
      clientRules: {
        maxAdditionalFeeCents: 15_000,
        earliestDeadlineDays: 5,
        latestDeadlineDays: 9,
        minimumHoursPerDay: 1,
        maximumHoursPerDay: 4,
        validStrategies: ["clarify", "paid_change", "scope_swap", "decline", "keep_contract"],
        facts: ["The requested date is the current agreed deadline minus two days, never before day five.", "Freelancer capacity is at most four estimated hours per scenario day.", "Sarah can fund up to $150 extra but payment does not create extra work capacity.", "If the request is infeasible, keeping the existing contract is a valid result."],
        evaluationRules: [
          { id: "rush-documentation", category: "explicit_agreement", observableCriterion: "Record the accepted earlier date and fee only after explicit client acceptance." },
          { id: "rush-capacity", category: "feasibility", observableCriterion: "Do not accept a deadline where active estimated hours exceed four times the proposed deadline days." },
          { id: "rush-clarification", category: "clarification", observableCriterion: "Clarify the required date or explain feasibility using the current contract before committing." },
        ],
      },
    },
    {
      id: "scope-swap",
      title: "Replacing part of the agreed work",
      clientMessage: "Instead of the portfolio gallery, could we have a simple testimonials section? I can supply three quotes and names. Would that change our price or date?",
      availableScopeItems: [
        { id: "testimonials-section", title: "Testimonials section", description: "Three client-supplied text quotes and names in a static section.", estimatedHours: 4 },
      ],
      learningObjectives: ["Compare the work being removed with the proposed replacement.", "Recognize an equal-effort scope swap as a defensible no-fee amendment."],
      clientRules: {
        maxAdditionalFeeCents: 0,
        earliestDeadlineDays: 5,
        latestDeadlineDays: 9,
        minimumHoursPerDay: 1,
        maximumHoursPerDay: 4,
        validStrategies: ["clarify", "scope_swap", "decline", "keep_contract"],
        facts: ["A static testimonials section takes four hours, equal to the baseline gallery.", "The gallery must still be active to exchange it; it may already have been removed in an earlier agreement.", "There is no additional budget for an equal-effort replacement.", "Removing the gallery and adding testimonials together preserves total hours and can preserve fee and date."],
        evaluationRules: [
          { id: "swap-documentation", category: "explicit_agreement", observableCriterion: "Record a defined exchange only after explicit client acceptance." },
          { id: "swap-capacity", category: "feasibility", observableCriterion: "Keep the accepted replacement within four estimated hours per scenario day." },
          { id: "swap-active-scope", category: "scope_management", observableCriterion: "Only remove the gallery if it is still in the currently active scope." },
          { id: "swap-economics", category: "economic_decision", observableCriterion: "Propose an explicitly no-fee equal-effort swap that preserves total estimated hours." },
        ],
      },
    },
  ],
});
