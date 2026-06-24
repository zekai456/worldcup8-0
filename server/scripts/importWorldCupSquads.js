import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/squads.csv';
const APPEARANCES_URL =
  'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/player_appearances.csv';
const GOALS_URL =
  'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/goals.csv';
const BOOKINGS_URL =
  'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/bookings.csv';
const SOFIFA_BASE_URL =
  'https://raw.githubusercontent.com/ifrankandrade/data-visualization/main/datasets';
const SOFIFA_SEASONS = [17, 18, 19, 20, 21];

const TEAM_NAME_MAP = {
  Argentina: '阿根廷',
  Australia: '澳大利亚',
  Austria: '奥地利',
  Belgium: '比利时',
  Bolivia: '玻利维亚',
  Brazil: '巴西',
  Bulgaria: '保加利亚',
  Cameroon: '喀麦隆',
  Canada: '加拿大',
  Chile: '智利',
  China: '中国',
  Colombia: '哥伦比亚',
  'Costa Rica': '哥斯达黎加',
  Croatia: '克罗地亚',
  Cuba: '古巴',
  Czechia: '捷克',
  Czechoslovakia: '捷克斯洛伐克',
  Denmark: '丹麦',
  'Dutch East Indies': '荷属东印度',
  Ecuador: '厄瓜多尔',
  Egypt: '埃及',
  England: '英格兰',
  France: '法国',
  Germany: '德国',
  'German DR': '东德',
  Ghana: '加纳',
  Greece: '希腊',
  Haiti: '海地',
  Honduras: '洪都拉斯',
  Hungary: '匈牙利',
  Iceland: '冰岛',
  Iran: '伊朗',
  Iraq: '伊拉克',
  Ireland: '爱尔兰',
  Israel: '以色列',
  Italy: '意大利',
  Jamaica: '牙买加',
  Japan: '日本',
  Korea: '韩国',
  Kuwait: '科威特',
  Mexico: '墨西哥',
  Morocco: '摩洛哥',
  Netherlands: '荷兰',
  'New Zealand': '新西兰',
  Nigeria: '尼日利亚',
  'North Korea': '朝鲜',
  'Northern Ireland': '北爱尔兰',
  Norway: '挪威',
  Panama: '巴拿马',
  Paraguay: '巴拉圭',
  Peru: '秘鲁',
  Poland: '波兰',
  Portugal: '葡萄牙',
  Qatar: '卡塔尔',
  Romania: '罗马尼亚',
  Russia: '俄罗斯',
  'Saudi Arabia': '沙特阿拉伯',
  Scotland: '苏格兰',
  Senegal: '塞内加尔',
  Serbia: '塞尔维亚',
  Slovakia: '斯洛伐克',
  Slovenia: '斯洛文尼亚',
  'South Africa': '南非',
  Spain: '西班牙',
  Sweden: '瑞典',
  Switzerland: '瑞士',
  Tunisia: '突尼斯',
  Turkey: '土耳其',
  Ukraine: '乌克兰',
  Uruguay: '乌拉圭',
  USA: '美国',
  Wales: '威尔士',
  Yugoslavia: '南斯拉夫',
  'West Germany': '西德',
};

const POSITION_MAP = {
  GK: 'GK',
  DF: 'DF',
  MF: 'MF',
  FW: 'FW',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, '..', 'data', 'importedPlayers.json');
const fifa2026File = path.join(__dirname, '..', 'data', 'raw', 'fifa-2026-squads.json');

const [response, appearancesResponse, goalsResponse, bookingsResponse, ...ratingResponses] = await Promise.all([
  fetch(SOURCE_URL),
  fetch(APPEARANCES_URL),
  fetch(GOALS_URL),
  fetch(BOOKINGS_URL),
  ...SOFIFA_SEASONS.map((season) => fetch(`${SOFIFA_BASE_URL}/players_${season}.csv`)),
]);
if (!response.ok) throw new Error(`Failed to download squads.csv: ${response.status}`);
if (!appearancesResponse.ok) throw new Error(`Failed to download player_appearances.csv: ${appearancesResponse.status}`);
if (!goalsResponse.ok) throw new Error(`Failed to download goals.csv: ${goalsResponse.status}`);
if (!bookingsResponse.ok) throw new Error(`Failed to download bookings.csv: ${bookingsResponse.status}`);
for (let i = 0; i < ratingResponses.length; i++) {
  if (!ratingResponses[i].ok) {
    throw new Error(`Failed to download SoFIFA players_${SOFIFA_SEASONS[i]}.csv: ${ratingResponses[i].status}`);
  }
}

