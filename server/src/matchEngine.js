import { stageByMatchday } from './tournament.js';

const PHASES = ['first_half', 'first_half', 'second_half', 'second_half', 'climax'];
const CONTINUATION_PREFIX = ['镜头还没切回来，', '这段攻势的余波还在，', '随后比赛彻底被拉进乱战，', '终场前的压力已经顶到极限，'];
const CONTINUATION_PREFIX_EN = ['Before the camera fully settles, ', 'The pressure from that move lingers, ', 'The match is pulled into a sharper rhythm, ', 'Late pressure is now at its limit, '];

export function normalizeMatchResult({ round, raw, opponentCountry = '', language = 'zh-CN' }) {
  const english = /^en/i.test(String(language || ''));
  const score = normalizeScore(raw?.score, raw?.winner);
  const sourceHighlights = Array.isArray(raw?.highlights) ? raw.highlights : [];
  const sourceTexts = sourceHighlights.map((h) => stripScoreMentions(highlightText(h))).filter(Boolean);
  if (!sourceTexts.length) throw new Error('match commentary missing');
  const preferredSides = sourceHighlights.map((h) => normalizeSide(h?.scorer || h?.side) || inferSideFromText(h?.text, opponentCountry));
  const timeline = buildGoalTimeline(score, preferredSides, raw?.decided_by);
  const goalSources = alignGoalSources(sourceHighlights, timeline, opponentCountry);
  const highlights = timeline.map((goal, index) => {
    const source = goalSources[index] || {};
    const phase = source.phase || PHASES[index] || 'climax';
    const text = stripScoreMentions(highlightText(source)) || continueCommentary(sourceTexts, index, goal.side, english);
    return {
      phase,
      minute: clampMinute(source.minute, goal.minute),
      scorer: goal.side,
      scoreAfter: { ...goal.scoreAfter },
      text,
    };
  });
  const broadcast = buildLongBroadcast({ score, goals: timeline, goalSources, sourceHighlights, sourceTexts, decidedBy: raw?.decided_by, english });
  const recap = buildRecap({ score, winner: score.player > score.opponent ? 'player' : 'opponent', decidedBy: raw?.decided_by, stats: raw?.stats, english });

  return {
    ...raw,
    stage: stageByMatchday(round),
    score,
    winner: score.player > score.opponent ? 'player' : 'opponent',
    decided_by: raw?.decided_by || (round > 3 ? 'regular' : 'group_stage'),
    match_flow: recap.summary,
    stats: buildDetailedStats({ score, winner: score.player > score.opponent ? 'player' : 'opponent', rawStats: raw?.stats }),
    highlights,
    broadcast,
    recap,
  };
}

function alignGoalSources(sourceHighlights, timeline, opponentCountry) {
  const used = new Set();
  return timeline.map((goal, index) => {
    const preferred = sourceHighlights.findIndex((source, sourceIndex) => {
      if (used.has(sourceIndex)) return false;
      const side = normalizeSide(source?.scorer || source?.side) || inferSideFromText(source?.text, opponentCountry);
      return side === goal.side;
    });
    const fallback = sourceHighlights.findIndex((source, sourceIndex) => !used.has(sourceIndex) && normalizeSide(source?.scorer || source?.side) !== 'none');
    const picked = preferred >= 0 ? preferred : fallback;
    if (picked >= 0) {
      used.add(picked);
      return sourceHighlights[picked];
    }
    return {};
  });
}

