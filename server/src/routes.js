// HTTP routes. Thin layer: validate input, call prompts/* + db/*, return JSON.
// Game state (squad, round, history) lives on the CLIENT; the server is
// stateless per-request except for the roster cache in MySQL.

import express from 'express';
import { FORMATIONS, listFormations, positionMatches } from './formations.js';
import { EDITIONS, YEARS, editionByYear, randomEdition, randomTeamFromEdition } from './wcData.js';
import { pickChampionOpponent } from './tournament.js';
import {
  getCachedSquad,
  getImportedSquad,
  cacheSquad,
  isDbReady,
  saveDraft,
  listImportedSquadKeys,
} from './db.js';
import { buildSquadResponse, normalizeCompletedDraft } from './playerCatalog.js';
import { enrichImportedSquadPositions, currentPositionOverrides } from './playerPositions.js';
import { enrichImportedSquadAppearances, currentAppearanceOverrides } from './playerAppearances.js';
import { assessTeam, judgeMatchup } from './teamAssessment.js';
import {
  COMMENTARY_STYLES,
  generateSquad,
  enrichPlayerAppearances,
  enrichPlayerPositions,
  eraProfile,
  playerCareerBio,
  preMatchEvent,
  simulateMatch,
  simulateOtherMatch,
  analyzePress,
  endgameHeadline,
  tournamentAwards,
} from './prompts.js';

export const router = express.Router();

// --- static config -------------------------------------------------------
router.get('/config', (req, res) => {
  const editions = editionsWithImportedSquads();
  res.json({
    years: editions.map((e) => e.year),
    editions: editions.map((e) => ({ year: e.year, host: e.host })),
    formations: listFormations(),
    commentaryStyles: Object.entries(COMMENTARY_STYLES).map(([id, s]) => ({ id, name: s.name, nameEn: s.nameEn || s.name })),
    dbCache: isDbReady(),
  });
});

