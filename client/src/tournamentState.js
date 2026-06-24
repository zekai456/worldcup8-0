import { pickStrongOpponent, WORLD_CUP_2026_PATH, stageByMatchday } from './tournament.js';

export const TOURNAMENT_STORAGE_KEY = 'worldcup8.tournamentState';
export const TOURNAMENT_STATE_VERSION = 3;

export function createTournamentState({ playerTeam = '我的梦之队', groupOpponents = [] } = {}) {
  const opponents = normalizeGroupOpponents(groupOpponents);
  while (opponents.length < 3) opponents.push({ country: `同组对手${opponents.length + 1}`, year: 2026 });
  const groupTeams = [playerTeam, ...opponents.map((team) => team.country)].slice(0, 4);
  return {
    version: TOURNAMENT_STATE_VERSION,
    playerTeam,
    groupTeams,
    fixtures: buildFixtures(playerTeam, opponents.slice(0, 3)),
    matches: [],
    awards: null,
  };
}

export function buildFixtures(playerTeamOrGroupTeams, groupOpponents = []) {
  const legacyTeams = Array.isArray(playerTeamOrGroupTeams) ? playerTeamOrGroupTeams : null;
  const player = legacyTeams ? legacyTeams[0] : playerTeamOrGroupTeams;
  const opponents = legacyTeams
    ? normalizeGroupOpponents(legacyTeams.slice(1))
    : normalizeGroupOpponents(groupOpponents);
  const [a, b, c] = opponents;
  return [
    playerFixture('g1-player', 1, player, a),
    otherFixture('g1-other', 1, b, c),
    playerFixture('g2-player', 2, player, b),
    otherFixture('g2-other', 2, a, c),
    playerFixture('g3-player', 3, player, c),
    otherFixture('g3-other', 3, a, b),
    ...WORLD_CUP_2026_PATH.filter((s) => s.type === 'knockout').map((stage) => ({
      id: `ko-${stage.matchday}`,
      matchday: stage.matchday,
      stage: stage.name,
      home: player,
      away: '待定',
      playerMatch: true,
    })),
  ];
}

export function championOpponentsForGroup() {
  const picked = [];
  const seeds = [Math.random(), Math.random(), Math.random()];
  for (let i = 0; i < 3; i += 1) {
    picked.push(pickStrongOpponent(i + 1, { seed: seeds[i], exclude: picked }));
  }
  return picked;
}

export function recordMatch(state, match) {
  const next = { ...(state || createTournamentState()) };
  const id = match.id || `${match.matchday}:${match.home}:${match.away}`;
  next.matches = [...(next.matches || []).filter((m) => m.id !== id), { ...match, id }];
  return next;
}

export function updateKnockoutFixture(state, matchday, opponent) {
  const next = { ...(state || createTournamentState()) };
  next.fixtures = (next.fixtures || []).map((fixture) => {
    if (fixture.matchday !== Number(matchday) || !fixture.playerMatch) return fixture;
    return {
      ...fixture,
      away: opponent?.country || fixture.away || '待定',
      opponentYear: opponent?.year || fixture.opponentYear || 2026,
      opponentTag: opponent?.tag || fixture.opponentTag || '',
      opponentTier: opponent?.tier || fixture.opponentTier || '',
      opponentStrength: opponent?.strength || fixture.opponentStrength || null,
      championOpponent: !!opponent?.champion,
    };
  });
  return next;
}

export function groupStandings(state) {
  const teams = new Map((state.groupTeams || []).map((team) => [team, emptyStanding(team)]));
  for (const match of state.matches || []) {
    if (Number(match.matchday) > 3) continue;
    const home = ensureStanding(teams, match.home);
    const away = ensureStanding(teams, match.away);
    const hg = Number(match.score?.home ?? match.score?.player ?? 0);
    const ag = Number(match.score?.away ?? match.score?.opponent ?? 0);
    applyResult(home, hg, ag);
    applyResult(away, ag, hg);
  }
  return [...teams.values()].sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team)
  );
}

