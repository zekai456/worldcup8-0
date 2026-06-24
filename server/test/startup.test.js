import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('server startup listens before async database initialization', () => {
  const indexSource = fs.readFileSync(path.join('server', 'src', 'index.js'), 'utf8');
  const listenIndex = indexSource.indexOf('app.listen');
  const initIndex = indexSource.indexOf('initDb().catch');

  assert.ok(listenIndex !== -1);
  assert.ok(initIndex !== -1);
  assert.ok(listenIndex < initIndex);
  assert.equal(indexSource.includes('await initDb()'), false);
});