function buildLongBroadcast({ score, goals, goalSources, sourceHighlights, sourceTexts, decidedBy, english = false }) {
  let player = 0;
  let opponent = 0;
  const goalLines = goals.map((goal, index) => {
    if (goal.side === 'player') player += 1;
    if (goal.side === 'opponent') opponent += 1;
    const source = goalSources[index] || {};
    const text = stripScoreMentions(highlightText(source)) || continueCommentary(sourceTexts, index, goal.side, english);
    return buildBroadcastLine({
      phase: source.phase || phaseForMinute(goal.minute),
      minute: clampMinute(source.minute, goal.minute),
      scorer: goal.side,
      side: goal.side,
      scoreAfter: { player, opponent },
      text,
      index,
      total: goals.length,
      kind: 'goal',
      english,
    });
  });

  const nonGoalSources = sourceHighlights
    .filter((source) => normalizeSide(source?.scorer || source?.side) === 'none')
    .map((source) => ({
      phase: source.phase || phaseForMinute(source.minute),
      minute: clampMinute(source.minute, 8),
      scorer: 'none',
      side: normalizeSide(source?.side) || inferEventSide(highlightText(source)) || 'neutral',
      text: stripScoreMentions(highlightText(source)),
      kind: normalizeKind(source.kind) || inferEventKind(highlightText(source)),
    }))
    .filter((source) => source.text);

  const baseLines = [
    {
      phase: 'first_half',
      minute: 1,
      scorer: 'none',
      side: 'neutral',
      scoreAfter: { player: 0, opponent: 0 },
      text: english
        ? 'Kick-off, and the broadcast camera checks both shapes first. Neither side rushes the first ball forward. Dream XI test the pressing angle from deep, while the opponent pushes the first line close to midfield.'
        : '比赛开场，镜头先扫过两队阵型。双方都没有急着把球打到前场，梦之队在中后场确认对手压迫方向，对手也把第一道防线推到中圈附近。',
      kind: 'setup',
      title: english ? "1' Opening Read" : "1' 开场观察",
      scoreText: '0:0',
    },
    ...nonGoalSources,
    ...goalLines,
    {
      phase: 'climax',
      minute: decidedBy === 'extra_time' ? 120 : decidedBy === 'penalties' ? 120 : 90,
      scorer: 'none',
      side: 'neutral',
      scoreAfter: { ...score },
      text: english
        ? `Full-time whistle. The board freezes at Dream XI ${score.player}:${score.opponent} Opponent. Every run, save and adjustment before it is finally gathered into that scoreline.`
        : `终场哨响，记分牌定格在我的梦之队${score.player}:${score.opponent}对手。前面的每一次推进、扑救和换位，最后都被这个比分收束。`,
      kind: 'recap',
      title: `${decidedBy === 'extra_time' ? 120 : decidedBy === 'penalties' ? 120 : 90}' ${english ? 'Full Time' : '终场'}`,
      scoreText: `${score.player}:${score.opponent}`,
    },
  ];

  const sorted = baseLines
    .map((line, index) => ({ ...line, order: index }))
    .sort((a, b) => a.minute - b.minute || kindOrder(a.kind) - kindOrder(b.kind) || a.order - b.order);
  const filled = fillRunningScores(sorted);
  while (filled.length < 14) {
    const insertAt = Math.max(1, filled.length - 1);
    const prev = filled[insertAt - 1] || { scoreAfter: { player: 0, opponent: 0 }, minute: 15 };
    filled.splice(insertAt, 0, buildTextureLine(prev, filled.length, sourceTexts, english));
  }
  return filled.map(({ order, ...line }) => line);
}

function highlightText(source = {}) {
  return source.text || source.commentary || source.description || source.detail || source.body || source.narration || '';
}

function buildBroadcastLine({ phase, minute, scorer, side = scorer, scoreAfter, text, index = 0, total = 1, kind = 'goal', english = false }) {
  const scoreText = scoreAfter ? `${scoreAfter.player}:${scoreAfter.opponent}` : '';
  const sideLine =
    scorer === 'player'
      ? (english ? 'Dream XI goal' : '我的梦之队进球')
      : scorer === 'opponent'
        ? (english ? 'Opponent goal' : '对手进球')
        : eventTitle(kind, english);
  const tempo =
    kind !== 'goal'
      ? ''
      : index === 0
        ? (english ? 'the first blow lands' : '第一声重锤落下')
        : index === total - 1
          ? (english ? 'the final sentence is written' : '最后的判词也写出来了')
          : (english ? 'the game state changes again' : '局面再次被改写');
  const scoreSentence = kind === 'goal' && scoreText
    ? english
      ? `${sideLine}, ${tempo}, ${scoreContext({ scorer, scoreAfter, english })}. Score now ${scoreText}. `
      : `${sideLine}，${tempo}，${scoreContext({ scorer, scoreAfter })}，比分来到${scoreText}。`
    : '';
  return {
    phase,
    minute,
    scorer,
    side,
    kind,
    scoreAfter: { ...scoreAfter },
    scoreText,
    text: `${scoreSentence}${sanitizeScoreSemantics(text || '')}`.trim(),
    title: `${minute}' ${sideLine}`,
  };
}