router.post('/player-bio', async (req, res) => {
  try {
    const { player, year, country, language = 'zh-CN' } = req.body || {};
    if (!player?.name && !player?.nameZh) {
      return res.status(400).json({ error: 'player required' });
    }
    const bio = await playerCareerBio({ player, year, country, language });
    res.json(bio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- era flavor text ------------------------------------------------------
router.get('/era/:year', async (req, res) => {
  try {
    const year = Number(req.params.year);
    if (!editionByYear(year)) return res.status(400).json({ error: 'unknown year' });
    const profile = await eraProfile(year, req.query.language || req.query.lang || 'zh-CN');
    res.json({ year, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- spin: roll a (year + country) for a slot ----------------------------
// body: { minYear?, maxYear?, centerYear, bias, lockYear?, lockCountry? }
//   minYear/maxYear -> HARD window: spins never escape this year range
//   lockYear   -> keep the year, reroll only the country in that edition
//   lockCountry-> keep the country, reroll only the year (a different edition
//                 that also fielded that nation, still within the window)
router.post('/spin', (req, res) => {
  const { minYear, maxYear, centerYear, bias = 0, lockYear, lockCountry } = req.body || {};

  const result = pickSpinResult({
    editions: editionsWithImportedSquads(),
    minYear,
    maxYear,
    centerYear,
    bias,
    lockYear,
    lockCountry,
  });
  if (!result) {
    return res.status(400).json({ error: 'selected era has no imported squads' });
  }
  res.json(result);
});

// --- squad: get roster for a (year, country), cache-first ----------------
router.post('/squad', async (req, res) => {
  try {
    const year = Number(req.body?.year);
    const country = String(req.body?.country || '').trim();
    if (!editionByYear(year) || !country) {
      return res.status(400).json({ error: 'year and country required' });
    }
    const importedRaw = await getImportedSquad(year, country);
    const imported = importedRaw.length
      ? await enrichImportedSquadPositions({
          year,
          country,
          players: importedRaw,
          overrides: currentPositionOverrides(),
          enrichFn: enrichPlayerPositions,
        })
      : [];
    const importedWithAppearances = imported.length
      ? await enrichImportedSquadAppearances({
          year,
          country,
          players: imported,
          overrides: currentAppearanceOverrides(),
          enrichFn: enrichPlayerAppearances,
        })
      : imported;
    const cached = importedWithAppearances.length ? [] : await getCachedSquad(year, country);
    let generated = [];
    if (!importedWithAppearances.length && (!cached || !cached.length)) {
      generated = await generateSquad(year, country);
      if (generated.length) cacheSquad(year, country, generated, 'llm_fallback'); // fire-and-forget
    }
    res.json(buildSquadResponse({ year, country, imported: importedWithAppearances, cached, generated }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- completed draft persistence -----------------------------------------
router.post('/draft/complete', async (req, res) => {
  try {
    const { formation, centerYear, squad = [] } = req.body || {};
    if (!formation || !Array.isArray(squad) || squad.length < 11) {
      return res.status(400).json({ error: 'formation and at least 11 players required' });
    }
    const draft = normalizeCompletedDraft(squad);
    const draftId = await saveDraft({ formation, centerYear, squad: draft });
    res.json({ draftId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- pre-match event (caller decides the 40% roll, or force=true) --------
router.post('/event', async (req, res) => {
  try {
    const { round = 1, squad = [], formation = '4-4-2', force = false, language = 'zh-CN' } = req.body || {};
    const triggered = force || Math.random() < 0.4;
    if (!triggered) return res.json({ triggered: false });
    const event = await preMatchEvent({ round, squad, formation, language });
    res.json({ triggered: true, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- opponent: roll an opponent team for this round ----------------------
router.post('/opponent', (req, res) => {
  const round = Number(req.body?.round) || 1;
  res.json(pickChampionOpponent(round));
});

// --- match simulation -----------------------------------------------------
router.post('/match', async (req, res) => {
  try {
    const {
      round = 1,
      formation = '4-4-2',
      squad = [],
      opponent,
      commentaryStyle = 'passion',
      consequences = [],
      bench = [],
      language = 'zh-CN',
    } = req.body || {};
    if (!opponent || !opponent.country) {
      return res.status(400).json({ error: 'opponent required' });
    }
    // annotate out-of-position before sending to LLM
    const fdef = FORMATIONS[formation];
    const starters = squad.slice(0, 11);
    const benchCells = Array.isArray(bench) && bench.length ? bench.slice(0, 2) : squad.slice(11, 13);
    const annotated = starters.map((s) => {
      const slot = fdef?.slots.find((sl) => sl.id === s.slotId);
      const slotPos = slot?.pos || s.pos;
      const playerPositions = Array.isArray(s.player?.positions) && s.player.positions.length
        ? s.player.positions
        : [s.player?.pos || slotPos];
      const outOfPosition = !playerPositions.some((pos) => positionMatches(pos, slotPos));
      return { ...s, pos: slotPos, outOfPosition };
    });
    const annotatedBench = benchCells.map((s, index) => ({
      ...s,
      slotId: s.slotId || `BENCH_${index + 1}`,
      pos: s.pos || `BENCH_${index + 1}`,
      outOfPosition: false,
    }));
    const teamAssessment = assessTeam({ round, squad: annotated, bench: annotatedBench });
    const verdict = judgeMatchup({ round, assessment: teamAssessment, opponent });
    const result = await simulateMatch({
      round,
      formation,
      squad: annotated,
      bench: annotatedBench,
      opponent,
      commentaryStyle,
      consequences,
      teamAssessment,
      matchVerdict: verdict,
      language,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/other-match', async (req, res) => {
  try {
    const { stage = '小组赛', home, away, context = '', language = 'zh-CN' } = req.body || {};
    if (!home || !away) return res.status(400).json({ error: 'home and away required' });
    const result = await simulateOtherMatch({ stage, home, away, context, language });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- press conference analysis -------------------------------------------
router.post('/press', async (req, res) => {
  try {
    const { question, answer, squad = [], lastMatch, language = 'zh-CN' } = req.body || {};
    if (!answer || !String(answer).trim()) {
      return res.status(400).json({ error: 'answer required' });
    }
    const result = await analyzePress({ question, answer, squad, lastMatch, language });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- endgame headline -----------------------------------------------------
router.post('/endgame', async (req, res) => {
  try {
    const { outcome = 'eliminated', round = 1, squad = [], history = [], language = 'zh-CN' } = req.body || {};
    const card = await endgameHeadline({ outcome, round, squad, history, language });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/awards', async (req, res) => {
  try {
    const { outcome = 'eliminated', squad = [], history = [], tournament = {}, language = 'zh-CN' } = req.body || {};
    const awards = await tournamentAwards({ outcome, squad, history, tournament, language });
    res.json(awards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export function editionsWithImportedSquads() {
  const keys = listImportedSquadKeys();
  const countriesByYear = new Map();
  for (const key of keys) {
    if (!countriesByYear.has(key.year)) countriesByYear.set(key.year, new Set());
    countriesByYear.get(key.year).add(key.country);
  }
  return EDITIONS
    .filter((edition) => countriesByYear.has(edition.year))
    .map((edition) => ({
      ...edition,
      teams: [...countriesByYear.get(edition.year)].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN')),
    }))
    .filter((edition) => edition.teams.length);
}

export function windowImportedEditions(editions, minYear, maxYear) {
  const lo = Number(minYear);
  const hi = Number(maxYear);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return editions;
  return editions.filter((e) => e.year >= lo && e.year <= hi);
}

export function pickSpinResult({
  editions,
  minYear,
  maxYear,
  centerYear,
  bias = 0.6,
  lockYear,
  lockCountry,
}) {
  const windowed = windowImportedEditions(editions, minYear, maxYear);
  if (!windowed.length) return null;

  // Reroll country only: stay in the locked year's edition, pick a new team.
  if (lockYear) {
    const edition = windowed.find((e) => e.year === Number(lockYear));
    if (edition) {
      const country = randomTeamFromEdition(edition, lockCountry);
      return { year: edition.year, host: edition.host, country };
    }
  }

  // Reroll year only: keep the nation when possible; otherwise stay in-window.
  if (lockCountry) {
    const countryEditions = windowed.filter((e) => e.teams.includes(lockCountry));
    const edition =
      (countryEditions.length
        ? randomImportedEdition(countryEditions, Number(centerYear) || null, Number(bias))
        : null) ||
      randomImportedEdition(windowed, Number(centerYear) || null, Number(bias));
    if (!edition) return null;
    const country = edition.teams.includes(lockCountry) ? lockCountry : randomTeamFromEdition(edition);
    return { year: edition.year, host: edition.host, country };
  }

  // Full spin: roll both year and country, within the window.
  const edition = randomImportedEdition(windowed, Number(centerYear) || null, Number(bias));
  if (!edition) return null;
  const country = randomTeamFromEdition(edition);
  return { year: edition.year, host: edition.host, country };
}

function randomImportedEdition(editions, centerYear, bias = 0) {
  if (!editions.length) return randomEdition(centerYear, bias);
  if (!centerYear || bias <= 0) {
    return editions[Math.floor(Math.random() * editions.length)];
  }
  const weights = editions.map((e) => {
    const dist = Math.abs(e.year - centerYear);
    return 1 / (1 + Math.pow(dist / 20, 2) * bias);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < editions.length; i++) {
    r -= weights[i];
    if (r <= 0) return editions[i];
  }
  return editions[editions.length - 1];
}

function randomImportedEditionWithTeam(editions, country, centerYear, bias = 0) {
  return randomImportedEdition(editions.filter((e) => e.teams.includes(country)), centerYear, bias);
}