const csv = await response.text();
const appearancesCsv = await appearancesResponse.text();
const goalsCsv = await goalsResponse.text();
const bookingsCsv = await bookingsResponse.text();
const ratingsCsvs = await Promise.all(ratingResponses.map((res) => res.text()));
const rows = parseCsv(csv);
const factIndex = buildFactIndex({
  appearances: parseCsv(appearancesCsv),
  goals: parseCsv(goalsCsv),
  bookings: parseCsv(bookingsCsv),
});
const ratingRows = ratingsCsvs.flatMap((text, i) =>
  parseCsv(text).map((row) => ({ ...row, season: 2000 + SOFIFA_SEASONS[i] }))
);
const ratingIndex = buildRatingIndex(ratingRows);
const historicalPlayers = rows
  .filter((row) => row.tournament_id?.startsWith('WC-'))
  .map((row) => toImportedPlayer(row, ratingIndex, factIndex))
  .filter(Boolean);
const players = [
  ...historicalPlayers,
  ...(await loadFifa2026Players(ratingIndex)),
];

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, `${JSON.stringify(players, null, 2)}\n`, 'utf8');

console.log(`Imported ${players.length} World Cup squad player rows to ${outFile}`);

async function loadFifa2026Players(ratingIndex) {
  try {
    const raw = JSON.parse(await fs.readFile(fifa2026File, 'utf8'));
    return raw.map((p) => {
      const rating = findRating(ratingIndex, countryToEnglish(p.country), p.name, '', 2026);
      const facts = {
        apps: Number(p.caps) || 0,
        starts: 0,
        subs: 0,
        goals: Number(p.goals) || 0,
        penaltyGoals: 0,
        ownGoals: 0,
        yellows: 0,
        reds: 0,
        secondYellows: 0,
        height: Number(p.height) || null,
      };
      const derived = deriveFactsRating({ pos: p.pos, year: 2026, facts });
      const hasFactsFill = rating && ['overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']
        .some((key) => rating[key] == null);
      return {
        year: 2026,
        country: p.country,
        name: p.name,
        pos: p.pos,
        positions: p.positions,
        overall: rating?.overall ?? derived.overall,
        pace: rating?.pace ?? derived.pace,
        shooting: rating?.shooting ?? derived.shooting,
        passing: rating?.passing ?? derived.passing,
        dribbling: rating?.dribbling ?? derived.dribbling,
        defending: rating?.defending ?? derived.defending,
        physical: rating?.physical ?? derived.physical,
        note: p.note,
        source: p.source,
        ratingsSource: rating
          ? `sofifa-players-${String(rating.season).slice(2)}${hasFactsFill ? '+fifa-2026-facts-fill' : ''}`
          : 'fifa-2026-facts-derived',
        ratingFacts: hasFactsFill || !rating ? facts : null,
      };
    });
  } catch (err) {
    console.warn(`Skipping 2026 FIFA squads: ${err.message}`);
    return [];
  }
}

function countryToEnglish(country) {
  const found = Object.entries(TEAM_NAME_MAP).find(([, zh]) => zh === country);
  if (found) return found[0];
  const extra = {
    阿尔及利亚: 'Algeria',
    美国: 'USA',
    乌兹别克斯坦: 'Uzbekistan',
  };
  return extra[country] || country;
}

