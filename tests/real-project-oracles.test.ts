import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertAnalysisAgainstOracle, type OracleCase, type AuditFinding } from "./helpers/real-project-oracle";

const load = (id: string): OracleCase => JSON.parse(readFileSync(new URL(`./fixtures/real-project-mode/${id}/oracle.json`, import.meta.url), "utf8"));
const valid = (c: OracleCase): AuditFinding[] => c.expected.map(e => ({ id: e.id, status: e.status,
  evidence: e.evidenceClauseIds.map(clauseId => ({ clauseId, quote: c.clauses[clauseId] })), additionalFeeCents: null }));

describe.each(["website", "logo", "copywriting"])("Real Project QA oracle: %s", id => {
  const c = load(id);
  it("maps every cited clause to the exact uploaded fictional document", () => {
    expect(c.contractText).toContain("FICTIONAL QA DOCUMENT");
    expect(readFileSync(new URL(`./fixtures/real-project-mode/${id}/contract.txt`, import.meta.url), "utf8").replace(/\r\n/g, "\n")).toBe(c.contractText.replace(/\r\n/g, "\n"));
    for (const [key, clause] of Object.entries(c.clauses)) expect(c.contractText).toContain(`${key}. ${clause}`);
    expect(() => assertAnalysisAgainstOracle(valid(c), c)).not.toThrow();
  });
  it("rejects fabricated clause IDs and quotations", () => {
    const wrong = valid(c);
    wrong[0].evidence.push({ clauseId: "C999", quote: "All requests cost $500." });
    expect(() => assertAnalysisAgainstOracle(wrong, c)).toThrow("Invented clause");
    const quote = valid(c);
    quote[0].evidence[0].quote = "The client must pay for every change.";
    expect(() => assertAnalysisAgainstOracle(quote, c)).toThrow("quote");
  });
  it("does not allow included work to become excluded or automatically charged", () => {
    const wrong = valid(c);
    wrong.find(f => f.status === "explicitly_included")!.status = "explicitly_excluded";
    expect(() => assertAnalysisAgainstOracle(wrong, c)).toThrow("Classification mismatch");
    const charged = valid(c);
    charged[0].additionalFeeCents = 25000;
    expect(() => assertAnalysisAgainstOracle(charged, c)).toThrow("cannot establish a fee");
  });
  it("preserves coverage and does not score duplicate requests twice", () => {
    const missing = valid(c).slice(1);
    expect(() => assertAnalysisAgainstOracle(missing, c)).toThrow("Missing");
    const duplicate = valid(c); duplicate[1] = duplicate[0];
    expect(() => assertAnalysisAgainstOracle(duplicate, c)).toThrow("Duplicate");
  });
  it("keeps estimate arithmetic reproducible and unaccepted terms uncommitted", () => {
    // Fixture arithmetic only, NOT a test of the unavailable real-project engine.
    for (const x of c.calculations) {
      expect(x.baseFeeCents + x.proposedAdditionalFeeCents).toBe(x.expectedTotalFeeCents);
      expect(x.baseHours + x.confirmedExtraHours).toBe(x.expectedTotalHours);
      expect(Math.round(x.expectedTotalFeeCents / x.expectedTotalHours)).toBe(x.expectedRateCents);
      if (!x.clientAccepted) {
        expect(x.committedFeeCents).toBe(x.baseFeeCents);
        expect(x.committedHours).toBe(x.baseHours);
      }
    }
  });
});

it("requires the accepted amendment evidence, not just the superseded original", () => {
  const c = load("copywriting"); const wrong = valid(c);
  wrong.find(f => f.id === "second-newsletter")!.evidence = [{ clauseId: "C2", quote: c.clauses.C2 }];
  expect(() => assertAnalysisAgainstOracle(wrong, c)).toThrow("Missing relevant evidence");
});
it("does not force an unspecified analytics request into the excluded category", () => {
  const c = load("website"); const wrong = valid(c);
  wrong.find(f => f.id === "analytics")!.status = "explicitly_excluded";
  expect(() => assertAnalysisAgainstOracle(wrong, c)).toThrow("Classification mismatch");
});
