import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAppearanceEnrichment,
  enrichImportedSquadAppearances,
  makeAppearanceKey,
  normalizeAppearanceOverride,
} from '../src/playerAppearances.js';

test('applyAppearanceEnrichment keeps same player year ratings separate', () => {
  const players = [
    { year: 2014, country: '阿根廷', name: 'Lionel Messi', pos: 'FW', overall: 93 },
    { year: 2022, country: '阿根廷', name: 'Lionel Messi', pos: 'FW', overall: 93 },
  ];

  const enriched = applyAppearanceEnrichment(players, {
    [makeAppearanceKey(2014, '阿根廷', 'Lionel Messi')]: { overall: 94, shirtNumber: 10, nameZh: '梅西' },
    [makeAppearanceKey(2022, '阿根廷', 'Lionel Messi')]: { overall: 91, shirtNumber: 10, nameZh: '梅西' },
  });

  assert.equal(enriched[0].overall, 94);
  assert.equal(enriched[0].rating, 94);
  assert.equal(enriched[1].overall, 91);
  assert.equal(enriched[1].rating, 91);
  assert.equal(enriched[1].shirtNumber, 10);
});

test('normalizeAppearanceOverride rejects impossible numbers and ratings', () => {
  assert.deepEqual(
    normalizeAppearanceOverride({ overall: 120, shirtNumber: 0, nameZh: '测试' }),
    { nameZh: '测试' }
  );
  assert.deepEqual(
    normalizeAppearanceOverride({ rating: 87, number: 7 }),
    { overall: 87, shirtNumber: 7 }
  );
});

test('enrichImportedSquadAppearances calls model for missing or repeated appearance data', async () => {
  const writes = [];
  const players = [
    { year: 2014, country: '阿根廷', name: 'Lionel Messi', pos: 'FW', overall: 93 },
    { year: 2022, country: '阿根廷', name: 'Lionel Messi', pos: 'FW', overall: 93 },
  ];

  const enriched = await enrichImportedSquadAppearances({
    year: 2022,
    country: '阿根廷',
    players,
    overrides: {},
    saveOverrides: async (next) => writes.push(next),
    enrichFn: async ({ players: pending }) => ({
      players: pending.map((p) => ({
        name: p.name,
        year: p.year,
        country: p.country,
        nameZh: '梅西',
        shirtNumber: 10,
        overall: p.year === 2014 ? 94 : 91,
      })),
    }),
  });

  assert.equal(enriched[0].overall, 94);
  assert.equal(enriched[1].overall, 91);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][makeAppearanceKey(2022, '阿根廷', 'Lionel Messi')].overall, 91);
});

test('enrichImportedSquadAppearances falls back when model output cannot be used', async () => {
  const players = [
    { year: 2022, country: '西班牙', name: 'Pedri', pos: 'CM', overall: 85 },
  ];

  const enriched = await enrichImportedSquadAppearances({
    year: 2022,
    country: '西班牙',
    players,
    overrides: {},
    saveOverrides: async () => {
      throw new Error('should not write');
    },
    enrichFn: async () => {
      throw new Error('Expected "," after array element in JSON');
    },
  });

  assert.deepEqual(enriched, players);
});
