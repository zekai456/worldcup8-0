export function chooseRosterSource({ imported, cached }) {
  if (Array.isArray(imported) && imported.length) {
    return { source: 'database', players: imported };
  }
  if (Array.isArray(cached) && cached.length) {
    return { source: 'cache', players: cached.map(normalizeFallbackPlayer) };
  }
  return { source: 'llm_fallback', players: [] };
}

export function buildSquadResponse({ year, country, imported, cached, generated }) {
  const chosen = chooseRosterSource({ imported, cached });
  const players =
    chosen.source === 'llm_fallback'
      ? (generated || []).map(normalizeFallbackPlayer)
      : chosen.players.map(normalizeFallbackPlayer);

  return { year, country, source: chosen.source, players };
}

export function normalizeCompletedDraft(arr) {
  return (Array.isArray(arr) ? arr : []).map((s) => ({
    slotId: String(s.slotId || ''),
    pos: String(s.pos || '').toUpperCase(),
    year: Number(s.year) || null,
    country: String(s.country || ''),
    host: String(s.host || ''),
    player: normalizeFallbackPlayer(s.player || {}),
    outOfPosition: !!s.outOfPosition,
  }));
}

export function normalizeFallbackPlayer(p) {
  // Preserve a genuinely-unknown rating as null instead of fabricating 75 —
  // the historical (fjelstul) squads ship with no ratings, and a fake 75 on
  // every card made them indistinguishable.
  const overall = nullableStat(p.overall ?? p.rating);
  return {
    name: String(p.name || '').slice(0, 80),
    nameZh: String(p.nameZh || p.zhName || '').slice(0, 40),
    pos: String(p.pos || 'CM').toUpperCase(),
    rating: overall,
    overall,
    positions: normalizePositions(p),
    shirtNumber: normalizeShirtNumber(p.shirtNumber ?? p.number ?? p.jerseyNumber),
    pace: nullableStat(p.pace),
    shooting: nullableStat(p.shooting),
    passing: nullableStat(p.passing),
    dribbling: nullableStat(p.dribbling),
    defending: nullableStat(p.defending),
    physical: nullableStat(p.physical),
    note: String(p.note || '').slice(0, 120),
    source: String(p.source || 'llm_fallback'),
    ratingsSource: p.ratingsSource || null,
  };
}

function normalizeShirtNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 99 ? rounded : null;
}

function nullableStat(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePositions(player) {
  const primary = String(player.pos || 'CM').toUpperCase();
  if (isBroadOnlySource(player)) return [primary];
  const raw = Array.isArray(player.positions) && player.positions.length
    ? [primary, ...player.positions]
    : [primary];
  const seen = new Set();
  return raw
    .map((pos) => String(pos || '').toUpperCase())
    .filter((pos) => {
      if (!pos || seen.has(pos)) return false;
      seen.add(pos);
      return true;
    })
    .slice(0, 2);
}

function isBroadOnlySource(player) {
  return ['DF', 'MF', 'FW'].includes(String(player.pos || '').toUpperCase()) &&
    !String(player.ratingsSource || '').startsWith('sofifa-');
}
