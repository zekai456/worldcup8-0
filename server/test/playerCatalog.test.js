import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSquadResponse,
  chooseRosterSource,
  normalizeCompletedDraft,
  normalizeFallbackPlayer,
} from '../src/playerCatalog.js';
import {
  applyPositionEnrichment,
  needsPositionEnrichment,
  normalizeDetailedPositions,
} from '../src/playerPositions.js';
import importedPlayers from '../data/importedPlayers.json' with { type: 'json' };

test('chooseRosterSource prefers imported rows over cache and llm', () => {
  const result = chooseRosterSource({
    imported: [{ name: 'A' }],
    cached: [{ name: 'B' }],
  });

  assert.equal(result.source, 'database');
  assert.equal(result.players[0].name, 'A');
});

test('buildSquadResponse returns structured ratings for imported players', () => {
  const result = buildSquadResponse({
    year: 2018,
    country: '法国',
    imported: [
      {
        name: 'L. Modric',
        pos: 'CM',
        overall: 91,
        pace: 70,
        shooting: 80,
        passing: 92,
        dribbling: 90,
        defending: 75,
        physical: 80,
      },
    ],
  });

  assert.equal(result.source, 'database');
  assert.equal(result.players[0].overall, 91);
  assert.equal(result.players[0].passing, 92);
});

test('buildSquadResponse preserves year-specific ratings and shirt numbers', () => {
  const result2014 = buildSquadResponse({
    year: 2014,
    country: '阿根廷',
    imported: [{ name: 'Lionel Messi', pos: 'FW', overall: 94, shirtNumber: 10 }],
  });
  const result2022 = buildSquadResponse({
    year: 2022,
    country: '阿根廷',
    imported: [{ name: 'Lionel Messi', pos: 'FW', overall: 91, shirtNumber: 10 }],
  });

  assert.equal(result2014.players[0].overall, 94);
  assert.equal(result2022.players[0].overall, 91);
  assert.equal(result2022.players[0].shirtNumber, 10);
});

test('normalizeFallbackPlayer preserves precise source positions with primary first', () => {
  const player = normalizeFallbackPlayer({
    name: 'Wide Forward',
    pos: 'RW',
    positions: ['RW', 'ST', 'LW', 'CAM'],
    ratingsSource: 'sofifa-players-21',
  });

  assert.equal(player.pos, 'RW');
  assert.deepEqual(player.positions, ['RW', 'ST']);
});

test('position enrichment replaces broad official positions with max two detailed roles', () => {
  const players = applyPositionEnrichment(
    [
      {
        year: 2018,
        country: '阿根廷',
        name: 'Gabriel Mercado',
        pos: 'DF',
        positions: ['DF'],
      },
    ],
    {
      '2018:阿根廷:Gabriel Mercado': {
        positions: ['RB', 'CB', 'LB'],
        nameZh: '加布里埃尔·梅尔卡多',
      },
    }
  );

  assert.equal(players[0].pos, 'RB');
  assert.deepEqual(players[0].positions, ['RB', 'CB']);
  assert.equal(players[0].nameZh, '加布里埃尔·梅尔卡多');
  assert.equal(players[0].positionSource, 'llm-position-enrichment');
});

test('position enrichment keeps existing detailed positions unchanged', () => {
  const player = {
    year: 2022,
    country: '法国',
    name: 'Kylian Mbappe',
    pos: 'LW',
    positions: ['LW', 'ST'],
    ratingsSource: 'sofifa-players-23',
  };

  assert.equal(needsPositionEnrichment(player), false);
  assert.deepEqual(applyPositionEnrichment([player], {})[0], player);
});

test('normalizeDetailedPositions filters broad and invalid model positions', () => {
  assert.deepEqual(normalizeDetailedPositions(['DF', 'RB', 'RWB', 'GOAT']), ['RB', 'RWB']);
  assert.deepEqual(normalizeDetailedPositions(['MF', 'CM', 'CAM', 'CDM']), ['CM', 'CAM']);
});

test('normalizeCompletedDraft keeps slot order and player snapshot', () => {
  const draft = normalizeCompletedDraft([
    {
      slotId: 'GK',
      pos: 'GK',
      year: 2014,
      country: '德国',
      player: { name: 'Neuer', overall: 92, shirtNumber: 1 },
    },
  ]);

  assert.equal(draft[0].slotId, 'GK');
  assert.equal(draft[0].player.name, 'Neuer');
  assert.equal(draft[0].player.shirtNumber, 1);
});

test('2018 Argentina imported source data still carries broad official buckets before enrichment', () => {
  const squad = importedPlayers.filter((p) => p.year === 2018 && p.country === '阿根廷');
  const nonBroad = squad.filter((p) => !['GK', 'DF', 'MF', 'FW'].includes(p.pos));

  assert.equal(nonBroad.length, 0);
  assert.ok(squad.some((p) => p.name === 'Gabriel Mercado' && p.pos === 'DF'));
  assert.ok(squad.some((p) => p.name === 'Lionel Messi' && p.pos === 'FW'));
});