export function buildAwards({ state, squad = [] }) {
  const playerRows = squad.map((cell) => ({
    name: cell.player?.nameZh || cell.player?.name || '未知球员',
    pos: cell.pos,
    rating: Number(cell.player?.overall ?? cell.player?.rating ?? 0) || 0,
  }));
  const bestPlayer = playerRows.slice().sort((a, b) => b.rating - a.rating)[0]?.name || '暂无';
  const bestKeeper = playerRows.filter((p) => p.pos === 'GK').sort((a, b) => b.rating - a.rating)[0]?.name || bestPlayer;
  const campaign = summarizeCampaign(state);
  const topScorer = estimateTopScorer(state, playerRows, campaign);
  const rivalStar = estimateRivalStar(state);
  const leaderboards = buildLeaderboards({ state, playerRows, campaign, rivalStar });
  const bestYoung = playerRows
    .filter((p) => p.rating < 90)
    .sort((a, b) => b.rating - a.rating)[0]?.name || rivalStar.winner;
  const playerDominant =
    campaign.totalMatches <= 1
      ? campaign.playerWins === campaign.totalMatches
      : campaign.playerWins >= Math.max(2, campaign.totalMatches - 1);
  return {
    goldenBall: {
      winner: playerDominant ? bestPlayer : rivalStar.winner,
      team: playerDominant ? '我的梦之队' : rivalStar.team,
      reason: playerDominant
        ? `带队取得${campaign.playerWins}胜，关键场面决定冠军走势。`
        : `${rivalStar.team}在玩家战役中制造最大阻力，整体表现更像赛事门面。`,
    },
    goldenBoot: topScorer,
    goldenGlove: {
      winner: campaign.cleanSheets > 0 || playerDominant ? bestKeeper : `${rivalStar.team}门将`,
      team: campaign.cleanSheets > 0 || playerDominant ? '我的梦之队' : rivalStar.team,
      reason: campaign.cleanSheets > 0
        ? `${campaign.cleanSheets}场零封和${campaign.saves}次扑救把容错率抬高。`
        : playerDominant
          ? '冠军战役里守住最后优势，是后场最稳定的保险。'
        : '淘汰赛压力下多次守住高质量机会。',
    },
    bestYoungPlayer: {
      winner: bestYoung,
      team: bestYoung === rivalStar.winner ? rivalStar.team : '我的梦之队',
      reason: '在巨星云集的赛程里依然打出存在感。',
    },
    rivalStar,
    bestCoach: {
      winner: campaign.playerWins >= 3 ? '玩家主帅' : `${rivalStar.team}主帅`,
      reason: campaign.playerWins >= 3 ? '阵容拼图、临场发布会与淘汰赛应变形成闭环。' : '针对梦之队弱点的比赛计划执行更完整。',
    },
    fairPlay: {
      winner: campaign.fouls <= 80 ? '我的梦之队' : rivalStar.team,
      reason: campaign.fouls <= 80 ? '高强度赛程中控制动作，少把比赛交给裁判。' : '身体对抗更克制，关键场次没有自毁式犯规。',
    },
    teamOfTournament: buildTeamOfTournament(playerRows, rivalStar.team),
    achievementBadges: buildAchievementBadges(campaign),
    technicalSummary: buildTechnicalSummary(campaign),
    scoringLeaders: leaderboards.scoringLeaders,
    assistLeaders: leaderboards.assistLeaders,
    mvpLeaders: leaderboards.mvpLeaders,
    saveLeaders: leaderboards.saveLeaders,
    teamStatsLeaders: leaderboards.teamStatsLeaders,
    ceremony: `本届挑战记录${campaign.totalMatches}场，${campaign.playerWins}胜，进${campaign.goalsFor}球失${campaign.goalsAgainst}球。奖项同时参考梦之队与对手表现。`,
  };
}

export function saveTournamentState(state) {
  window.localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(state));
}

export function loadTournamentState() {
  try {
    const raw = window.localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    return state?.version === TOURNAMENT_STATE_VERSION ? state : null;
  } catch {
    return null;
  }
}

export function clearTournamentState() {
  window.localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
}

export function fixtureForMatchday(state, matchday) {
  const stage = stageByMatchday(matchday);
  return (state.fixtures || []).find((f) => f.matchday === stage.matchday && f.playerMatch);
}

function estimateTopScorer(state, playerRows, campaign = summarizeCampaign(state)) {
  const goals = (state.matches || []).reduce((sum, match) => sum + Number(match.score?.player ?? match.score?.home ?? 0), 0);
  if (!playerRows.length) return '暂无';
  const attackers = playerRows.filter((p) => ['ST', 'LW', 'RW', 'CAM'].includes(p.pos));
  const ownScorer = (attackers[goals % Math.max(1, attackers.length)] || playerRows[0]).name;
  const rival = estimateRivalStar(state);
  const rivalGoals = Math.max(4, campaign.goalsAgainst + Math.ceil(campaign.otherGoalsFor / 3));
  const ownGoals = Math.max(1, Math.ceil(campaign.goalsFor * 0.45));
  if (rivalGoals > ownGoals + 1) {
    return {
      winner: rival.winner,
      team: rival.team,
      goals: rivalGoals,
      reason: `对手线累计火力更猛，${rival.team}成为本届最锋利的镜头。`,
    };
  }
  return {
    winner: ownScorer,
    team: '我的梦之队',
    goals: ownGoals,
    reason: '在玩家关键进球里占比最高。',
  };
}

