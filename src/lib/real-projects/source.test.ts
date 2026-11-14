import { describe, expect, it } from "vitest";
import type { RawScopeAnalysis, RawSourceQuote, RealProjectCreateInput, SourceDocument } from "@/types/real-project";
import { RealProjectError } from "./errors";
import { buildRealProject, canonicalSource, createSourceDocument, groundScopeAnalysis, resolveSourceQuote } from "./source";

const projectInput: RealProjectCreateInput = {
  name: "Synthetic website project",
  originalFeeCents: 150_000,
  originalEstimatedHours: 20,
  originalDeadline: "2026-12-01",
  agreementText: "Build five website pages.\r\n\r\nAppointment booking is excluded.",
};

function quote(document: SourceDocument, value: string, passageIndex = 0): RawSourceQuote {
  return { documentId: document.id, passageId: document.passages[passageIndex].id, quote: value };
}

function analysis(requestDocument: SourceDocument): RawScopeAnalysis {
  return {
    summary: "The client requests appointment booking.",
    items: [{
      title: "Appointment booking",
      requestedWork: "Let visitors reserve a time slot.",
      classification: "not_specified",
      contractEvidence: [],
      requestEvidence: [quote(requestDocument, "Please add appointment booking.")],
      explanation: "Review this request against the actual agreement.",
      unknowns: ["Availability management is unspecified."],
      clarificationQuestions: ["Who supplies the available time slots?"],
    }],
    limitations: [],
  };
}

function sources() {
  const project = buildRealProject(projectInput);
  const requestDocument = createSourceDocument("Please add appointment booking.", "client_request", "Synthetic client request");
  return { project, requestDocument, raw: analysis(requestDocument) };
}

