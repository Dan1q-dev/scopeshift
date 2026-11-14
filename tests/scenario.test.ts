import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scenario = JSON.parse(readFileSync(new URL('../docs/design-drafts/website-project.json', import.meta.url), 'utf8'));
test('baseline effort sums to contract and identifiers are unique', () => {
  const contract = scenario.learnerVisible.initialContract;
  assert.equal(contract.scope.reduce((sum: number, item: {minutes: number}) => sum + item.minutes, 0), contract.estimatedMinutes);
  const ids = [...contract.scope.map((s: {id: string}) => s.id), ...scenario.requests.flatMap((r: {options: {id: string}[]}) => r.options.map(o => o.id))];
  assert.equal(new Set(ids).size, ids.length);
});
test('all first-request arithmetic examples are reproducible from catalog effort', () => {
  const contract = scenario.learnerVisible.initialContract;
  const request = scenario.requests[0];
  for (const example of request.exampleAgreements) {
    const minutes = contract.estimatedMinutes
      + example.addedOptionIds.reduce((sum: number, id: string) => sum + request.options.find((o: {id: string}) => o.id === id).incrementalMinutes, 0)
      - example.removedScopeIds.reduce((sum: number, id: string) => sum + contract.scope.find((o: {id: string}) => o.id === id).minutes, 0);
    assert.equal(minutes, example.resultFromBaseline.minutes);
    assert.equal(contract.feeCents + example.feeDeltaCents, example.resultFromBaseline.feeCents);
    assert.equal(example.resultFromBaseline.feeCents / 100 / (minutes / 60), example.resultFromBaseline.rateUSDPerHour);
    assert.ok(minutes <= example.deliveryDay * scenario.learnerVisible.capacity.minutesPerDay);
  }
});
test('sequential paid path remains within total budget and day-7 capacity', () => {
  const r1 = scenario.requests[0].exampleAgreements[0];
  const r2 = scenario.requests[1].exampleAgreements[0];
  const result = r2.resultAfterPaidR1;
  assert.equal(r1.resultFromBaseline.feeCents + r2.feeDeltaCents, result.feeCents);
  assert.equal(r1.resultFromBaseline.minutes + scenario.requests[1].options[0].incrementalMinutes, result.minutes);
  assert.equal(result.feeCents / 100 / (result.minutes / 60), result.rateUSDPerHour);
  assert.ok(result.feeCents - 150000 <= scenario.serverOnly.additionalBudgetCents);
  assert.ok(result.minutes <= 7 * 240);
  assert.ok(result.minutes > 5 * 240);
});