function summarizeCampaign(state) {
  const matches = state?.matches || [];
  const playerMatches = matches.filter((m) => m.playerMatch);
  const otherMatches = matches.filter((m) => !m.playerMatch);
  const goalsFor = playerMatches.reduce((sum, m) => sum + Number(m.score?.player ?? m.score?.home ?? 0), 0);
  const goalsAgainst = playerMatches.reduce((sum, m) => sum + Number(m.score?.opponent ?? m.score?.away ?? 0), 0);
  const playerWins = playerMatches.filter((m) => Number(m.score?.player ?? m.score?.home ?? 0) > Number(m.score?.opponent ?? m.score?.away ?? 0)).length;
  const cleanSheets = playerMatches.filter((m) => Number(m.score?.opponent ?? m.score?.away ?? 0) === 0).length;
  const stats = playerMatches.map((m) => m.stats || {});
  return {
    totalMatches: playerMatches.length,
    playerWins,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    otherGoalsFor: otherMatches.reduce((sum, m) => sum + Number(m.score?.home ?? 0) + Number(m.score?.away ?? 0), 0),
    shotsFor: sumNested(stats, 'shots.player') || sumNested(stats, 'playerShots') || goalsFor * 5,
    shotsAgainst: sumNested(stats, 'shots.opponent') || sumNested(stats, 'opponentShots') || goalsAgainst * 5,
    xgFor: sumNested(stats, 'xg.player') || Number((goalsFor * 0.9).toFixed(1)),
    xgAgainst: sumNested(stats, 'xg.opponent') || Number((goalsAgainst * 0.9).toFixed(1)),
    saves: sumNested(stats, 'saves.player') || Math.max(0, goalsAgainst + cleanSheets * 2),
    opponentSaves: sumNested(stats, 'saves.opponent') || Math.max(0, goalsFor),
    fouls: sumNested(stats, 'discipline.fouls.player') || playerMatches.length * 10,
    cornersFor: sumNested(stats, 'corners.player') || Math.max(0, Math.round(goalsFor * 1.5 + playerMatches.length)),
    cornersAgainst: sumNested(stats, 'corners.opponent') || Math.max(0, Math.round(goalsAgainst * 1.5 + playerMatches.length)),
    shotsOnTargetFor: sumNested(stats, 'shotsOnTarget.player') || Math.max(goalsFor, Math.round(goalsFor * 2.2)),
    shotsOnTargetAgainst: sumNested(stats, 'shotsOnTarget.opponent') || Math.max(goalsAgainst, Math.round(goalsAgainst * 2.2)),
    possession: averageNested(stats, 'possession.player') || 50,
  };
}

function estimateRivalStar(state) {
  const matches = state?.matches || [];
  const candidates = [];
  for (const match of matches) {
    if (match.playerMatch && match.away) {
      candidates.push({ team: match.away, weight: Number(match.score?.opponent ?? match.score?.away ?? 0) + 2 });
    }
    if (!match.playerMatch) {
      const homeGoals = Number(match.score?.home ?? 0);
      const awayGoals = Number(match.score?.away ?? 0);
      candidates.push({ team: homeGoals >= awayGoals ? match.home : match.away, weight: Math.max(homeGoals, awayGoals) + 1 });
      for (const player of match.keyPlayers || []) candidates.push({ team: homeGoals >= awayGoals ? match.home : match.away, player, weight: 5 });
    }
  }
  const picked = candidates.sort((a, b) => b.weight - a.weight)[0] || { team: '法国', player: '姆巴佩' };
  return {
    winner: picked.player || `${picked.team}核心`,
    team: picked.team || '对手',
    reason: '在非玩家比赛和正面对抗里持续制造决定性回合。',
  };
}

function buildTeamOfTournament(playerRows, rivalTeam) {
  const byLine = [
    playerRows.find((p) => p.pos === 'GK')?.name,
    playerRows.find((p) => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.pos))?.name,
    playerRows.find((p) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.pos))?.name,
    playerRows.find((p) => ['ST', 'LW', 'RW'].includes(p.pos))?.name,
  ].filter(Boolean);
  return [...byLine, `${rivalTeam}核心`, `${rivalTeam}门将`].slice(0, 6);
}