function toImportedPlayer(row, ratingIndex, factIndex) {
  const year = Number(row.tournament_id.replace('WC-', ''));
  if (!Number.isFinite(year)) return null;

  const country = TEAM_NAME_MAP[row.team_name];
  if (!country) return null;

  const officialPos = POSITION_MAP[row.position_code] || 'MF';
  const name = [row.given_name, row.family_name].filter(Boolean).join(' ').trim();
  if (!name) return null;

  const rating = findRating(ratingIndex, row.team_name, name, row.family_name, year);
  const facts = factIndex.get(factKey(row)) || emptyFacts();
  const derived = deriveFactsRating({ pos: officialPos, year, facts });
  const hasFactsFill = rating && ['overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']
    .some((key) => rating[key] == null);
  return {
    year,
    country,
    name,
    pos: officialPos,
    positions: [officialPos],
    overall: rating?.overall ?? derived.overall,
    pace: rating?.pace ?? derived.pace,
    shooting: rating?.shooting ?? derived.shooting,
    passing: rating?.passing ?? derived.passing,
    dribbling: rating?.dribbling ?? derived.dribbling,
    defending: rating?.defending ?? derived.defending,
    physical: rating?.physical ?? derived.physical,
    note: `${row.team_name} ${year} World Cup squad`,
    source: 'fjelstul-worldcup-squads',
    ratingsSource: rating
      ? `sofifa-players-${String(rating.season).slice(2)}${hasFactsFill ? '+worldcup-facts-fill' : ''}`
      : 'worldcup-facts-derived',
    ratingFacts: hasFactsFill || !rating ? facts : null,
  };
}

function buildFactIndex({ appearances, goals, bookings }) {
  const index = new Map();
  for (const row of appearances.filter((r) => r.tournament_id?.startsWith('WC-'))) {
    const key = factKey(row);
    const facts = ensureFacts(index, key);
    facts.apps += 1;
    facts.starts += Number(row.starter) || 0;
    facts.subs += Number(row.substitute) || 0;
  }
  for (const row of goals.filter((r) => r.tournament_id?.startsWith('WC-'))) {
    const key = factKey(row);
    const facts = ensureFacts(index, key);
    if (Number(row.own_goal)) facts.ownGoals += 1;
    else if (Number(row.penalty)) facts.penaltyGoals += 1;
    else facts.goals += 1;
  }
  for (const row of bookings.filter((r) => r.tournament_id?.startsWith('WC-'))) {
    const key = factKey(row);
    const facts = ensureFacts(index, key);
    facts.yellows += Number(row.yellow_card) || 0;
    facts.reds += Number(row.red_card) || 0;
    facts.secondYellows += Number(row.second_yellow_card) || 0;
  }
  return index;
}

function ensureFacts(index, key) {
  if (!index.has(key)) index.set(key, emptyFacts());
  return index.get(key);
}

function emptyFacts() {
  return {
    apps: 0,
    starts: 0,
    subs: 0,
    goals: 0,
    penaltyGoals: 0,
    ownGoals: 0,
    yellows: 0,
    reds: 0,
    secondYellows: 0,
  };
}

function deriveFactsRating({ pos, year, facts }) {
  const era = year >= 1998 ? 2 : year >= 1974 ? 1 : 0;
  const participation = Math.min(10, facts.starts * 2 + facts.subs);
  const goalImpact = Math.min(10, facts.goals * 2 + facts.penaltyGoals);
  const discipline = Math.min(8, facts.reds * 4 + facts.secondYellows * 3 + facts.yellows);
  const ownGoalPenalty = Math.min(4, facts.ownGoals * 2);
  const baseOverall = clamp(62 + participation + Math.floor(goalImpact / 2) + era - Math.floor(discipline / 3) - ownGoalPenalty, 50, 86);
  const profile = {
    GK: { pace: 42, shooting: 28, passing: 54, dribbling: 48, defending: 64, physical: 70 },
    CB: { pace: 60, shooting: 42, passing: 58, dribbling: 55, defending: 70, physical: 72 },
    CM: { pace: 64, shooting: 60, passing: 68, dribbling: 66, defending: 62, physical: 66 },
    ST: { pace: 70, shooting: 70, passing: 60, dribbling: 68, defending: 40, physical: 66 },
  }[pos] || { pace: 62, shooting: 58, passing: 62, dribbling: 62, defending: 58, physical: 64 };
  const boost = Math.max(-8, baseOverall - 68);
  return {
    overall: baseOverall,
    pace: clamp(profile.pace + Math.floor(boost / 2), 25, 90),
    shooting: clamp(profile.shooting + Math.floor(goalImpact / 2) + Math.floor(boost / 2), 20, 90),
    passing: clamp(profile.passing + Math.floor(participation / 3), 25, 90),
    dribbling: clamp(profile.dribbling + Math.floor(participation / 4), 25, 90),
    defending: clamp(profile.defending + Math.floor(participation / 3) - facts.ownGoals, 20, 90),
    physical: clamp(profile.physical + Math.floor(participation / 3) - Math.floor(discipline / 3), 25, 90),
  };
}

