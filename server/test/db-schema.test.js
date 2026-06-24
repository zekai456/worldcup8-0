import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingPlayerColumnMigrationStatements,
  buildMissingColumnMigrationStatements,
  buildSchemaStatements,
  listImportedSquadKeys,
  saveDraft,
} from '../src/db.js';

test('buildSchemaStatements includes imported player and draft tables', () => {
  const sql = buildSchemaStatements().join('\n');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_players/);
  assert.match(sql, /shirt_number INT DEFAULT NULL/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_player_ratings/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_draft_squads/);
});

test('buildMissingPlayerColumnMigrationStatements adds shirt_number only when missing', () => {
  assert.deepEqual(
    buildMissingPlayerColumnMigrationStatements([{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'shirt_number' }]),
    []
  );

  const statements = buildMissingPlayerColumnMigrationStatements([{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'pos' }]);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /ADD COLUMN shirt_number INT DEFAULT NULL/);
});

test('listImportedSquadKeys exposes curated year-country pairs', () => {
  const keys = listImportedSquadKeys();

  assert.ok(keys.some((k) => k.year === 2022 && k.country === '阿根廷'));
  assert.ok(keys.some((k) => k.year === 2018 && k.country === '法国'));
});

test('buildMissingColumnMigrationStatements skips existing facts_json column', () => {
  const statements = buildMissingColumnMigrationStatements([
    { COLUMN_NAME: 'id' },
    { COLUMN_NAME: 'overall' },
    { COLUMN_NAME: 'source' },
    { COLUMN_NAME: 'facts_json' },
  ]);

  assert.deepEqual(statements, []);
});

test('buildMissingColumnMigrationStatements adds facts_json only when missing', () => {
  const statements = buildMissingColumnMigrationStatements([
    { COLUMN_NAME: 'id' },
    { COLUMN_NAME: 'overall' },
    { COLUMN_NAME: 'source' },
  ]);

  assert.equal(statements.length, 1);
  assert.match(statements[0], /ADD COLUMN facts_json TEXT DEFAULT NULL/);
});

test('saveDraft degrades to null when database is unavailable', async () => {
  const draftId = await saveDraft({
    formation: '4-4-2',
    centerYear: 2002,
    squad: Array.from({ length: 11 }, (_, i) => ({
      slotId: `S${i}`,
      pos: 'CM',
      player: { name: `Player ${i}`, pos: 'CM' },
    })),
  });

  assert.equal(draftId, null);
});
