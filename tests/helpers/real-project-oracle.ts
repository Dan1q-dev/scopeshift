// Test-only comparison format. This is NOT the future Real Project API contract.
import assert from "node:assert/strict";

export interface OracleCase {
  id: string;
  contractText: string;
  clauses: Record<string, string>;
  expected: { id: string; status: string; evidenceClauseIds: string[]; autoBill: boolean }[];
  calculations: { baseFeeCents: number; baseHours: number; confirmedExtraHours: number;
    proposedAdditionalFeeCents: number; expectedTotalFeeCents: number; expectedTotalHours: number;
    expectedRateCents: number; clientAccepted: boolean; committedFeeCents: number; committedHours: number }[];
}
export interface AuditFinding {
  id: string;
  status: string;
  evidence: { clauseId: string; quote: string }[];
  additionalFeeCents: number | null;
}

/** Requires an adapter from Danila's actual response before any live-model use.
 * It checks observable output, not legal correctness or model reliability.
 */
export function assertAnalysisAgainstOracle(findings: AuditFinding[], oracle: OracleCase) {
  assert.equal(findings.length, oracle.expected.length, "Missing or unexpected finding");
  assert.equal(new Set(findings.map(f => f.id)).size, findings.length, "Duplicate finding");
  for (const finding of findings) {
    const expected = oracle.expected.find(e => e.id === finding.id);
    assert.ok(expected, "Unknown request item");
    assert.equal(finding.status, expected.status, `Classification mismatch: ${finding.id}`);
    assert.equal(finding.additionalFeeCents, null, "Analysis alone cannot establish a fee");
    for (const e of finding.evidence) {
      const clause = oracle.clauses[e.clauseId];
      assert.ok(clause, "Invented clause ID");
      assert.ok(e.quote.trim() && clause.includes(e.quote), "Invented or altered quote");
    }
    for (const id of expected.evidenceClauseIds) {
      assert.ok(finding.evidence.some(e => e.clauseId === id), `Missing relevant evidence: ${id}`);
    }
  }
}