describe("source document grounding", () => {
  it("normalizes CRLF and lone CR without changing Unicode or indentation", () => {
    expect(canonicalSource("  Contract 😀\r\n\rTerms\n End  ")).toBe("  Contract 😀\n\nTerms\n End  ");
  });

  it("rejects null characters rather than silently changing quoted content", () => {
    expect(() => canonicalSource("Scope\0hidden")).toThrow(RealProjectError);
  });

  it("keeps evidence offsets exact in the canonical UTF-16 text after CRLF and emoji", () => {
    const document = createSourceDocument("Title 😀\r\n\r\n  Includes a contact form.  ", "agreement", "Synthetic agreement");
    const actual = resolveSourceQuote(quote(document, "contact form", 1), [document]);
    expect(document.canonicalText).toBe("Title 😀\n\n  Includes a contact form.  ");
    expect(actual.start).toBe(document.canonicalText.indexOf("contact form"));
    expect(actual.end).toBe(actual.start + "contact form".length);
    expect(document.canonicalText.slice(actual.start, actual.end)).toBe("contact form");
    for (const passage of document.passages) {
      expect(document.canonicalText.slice(passage.start, passage.end)).toBe(passage.text);
    }
  });

  it("never splits an emoji surrogate pair at a long passage boundary", () => {
    const text = `${"a".repeat(1_199)}😀 contact form`;
    const document = createSourceDocument(text, "agreement", "Long synthetic agreement");
    expect(document.passages).toHaveLength(2);
    expect(document.passages[0].text).toHaveLength(1_199);
    expect(document.passages[1].text.startsWith("😀")).toBe(true);
    expect(document.passages.map((passage) => passage.text).join("")).toBe(text);
    const result = resolveSourceQuote(quote(document, "😀 contact form", 1), [document]);
    expect(result.start).toBe(1_199);
    expect(result.end).toBe(text.length);
  });

  it.each([
    { documentId: "00000000-0000-4000-8000-000000000099" },
    { passageId: "fabricated_passage" },
    { quote: "The client agrees to pay any requested amount." },
    { quote: "appointment booking is excluded." },
    { quote: "   " },
  ])("rejects fabricated or non-exact evidence %j", (override) => {
    const { project } = sources();
    const document = project.documents[0];
    const candidate = { ...quote(document, "Appointment booking is excluded.", 1), ...override };
    expect(() => resolveSourceQuote(candidate, [document])).toThrow(RealProjectError);
    try {
      resolveSourceQuote(candidate, [document]);
    } catch (error) {
      expect(error).toMatchObject({ status: 502, code: "INVALID_EVIDENCE" });
    }
  });

  it("rejects a saved passage whose text does not match its source offsets", () => {
    const { project } = sources();
    const document = structuredClone(project.documents[0]);
    document.passages[1].text = "Fabricated permission to charge more.";
    expect(() => resolveSourceQuote(quote(document, "Fabricated", 1), [document])).toThrow("could not be grounded");
  });

  it.each(["included", "excluded"] as const)("requires an actual agreement quote for %s", (classification) => {
    const { project, requestDocument, raw } = sources();
    raw.items[0].classification = classification;
    expect(() => groundScopeAnalysis(raw, project, requestDocument)).toThrow("actual agreement quotation");
  });

  it("allows not explicitly specified with no contract quote and marks review as mandatory", () => {
    const { project, requestDocument, raw } = sources();
    const result = groundScopeAnalysis(raw, project, requestDocument);
    expect(result.items[0]).toMatchObject({ id: "item_1", classification: "not_specified", contractEvidence: [], userReviewRequired: true });
    expect(result.items[0].requestEvidence[0].quote).toBe("Please add appointment booking.");
    expect(result.limitations.join(" ")).toContain("Missing wording is not proof of exclusion or automatic billability.");
  });

  it("accepts an explicitly excluded item only with grounded agreement evidence", () => {
    const { project, requestDocument, raw } = sources();
    raw.items[0].classification = "excluded";
    raw.items[0].contractEvidence = [quote(project.documents[0], "Appointment booking is excluded.", 1)];
    const result = groundScopeAnalysis(raw, project, requestDocument);
    const citation = result.items[0].contractEvidence[0];
    expect(project.documents[0].canonicalText.slice(citation.start, citation.end)).toBe(citation.quote);
    expect(result.items[0].classification).toBe("excluded");
  });

  it("cannot use a client message as agreement evidence", () => {
    const { project, requestDocument, raw } = sources();
    raw.items[0].classification = "included";
    raw.items[0].contractEvidence = [quote(requestDocument, "Please add appointment booking.")];
    expect(() => groundScopeAnalysis(raw, project, requestDocument)).toThrow(RealProjectError);
  });

  it("cannot invent a requested item by quoting only the original agreement", () => {
    const { project, requestDocument, raw } = sources();
    raw.items[0].requestEvidence = [quote(project.documents[0], "Build five website pages.")];
    expect(() => groundScopeAnalysis(raw, project, requestDocument)).toThrow(RealProjectError);
  });

  it("includes existing amendments as distinct, citable sources", () => {
    const project = buildRealProject({ ...projectInput, amendmentsText: "Amendment: a basic booking form is included." });
    const requestDocument = createSourceDocument("Please add appointment booking.", "client_request", "Synthetic request");
    const raw = analysis(requestDocument);
    raw.items[0].classification = "ambiguous";
    raw.items[0].contractEvidence = [
      quote(project.documents[0], "Appointment booking is excluded.", 1),
      quote(project.documents[1], "a basic booking form is included."),
    ];
    const result = groundScopeAnalysis(raw, project, requestDocument);
    expect(project.documents[1].kind).toBe("amendment");
    expect(result.items[0].contractEvidence.map((entry) => entry.documentId)).toEqual(project.documents.map((entry) => entry.id));
    expect(result.items[0].classification).toBe("ambiguous");
  });

  it("retains separate atomic requests and individual evidence instead of one combined classification", () => {
    const project = buildRealProject(projectInput);
    const requestDocument = createSourceDocument("Please add appointment booking.\n\nAlso add two more pages.", "client_request", "Synthetic multi-item request");
    const raw = analysis(requestDocument);
    raw.items.push({
      ...raw.items[0],
      title: "Two additional pages",
      requestedWork: "Add two pages beyond the original five-page site.",
      requestEvidence: [quote(requestDocument, "Also add two more pages.", 1)],
      clarificationQuestions: ["Which two pages are needed?"],
    });
    const result = groundScopeAnalysis(raw, project, requestDocument);
    expect(result.items.map((item) => item.id)).toEqual(["item_1", "item_2"]);
    expect(result.items.map((item) => item.requestEvidence[0].quote)).toEqual(["Please add appointment booking.", "Also add two more pages."]);
    expect(result.items.every((item) => item.userReviewRequired)).toBe(true);
  });

  it("updates the source revision while preserving identity and creation time", () => {
    const initial = buildRealProject(projectInput);
    const updated = buildRealProject({ ...projectInput, originalFeeCents: 170_000 }, initial);
    expect(updated.id).toBe(initial.id);
    expect(updated.createdAt).toBe(initial.createdAt);
    expect(updated.sourceRevision).toBe(2);
    expect(updated.documents[0].revision).toBe(2);
    expect(updated.originalFeeCents).toBe(170_000);
    expect(initial.originalFeeCents).toBe(150_000);
  });
});