function factKey(row) {
  return `${row.tournament_id}:${row.team_id}:${row.player_id}`;
}

function buildRatingIndex(rows) {
  const byNationality = new Map();
  for (const row of rows) {
    const nationality = row.nationality;
    const entry = {
      names: [row.long_name, row.short_name].filter(Boolean).map(normalizeName),
      family: normalizeName(String(row.long_name || '').split(' ').slice(-1)[0] || ''),
      positions: String(row.player_positions || '')
        .split(',')
        .map((p) => mapSofifaPosition(p.trim()))
        .filter(Boolean),
      overall: numberOrNull(row.overall),
      pace: numberOrNull(row.pace ?? row.gk_speed),
      shooting: numberOrNull(row.shooting),
      passing: numberOrNull(row.passing),
      dribbling: numberOrNull(row.dribbling),
      defending: numberOrNull(row.defending),
      physical: numberOrNull(row.physic),
      season: Number(row.season),
    };
    if (!byNationality.has(nationality)) byNationality.set(nationality, []);
    byNationality.get(nationality).push(entry);
  }
  return byNationality;
}

function findRating(index, teamName, fullName, familyName, tournamentYear) {
  const candidates = index.get(teamName) || [];
  const target = normalizeName(fullName);
  const targetTokens = tokenSet(target);
  return (
    bestSeasonMatch(candidates.filter((c) => c.names.includes(target)), tournamentYear) ||
    bestSeasonMatch(candidates.filter((c) => c.names.some((name) => isLikelySameName(targetTokens, tokenSet(name)))), tournamentYear) ||
    null
  );
}

function bestSeasonMatch(candidates, tournamentYear) {
  if (!candidates.length) return null;
  const year = Number.isFinite(tournamentYear) ? tournamentYear : 2021;
  return candidates
    .slice()
    .sort((a, b) => Math.abs(a.season - year) - Math.abs(b.season - year))[0];
}

function mapSofifaPosition(pos) {
  if (['GK'].includes(pos)) return 'GK';
  if (['LB', 'LWB'].includes(pos)) return pos;
  if (['RB', 'RWB'].includes(pos)) return pos;
  if (['CB'].includes(pos)) return 'CB';
  if (['CDM'].includes(pos)) return 'CDM';
  if (['CM'].includes(pos)) return 'CM';
  if (['LM', 'RM'].includes(pos)) return pos;
  if (['CAM', 'CF'].includes(pos)) return 'CAM';
  if (['LW', 'RW'].includes(pos)) return pos;
  if (['ST'].includes(pos)) return 'ST';
  return null;
}

function mergePositions(primary, extra = []) {
  const seen = new Set();
  return [...primary, ...extra].filter((pos) => {
    if (!pos || seen.has(pos)) return false;
    seen.add(pos);
    return true;
  }).slice(0, 2);
}

function parseCsv(input) {
  const lines = input.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] || '']));
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(
    String(value || '')
      .split(' ')
      .filter((token) => token.length > 1)
  );
}

function isLikelySameName(targetTokens, candidateTokens) {
  if (!targetTokens.size || !candidateTokens.size) return false;
  let overlap = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }
  return overlap >= Math.min(2, targetTokens.size);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
