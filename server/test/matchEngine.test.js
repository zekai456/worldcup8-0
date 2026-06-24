import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetailedStats,
  normalizeMatchResult,
  stripScoreMentions,
} from '../src/matchEngine.js';
import { stageByMatchday } from '../src/tournament.js';

test('stageByMatchday follows the 2026 World Cup eight-match champion path', () => {
  assert.equal(stageByMatchday(1).name, '小组赛第1场');
  assert.equal(stageByMatchday(3).name, '小组赛第3场');
  assert.equal(stageByMatchday(4).name, '32强');
  assert.equal(stageByMatchday(8).name, '决赛');
  assert.equal(stageByMatchday(8).total, 8);
});

test('normalizeMatchResult anchors every highlight to a canonical score timeline', () => {
  const result = normalizeMatchResult({
    round: 4,
    raw: {
      score: { player: 3, opponent: 2 },
      winner: 'player',
      highlights: [
        { phase: 'first_half', minute: 18, text: '对手先进一个，比分0-1！' },
        { phase: 'first_half', minute: 37, text: '我们扳平，比分1-1。' },
      ],
      match_flow: '边路打开局面',
    },
  });

  assert.equal(result.stage.name, '32强');
  assert.deepEqual(result.score, { player: 3, opponent: 2 });
  assert.equal(result.highlights.length, 5);
  assert.deepEqual(result.highlights.at(-1).scoreAfter, { player: 3, opponent: 2 });
  assert.equal(result.highlights.some((h) => /\d+\s*[-:：比]\s*\d+/.test(h.text)), false);
});

test('normalizeMatchResult never invents impossible intermediate goals for low scores', () => {
  const result = normalizeMatchResult({
    round: 1,
    raw: {
      score: { player: 1, opponent: 0 },
      winner: 'player',
      highlights: [{ text: '僵持之后终于破门，比分1-0。' }],
    },
  });

  assert.deepEqual(result.highlights.map((h) => h.scoreAfter), [
    { player: 1, opponent: 0 },
  ]);
});

test('normalizeMatchResult aligns scoreAfter with narrated opponent goals', () => {
  const result = normalizeMatchResult({
    round: 4,
    opponentCountry: '法国',
    raw: {
      score: { player: 2, opponent: 3 },
      winner: 'opponent',
      highlights: [
        { phase: 'first_half', text: '法国队边路传中，格列兹曼抢点破门。' },
        { phase: 'second_half', text: '我的梦之队终于靠梅西打穿肋部。' },
      ],
    },
  });

  assert.deepEqual(result.highlights[0].scoreAfter, { player: 0, opponent: 1 });
  assert.equal(result.highlights[0].scorer, 'opponent');
  assert.deepEqual(result.highlights[1].scoreAfter, { player: 1, opponent: 1 });
});

test('normalizeMatchResult emits one score node per goal for high-scoring matches', () => {
  const result = normalizeMatchResult({
    round: 4,
    raw: {
      score: { player: 3, opponent: 4 },
      winner: 'opponent',
      highlights: [{ text: '比赛持续拉锯。' }],
    },
  });

  assert.equal(result.highlights.length, 7);
  for (let i = 1; i < result.highlights.length; i++) {
    const prev = result.highlights[i - 1].scoreAfter;
    const next = result.highlights[i].scoreAfter;
    assert.equal((next.player - prev.player) + (next.opponent - prev.opponent), 1);
  }
  assert.deepEqual(result.highlights.at(-1).scoreAfter, { player: 3, opponent: 4 });
});

test('normalizeMatchResult does not force ordinary matches into late winners', () => {
  const result = normalizeMatchResult({
    round: 4,
    raw: {
      score: { player: 2, opponent: 1 },
      winner: 'player',
      decided_by: 'regular',
      highlights: [
        { text: '中场连续传递后打穿肋部。' },
        { text: '对手利用定位球制造混乱。' },
        { text: '边路套上传中终于形成致命一击。' },
      ],
    },
  });

  assert.ok(result.highlights.at(-1).minute <= 82);
});

test('normalizeMatchResult does not expose canned fallback commentary when model gives fewer lines than goals', () => {
  const result = normalizeMatchResult({
    round: 4,
    raw: {
      score: { player: 3, opponent: 2 },
      winner: 'player',
      highlights: [
        { text: '梅西右路内切吸引两人后送出直塞，劳塔罗前插低射破门。' },
      ],
    },
  });

  assert.equal(result.highlights.length, 5);
  assert.equal(
    result.highlights.some((h) => /双方在中前场反复试探|换边之后空间被拉开|终场前最后一波/.test(h.text)),
    false
  );
  assert.ok(new Set(result.highlights.map((h) => h.text)).size > 1);
});

test('normalizeMatchResult returns a clear generation failure instead of canned commentary with no highlights', () => {
  assert.throws(
    () => normalizeMatchResult({
      round: 4,
      raw: {
        score: { player: 2, opponent: 1 },
        winner: 'player',
        highlights: [],
      },
    }),
    /match commentary missing/
  );
});

