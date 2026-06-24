import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAMPION_TEAMS,
  GROUP_STAGE_MATCHDAYS,
  KNOCKOUT_STAGES,
  WORLD_CUP_2026_PATH,
  pickChampionOpponent,
  stageByMatchday,
} from '../src/tournament.js';

test('2026 challenge path is three group matches plus five knockouts', () => {
  assert.equal(WORLD_CUP_2026_PATH.length, 8);
  assert.deepEqual(GROUP_STAGE_MATCHDAYS.map((s) => s.name), [
    '小组赛第1场',
    '小组赛第2场',
    '小组赛第3场',
  ]);
  assert.deepEqual(KNOCKOUT_STAGES.map((s) => s.name), [
    '32强',
    '16强',
    '8强',
    '半决赛',
    '决赛',
  ]);
  assert.equal(stageByMatchday(99).name, '决赛');
});

test('champion opponent pool follows historical World Cup winners', () => {
  assert.deepEqual(CHAMPION_TEAMS.slice(0, 3).map((team) => `${team.year}-${team.country}`), [
    '1930-乌拉圭',
    '1934-意大利',
    '1938-意大利',
  ]);
  assert.ok(CHAMPION_TEAMS.some((team) => team.year === 2022 && team.country === '阿根廷'));
});

test('pickChampionOpponent returns only champion teams and varies by round', () => {
  const groupOpponent = pickChampionOpponent(1, { seed: 0 });
  const finalOpponent = pickChampionOpponent(8, { seed: 0 });

  assert.equal(groupOpponent.champion, true);
  assert.equal(finalOpponent.champion, true);
  assert.ok(CHAMPION_TEAMS.some((team) => team.year === groupOpponent.year && team.country === groupOpponent.country));
  assert.ok(CHAMPION_TEAMS.some((team) => team.year === finalOpponent.year && team.country === finalOpponent.country));
  assert.ok(finalOpponent.year >= groupOpponent.year);
});
