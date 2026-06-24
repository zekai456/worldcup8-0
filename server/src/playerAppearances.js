import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appearanceOverridesSeed from '../data/playerAppearanceOverrides.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const overridesFile = path.join(__dirname, '..', 'data', 'playerAppearanceOverrides.json');
let overridesCache = { ...appearanceOverridesSeed };
let writeQueue = Promise.resolve();

export function makeAppearanceKey(year, country, name) {
  return `${Number(year)}:${String(country || '').trim()}:${String(name || '').trim()}`;
}

export function normalizeAppearanceOverride(row = {}) {
  const next = {};
  const nameZh = String(row.nameZh || row.zhName || '').trim().slice(0, 40);
  const shirtNumber = normalizeShirtNumber(row.shirtNumber ?? row.number ?? row.jerseyNumber);
  const overall = normalizeRating(row.overall ?? row.rating);
  if (nameZh) next.nameZh = nameZh;
  if (overall !== null) next.overall = overall;
  if (shirtNumber !== null) next.shirtNumber = shirtNumber;
  return next;
}

export function applyAppearanceEnrichment(players, overrides = {}) {
  return (Array.isArray(players) ? players : []).map((player) => {
    const override = normalizeAppearanceOverride(
      overrides[makeAppearanceKey(player.year, player.country, player.name)]
    );
    if (!Object.keys(override).length) return player;
    const overall = override.overall ?? player.overall ?? player.rating ?? null;
    return {
      ...player,
      nameZh: override.nameZh || player.nameZh,
      shirtNumber: override.shirtNumber ?? player.shirtNumber ?? null,
      rating: overall,
      overall,
      appearanceSource: 'llm-appearance-enrichment',
    };
  });
}

export function needsAppearanceEnrichment(player, sameNameAppearances = []) {
  if (!player) return false;
  if (normalizeShirtNumber(player.shirtNumber ?? player.number ?? player.jerseyNumber) === null) return true;
  if (!String(player.nameZh || player.zhName || '').trim()) return true;
  const rating = normalizeRating(player.overall ?? player.rating);
  if (rating === null) return true;
  const sameRatedAppearances = sameNameAppearances.filter((p) =>
    normalizeName(p.name) === normalizeName(player.name) &&
    normalizeRating(p.overall ?? p.rating) === rating
  );
  return sameRatedAppearances.length > 1;
}

export async function enrichImportedSquadAppearances({
  year,
  country,
  players,
  overrides = overridesCache,
  saveOverrides = saveAppearanceOverrides,
  enrichFn,
}) {
  const withCached = applyAppearanceEnrichment(players, overrides);
  const pending = withCached.filter((p) => {
    if (overrides[makeAppearanceKey(p.year || year, p.country || country, p.name)]) return false;
    return needsAppearanceEnrichment(p, withCached);
  });
  if (!pending.length || typeof enrichFn !== 'function') return withCached;

  let data;
  try {
    data = await enrichFn({
      year,
      country,
      players: pending.map((p) => ({
        name: p.name,
        nameZh: p.nameZh || '',
        country: p.country || country,
        year: p.year || year,
        pos: p.pos,
        positions: p.positions || [p.pos],
        currentOverall: p.overall ?? p.rating ?? null,
        note: p.note || '',
      })),
    });
  } catch (err) {
    console.warn(`[player-appearances] enrichment skipped for ${year} ${country}:`, err.message);
    return withCached;
  }
  const rows = Array.isArray(data?.players) ? data.players : [];
  const nextOverrides = { ...overrides };
  let changed = false;

  for (const row of rows) {
    const rowYear = Number(row?.year) || null;
    const rowCountry = String(row?.country || '').trim();
    const sourcePlayer = pending.find((p) =>
      samePlayerName(p.name, row?.name) &&
      (!rowYear || Number(p.year || year) === rowYear) &&
      (!rowCountry || String(p.country || country).trim() === rowCountry)
    );
    if (!sourcePlayer) continue;
    const override = normalizeAppearanceOverride(row);
    if (!Object.keys(override).length) continue;
    nextOverrides[makeAppearanceKey(sourcePlayer.year || year, sourcePlayer.country || country, sourcePlayer.name)] = {
      ...override,
      source: 'llm-appearance-enrichment',
    };
    changed = true;
  }

  if (changed) {
    await saveOverrides(nextOverrides);
    overridesCache = { ...nextOverrides };
    return applyAppearanceEnrichment(players, nextOverrides);
  }
  return withCached;
}

export function currentAppearanceOverrides() {
  return overridesCache;
}

async function saveAppearanceOverrides(nextOverrides) {
  writeQueue = writeQueue.then(async () => {
    await fs.writeFile(overridesFile, `${JSON.stringify(nextOverrides, null, 2)}\n`, 'utf8');
  });
  return writeQueue;
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 99 ? rounded : null;
}

function normalizeShirtNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 99 ? rounded : null;
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