function scoreContext({ scorer, scoreAfter, english = false }) {
  const player = Number(scoreAfter?.player ?? 0);
  const opponent = Number(scoreAfter?.opponent ?? 0);
  const diff = player - opponent;
  if (english) {
    if (diff === 0) return scorer === 'player' ? 'Dream XI equalize' : 'the opponent equalize';
    if (scorer === 'player') {
      if (diff === 1 && player > 1 && opponent > 0) return 'Dream XI complete the turnaround';
      if (diff > 0) return 'Dream XI take the lead';
      return 'Dream XI pull one back';
    }
    if (diff === -1 && opponent > 1 && player > 0) return 'the opponent complete the turnaround';
    if (diff < 0) return 'the opponent take the lead';
    return 'the opponent pull one back';
  }
  if (diff === 0) return scorer === 'player' ? '梦之队把比赛扳平' : '对手把比赛扳平';
  if (scorer === 'player') {
    if (diff === 1 && player > 1 && opponent > 0) return '梦之队完成反超';
    if (diff > 0) return '梦之队取得领先';
    return '梦之队追回一球';
  }
  if (diff === -1 && opponent > 1 && player > 0) return '对手完成反超';
  if (diff < 0) return '对手取得领先';
  return '对手追回一球';
}

function sanitizeScoreSemantics(text) {
  return String(text || '')
    .replace(/，?\s*比分(?:回到)?同一起跑线[！!。,.，；;]?/g, '')
    .replace(/，?\s*双方(?:重新)?回到同一起跑线[！!。,.，；;]?/g, '')
    .replace(/，?\s*(?:扳平|追平)(?:比分|了比分|成功|！|!|。)?/g, '')
    .replace(/，?\s*(?:反超|逆转)(?:比分|成功|局势|！|!|。)?/g, '')
    .replace(/，?\s*(?:扩大领先|锁定胜局|杀死比赛)(?:！|!|。)?/g, '')
    .replace(/，{2,}/g, '，')
    .replace(/。{2,}/g, '。')
    .replace(/^，|，$/g, '')
    .trim();
}

function fillRunningScores(lines) {
  let current = { player: 0, opponent: 0 };
  return lines.map((line) => {
    if (line.kind === 'goal' || line.kind === 'recap') current = { ...line.scoreAfter };
    const scoreAfter = line.scoreAfter || { ...current };
    const scoreText = line.scoreText || `${scoreAfter.player}:${scoreAfter.opponent}`;
    return {
      ...line,
      scoreAfter,
      scoreText,
    };
  });
}

function buildTextureLine(prev, index, sourceTexts, english = false) {
  const minute = Math.min(89, Number(prev.minute || 12) + 7 + (index % 5));
  const fallbackEvents = [
    {
      kind: 'corner',
      side: 'opponent',
      title: '角球防守',
      text: '对手右侧角球开向前点，第一下争顶造成禁区混乱，梦之队门将没有贸然出击，中卫扛住身体后把球顶出危险区。',
    },
    {
      kind: 'free_kick',
      side: 'player',
      title: '任意球机会',
      text: '梦之队在禁区弧顶附近赢得任意球，主罚球员选择绕过人墙打近角，对手门将提前移动半步，双拳把球托出横梁。',
    },
    {
      kind: 'big_chance',
      side: 'opponent',
      title: '重大机会',
      text: '对手中场突然送出直塞，前锋反越位形成单刀，梦之队中卫一路回追干扰射门角度，最后这脚推射擦着远门柱偏出。',
    },
    {
      kind: 'substitution',
      side: 'player',
      title: '换人调整',
      text: '梦之队替补席做出调整，新上来的球员立刻站到边路接应，教练显然想把进攻重心转到弱侧，逼迫对手边后卫连续回撤。',
    },
  ];
  const fallbackEventsEn = [
    {
      kind: 'corner',
      side: 'opponent',
      title: 'Corner Defence',
      text: 'The opponent bends a corner toward the near post, the first contact creates traffic in the box, and Dream XI hold their nerve before a centre-back heads clear.',
    },
    {
      kind: 'free_kick',
      side: 'player',
      title: 'Free-kick Chance',
      text: 'Dream XI win a free-kick near the arc. The taker curls it around the wall toward the near corner, but the goalkeeper shifts early and palms it over.',
    },
    {
      kind: 'big_chance',
      side: 'opponent',
      title: 'Big Chance',
      text: 'The opponent midfield suddenly threads a vertical pass. The striker breaks behind, but a recovering Dream XI defender narrows the angle and the finish slides wide.',
    },
    {
      kind: 'substitution',
      side: 'player',
      title: 'Substitution',
      text: 'Dream XI make a change. The fresh player immediately offers width, and the coach clearly wants to move the attack to the weak side.',
    },
  ];
  const picked = (english ? fallbackEventsEn : fallbackEvents)[index % fallbackEvents.length];
  return {
    phase: phaseForMinute(minute),
    minute,
    scorer: 'none',
    side: picked.side,
    kind: picked.kind,
    scoreAfter: { ...prev.scoreAfter },
    scoreText: `${prev.scoreAfter.player}:${prev.scoreAfter.opponent}`,
    title: `${minute}' ${picked.title}`,
    text: picked.text || continueCommentary(sourceTexts, index, 'none', english),
  };
}

