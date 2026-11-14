// Integrate with the actual repo's Vitest configuration; no dependency installed here.
import { describe, it, expect } from 'vitest';
import { evaluate, criteria } from '../src/lib/evaluation/index';
import type { Observation } from '../src/lib/evaluation/index';

describe('transparent evaluation adapter contract', () => {
  it('does not issue scores for missing observations', () => {
    expect(Object.values(evaluate([], []).scores).every(s => s.score === null)).toBe(true);
  });
  it('is stable for complete evidence and rejects an unknown event', () => {
    const observations: Observation[] = criteria.map(c => ({
      dimension: c.dimension, criterionId: c.id, status: 'met',
      evidence: [{ eventId: 'fixture-accepted', quote: 'Fixture: validated accepted amendment' }],
      explanation: 'Fixture validates aggregation, not evidence extraction.',
      advice: 'Retain the written amendment for replay.',
    }));
    expect(evaluate(observations, ['fixture-accepted'])).toEqual(evaluate(observations, ['fixture-accepted']));
    expect(() => evaluate(observations, [])).toThrow('Missing verifiable evidence');
  });
});
