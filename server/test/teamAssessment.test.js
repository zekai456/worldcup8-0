import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessTeam,
  difficultyForRound,
} from '../src/teamAssessment.js';

function cell(pos, rating, positions = [pos], name = `${pos}-${rating}`) {
  return {
    pos,
    slotId: pos,
    outOfPosition: !positions.includes(pos),
    player: { name, pos: positions[0], positions, overall: rating },
  };
}

test('assessTeam rates elite balanced lineups as title caliber', () => {
  const squad = [
    cell('GK', 93),
    cell('LB', 90),
    cell('CB', 92),
    cell('CB', 91),
    cell('RB', 90),
    cell('CDM', 91),
    cell('CM', 92),
    cell('CAM', 93),
    cell('LW', 94),
    cell('ST', 95),
    cell('RW', 93),
  ];

  const report = assessTeam({ round: 8, squad });

  assert.ok(report.overallScore >= 88);
  assert.equal(report.tier, 'title_caliber');
  assert.equal(report.canWinWorldCup, true);
});

test('assessTeam punishes weak fit even with famous attackers', () => {
  const squad = [
    cell('GK', 72),
    cell('LB', 88, ['ST']),
    cell('CB', 88, ['ST']),
    cell('CB', 86, ['CAM']),
    cell('RB', 85, ['LW']),
    cell('CDM', 76, ['LW']),
    cell('CM', 78, ['ST']),
    cell('CAM', 92),
    cell('LW', 94),
    cell('ST', 95),
    cell('RW', 93),
  ];

  const report = assessTeam({ round: 8, squad });

  assert.ok(report.overallScore < 72);
  assert.equal(report.canWinWorldCup, false);
  assert.ok(report.weaknesses.some((w) => /错位|门将|防线/.test(w)));
});

test('difficultyForRound gets strict from knockouts to final', () => {
  assert.ok(difficultyForRound(1).requiredScore < difficultyForRound(4).requiredScore);
  assert.ok(difficultyForRound(4).requiredScore < difficultyForRound(8).requiredScore);
  assert.equal(difficultyForRound(8).stageName, '决赛');
});

test('assessTeam uses substitutes as bench depth and position coverage', () => {
  const starters = [
    cell('GK', 90),
    cell('LB', 84),
    cell('CB', 86),
    cell('CB', 86),
    cell('RB', 84),
    cell('CDM', 84),
    cell('CM', 84),
    cell('CAM', 86),
    cell('LW', 87),
    cell('ST', 88),
    cell('RW', 87),
  ];
  const reportWithoutBench = assessTeam({ round: 8, squad: starters, bench: [] });
  const reportWithBench = assessTeam({
    round: 8,
    squad: starters,
    bench: [
      cell('BENCH_1', 92, ['CB', 'CDM'], 'bench-def-mid'),
      cell('BENCH_2', 91, ['ST', 'LW'], 'bench-att'),
    ],
  });

  assert.ok(reportWithBench.benchScore > reportWithoutBench.benchScore);
  assert.ok(reportWithBench.overallScore > reportWithoutBench.overallScore);
  assert.ok(reportWithBench.strengths.some((w) => /替补|板凳|覆盖/.test(w)));
});