function buildScoreBroadcast(highlights) {
  return highlights.map((h, index) => {
    const scoreText = h.scoreAfter ? `${h.scoreAfter.player}:${h.scoreAfter.opponent}` : '';
    const sideLine =
      h.scorer === 'player'
        ? '我的梦之队进球'
        : h.scorer === 'opponent'
          ? '对手进球'
          : '比赛继续推进';
    const minute = Number(h.minute) || 0;
    const tempo =
      index === 0
        ? '第一声重锤落下'
        : index === highlights.length - 1
          ? '最后的判词也写出来了'
          : '局面再次被改写';
    const scoreSentence = scoreText
      ? `${sideLine}，${tempo}，比分来到${scoreText}。`
      : '';
    return {
      ...h,
      scoreText,
      text: `${scoreSentence}${h.text || ''}`.trim(),
      title: `${minute}' ${sideLine}`,
    };
  });
}

function buildRecap({ score, winner, decidedBy, stats = {}, english = false }) {
  const decidedText = english
    ? ({ regular: 'regular time', extra_time: 'extra time', penalties: 'penalties', group_stage: 'regular time' }[decidedBy] || 'regular time')
    : ({ regular: '常规时间', extra_time: '加时赛', penalties: '点球大战', group_stage: '常规时间' }[decidedBy] || '常规时间');
  const scoreline = english ? `Dream XI ${score.player}:${score.opponent} Opponent` : `我的梦之队 ${score.player}:${score.opponent} 对手`;
  const verdict = winner === 'player'
    ? (english ? `Dream XI win in ${decidedText}` : `我的梦之队${decidedText}取胜`)
    : (english ? `Dream XI lose in ${decidedText}` : `我的梦之队${decidedText}失利`);
  const possession = readStat(stats, ['possession.player', 'playerPossession', 'homePossession']);
  const shots = readStat(stats, ['shots.player', 'playerShots', 'homeShots']);
  const opponentShots = readStat(stats, ['shots.opponent', 'opponentShots', 'awayShots']);
  const texture = possession
    ? (english ? `possession ${clampPercent(possession)}%` : `控球率${clampPercent(possession)}%`)
    : shots
      ? (english ? `shots ${shots}:${opponentShots ?? Math.max(1, score.opponent * 4)}` : `射门${shots}:${opponentShots ?? Math.max(1, score.opponent * 4)}`)
      : (english ? `finishing ${score.player}:${score.opponent}` : `进球效率${score.player}:${score.opponent}`);
  return {
    scoreline,
    verdict,
    summary: english
      ? `${verdict}, final score ${score.player}:${score.opponent}. ${texture}; the match verdict follows the final score and goal timeline.`
      : `${verdict}，比分${score.player}:${score.opponent}。${texture}，比赛结论以最终比分和进球节点为准。`,
  };
}

