import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichImportedSquadPositions,
  makePositionKey,
} from '../src/playerPositions.js';

test('enrichImportedSquadPositions calls model for missing broad positions or Chinese names and caches result', async () => {
  const writes = [];
  const players = [
    { year: 2018, country: '阿根廷', name: 'Lionel Messi', pos: 'FW', positions: ['FW'] },
    { year: 2018, country: '阿根廷', name: 'Franco Armani', pos: 'GK', positions: ['GK'] },
    { year: 2018, country: '阿根廷', name: 'Sergio Aguero', nameZh: '塞尔吉奥·阿圭罗', pos: 'ST', positions: ['ST'] },
  ];

  const enriched = await enrichImportedSquadPositions({
    year: 2018,
    country: '阿根廷',
    players,
    overrides: {},
    saveOverrides: async (next) => writes.push(next),
    enrichFn: async ({ players: pending }) => ({
      players: pending.map((p) => ({
        name: p.name,
        nameZh: p.name.includes('Armani') ? '弗兰科·阿尔马尼' : '梅西',
        positions: p.name.includes('Armani') ? ['GK'] : ['RW', 'ST'],
      })),
    }),
  });

  assert.equal(enriched[0].pos, 'RW');
  assert.deepEqual(enriched[0].positions, ['RW', 'ST']);
  assert.equal(enriched[0].nameZh, '梅西');
  assert.equal(enriched[1].pos, 'GK');
  assert.equal(enriched[1].nameZh, '弗兰科·阿尔马尼');
  assert.equal(enriched[2].pos, 'ST');
  assert.equal(enriched[2].nameZh, '塞尔吉奥·阿圭罗');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][makePositionKey(2018, '阿根廷', 'Lionel Messi')].positions, ['RW', 'ST']);
  assert.deepEqual(writes[0][makePositionKey(2018, '阿根廷', 'Franco Armani')].positions, ['GK']);
});

test('enrichImportedSquadPositions falls back when model enrichment fails', async () => {
  const players = [
    { year: 2022, country: '西班牙', name: 'Pedri', pos: 'MF', positions: ['MF'] },
  ];

  const enriched = await enrichImportedSquadPositions({
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