function buildAchievementBadges(campaign) {
  const badges = [
    { title: '战役胜场', value: `${campaign.playerWins}/${campaign.totalMatches || 0}`, note: '一路推进留下的硬成绩。' },
    { title: '火力指数', value: `${campaign.goalsFor}球`, note: campaign.goalsFor >= campaign.totalMatches * 2 ? '进攻端打出冠军相。' : '每个进球都来得很贵。' },
    { title: '防线成色', value: `${campaign.cleanSheets}零封`, note: campaign.cleanSheets ? '门将和中卫组有高光。' : '没有零封，比赛一直很刺激。' },
    { title: '射门压制', value: `${campaign.shotsFor}:${campaign.shotsAgainst}`, note: '反映整届比赛的场面主动权。' },
    { title: '控球均值', value: `${campaign.possession}%`, note: campaign.possession >= 54 ? '能把比赛节奏握在脚下。' : '更多依靠转换和效率。' },
    { title: '角球制造', value: `${campaign.cornersFor}次`, note: '定位球也是冠军路线的一部分。' },
  ];
  return badges;
}

function buildTechnicalSummary(campaign) {
  return [
    { label: '总进球', mine: campaign.goalsFor, rivals: campaign.goalsAgainst },
    { label: '总射门', mine: campaign.shotsFor, rivals: campaign.shotsAgainst },
    { label: '总射正', mine: campaign.shotsOnTargetFor, rivals: campaign.shotsOnTargetAgainst },
    { label: '累计xG', mine: campaign.xgFor.toFixed(1), rivals: campaign.xgAgainst.toFixed(1) },
    { label: '角球', mine: campaign.cornersFor, rivals: campaign.cornersAgainst },
    { label: '门将扑救', mine: campaign.saves, rivals: campaign.opponentSaves },
    { label: '平均控球', mine: `${campaign.possession}%`, rivals: `${100 - campaign.possession}%` },
    { label: '犯规', mine: campaign.fouls, rivals: Math.max(0, campaign.fouls + campaign.goalsFor - campaign.goalsAgainst) },
  ];
}

function buildLeaderboards({ state, playerRows, campaign, rivalStar }) {
  const attackers = playerRows.filter((p) => ['ST', 'LW', 'RW', 'CAM'].includes(p.pos)).sort((a, b) => b.rating - a.rating);
  const creators = playerRows.filter((p) => ['CAM', 'CM', 'LW', 'RW', 'LM', 'RM'].includes(p.pos)).sort((a, b) => b.rating - a.rating);
  const defenders = playerRows.filter((p) => ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(p.pos)).sort((a, b) => b.rating - a.rating);
  const ownGoals = splitTotal(campaign.goalsFor, attackers.length || 1);
  const assists = splitTotal(Math.max(0, campaign.goalsFor - 1), creators.length || 1);
  const mvpPoints = splitTotal(Math.max(3, campaign.playerWins * 2 + 2), Math.max(1, playerRows.length));
  const scoringLeaders = [
    ...attackers.slice(0, 4).map((p, i) => ({ player: p.name, team: '我的梦之队', goals: ownGoals[i] || 0 })),
    { player: rivalStar.winner, team: rivalStar.team, goals: Math.max(1, campaign.goalsAgainst + Math.ceil(campaign.otherGoalsFor / 4)) },
    { player: `${rivalStar.team}前锋`, team: rivalStar.team, goals: Math.max(1, Math.ceil(campaign.otherGoalsFor / 5)) },
  ].filter((row) => row.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 6);
  const assistLeaders = [
    ...creators.slice(0, 5).map((p, i) => ({ player: p.name, team: '我的梦之队', assists: assists[i] || 0 })),
    { player: `${rivalStar.team}核心`, team: rivalStar.team, assists: Math.max(1, Math.ceil(campaign.goalsAgainst / 2)) },
  ].filter((row) => row.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 6);
  const mvpLeaders = [
    ...playerRows.slice().sort((a, b) => b.rating - a.rating).slice(0, 5).map((p, i) => ({ player: p.name, team: '我的梦之队', points: mvpPoints[i] || 1 })),
    { player: rivalStar.winner, team: rivalStar.team, points: Math.max(2, campaign.goalsAgainst) },
  ].sort((a, b) => b.points - a.points).slice(0, 6);
  const saveLeaders = [
    { player: defenders.find((p) => p.pos === 'GK')?.name || '梦之队门将', team: '我的梦之队', saves: campaign.saves },
    { player: `${rivalStar.team}门将`, team: rivalStar.team, saves: campaign.opponentSaves },
    { player: `${rivalStar.team}后卫`, team: rivalStar.team, saves: Math.max(1, Math.ceil(campaign.shotsFor / 8)) },
  ].sort((a, b) => b.saves - a.saves).slice(0, 5);
  const teamStatsLeaders = [
    { label: '进球', mine: campaign.goalsFor, rivals: campaign.goalsAgainst, leader: campaign.goalsFor >= campaign.goalsAgainst ? '我的梦之队' : '对手' },
    { label: '射门', mine: campaign.shotsFor, rivals: campaign.shotsAgainst, leader: campaign.shotsFor >= campaign.shotsAgainst ? '我的梦之队' : '对手' },
    { label: '射正', mine: campaign.shotsOnTargetFor, rivals: campaign.shotsOnTargetAgainst, leader: campaign.shotsOnTargetFor >= campaign.shotsOnTargetAgainst ? '我的梦之队' : '对手' },
    { label: '角球', mine: campaign.cornersFor, rivals: campaign.cornersAgainst, leader: campaign.cornersFor >= campaign.cornersAgainst ? '我的梦之队' : '对手' },
    { label: '扑救', mine: campaign.saves, rivals: campaign.opponentSaves, leader: campaign.saves >= campaign.opponentSaves ? '我的梦之队' : '对手' },
    { label: '控球', mine: `${campaign.possession}%`, rivals: `${100 - campaign.possession}%`, leader: campaign.possession >= 50 ? '我的梦之队' : '对手' },
  ];
  return { scoringLeaders, assistLeaders, mvpLeaders, saveLeaders, teamStatsLeaders };
}