export function buildDetailedStats({ score, winner, rawStats = {} } = {}) {
  const playerGoals = clampGoal(score?.player);
  const opponentGoals = clampGoal(score?.opponent);
  const goalDiff = playerGoals - opponentGoals;
  const playerWon = (winner || (goalDiff >= 0 ? 'player' : 'opponent')) === 'player';
  const edge = Math.min(4, Math.abs(goalDiff)) || 1;
  const rawPossession = readStat(rawStats, ['possession.player', 'playerPossession', 'homePossession']);
  const possessionPlayer = clampPercent(rawPossession ?? (playerWon ? 51 + edge * 3 : 49 - edge * 3));
  const possessionOpponent = 100 - possessionPlayer;
  const shotsPlayer = clampStat(
    readStat(rawStats, ['shots.player', 'playerShots', 'homeShots']) ?? 7 + playerGoals * 4 + (playerWon ? edge * 2 : 0),
    1,
    38
  );
  const shotsOpponent = clampStat(
    readStat(rawStats, ['shots.opponent', 'opponentShots', 'awayShots']) ?? 7 + opponentGoals * 4 + (!playerWon ? edge * 2 : 0),
    1,
    38
  );
  const shotsOnTargetPlayer = clampStat(
    readStat(rawStats, ['shotsOnTarget.player', 'playerShotsOnTarget']) ?? Math.max(playerGoals, Math.round(shotsPlayer * 0.42)),
    playerGoals,
    shotsPlayer
  );
  const shotsOnTargetOpponent = clampStat(
    readStat(rawStats, ['shotsOnTarget.opponent', 'opponentShotsOnTarget']) ?? Math.max(opponentGoals, Math.round(shotsOpponent * 0.42)),
    opponentGoals,
    shotsOpponent
  );
  const xgPlayer = clampDecimal(
    readStat(rawStats, ['xg.player', 'playerXg']) ?? playerGoals * 0.74 + shotsOnTargetPlayer * 0.16 + (playerWon ? 0.28 : 0.04),
    0.1,
    6.8
  );
  const xgOpponent = clampDecimal(
    readStat(rawStats, ['xg.opponent', 'opponentXg']) ?? opponentGoals * 0.74 + shotsOnTargetOpponent * 0.16 + (!playerWon ? 0.28 : 0.04),
    0.1,
    6.8
  );

  return {
    possession: { player: possessionPlayer, opponent: possessionOpponent },
    shots: { player: shotsPlayer, opponent: shotsOpponent },
    shotsOnTarget: { player: shotsOnTargetPlayer, opponent: shotsOnTargetOpponent },
    xg: { player: xgPlayer, opponent: xgOpponent },
    bigChances: {
      player: clampStat(readStat(rawStats, ['bigChances.player']) ?? Math.max(1, playerGoals + (playerWon ? 2 : 0)), 0, 12),
      opponent: clampStat(readStat(rawStats, ['bigChances.opponent']) ?? Math.max(1, opponentGoals + (!playerWon ? 2 : 0)), 0, 12),
    },
    passes: {
      player: clampStat(readStat(rawStats, ['passes.player']) ?? possessionPlayer * 9 + 90, 180, 850),
      opponent: clampStat(readStat(rawStats, ['passes.opponent']) ?? possessionOpponent * 9 + 90, 180, 850),
    },
    passAccuracy: {
      player: clampStat(readStat(rawStats, ['passAccuracy.player']) ?? 76 + Math.round(possessionPlayer / 7), 58, 94),
      opponent: clampStat(readStat(rawStats, ['passAccuracy.opponent']) ?? 76 + Math.round(possessionOpponent / 7), 58, 94),
    },
    corners: {
      player: clampStat(readStat(rawStats, ['corners.player']) ?? Math.round(shotsPlayer / 4), 0, 16),
      opponent: clampStat(readStat(rawStats, ['corners.opponent']) ?? Math.round(shotsOpponent / 4), 0, 16),
    },
    saves: {
      player: clampStat(readStat(rawStats, ['saves.player']) ?? Math.max(0, shotsOnTargetOpponent - opponentGoals), 0, 18),
      opponent: clampStat(readStat(rawStats, ['saves.opponent']) ?? Math.max(0, shotsOnTargetPlayer - playerGoals), 0, 18),
    },
    attacks: {
      player: clampStat(readStat(rawStats, ['attacks.player']) ?? shotsPlayer * 5 + possessionPlayer, 25, 220),
      opponent: clampStat(readStat(rawStats, ['attacks.opponent']) ?? shotsOpponent * 5 + possessionOpponent, 25, 220),
    },
    discipline: {
      yellowCards: {
        player: clampStat(readStat(rawStats, ['discipline.yellowCards.player', 'yellowCards.player']) ?? (playerWon ? 1 : 2), 0, 7),
        opponent: clampStat(readStat(rawStats, ['discipline.yellowCards.opponent', 'yellowCards.opponent']) ?? (playerWon ? 2 : 1), 0, 7),
      },
      fouls: {
        player: clampStat(readStat(rawStats, ['discipline.fouls.player', 'fouls.player']) ?? 8 + (!playerWon ? edge * 2 : edge), 3, 28),
        opponent: clampStat(readStat(rawStats, ['discipline.fouls.opponent', 'fouls.opponent']) ?? 8 + (playerWon ? edge * 2 : edge), 3, 28),
      },
    },
  };
}

