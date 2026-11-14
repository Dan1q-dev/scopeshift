import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  realProjectCreateSchema, realProjectSchema, scopeAnalysisSchema, sourceDocumentSchema, sourceQuoteSchema,
  type RawScopeAnalysis, type RawSourceQuote, type RealProject, type RealProjectCreateInput,
  type ScopeAnalysis, type SourceDocument, type SourcePassage, type SourceQuote,
} from "@/types/real-project";
import { RealProjectError } from "./errors";

export const hashRealInput = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function canonicalSource(text: string) {
  if (text.includes("\0")) throw new RealProjectError(400, "INVALID_REQUEST", "Source text cannot contain null characters.");
  return text.replace(/\r\n?/g, "\n");
}

export function createSourceDocument(text: string, kind: SourceDocument["kind"], label: string, revision = 1, id: string = randomUUID()): SourceDocument {
  const canonicalText = canonicalSource(text);
  const passages: SourcePassage[] = [];
  const addParagraph = (from: number, to: number) => {
    while (from < to && /\s/.test(canonicalText[from])) from++;
    while (to > from && /\s/.test(canonicalText[to - 1])) to--;
    while (from < to) {
      let end = Math.min(from + 1_200, to);
      // Keep surrogate pairs together while retaining UTF-16 source offsets.
      if (end < to && /[\uD800-\uDBFF]/.test(canonicalText[end - 1])) end--;
      passages.push({ id: `${id}_p${passages.length + 1}`, start: from, end, text: canonicalText.slice(from, end) });
      from = end;
    }
  };
  let start = 0;
  for (const match of canonicalText.matchAll(/\n[\t ]*\n+/g)) {
    addParagraph(start, match.index!);
    start = match.index! + match[0].length;
  }
  addParagraph(start, canonicalText.length);
  return sourceDocumentSchema.parse({ id, kind, label, revision, canonicalText, contentHash: hashRealInput(canonicalText), passages });
}

export function buildRealProject(input: RealProjectCreateInput, previous?: RealProject): RealProject {
  const data = realProjectCreateSchema.parse(input);
  const revision = (previous?.sourceRevision ?? 0) + 1;
  const now = new Date().toISOString();
  const documents = [createSourceDocument(data.agreementText, "agreement", "Original agreement", revision)];
  if (data.amendmentsText?.trim()) documents.push(createSourceDocument(data.amendmentsText, "amendment", "Existing amendments", revision));
  return realProjectSchema.parse({
    id: previous?.id ?? randomUUID(), name: data.name, originalFeeCents: data.originalFeeCents,
    originalEstimatedHours: data.originalEstimatedHours, originalDeadline: data.originalDeadline,
    sourceRevision: revision, documents, createdAt: previous?.createdAt ?? now, updatedAt: now,
  });
}

export function resolveSourceQuote(input: RawSourceQuote, documents: readonly SourceDocument[]): SourceQuote {
  const document = documents.find((item) => item.id === input.documentId);
  const passage = document?.passages.find((item) => item.id === input.passageId);
  if (!document || !passage || document.canonicalText.slice(passage.start, passage.end) !== passage.text || !input.quote.trim()) {
    throw new RealProjectError(502, "INVALID_EVIDENCE", "The analysis could not be grounded in the supplied sources. Please start a new analysis.");
  }
  const offset = passage.text.indexOf(input.quote);
  if (offset < 0) throw new RealProjectError(502, "INVALID_EVIDENCE", "The analysis cited text that is not present in the supplied source.");
  const start = passage.start + offset;
  return sourceQuoteSchema.parse({ ...input, start, end: start + input.quote.length });
}

export function groundScopeAnalysis(raw: RawScopeAnalysis, project: RealProject, requestDocument: SourceDocument, analysisId: string = randomUUID()): ScopeAnalysis {
  const items = raw.items.map((item, index) => {
    const contractEvidence = item.contractEvidence.map((quote) => resolveSourceQuote(quote, project.documents));
    const requestEvidence = item.requestEvidence.map((quote) => resolveSourceQuote(quote, [requestDocument]));
    if ((item.classification === "included" || item.classification === "excluded") && contractEvidence.length === 0) {
      throw new RealProjectError(502, "INVALID_EVIDENCE", "An included or excluded classification needs an actual agreement quotation.");
    }
    return { ...item, id: `item_${index + 1}`, contractEvidence, requestEvidence, userReviewRequired: true as const };
  });
  return scopeAnalysisSchema.parse({ id: analysisId, version: "real-scope-v1", sourceRevision: project.sourceRevision,
    summary: raw.summary, items, limitations: [...raw.limitations.slice(0, 19), "AI scope interpretations require your review. Missing wording is not proof of exclusion or automatic billability."], createdAt: new Date().toISOString() });
}
