import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, DEFAULTS, calculateRisk, rankMaterials, contributions } from './model.js';

test('reference inputs contribute zero; baseline is the illustrative material weight', () => {
  const env = { oxygen: 21, pressure: 4.3, airflow: 0 };
  assert.deepEqual(contributions(env), { oxygen: 0, pressure: 0, airflow: 0 });
  MATERIALS.forEach(m => assert.equal(calculateRisk(m, env).score, m.base));
});
test('default scenario has deterministic ranking and saturation', () => {
  const result = rankMaterials(DEFAULTS);
  assert.deepEqual(result.map(m => m.score), [98, 85, 65, 38]);
  assert.equal(result[0].id, 'pmma');
  assert.equal(calculateRisk(MATERIALS[1], { oxygen: 100, pressure: 14.7, airflow: 20 }).score, 100);
});
test('all control extremes produce bounded scores and consistent categories', () => {
  for (const oxygen of [21, 100]) for (const pressure of [4.3, 14.7]) for (const airflow of [0, 20]) {
    rankMaterials({ oxygen, pressure, airflow }).forEach(m => {
      assert.ok(m.score >= 0 && m.score <= 100);
      assert.equal(m.level, m.score >= 70 ? 'High' : m.score >= 40 ? 'Moderate' : 'Low');
    });
  }
});