function continueCommentary(sourceTexts, index, side, english = false) {
  const seed = sourceTexts[index % sourceTexts.length];
  if (english) {
    const prefix = CONTINUATION_PREFIX_EN[(index - sourceTexts.length) % CONTINUATION_PREFIX_EN.length] || 'Then, ';
    const sideText = side === 'player' ? 'Dream XI' : side === 'opponent' ? 'the opponent' : 'both sides';
    return `${prefix}${sideText} keep pressing in the same rhythm. ${seed}`;
  }
  const prefix = CONTINUATION_PREFIX[(index - sourceTexts.length) % CONTINUATION_PREFIX.length] || '随后，';
  const sideText = side === 'player' ? '梦之队' : side === 'opponent' ? '对手' : '双方';
  return `${prefix}${sideText}沿着刚才的节奏继续施压，${seed}`;
}

export function stripScoreMentions(text) {
  return sanitizeScoreSemantics(String(text || '')
    .replace(/比分(?:来到|变成|改写为|变为|是|为)?\s*\d+\s*[-:：比]\s*\d+[！!。,.，；;]?/g, '')
    .replace(/\b\d+\s*[-:：]\s*\d+\b[！!。,.，；;]?/g, '')
    .replace(/玩家\s*\d+\s*[-:：比]\s*\d+\s*对手/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/，{2,}/g, '，')
    .replace(/。{2,}/g, '。')
    .replace(/^，|，$/g, '')
    .trim());
}

function normalizeScore(input, winner) {
  let player = clampGoal(input?.player);
  let opponent = clampGoal(input?.opponent);
  if (player === 0 && opponent === 0) {
    player = winner === 'opponent' ? 1 : 2;
    opponent = winner === 'opponent' ? 2 : 1;
  }
  if (player === opponent) {
    if (winner === 'opponent') opponent += 1;
    else player += 1;
  }
  return { player, opponent };
}

function buildGoalTimeline(score, preferredSides = [], decidedBy = 'regular') {
  const total = score.player + score.opponent;
  const count = Math.max(1, total || 1);
  const goals = chooseGoalSides(score, preferredSides);
  let player = 0;
  let opponent = 0;
  const minutes = goalMinutes(count, decidedBy);
  return Array.from({ length: count }, (_, index) => {
    const side = goals[index] || goals[goals.length - 1] || null;
    if (side === 'player' && player < score.player) player += 1;
    if (side === 'opponent' && opponent < score.opponent) opponent += 1;
    if (index === count - 1) {
      player = score.player;
      opponent = score.opponent;
    }
    return {
      side: side || 'none',
      minute: minutes[index] || Math.min(90, 12 + index * 18),
      scoreAfter: { player, opponent },
    };
  });
}

function goalMinutes(count, decidedBy = 'regular') {
  if (decidedBy === 'extra_time') {
    return [18, 44, 72, 96, 108, 118].slice(0, count);
  }
  if (decidedBy === 'penalties') {
    return [22, 55, 82, 120, 120, 120].slice(0, count);
  }
  const regular = {
    1: [57],
    2: [31, 69],
    3: [24, 52, 78],
    4: [16, 39, 61, 81],
    5: [12, 29, 48, 66, 83],
  };
  if (regular[count]) return regular[count];
  return Array.from({ length: count }, (_, index) => Math.min(84, 10 + index * Math.max(8, Math.floor(70 / count))));
}

function phaseForMinute(minute) {
  const n = Number(minute);
  if (n >= 84) return 'climax';
  if (n >= 46) return 'second_half';
  return 'first_half';
}

function clampMinute(value, fallback = 45) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(130, Math.round(n)));
}

function inferEventKind(text) {
  const raw = String(text || '');
  if (/角球|角旗|前点|后点/.test(raw)) return 'corner';
  if (/任意球|定位球|人墙/.test(raw)) return 'free_kick';
  if (/点球|十二码/.test(raw)) return 'penalty';
  if (/黄牌|吃牌|警告/.test(raw)) return 'yellow_card';
  if (/换人|替补|换上|换下/.test(raw)) return 'substitution';
  if (/单刀|空门|横梁|门柱|绝佳|重大机会/.test(raw)) return 'big_chance';
  if (/扑|门将|封堵|解围/.test(raw)) return 'save';
  if (/压迫|站位|阵型|节奏|换位|中场/.test(raw)) return 'tactic';
  return 'texture';
}

