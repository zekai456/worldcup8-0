import { positionMatches } from './formations.js';
import { stageByMatchday } from './tournament.js';

const LINE_BY_POS = {
  GK: 'goalkeeper',
  LB: 'defense',
  RB: 'defense',
  CB: 'defense',
  LWB: 'defense',
  RWB: 'defense',
  CDM: 'midfield',
  CM: 'midfield',
  LM: 'midfield',
  RM: 'midfield',
  CAM: 'midfield',
  LW: 'attack',
  RW: 'attack',
  ST: 'attack',
};

export function difficultyForRound(round = 1) {
  const stage = stageByMatchday(round);
  const requiredByRound = {
    1: 72,
    2: 74,
    3: 76,
    4: 80,
    5: 83,
    6: 86,
    7: 88,
    8: 90,
  };
  return {
    round: Number(round) || 1,
    stageName: stage.name,
    requiredScore: requiredByRound[Number(round)] || 90,
  };
}

export function assessTeam({ round = 1, squad = [], bench = [] }) {
  const difficulty = difficultyForRound(round);
  const rows = (Array.isArray(squad) ? squad : []).map(normalizeCell);
  const benchRows = (Array.isArray(bench) ? bench : []).map((cell) => normalizeCell({ ...cell, pos: cell.pos || cell.slot || 'BENCH' }));
  const averageRating = average(rows.map((r) => r.rating).filter((n) => n !== null));
  const fitScore = average(rows.map((r) => r.fitScore));
  const lineScores = scoreLines(rows);
  const balanceScore = scoreBalance(lineScores);
  const eraScore = scoreEraBlend(rows);
  const starScore = scoreStars(rows);
  const benchScore = scoreBenchDepth(benchRows, lineScores);
  const structuralPenalty = scoreStructuralPenalty({ rows, lineScores, difficulty });
  const overallScore = clamp(
    averageRating * 0.48 +
    fitScore * 0.2 +
    lineScores.defense * 0.12 +
    lineScores.midfield * 0.08 +
    lineScores.attack * 0.08 +
    balanceScore * 0.04 +
    eraScore * 0.03 +
    starScore * 0.03 -
    structuralPenalty +
    benchImpact(benchScore)
  );
  const weaknesses = buildWeaknesses({ rows, benchRows, averageRating, fitScore, lineScores, balanceScore, benchScore, difficulty });
  const strengths = buildStrengths({ rows, benchRows, averageRating, fitScore, lineScores, balanceScore, benchScore });
  const canWinWorldCup =
    overallScore >= difficulty.requiredScore &&
    lineScores.goalkeeper >= Math.max(72, difficulty.requiredScore - 14) &&
    lineScores.defense >= Math.max(76, difficulty.requiredScore - 10) &&
    fitScore >= 82 &&
    weaknesses.filter((w) => /灾难|严重|错位|门将|防线/.test(w)).length === 0;

  return {
    difficulty,
    averageRating: Math.round(averageRating),
    fitScore: Math.round(fitScore),
    lineScores: roundLineScores(lineScores),
    balanceScore: Math.round(balanceScore),
    benchScore: Math.round(benchScore),
    eraScore: Math.round(eraScore),
    starScore: Math.round(starScore),
    structuralPenalty: Math.round(structuralPenalty),
    overallScore: Math.round(overallScore),
    tier: tierForScore(overallScore, canWinWorldCup),
    canWinWorldCup,
    strengths,
    weaknesses,
    tacticalSummary: tacticalSummary({ overallScore, lineScores, fitScore, balanceScore, benchScore, canWinWorldCup }),
  };
}

export function judgeMatchup({ round = 1, assessment = null, opponent = null } = {}) {
  const report = assessment || assessTeam({ round, squad: [], bench: [] });
  const difficulty = report.difficulty || difficultyForRound(round);
  const opponentStrength = opponentDifficulty({ round, opponent, difficulty });
  const scoreDelta =
    report.overallScore -
    opponentStrength +
    (report.fitScore - 82) * 0.08 +
    (report.balanceScore - 80) * 0.05 +
    (report.benchScore - 72) * 0.05 -
    Math.max(0, difficulty.requiredScore - report.lineScores.defense) * 0.09;
  const winner = scoreDelta >= 1.5 ? 'player' : 'opponent';
  const closeness = Math.abs(scoreDelta);
  const score = suggestedScore({ winner, closeness, round });
  const decidedBy = closeness < 4 && round >= 4 ? 'extra_time' : 'regular';
  return {
    playerPower: Math.round(report.overallScore),
    opponentPower: Math.round(opponentStrength),
    scoreDelta: Number(scoreDelta.toFixed(1)),
    winner,
    score,
    decidedBy,
    rationale: matchupRationale({ report, opponentStrength, scoreDelta, winner }),
  };
}