test('stripScoreMentions removes textual score claims from commentary', () => {
  assert.equal(
    stripScoreMentions('梅西破门，比分来到2-1！法国队2:2追平又被改写。'),
    '梅西破门，法国队追平又被改写。'
  );
});

test('normalizeMatchResult exposes score-aware broadcast lines and deeper match stats', () => {
  const result = normalizeMatchResult({
    round: 6,
    opponentCountry: '法国',
    raw: {
      score: { player: 2, opponent: 1 },
      winner: 'player',
      highlights: [
        { scorer: 'player', text: '齐达内被贴身压迫后回传失误，梅西拿球立刻提速。' },
        { text: '法国队用边路速度打到身后，门将第一下扑救没能解围。' },
        { text: '罗纳尔多在禁区线附近抗住中卫，转身抽射完成致命一击。' },
      ],
      stats: { possession: { player: 57, opponent: 43 }, shots: { player: 15, opponent: 9 } },
    },
  });

  const goalLines = result.broadcast.filter((line) => line.kind === 'goal');
  assert.ok(result.broadcast.length >= 8);
  assert.equal(goalLines[0].scoreText, '1:0');
  assert.match(goalLines[0].text, /比分来到1:0/);
  assert.equal(result.stats.possession.player, 57);
  assert.ok(result.stats.xg.player > result.stats.xg.opponent);
  assert.ok(result.stats.corners.player >= 0);
  assert.equal(result.stats.discipline.yellowCards.player >= 0, true);
});

test('buildDetailedStats gives plausible advantage to the winning side without erasing opponent data', () => {
  const stats = buildDetailedStats({ score: { player: 1, opponent: 3 }, winner: 'opponent' });

  assert.ok(stats.shots.opponent > stats.shots.player);
  assert.ok(stats.xg.opponent > stats.xg.player);
  assert.equal(stats.possession.player + stats.possession.opponent, 100);
  assert.ok(stats.saves.player > 0);
  assert.ok(stats.attacks.opponent > stats.attacks.player);
});

test('normalizeMatchResult keeps non-goal commentary without changing the score', () => {
  const result = normalizeMatchResult({
    round: 7,
    opponentCountry: '法国',
    raw: {
      score: { player: 2, opponent: 1 },
      winner: 'player',
      highlights: [
        { phase: 'first_half', minute: 4, scorer: 'none', text: '开场两队都把阵型压得很窄，梅西回撤到中线附近接球，法国队后腰没有贸然上抢。' },
        { phase: 'first_half', minute: 18, scorer: 'player', text: '梅西斜塞右肋，罗纳尔多第一脚停球把中卫带开，随后低射破门。' },
        { phase: 'first_half', minute: 31, scorer: 'none', text: '法国队连续三次从左路打身后，但诺伊尔出击范围很大，把第二点直接摘走。' },
        { phase: 'second_half', minute: 56, scorer: 'opponent', text: '法国队边路速度终于打穿防线，倒三角传中后中路包抄得手。' },
        { phase: 'second_half', minute: 74, scorer: 'none', text: '齐达内和哈维在中圈附近连续换位，梦之队开始把节奏重新拉慢。' },
        { phase: 'climax', minute: 88, scorer: 'player', text: '最后阶段罗纳尔多抗住中卫，回做给插上的梅西，禁区线前一脚推射压进死角。' },
      ],
    },
  });

  assert.ok(result.broadcast.length >= 8);
  const goalLines = result.broadcast.filter((line) => line.kind === 'goal');
  assert.deepEqual(result.broadcast[0].scoreAfter, { player: 0, opponent: 0 });
  assert.deepEqual(goalLines[0].scoreAfter, { player: 1, opponent: 0 });
  assert.deepEqual(result.broadcast.find((line) => line.text.includes('诺伊尔出击范围很大')).scoreAfter, { player: 1, opponent: 0 });
  assert.deepEqual(result.broadcast.at(-1).scoreAfter, { player: 2, opponent: 1 });
  assert.equal(result.broadcast.filter((h) => h.kind === 'goal' && h.scorer === 'player').length, 2);
  assert.equal(result.broadcast.filter((h) => h.kind === 'goal' && h.scorer === 'opponent').length, 1);
});

test('normalizeMatchResult produces a canonical recap that cannot contradict the score', () => {
  const result = normalizeMatchResult({
    round: 8,
    raw: {
      score: { player: 1, opponent: 3 },
      winner: 'opponent',
      match_flow: '梦之队3-0大胜，完全压制。',
      highlights: [
        { scorer: 'opponent', text: '对手利用角球先声夺人。' },
        { scorer: 'player', text: '梦之队依靠中路撞墙扳回一城。' },
        { scorer: 'opponent', text: '对手反击扩大优势。' },
        { scorer: 'opponent', text: '补时阶段对手再入一球。' },
      ],
    },
  });

  assert.equal(result.recap.scoreline, '我的梦之队 1:3 对手');
  assert.match(result.recap.verdict, /失利/);
  assert.doesNotMatch(result.recap.summary, /3-0|大胜|完全压制/);
});
