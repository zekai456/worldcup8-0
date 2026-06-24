import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAwards,
  championOpponentsForGroup,
  createTournamentState,
  fixtureForMatchday,
  groupStandings,
  loadTournamentState,
  recordMatch,
  saveTournamentState,
  TOURNAMENT_STORAGE_KEY,
  TOURNAMENT_STATE_VERSION,
  updateKnockoutFixture,
} from './tournamentState.js';

test('createTournamentState builds group fixtures and knockout bracket placeholders', () => {
  const state = createTournamentState({ groupOpponents: ['法国', '巴西', '德国'] });

  assert.equal(state.fixtures.length, 11);
  assert.equal(fixtureForMatchday(state, 1).away, '法国');
  assert.equal(fixtureForMatchday(state, 4).stage, '32强');
});

test('groupStandings ranks by points and goal difference', () => {
  let state = createTournamentState({ groupOpponents: ['法国', '巴西', '德国'] });
  state = recordMatch(state, { id: 'a', matchday: 1, home: '我的梦之队', away: '法国', score: { home: 2, away: 1 } });
  state = recordMatch(state, { id: 'b', matchday: 1, home: '巴西', away: '德国', score: { home: 0, away: 3 } });

  const table = groupStandings(state);

  assert.equal(table[0].team, '德国');
  assert.equal(table.find((r) => r.team === '我的梦之队').pts, 3);
});

test('buildAwards reveals awards from final squad and tournament state', () => {
  const state = recordMatch(createTournamentState(), {
    id: 'final',
    matchday: 8,
    home: '我的梦之队',
    away: '法国',
    score: { home: 3, away: 2 },
  });
  const awards = buildAwards({
    state,
    squad: [
      { pos: 'GK', player: { nameZh: '诺伊尔', overall: 92 } },
      { pos: 'ST', player: { nameZh: '罗纳尔多', overall: 96 } },
    ],
  });

  assert.equal(awards.goldenBall.winner, '罗纳尔多');
  assert.equal(awards.goldenGlove.winner, '诺伊尔');
  assert.ok(awards.goldenBoot.winner);
  assert.ok(Array.isArray(awards.teamOfTournament));
});

test('buildAwards includes rival awards and achievement-style campaign honors', () => {
  let state = createTournamentState({ groupOpponents: ['法国', '巴西', '德国'] });
  state = recordMatch(state, {
    id: 'g1-player',
    matchday: 1,
    home: '我的梦之队',
    away: '法国',
    score: { home: 1, away: 3, player: 1, opponent: 3 },
    stats: { shots: { player: 8, opponent: 17 }, possession: { player: 43, opponent: 57 } },
  });
  state = recordMatch(state, {
    id: 'g1-other',
    matchday: 1,
    home: '巴西',
    away: '德国',
    score: { home: 4, away: 2 },
    keyPlayers: ['内马尔'],
  });

  const awards = buildAwards({
    state,
    squad: [
      { pos: 'GK', player: { nameZh: '诺伊尔', overall: 92 } },
      { pos: 'ST', player: { nameZh: '罗纳尔多', overall: 96 } },
    ],
  });

  assert.notEqual(awards.goldenBoot.team, '我的梦之队');
  assert.ok(awards.rivalStar.winner);
  assert.ok(awards.achievementBadges.length >= 4);
  assert.ok(awards.technicalSummary.length >= 4);
});

test('updateKnockoutFixture replaces待定 opponent without losing recorded matches', () => {
  let state = createTournamentState({ groupOpponents: ['法国', '巴西', '德国'] });
  state = recordMatch(state, {
    id: 'ko-4',
    matchday: 4,
    home: '我的梦之队',
    away: '葡萄牙',
    score: { home: 2, away: 1 },
  });

  const next = updateKnockoutFixture(state, 5, { country: '阿根廷', year: 2026 });

  assert.equal(fixtureForMatchday(next, 5).away, '阿根廷');
  assert.equal(fixtureForMatchday(next, 5).opponentYear, 2026);
  assert.equal(next.matches.length, 1);
});

test('championOpponentsForGroup gives three historical champion opponents', () => {
  const opponents = championOpponentsForGroup();

  assert.equal(opponents.length, 3);
  assert.deepEqual(opponents.map((team) => team.champion), [true, true, true]);
  assert.ok(opponents.every((team) => team.year && team.country));
});

test('loadTournamentState ignores stale stored tournament versions', () => {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };

  store.set(TOURNAMENT_STORAGE_KEY, JSON.stringify({ playerTeam: '旧梦之队', fixtures: [], matches: [] }));
  assert.equal(loadTournamentState(), null);

  const state = createTournamentState({ groupOpponents: ['法国', '巴西', '德国'] });
  saveTournamentState(state);
  assert.equal(loadTournamentState().version, TOURNAMENT_STATE_VERSION);

  delete global.window;
});
