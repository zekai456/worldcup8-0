import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickSpinResult,
  windowImportedEditions,
} from '../src/routes.js';

const editions = [
  { year: 1930, host: '乌拉圭', teams: ['阿根廷', '巴西'] },
  { year: 2002, host: '韩国/日本', teams: ['巴西', '德国'] },
  { year: 2018, host: '俄罗斯', teams: ['法国', '阿根廷'] },
];

test('windowImportedEditions returns an empty list for empty era windows', () => {
  const result = windowImportedEditions(editions, 1940, 1949);

  assert.deepEqual(result, []);
});

test('pickSpinResult returns null instead of escaping an empty era window', () => {
  const result = pickSpinResult({
    editions,
    minYear: 1940,
    maxYear: 1949,
    centerYear: 1945,
  });

  assert.equal(result, null);
});

test('pickSpinResult rerolls another in-window country when locked country has no in-window edition', () => {
  const result = pickSpinResult({
    editions,
    minYear: 1930,
    maxYear: 1930,
    centerYear: 1930,
    lockCountry: '法国',
  });

  assert.equal(result.year, 1930);
  assert.ok(['阿根廷', '巴西'].includes(result.country));
});
