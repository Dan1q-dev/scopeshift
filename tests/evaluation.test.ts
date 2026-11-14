import { test } from 'vitest';
import assert from 'node:assert/strict';
import { evaluate, criteria } from '../src/lib/evaluation/index';
import type { Observation } from '../src/lib/evaluation/index';

const observation = (index: number, status: Observation['status'] = 'met'): Observation => ({
  dimension: criteria[index].dimension, criterionId: criteria[index].id, status,
  evidence: [{ eventId: 'e1', quote: 'Reviewed the proposed scope and impact' }],
  explanation: 'Validated fixture evidence for scoring mechanics; not a transcript entailment test.',
  advice: 'Keep the agreed scope and its calculated impact in the written amendment.',
});
test('empty logs remain unassessed', () => {
  const result = evaluate([], []);
  assert.equal(result.unassessed.length, 10);
  for (const score of Object.values(result.scores)) assert.equal(score.score, null);
});
test('identical evidence produces identical evaluation', () => {
  const evidence = criteria.map((_, i) => observation(i));
  assert.deepEqual(evaluate(evidence, ['e1']), evaluate(evidence, ['e1']));
  for (const score of Object.values(evaluate(evidence, ['e1']).scores)) assert.equal(score.score, 4);
});
test('partial evidence cannot imply full dimension score', () => {
  assert.equal(evaluate([observation(0)], ['e1']).scores.clarification.score, null);
});
test('one missed criterion yields two of four with evidence', () => {
  const result = evaluate([observation(0), observation(1, 'missed')], ['e1']);
  assert.equal(result.scores.clarification.score, 2);
  assert.equal(result.mistakes[0].evidence[0].eventId, 'e1');
});
test('documented decline may make acceptance inapplicable', () => {
  const result = evaluate([observation(6, 'not-applicable'), observation(7)], ['e1']);
  assert.equal(result.scores.agreement.score, 4);
});
test('unknown events, duplicate criteria and mismatched dimensions fail closed', () => {
  assert.throws(() => evaluate([observation(0)], []), /evidence/);
  assert.throws(() => evaluate([observation(0), observation(0)], ['e1']), /Duplicate/);
  assert.throws(() => evaluate([{ ...observation(0), dimension: 'scope' }], ['e1']), /Unknown/);
});
test('inapplicability also needs evidence', () => {
  assert.throws(() => evaluate([{ ...observation(0, 'not-applicable'), evidence: [] }], ['e1']), /evidence/);
});
