import test from 'node:test';
import assert from 'node:assert/strict';
import buildStages from '../src/utils/grabFunnelChart.js';

test('real aggregate uses the same linear scale for all four stage widths', () => {
  const values = [208420, 13329, 5344, 2247];
  const stages = buildStages({ reach: values[0], visits: values[1], baskets: values[2], checkouts: values[3] });
  assert.equal(stages[0].widthPercent, 100);
  assert.equal(Number(stages[1].widthPercent.toFixed(2)), 6.4);
  for (let i = 1; i < stages.length; i++) {
    assert.ok(Math.abs(stages[i].widthPercent / stages[0].widthPercent - values[i] / values[0]) < 1e-12);
    assert.equal(stages[i].sharePercent, values[i] / values[0] * 100);
  }
  assert.ok(stages[3].widthPercent < 1.079);
});

test('small Vietsing stages retain their true fractional widths without a minimum', () => {
  const stages = buildStages({ reach: 70520, visits: 1860, baskets: 507, checkouts: 171 });
  assert.ok(stages[3].widthPercent < .25);
  assert.equal(stages[3].widthPercent, 171 / 70520 * 100);
});

test('zero values draw no filled area and an empty baseline has no percentage', () => {
  assert.ok(buildStages({}).every(stage => stage.widthPercent === 0 && stage.sharePercent === null));
  const stages = buildStages({ reach: 1000, visits: 0, baskets: 0, checkouts: 0 });
  assert.equal(stages[1].widthPercent, 0);
  assert.equal(stages[1].sharePercent, 0);
});

test('an unusual non-monotonic source is shown without clipping or invented taper', () => {
  const stages = buildStages({ reach: 10, visits: 20, baskets: 2, checkouts: 1 });
  assert.equal(stages[0].widthPercent, 50);
  assert.equal(stages[1].widthPercent, 100);
  assert.equal(stages[1].sharePercent, 200);
});
