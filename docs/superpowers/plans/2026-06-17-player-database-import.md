# Player Database Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LLM-only squad generation with curated player imports, richer ability fields, and persisted completed drafts.

**Architecture:** Keep the current game loop intact. Add a database-backed player catalog for imported squads, preserve the existing `wc_squads` LLM cache as fallback, and store each completed 11-man draft as a separate saved record. The frontend keeps the same spin-and-pick flow, but confirmation now saves the full squad snapshot before round 1 begins.

**Tech Stack:** Node 18+ ESM, Express, MySQL, React, Vite, built-in `node:test` for server checks.

---

### Task 1: Add database tables for imported players and saved drafts

**Files:**
- Modify: `server/src/db.js`
- Test: `server/test/db-schema.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchemaStatements } from '../src/db.js';

test('buildSchemaStatements includes imported player and draft tables', () => {
  const sql = buildSchemaStatements();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_players/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_player_ratings/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS wc_draft_squads/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test server/test/db-schema.test.js`
Expected: fail because `buildSchemaStatements` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function buildSchemaStatements() {
  return `
    CREATE TABLE IF NOT EXISTS wc_squads (...);
    CREATE TABLE IF NOT EXISTS wc_players (...);
    CREATE TABLE IF NOT EXISTS wc_player_ratings (...);
    CREATE TABLE IF NOT EXISTS wc_draft_squads (...);
  `;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test server/test/db-schema.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db.js server/test/db-schema.test.js
git commit -m "feat: add player and draft tables"
```

### Task 2: Add a reusable player catalog lookup layer

**Files:**
- Create: `server/src/playerCatalog.js`
- Test: `server/test/playerCatalog.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRosterSource } from '../src/playerCatalog.js';