function splitTotal(total, count) {
  const safeCount = Math.max(1, count);
  const values = Array.from({ length: safeCount }, () => 0);
  let remaining = Math.max(0, Math.round(total));
  let i = 0;
  while (remaining > 0) {
    values[i % safeCount] += 1;
    remaining -= 1;
    i += i < safeCount ? 1 : 2;
  }
  return values.sort((a, b) => b - a);
}

function sumNested(items, path) {
  return items.reduce((sum, item) => {
    const value = readNested(item, path);
    return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
  }, 0);
}

function averageNested(items, path) {
  const values = items.map((item) => Number(readNested(item, path))).filter(Number.isFinite);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function readNested(item, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), item);
}

function normalizeGroupOpponents(opponents = []) {
  return opponents.slice(0, 3).map((team) => {
    if (typeof team === 'string') return { country: team, year: 2026, champion: false, tier: '', strength: null, tag: '' };
    return {
      country: team?.country || '待定',
      year: team?.year || 2026,
      champion: !!team?.champion,
      tier: team?.tier || '',
      strength: team?.strength || null,
      tag: team?.tag || '',
    };
  });
}

function playerFixture(id, matchday, home, opponent) {
  return {
    id,
    matchday,
    stage: stageByMatchday(matchday).name,
    home,
    away: opponent.country,
    opponentYear: opponent.year,
    opponentTag: opponent.tag || '',
    opponentTier: opponent.tier || '',
    opponentStrength: opponent.strength || null,
    championOpponent: !!opponent.champion,
    playerMatch: true,
  };
}

function otherFixture(id, matchday, home, away) {
  return {
    id,
    matchday,
    stage: stageByMatchday(matchday).name,
    home: home.country,
    away: away.country,
    homeYear: home.year,
    awayYear: away.year,
    homeTag: home.tag || '',
    awayTag: away.tag || '',
    homeTier: home.tier || '',
    awayTier: away.tier || '',
    homeStrength: home.strength || null,
    awayStrength: away.strength || null,
    playerMatch: false,
  };
}

function emptyStanding(team) {
  return { team, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
}

function ensureStanding(map, team) {
  if (!map.has(team)) map.set(team, emptyStanding(team));
  return map.get(team);
}

function applyResult(row, gf, ga) {
  row.played += 1;
  row.gf += gf;
  row.ga += ga;
  if (gf > ga) {
    row.win += 1;
    row.pts += 3;
  } else if (gf === ga) {
    row.draw += 1;
    row.pts += 1;
  } else {
    row.loss += 1;
  }
}
