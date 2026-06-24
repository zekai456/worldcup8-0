import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGameMode,
  playerStatSummary,
  shouldHidePlayerStats,
} from './gameModes.js';

test('expert mode hides player stats during draft', () => {
  assert.equal(shouldHidePlayerStats('expert'), true);
  assert.equal(shouldHidePlayerStats('classic'), false);
  assert.equal(shouldHidePlayerStats('unknown'), false);
});

test('normalizeGameMode falls back to classic', () => {
  assert.equal(normalizeGameMode('expert'), 'expert');
  assert.equal(normalizeGameMode('wat'), 'classic');
});

test('playerStatSummary includes all six outfield stats', () => {
  assert.equal(
    playerStatSummary({ pace: 90, shooting: 88, passing: 84, dribbling: 91, defending: 40, physical: 75 }),
    '速90 射88 传84 盘91 防40 体75'
  );
});
