// MySQL connection pool + roster cache.
// The DB caches LLM-generated squads so a given (year, country) is only
// generated once, then reused across players/sessions. Degrades gracefully:
// if the DB is unreachable, caching is skipped and the game still runs.

import mysql from 'mysql2/promise';
import importedPlayers from '../data/importedPlayers.json' with { type: 'json' };

let pool = null;
let dbReady = false;

export function buildSchemaStatements() {
  return [
    `
      CREATE TABLE IF NOT EXISTS wc_squads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        country VARCHAR(64) NOT NULL,
        squad_json MEDIUMTEXT NOT NULL,
        source VARCHAR(32) DEFAULT 'llm',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_year_country (year, country)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS wc_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        country VARCHAR(64) NOT NULL,
        name VARCHAR(96) NOT NULL,
        pos VARCHAR(8) NOT NULL,
        shirt_number INT DEFAULT NULL,
        source VARCHAR(64) DEFAULT 'curated',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_player_appearance (year, country, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS wc_player_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        overall INT DEFAULT NULL,
        pace INT DEFAULT NULL,
        shooting INT DEFAULT NULL,
        passing INT DEFAULT NULL,
        dribbling INT DEFAULT NULL,
        defending INT DEFAULT NULL,
        physical INT DEFAULT NULL,
        note VARCHAR(160) DEFAULT '',
        source VARCHAR(64) DEFAULT NULL,
        facts_json TEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_player_rating (player_id),
        CONSTRAINT fk_wc_player_ratings_player
          FOREIGN KEY (player_id) REFERENCES wc_players(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS wc_draft_squads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        formation VARCHAR(32) NOT NULL,
        center_year INT DEFAULT NULL,
        squad_json MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  ];
}

export async function initDb() {
  try {
    console.log('[db] connecting...');
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 8000,
      charset: 'utf8mb4',
    });

    for (const stmt of buildSchemaStatements()) {
      await pool.query(stmt);
    }
    console.log('[db] schema checked');
    await migrateSchema();

    void seedImportedPlayers().catch((err) => {
      console.warn('[db] imported player seed skipped:', err.message);
    });

    dbReady = true;
    console.log('[db] connected & schema ready');
  } catch (err) {
    dbReady = false;
    console.warn('[db] unavailable, running without cache:', err.message);
  }
}

export function isDbReady() {
  return dbReady;
}

export function listImportedSquadKeys() {
  const seen = new Set();
  return normalizeImportedRows(importedPlayers)
    .map((p) => ({ year: p.year, country: p.country }))
    .filter((key) => {
      const id = `${key.year}:${key.country}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export async function getCachedSquad(year, country) {
  if (!dbReady) return null;
  try {
    const [rows] = await pool.query(
      'SELECT squad_json FROM wc_squads WHERE year = ? AND country = ? LIMIT 1',
      [year, country]
    );
    if (rows.length) return JSON.parse(rows[0].squad_json);
    return null;
  } catch (err) {
    console.warn('[db] read failed:', err.message);
    return null;
  }
}

export async function getImportedSquad(year, country) {
  const normalized = normalizeImportedRows(importedPlayers).filter(
    (p) => p.year === Number(year) && p.country === country
  );
  if (normalized.length) return normalized;

  if (!dbReady) return [];
  try {
    const [rows] = await pool.query(
      `SELECT
         p.name, p.pos, p.shirt_number AS shirtNumber, p.source,
         r.overall, r.pace, r.shooting, r.passing, r.dribbling, r.defending, r.physical, r.note,
         r.source AS ratingsSource,
         r.facts_json AS factsJson
       FROM wc_players p
       LEFT JOIN wc_player_ratings r ON r.player_id = p.id
       WHERE p.year = ? AND p.country = ?
       ORDER BY
         FIELD(p.pos, 'GK','RB','CB','LB','RWB','LWB','CDM','CM','RM','LM','CAM','RW','LW','ST'),
         r.overall DESC,
         p.name ASC`,
      [year, country]
    );
    return rows.map(normalizeImportedPlayer);
  } catch (err) {
    console.warn('[db] imported squad read failed:', err.message);
    return [];
  }
}

export async function cacheSquad(year, country, squad, source = 'llm') {
  if (!dbReady) return;
  try {
    await pool.query(
      `INSERT INTO wc_squads (year, country, squad_json, source)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE squad_json = VALUES(squad_json), source = VALUES(source)`,
      [year, country, JSON.stringify(squad), source]
    );
  } catch (err) {
    console.warn('[db] write failed:', err.message);
  }
}

export async function saveDraft({ formation, centerYear, squad }) {
  if (!dbReady) {
    return null;
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO wc_draft_squads (formation, center_year, squad_json)
       VALUES (?, ?, ?)`,
      [formation, Number(centerYear) || null, JSON.stringify(squad)]
    );
    return result.insertId;
  } catch (err) {
    console.warn('[db] draft save failed:', err.message);
    throw err;
  }
}

async function seedImportedPlayers() {
  const rows = normalizeImportedRows(importedPlayers);
  if (!dbReady && !pool) return;
  const [countRows] = await pool.query('SELECT COUNT(*) AS count FROM wc_players');
  const existingCount = Number(countRows[0]?.count) || 0;
  if (existingCount > 0) {
    console.log(`[db] imported player seed skipped (${existingCount} rows already present)`);
    return;
  }
  console.log(`[db] seeding imported players (${rows.length} rows)...`);
  for (const p of rows) {
    try {
      const [playerResult] = await pool.query(
        `INSERT INTO wc_players (year, country, name, pos, shirt_number, source)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE pos = VALUES(pos), shirt_number = VALUES(shirt_number), source = VALUES(source)`,
        [p.year, p.country, p.name, p.pos, p.shirtNumber, p.source || 'curated']
      );
      let playerId = playerResult.insertId;
      if (!playerId) {
        const [existing] = await pool.query(
          'SELECT id FROM wc_players WHERE year = ? AND country = ? AND name = ? LIMIT 1',
          [p.year, p.country, p.name]
        );
        playerId = existing[0]?.id;
      }
      if (!playerId) continue;
      await pool.query(
        `INSERT INTO wc_player_ratings
           (player_id, overall, pace, shooting, passing, dribbling, defending, physical, note, source, facts_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           overall = VALUES(overall),
           pace = VALUES(pace),
           shooting = VALUES(shooting),
           passing = VALUES(passing),
           dribbling = VALUES(dribbling),
           defending = VALUES(defending),
           physical = VALUES(physical),
           note = VALUES(note),
           source = VALUES(source),
           facts_json = VALUES(facts_json)`,
        [
          playerId,
          p.overall,
          p.pace,
          p.shooting,
          p.passing,
          p.dribbling,
          p.defending,
          p.physical,
          p.note || '',
          p.ratingsSource || null,
          p.ratingFacts ? JSON.stringify(p.ratingFacts) : null,
        ]
      );
    } catch (err) {
      console.warn(`[db] seed failed for ${p.year} ${p.country} ${p.name}:`, err.message);
    }
    await yieldToEventLoop();
  }
  console.log('[db] imported player seed finished');
}

function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function migrateSchema() {
  try {
    await pool.query('ALTER TABLE wc_player_ratings MODIFY overall INT DEFAULT NULL');
    await pool.query('ALTER TABLE wc_player_ratings MODIFY source VARCHAR(64) DEFAULT NULL');
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'wc_player_ratings'`
    );
    for (const stmt of buildMissingColumnMigrationStatements(columns)) {
      await pool.query(stmt);
    }
    const [playerColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'wc_players'`
    );
    for (const stmt of buildMissingPlayerColumnMigrationStatements(playerColumns)) {
      await pool.query(stmt);
    }
  } catch (err) {
    console.warn('[db] schema migration skipped:', err.message);
  }
}

export function buildMissingColumnMigrationStatements(columns) {
  const existing = new Set(
    (Array.isArray(columns) ? columns : []).map((row) => String(row.COLUMN_NAME || row.column_name || '').toLowerCase())
  );
  const statements = [];
  if (!existing.has('facts_json')) {
    statements.push('ALTER TABLE wc_player_ratings ADD COLUMN facts_json TEXT DEFAULT NULL');
  }
  return statements;
}

export function buildMissingPlayerColumnMigrationStatements(columns) {
  const existing = new Set(
    (Array.isArray(columns) ? columns : []).map((row) => String(row.COLUMN_NAME || row.column_name || '').toLowerCase())
  );
  const statements = [];
  if (!existing.has('shirt_number')) {
    statements.push('ALTER TABLE wc_players ADD COLUMN shirt_number INT DEFAULT NULL AFTER pos');
  }
  return statements;
}

function normalizeImportedRows(data) {
  return (Array.isArray(data) ? data : []).map(normalizeImportedPlayer);
}

function normalizeImportedPlayer(p) {
  // Keep unknown ratings as null — historical squads have no FIFA-style stats,
  // and coercing them to 75 made every player look identical.
  const overall = nullableStat(p.overall ?? p.rating);
  return {
    name: String(p.name || '').slice(0, 80),
    nameZh: String(p.nameZh || p.zhName || '').slice(0, 40),
    pos: String(p.pos || 'CM').toUpperCase(),
    rating: overall,
    overall,
    positions: normalizePositions(p),
    shirtNumber: normalizeShirtNumber(p.shirtNumber ?? p.shirt_number ?? p.number ?? p.jerseyNumber),
    pace: nullableStat(p.pace),
    shooting: nullableStat(p.shooting),
    passing: nullableStat(p.passing),
    dribbling: nullableStat(p.dribbling),
    defending: nullableStat(p.defending),
    physical: nullableStat(p.physical),
    note: String(p.note || '').slice(0, 120),
    source: String(p.source || 'curated'),
    ratingsSource: p.ratingsSource || null,
    ratingFacts: parseFacts(p.ratingFacts ?? p.factsJson),
    year: Number(p.year),
    country: String(p.country || ''),
  };
}

function parseFacts(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function nullableStat(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeShirtNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 99 ? rounded : null;
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