test('chooseRosterSource prefers imported rows over cache and llm', () => {
  const result = chooseRosterSource({
    imported: [{ name: 'A' }],
    cached: [{ name: 'B' }],
  });
  assert.equal(result.source, 'database');
  assert.equal(result.players[0].name, 'A');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test server/test/playerCatalog.test.js`
Expected: fail because `chooseRosterSource` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function chooseRosterSource({ imported, cached }) {
  if (imported?.length) return { source: 'database', players: imported };
  if (cached?.length) return { source: 'cache', players: cached };
  return { source: 'llm_fallback', players: [] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test server/test/playerCatalog.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/playerCatalog.js server/test/playerCatalog.test.js
git commit -m "feat: add roster source selection"
```

### Task 3: Import curated squad data and surface richer abilities from `/api/squad`

**Files:**
- Create: `server/data/importedPlayers.json`
- Modify: `server/src/routes.js`
- Modify: `server/src/prompts.js`
- Test: `server/test/squad-route.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSquadResponse } from '../src/playerCatalog.js';

test('buildSquadResponse returns structured ratings for imported players', () => {
  const result = buildSquadResponse({
    year: 2018,
    country: '法国',
    imported: [
      { name: 'L. Modric', pos: 'CM', overall: 91, pace: 70, passing: 92, defending: 75, physical: 80 },
    ],
  });
  assert.equal(result.source, 'database');
  assert.equal(result.players[0].overall, 91);
  assert.equal(result.players[0].passing, 92);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test server/test/squad-route.test.js`
Expected: fail because `buildSquadResponse` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function buildSquadResponse({ year, country, imported, cached, generated }) {
  const chosen = chooseRosterSource({ imported, cached });
  const players = chosen.source === 'llm_fallback' ? generated : chosen.players;
  return { year, country, source: chosen.source, players };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test server/test/squad-route.test.js`
Expected: PASS.

- [ ] **Step 5: Update `simulateMatch` input payload**

```js
const squadJson = squad.map((s) => ({
  slot: s.pos,
  position: posLabel(s.pos),
  player: s.player?.name || '空缺',
  rating: s.player?.overall ?? s.player?.rating ?? null,
  pace: s.player?.pace ?? null,
  shooting: s.player?.shooting ?? null,
  passing: s.player?.passing ?? null,
  dribbling: s.player?.dribbling ?? null,
  defending: s.player?.defending ?? null,
  physical: s.player?.physical ?? null,
  outOfPosition: !!s.outOfPosition,
}));
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.js server/src/prompts.js server/src/playerCatalog.js server/data/importedPlayers.json server/test/squad-route.test.js
git commit -m "feat: serve imported player squads"
```

### Task 4: Save completed 11-player drafts before starting the match

**Files:**
- Modify: `server/src/routes.js`
- Modify: `client/src/api.js`
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/Draft.jsx`
- Test: `client/src/components/Draft.jsx` manual smoke check

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompletedDraft } from '../src/playerCatalog.js';

test('normalizeCompletedDraft keeps slot order and player snapshot', () => {
  const draft = normalizeCompletedDraft([
    { slotId: 'GK', pos: 'GK', year: 2014, country: '德国', player: { name: 'Neuer', overall: 92 } },
  ]);
  assert.equal(draft[0].slotId, 'GK');
  assert.equal(draft[0].player.name, 'Neuer');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test server/test/playerCatalog.test.js`
Expected: fail because `normalizeCompletedDraft` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function normalizeCompletedDraft(arr) {
  return (Array.isArray(arr) ? arr : []).map((s) => ({
    slotId: s.slotId,
    pos: s.pos,
    year: s.year,
    country: s.country,
    host: s.host,
    player: s.player,
    outOfPosition: !!s.outOfPosition,
  }));
}
```

- [ ] **Step 4: Wire the endpoint and client calls**

```js
// server/src/routes.js
router.post('/draft/complete', async (req, res) => {
  const { formation, centerYear, squad = [] } = req.body || {};
  if (!formation || !Array.isArray(squad) || squad.length !== 11) {
    return res.status(400).json({ error: 'formation and 11-player squad required' });
  }
  const draft = normalizeCompletedDraft(squad);
  const draftId = await saveDraft({ formation, centerYear, squad: draft });
  res.json({ draftId });
});
```

```js
// client/src/api.js
completeDraft: (body) => post('/draft/complete', body),
```

```js
// client/src/components/Draft.jsx
async function finish() {
  try {
    const saved = await api.completeDraft({ formation: formation.name, centerYear, squad: arr });
    onComplete(arr, saved.draftId);
  } catch (e) {
    setErr('阵容保存失败：' + e.message);
  }
}
```

- [ ] **Step 5: Run a browser smoke check**

Run the app, build a squad, confirm it, and verify the request to `/api/draft/complete` returns a `draftId` before round 1 begins.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.js server/src/db.js client/src/api.js client/src/App.jsx client/src/components/Draft.jsx server/test/playerCatalog.test.js
git commit -m "feat: persist completed drafts"
```

### Task 5: Update the draft UI to show real ability fields

**Files:**
- Modify: `client/src/components/Draft.jsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Write the failing test**

```jsx
// Manual QA target: roster chips should show overall + at least two sub-stats.
```

- [ ] **Step 2: Run a manual check**

Open the draft screen and verify each imported player chip shows `overall`, `pace`, and `passing` or equivalent sub-stats without overflow.

- [ ] **Step 3: Write minimal implementation**

```jsx
<span className="pc-rating">{p.overall ?? p.rating}</span>
<span className="pc-meta">{p.pace}/{p.passing}/{p.defending}</span>
```

- [ ] **Step 4: Verify layout**

Confirm the roster grid still fits the existing draft panel width and does not wrap into the pitch.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Draft.jsx client/src/styles.css
git commit -m "feat: show richer player ratings"
```

### Task 6: Verify the full flow end to end

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend checks**

Run: `node --test server/test/*.test.js`
Expected: all tests pass.

- [ ] **Step 2: Run the app**

Run: `npm run go`
Expected: server starts on `http://localhost:8787` and the client build is served.

- [ ] **Step 3: Smoke-test the new flow**

1. Open the app.
2. Pick a year and formation.
3. Draft one imported squad.
4. Confirm the squad and verify it is saved before the match starts.
5. Start the match and confirm the prompt still receives the selected squad.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat: import curated player database"
```