function opponentDifficulty({ round, opponent, difficulty }) {
  const country = String(opponent?.country || '');
  const elite = ['法国', '巴西', '阿根廷', '德国', '西班牙', '英格兰', '葡萄牙', '荷兰', '意大利'];
  const strong = ['比利时', '克罗地亚', '乌拉圭', '哥伦比亚', '墨西哥', '美国', '摩洛哥'];
  const legendaryChampionYears = [1954, 1958, 1970, 1974, 1982, 1986, 1998, 2002, 2010, 2014, 2018, 2022];
  const listedStrength = Number(opponent?.strength);
  let base = Number.isFinite(listedStrength)
    ? listedStrength - (round <= 3 ? 4 : 1)
    : difficulty.requiredScore - (round <= 3 ? 5 : 1);
  if (elite.includes(country)) base += 3;
  else if (strong.includes(country)) base += 1;
  else base -= 2;
  if (opponent?.champion) base += 1;
  if (opponent?.tier === 'legendary') base += 1.5;
  else if (opponent?.tier === 'elite') base += 0.7;
  if (legendaryChampionYears.includes(Number(opponent?.year))) base += 1;
  return clamp(base);
}

function suggestedScore({ winner, closeness, round }) {
  const tight = closeness < 6;
  if (winner === 'player') {
    if (tight && round >= 4) return { player: 2, opponent: 1 };
    return { player: 2, opponent: 0 };
  }
  if (tight && round >= 4) return { player: 1, opponent: 2 };
  return { player: 0, opponent: 2 };
}

function matchupRationale({ report, opponentStrength, scoreDelta, winner }) {
  const sign = winner === 'player' ? '略占上风' : '处在下风';
  const weak = report.weaknesses?.[0] ? `主要风险是${report.weaknesses[0]}` : '没有明显灾难短板';
  const strong = report.strengths?.[0] ? `主要优势是${report.strengths[0]}` : '依靠局部球星解决问题';
  return `本地裁判综合阵容${report.overallScore}、对手强度${Math.round(opponentStrength)}、适配${report.fitScore}、防线${report.lineScores.defense}、替补${report.benchScore}，判定玩家${sign}（差值${scoreDelta.toFixed(1)}）。${strong}；${weak}。`;
}

function scoreStructuralPenalty({ rows, lineScores, difficulty }) {
  const outCount = rows.filter((r) => r.outOfPosition).length;
  let penalty = outCount * 3.4;
  if (lineScores.goalkeeper < 76) penalty += 5;
  if (lineScores.defense < difficulty.requiredScore - 8) penalty += 5;
  if (rows.filter((r) => r.line === 'defense' && r.outOfPosition).length >= 2) penalty += 6;
  return penalty;
}

function normalizeCell(cell = {}) {
  const slot = String(cell.pos || cell.slot || '').toUpperCase();
  const positions = Array.isArray(cell.player?.positions) && cell.player.positions.length
    ? cell.player.positions.map((p) => String(p).toUpperCase())
    : [String(cell.player?.pos || slot).toUpperCase()];
  const naturalFit = positions.some((pos) => positionMatches(pos, slot));
  const rating = nullableRating(cell.player?.overall ?? cell.player?.rating);
  return {
    slot,
    line: LINE_BY_POS[slot] || 'midfield',
    playerName: cell.player?.nameZh || cell.player?.name || '未知球员',
    positions,
    rating: rating ?? 72,
    fitScore: naturalFit && !cell.outOfPosition ? 96 : 52,
    outOfPosition: !naturalFit || !!cell.outOfPosition,
    year: Number(cell.year) || null,
  };
}

function scoreBenchDepth(benchRows, lineScores) {
  if (!benchRows.length) return 50;
  const avgRating = average(benchRows.map((r) => r.rating));
  const coverage = scoreBenchCoverage(benchRows, lineScores);
  const fit = average(benchRows.map((r) => r.positions.length ? 92 : 70));
  return clamp(avgRating * 0.58 + coverage * 0.3 + fit * 0.12);
}

function scoreBenchCoverage(benchRows, lineScores) {
  if (!benchRows.length) return 45;
  const covered = new Set();
  for (const row of benchRows) {
    for (const pos of row.positions) {
      const line = LINE_BY_POS[pos];
      if (line && line !== 'goalkeeper') covered.add(line);
      if (pos === 'GK') covered.add('goalkeeper');
    }
  }
  let score = 56 + covered.size * 8;
  const weakestLine = Object.entries(lineScores)
    .sort((a, b) => a[1] - b[1])[0]?.[0];
  if (weakestLine && covered.has(weakestLine)) score += 10;
  if (covered.has('defense') && covered.has('attack')) score += 6;
  return clamp(score);
}

