import { z } from "zod";
import {
  changeOrderSchema,
  financialImpactSchema,
  realClientRequestSchema,
  realProjectSchema,
  scopeClassificationLabels,
  type ChangeOrder,
  type FinancialImpact,
  type RealClientRequest,
  type RealProject,
} from "@/types/real-project";
import { calculateFinancialImpact } from "./finance";

function invalid(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["changeOrder"], message }]);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

function signedMoney(cents: number) {
  return `${cents > 0 ? "+" : cents < 0 ? "-" : ""}${money(Math.abs(cents))}`;
}

/** A deterministic editable proposal, never a record of client acceptance. */
export function buildProposedChangeOrder(
  projectValue: RealProject,
  requestValue: RealClientRequest,
  impactValue: FinancialImpact,
  impactHash = requestValue.impactHash,
): ChangeOrder {
  const project = realProjectSchema.parse(projectValue);
  const request = realClientRequestSchema.parse(requestValue);
  const impact = financialImpactSchema.parse(impactValue);
  if (!request.analysis || !request.review || request.status !== "confirmed") invalid("Confirm the complete scope analysis before preparing a change order.");
  if (request.projectId !== project.id || request.projectSnapshot.id !== project.id) invalid("This request does not belong to the project.");
  if (request.sourceRevision !== project.sourceRevision || request.analysis.sourceRevision !== project.sourceRevision) invalid("The agreement changed. Review a new analysis before preparing a change order.");
  const analysisIds = new Set(request.analysis.items.map((item) => item.id));
  const reviewedIds = new Set(request.review.items.map((item) => item.itemId));
  if (analysisIds.size !== request.analysis.items.length || reviewedIds.size !== request.review.items.length
    || analysisIds.size !== reviewedIds.size || [...analysisIds].some((id) => !reviewedIds.has(id))) {
    invalid("Confirm every analyzed item exactly once before preparing a change order.");
  }
  const calculated = calculateFinancialImpact(project, impact.input, request.review);
  if (JSON.stringify(calculated) !== JSON.stringify(impact)) invalid("The saved impact does not match the confirmed estimates.");
  if (!impactHash || !/^[a-f0-9]{64}$/.test(impactHash)) invalid("A validated impact reference is required.");

  const selected = impact.input.selectedItemIds.map((id) => request.analysis!.items.find((item) => item.id === id)!);
  const reviewed = new Map(request.review.items.map((item) => [item.itemId, item]));
  const quotes = [...new Map(selected.flatMap((item) => item.contractEvidence).map((quote) => [
    `${quote.documentId}:${quote.start}:${quote.end}`, quote,
  ])).values()];
  const questions = [...new Set(selected.flatMap((item) => item.clarificationQuestions))];
  const unknowns = [...new Set(selected.flatMap((item) => item.unknowns))];
  const title = `Proposed change order: ${project.name}`;
  const lines = [
    "PROPOSED CHANGE ORDER - NOT ACCEPTED",
    `Project: ${project.name} (${project.id})`,
    `Client request reference: ${request.id}`,
    `Agreement source revision: ${project.sourceRevision}`,
    `Confirmed interpretation revision: ${request.review.revision}`,
    "",
    "ORIGINAL SCOPE",
    "The original scope is the reviewed agreement and amendments referenced below. This proposal does not replace them or state that the client accepted a change.",
    ...project.documents.map((document) => `- ${document.label}: ${document.id}, revision ${document.revision}`),
    ...(quotes.length ? ["Relevant original scope excerpts:", ...quotes.map((quote) => `- "${quote.quote}" [${quote.documentId}, ${quote.passageId}, UTF-16 ${quote.start}-${quote.end}]`)] : ["No source excerpt establishes that these changes are already included or excluded. Review the original documents and clarify their coverage."]),
    "",
    "PROPOSED MODIFICATIONS",
    ...selected.flatMap((item) => [
      `- ${item.title}: ${item.requestedWork}`,
      `  User-confirmed classification: ${scopeClassificationLabels[reviewed.get(item.id)!.classification]}.`,
      ...(reviewed.get(item.id)!.reason ? [`  Review note: ${reviewed.get(item.id)!.reason}`] : []),
    ]),
    ...(impact.input.removedScope.length ? ["Work proposed for removal or replacement:", ...impact.input.removedScope.map((item) => `- ${item.description} (${item.estimatedHours} estimated hours removed)`)] : ["No work is proposed for removal."]),
    "",
    "PROPOSED COMMERCIAL TERMS",
    `Original agreed fee: ${money(impact.originalFeeCents)}`,
    `Additional compensation / credit: ${signedMoney(impact.additionalCompensationCents)}`,
    `Proposed total fee: ${money(impact.proposedFeeCents)}`,
    `Original estimated hours: ${impact.originalEstimatedHours}`,
    `Updated estimated hours: ${impact.updatedEstimatedHours}`,
    `Additional expenses entered by the freelancer: ${money(impact.additionalExpensesCents)}. These are not automatically added to the proposed fee.`,
    `Original delivery date: ${impact.originalDeadline}`,
    `Proposed delivery date: ${impact.proposedDeadline} (${impact.input.deadlineExtensionDays} calendar days of extension)`,
    "Hours and expenses are planning estimates supplied by the freelancer, not a guarantee or an AI-verified market price.",
    "",
    "DEPENDENCIES, ASSUMPTIONS AND OPEN QUESTIONS",
    ...(impact.input.assumptions.length ? impact.input.assumptions.map((assumption) => `- User-entered assumption: ${assumption}`) : ["- No additional user-entered assumptions recorded."]),
    ...unknowns.map((unknown) => `- Unresolved issue: ${unknown}`),
    ...questions.map((question) => `- Clarify before agreement: ${question}`),
    "",
    "CONFIRMATION STATUS",
    "Proposed only. The client has not accepted these terms in ScopeShift. Review and edit this proposal, resolve open questions, and obtain explicit agreement before changing the project commitments.",
    "This editable planning proposal is not legal advice or a legally binding contract.",
  ];
  const body = lines.join("\n");
  if (body.length > 40_000) invalid("This change order is too long. Reduce selected items or notes before preparing a copyable proposal.");
  return changeOrderSchema.parse({
    projectId: project.id,
    requestId: request.id,
    sourceRevision: project.sourceRevision,
    reviewRevision: request.review.revision,
    impactHash,
    status: "proposed",
    title,
    body,
  });
}