function eventTitle(kind, english = false) {
  if (english) {
    if (kind === 'corner') return 'Corner';
    if (kind === 'free_kick') return 'Free Kick';
    if (kind === 'penalty') return 'Penalty Incident';
    if (kind === 'yellow_card') return 'Yellow Card';
    if (kind === 'substitution') return 'Substitution';
    if (kind === 'big_chance') return 'Big Chance';
    if (kind === 'save') return 'Key Defence';
    if (kind === 'tactic') return 'Tactical Shift';
    if (kind === 'setup') return 'Opening Read';
    if (kind === 'recap') return 'Full-time Review';
    return 'Live Phase';
  }
  if (kind === 'corner') return '角球';
  if (kind === 'free_kick') return '任意球';
  if (kind === 'penalty') return '点球事件';
  if (kind === 'yellow_card') return '黄牌';
  if (kind === 'substitution') return '换人';
  if (kind === 'big_chance') return '重大机会';
  if (kind === 'save') return '关键防守';
  if (kind === 'tactic') return '战术调整';
  if (kind === 'setup') return '开场观察';
  if (kind === 'recap') return '终场复盘';
  return '比赛推进';
}

function kindOrder(kind) {
  return { setup: 0, tactic: 1, substitution: 2, corner: 3, free_kick: 3, yellow_card: 3, penalty: 4, big_chance: 4, save: 5, goal: 6, texture: 7, recap: 9 }[kind] ?? 5;
}

function normalizeKind(value) {
  const kind = String(value || '').toLowerCase();
  if (['goal', 'corner', 'free_kick', 'save', 'big_chance', 'yellow_card', 'substitution', 'penalty', 'tactic', 'setup', 'recap', 'texture'].includes(kind)) return kind;
  if (kind === 'freekick') return 'free_kick';
  if (kind === 'chance') return 'big_chance';
  if (kind === 'card') return 'yellow_card';
  return null;
}

function inferEventSide(text) {
  const raw = String(text || '');
  if (/对手|客队|法国|巴西|德国|阿根廷|英格兰|西班牙|葡萄牙|荷兰|意大利/.test(raw)) return 'opponent';
  if (/梦之队|我的|我们|玩家/.test(raw)) return 'player';
  return null;
}

function chooseGoalSides(score, preferredSides = []) {
  const winner = score.player > score.opponent ? 'player' : 'opponent';
  const loser = winner === 'player' ? 'opponent' : 'player';
  const remaining = { player: score.player, opponent: score.opponent };
  const sides = preferredSides.map((side) => {
    if ((side === 'player' || side === 'opponent') && remaining[side] > 0) {
      remaining[side] -= 1;
      return side;
    }
    return null;
  });
  const winnerGoals = score[winner];
  const loserGoals = score[loser];
  if (remaining[loser] > 0) {
    sides.push(loser);
    remaining[loser] -= 1;
  }
  for (let i = 0; i < winnerGoals && remaining[winner] > 0; i++) {
    sides.push(winner);
    remaining[winner] -= 1;
  }
  for (let i = 0; i < loserGoals && remaining[loser] > 0; i++) {
    sides.splice(Math.max(1, sides.length - 1), 0, loser);
    remaining[loser] -= 1;
  }
  return sides.filter(Boolean);
}

function normalizeSide(value) {
  const side = String(value || '').toLowerCase();
  if (['player', 'home', 'us', 'mine'].includes(side)) return 'player';
  if (['opponent', 'away', 'them'].includes(side)) return 'opponent';
  if (['none', 'neutral', 'no_goal'].includes(side)) return 'none';
  return null;
}

function inferSideFromText(text, opponentCountry) {
  const raw = String(text || '');
  if (opponentCountry && raw.includes(opponentCountry)) return 'opponent';
  if (/对手|客队/.test(raw)) return 'opponent';
  if (/玩家|梦之队|我的|我们/.test(raw)) return 'player';
  return null;
}

function clampGoal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(8, Math.round(n)));
}

function readStat(obj, paths) {
  for (const path of paths) {
    const value = String(path)
      .split('.')
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function clampStat(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampDecimal(value, min = 0, max = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Number(Math.max(min, Math.min(max, n)).toFixed(2));
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(25, Math.min(75, Math.round(n)));
}