function benchImpact(benchScore) {
  return Math.max(-2, Math.min(4, (benchScore - 70) * 0.12));
}

function scoreLines(rows) {
  const byLine = {
    goalkeeper: rows.filter((r) => r.line === 'goalkeeper'),
    defense: rows.filter((r) => r.line === 'defense'),
    midfield: rows.filter((r) => r.line === 'midfield'),
    attack: rows.filter((r) => r.line === 'attack'),
  };
  return Object.fromEntries(
    Object.entries(byLine).map(([line, lineRows]) => {
      if (!lineRows.length) return [line, 50];
      const rating = average(lineRows.map((r) => r.rating));
      const fit = average(lineRows.map((r) => r.fitScore));
      return [line, clamp(rating * 0.72 + fit * 0.28)];
    })
  );
}

function scoreBalance(lineScores) {
  const core = [lineScores.goalkeeper, lineScores.defense, lineScores.midfield, lineScores.attack];
  const spread = Math.max(...core) - Math.min(...core);
  return clamp(100 - spread * 1.4);
}

function scoreEraBlend(rows) {
  const years = rows.map((r) => r.year).filter(Boolean);
  if (years.length < 2) return 82;
  const spread = Math.max(...years) - Math.min(...years);
  return clamp(96 - Math.min(28, spread / 4));
}

function scoreStars(rows) {
  const elite = rows.filter((r) => r.rating >= 90).length;
  const weak = rows.filter((r) => r.rating < 78).length;
  return clamp(76 + elite * 4 - weak * 5);
}

function buildWeaknesses({ rows, benchRows, averageRating, fitScore, lineScores, balanceScore, benchScore, difficulty }) {
  const weaknesses = [];
  const outCount = rows.filter((r) => r.outOfPosition).length;
  if (outCount) weaknesses.push(`${outCount} 个位置错位，模型必须把它视为真实战术风险`);
  if (lineScores.goalkeeper < 75) weaknesses.push('门将档次不足，强强对话容易被惩罚');
  if (lineScores.defense < difficulty.requiredScore - 8) weaknesses.push('防线强度达不到本阶段门槛');
  if (lineScores.midfield < 78) weaknesses.push('中场控制力不足，无法持续支撑淘汰赛节奏');
  if (averageRating < difficulty.requiredScore - 5) weaknesses.push('整体数值不够，不能靠名气硬夺冠');
  if (fitScore < 82) weaknesses.push('位置适配不够好，搭配缺陷会放大');
  if (balanceScore < 78) weaknesses.push('阵容严重偏科');
  if (benchRows.length && benchScore < 68) weaknesses.push('替补席覆盖不足，落后时缺少有效变招');
  return weaknesses;
}

function buildStrengths({ rows, benchRows, averageRating, fitScore, lineScores, balanceScore, benchScore }) {
  const strengths = [];
  if (averageRating >= 88) strengths.push('整体能力达到世界冠军候选水准');
  if (fitScore >= 90) strengths.push('大多数球员处在熟悉职责上');
  if (lineScores.midfield >= 86) strengths.push('中场能决定比赛节奏');
  if (lineScores.attack >= 88) strengths.push('前场终结质量很高');
  if (lineScores.defense >= 86) strengths.push('防线足以承受淘汰赛压力');
  if (balanceScore >= 86) strengths.push('三线结构比较均衡');
  if (benchRows.length && benchScore >= 78) strengths.push('替补席有真实板凳深度，能覆盖关键位置并提供后手');
  if (!strengths.length && rows.length) strengths.push('阵中仍有个别球星能改变局部回合');
  return strengths;
}

function tacticalSummary({ overallScore, lineScores, fitScore, balanceScore, benchScore, canWinWorldCup }) {
  const verdict = canWinWorldCup ? '具备夺冠硬实力' : '还不够稳定夺冠';
  return `${verdict}：综合${Math.round(overallScore)}，门将${Math.round(lineScores.goalkeeper)}，防线${Math.round(lineScores.defense)}，中场${Math.round(lineScores.midfield)}，进攻${Math.round(lineScores.attack)}，适配${Math.round(fitScore)}，均衡${Math.round(balanceScore)}，替补${Math.round(benchScore)}。`;
}

function tierForScore(score, canWinWorldCup) {
  if (canWinWorldCup && score >= 88) return 'title_caliber';
  if (score >= 83) return 'contender';
  if (score >= 78) return 'dangerous_but_flawed';
  return 'outsider';
}

function roundLineScores(lineScores) {
  return Object.fromEntries(Object.entries(lineScores).map(([key, value]) => [key, Math.round(value)]));
}

function nullableRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n) : null;
}

function average(values) {
  const nums = values.filter((n) => Number.isFinite(n));
  if (!nums.length) return 72;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function clamp(value) {
  return Math.max(1, Math.min(99, Number(value) || 1));
}
