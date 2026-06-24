import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import positionOverridesSeed from '../data/playerPositionOverrides.json' with { type: 'json' };

export const DETAILED_POSITIONS = new Set([
  'GK',
  'LB',
  'RB',
  'CB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'LM',
  'RM',
  'CAM',
  'LW',
  'RW',
  'ST',
]);

const BROAD_POSITIONS = new Set(['DF', 'MF', 'FW']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const overridesFile = path.join(__dirname, '..', 'data', 'playerPositionOverrides.json');
let overridesCache = { ...positionOverridesSeed };
let writeQueue = Promise.resolve();

export function makePositionKey(year, country, name) {
  return `${Number(year)}:${String(country || '').trim()}:${String(name || '').trim()}`;
}

export function needsPositionEnrichment(player) {
  const pos = String(player?.pos || '').toUpperCase();
  if (!BROAD_POSITIONS.has(pos)) return false;
  const detailed = normalizeDetailedPositions(player?.positions || []);
  return detailed.length === 0;
}

export function needsNameEnrichment(player) {
  return !String(player?.nameZh || player?.zhName || '').trim();
}

export function normalizeDetailedPositions(positions) {
  const seen = new Set();
  return (Array.isArray(positions) ? positions : [positions])
    .map((pos) => String(pos || '').toUpperCase().trim())
    .filter((pos) => {
      if (!DETAILED_POSITIONS.has(pos) || seen.has(pos)) return false;
      seen.add(pos);
      return true;
    })
    .slice(0, 2);
}

export function applyPositionEnrichment(players, overrides = {}) {
  return (Array.isArray(players) ? players : []).map((player) => {
    const override = overrides[makePositionKey(player.year, player.country, player.name)];
    if (!override) return player;
    const detailed = normalizeDetailedPositions(override?.positions);
    const nameZh = String(override.nameZh || player.nameZh || '').slice(0, 40);
    if (!needsPositionEnrichment(player)) {
      return nameZh ? { ...player, nameZh } : player;
    }
    if (!detailed.length) return nameZh ? { ...player, nameZh } : player;
    return {
      ...player,
      nameZh: nameZh || undefined,
      pos: detailed[0],
      positions: detailed,
      positionSource: override.source || 'llm-position-enrichment',
    };
  });
}

export async function enrichImportedSquadPositions({
  year,
  country,
  players,
  overrides = overridesCache,
  saveOverrides = savePositionOverrides,
  enrichFn,
}) {
  const withCached = applyPositionEnrichment(players, overrides);
  const pending = withCached.filter((p) => needsPositionEnrichment(p) || needsNameEnrichment(p));
  if (!pending.length || typeof enrichFn !== 'function') return withCached;

  let data;
  try {
    data = await enrichFn({
      year,
      country,
      players: pending.map((p) => ({
        name: p.name,
        country: p.country || country,
        year: p.year || year,
        officialPosition: p.pos,
        club: p.club || '',
        note: p.note || '',
      })),
    });
  } catch (err) {
    console.warn(`[player-positions] enrichment skipped for ${year} ${country}:`, err.message);
    return withCached;
  }
  const rows = Array.isArray(data?.players) ? data.players : [];
  const nextOverrides = { ...overrides };
  let changed = false;

  for (const row of rows) {
    const sourcePlayer = pending.find((p) => samePlayerName(p.name, row?.name));
    if (!sourcePlayer) continue;
    const positions = normalizeDetailedPositions(row.positions).length
      ? normalizeDetailedPositions(row.positions)
      : normalizeDetailedPositions(sourcePlayer.positions || [sourcePlayer.pos]);
    if (!positions.length) continue;
    nextOverrides[makePositionKey(sourcePlayer.year || year, sourcePlayer.country || country, sourcePlayer.name)] = {
      positions,
      nameZh: String(row.nameZh || '').slice(0, 40),
      source: 'llm-position-enrichment',
    };
    changed = true;
  }

  if (changed) {
    await saveOverrides(nextOverrides);
    overridesCache = { ...nextOverrides };
    return applyPositionEnrichment(players, nextOverrides);
  }
  return withCached;
}

export function currentPositionOverrides() {
  return overridesCache;
}

async function savePositionOverrides(nextOverrides) {
  writeQueue = writeQueue.then(async () => {
    await fs.writeFile(overridesFile, `${JSON.stringify(nextOverrides, null, 2)}\n`, 'utf8');
  });
  return writeQueue;
}

function samePlayerName(a, b) {
  return normalizeName(a) === normalizeName(b);
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}
