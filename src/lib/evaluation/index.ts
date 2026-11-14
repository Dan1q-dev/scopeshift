/** Proposed adapter contract v0.1; not yet matched to the shared engine. */
export const dimensions = ['clarification', 'scope', 'economics', 'agreement', 'feasibility'] as const;
export type Dimension = typeof dimensions[number];
export interface Observation {
  dimension: Dimension;
  criterionId: string;
  status: 'met' | 'missed' | 'not-observed' | 'not-applicable';
  evidence: { eventId: string; quote: string }[];
  explanation: string;
  advice: string;
}
export interface Criterion { id: string; dimension: Dimension; description: string }
export const criteria: Criterion[] = [
  { id: 'fields', dimension: 'clarification', description: 'Resolves booking fields and workflow before committing, or declines without committing.' },
  { id: 'priority', dimension: 'clarification', description: 'Resolves launch priority and dependency on client content before committing.' },
  { id: 'baseline', dimension: 'scope', description: 'Correctly distinguishes the included contact form from booking automation.' },
  { id: 'boundaries', dimension: 'scope', description: 'Bounds additions, exclusions and any removed deliverables by identifier.' },
  { id: 'impact', dimension: 'economics', description: 'Reviews estimated hours and effective hourly revenue for the proposed final scope.' },
  { id: 'choice', dimension: 'economics', description: 'Chooses a feasible paid, declined, exchanged or deliberately bounded goodwill option.' },
  { id: 'acceptance', dimension: 'agreement', description: 'Relies on explicit client acceptance of an identified proposal version.' },
  { id: 'record', dimension: 'agreement', description: 'Records scope, total fee and delivery day, including unchanged terms.' },
  { id: 'capacity', dimension: 'feasibility', description: 'Commitment fits remaining capacity and any hard launch constraint.' },
  { id: 'dependencies', dimension: 'feasibility', description: 'Conditions delivery on unresolved content, access and approval dependencies.' },
];

/** Consume validated, version-bound evidence from a server adapter, never raw model scores.
 * Null means insufficient evidence; this pedagogic rubric is not a business metric.
 */
export function evaluate(observations: Observation[], validEventIds: readonly string[]) {
  const seen = new Set<string>();
  const valid = new Set(validEventIds);
  for (const item of observations) {
    const criterion = criteria.find(c => c.id === item.criterionId);
    if (!criterion || criterion.dimension !== item.dimension) throw new Error('Unknown criterion');
    if (seen.has(item.criterionId)) throw new Error('Duplicate criterion');
    seen.add(item.criterionId);
    if (!['met', 'missed', 'not-observed', 'not-applicable'].includes(item.status)) throw new Error('Invalid status');
    if (!item.explanation.trim() || !item.advice.trim()) throw new Error('Missing rationale');
    if (item.status !== 'not-observed' && (!item.evidence.length || item.evidence.some(e => !valid.has(e.eventId) || !e.quote.trim()))) {
      throw new Error('Missing verifiable evidence');
    }
  }
  const scores = Object.fromEntries(dimensions.map(dimension => {
    const relevant = criteria.filter(c => c.dimension === dimension);
    const entries = relevant.map(c => observations.find(o => o.criterionId === c.id));
    const applicable = entries.filter(o => o?.status !== 'not-applicable');
    const complete = applicable.every(o => o && o.status !== 'not-observed');
    return [dimension, {
      earned: entries.filter(o => o?.status === 'met').length,
      possible: applicable.length,
      score: complete && applicable.length ? entries.filter(o => o?.status === 'met').length / applicable.length * 4 : null,
      coverage: entries.filter(o => o && o.status !== 'not-observed').length,
    }];
  }));
  return {
    rubricVersion: '0.1', scores,
    strengths: observations.filter(o => o.status === 'met'),
    mistakes: observations.filter(o => o.status === 'missed'),
    unassessed: criteria.filter(c => !observations.some(o => o.criterionId === c.id && o.status !== 'not-observed')),
  };
}
