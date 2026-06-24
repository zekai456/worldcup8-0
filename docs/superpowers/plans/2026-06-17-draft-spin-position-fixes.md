# Draft Spin Position Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make draft confirmation progress reliably, keep spins inside the selected era window, and narrow player positions to trustworthy official-style positions.

**Architecture:** Keep the route layer thin, but export small pure helpers from `server/src/routes.js` for deterministic spin-window tests. Keep draft persistence best-effort in `server/src/db.js` so gameplay is not blocked by MySQL. Normalize imported and fallback player positions in `server/src/playerCatalog.js` and `server/src/db.js`, and update the import script so regenerated data stays narrow.

**Tech Stack:** Node.js ESM, `node:test`, React/Vite frontend.

---

### Task 1: Draft Persistence Degrades Gracefully

**Files:**
- Modify: `server/test/db-schema.test.js`
- Modify: `server/src/db.js`

- [ ] Add a failing test that `saveDraft()` returns `null` while the DB is unavailable.
- [ ] Run `node --test server/test/db-schema.test.js` and confirm it fails with `database unavailable`.
- [ ] Change `saveDraft()` to return `null` when `dbReady` is false.
- [ ] Re-run the test and confirm it passes.

### Task 2: Spins Never Escape The Era Window

**Files:**
- Create: `server/test/routes-spin.test.js`
- Modify: `server/src/routes.js`

- [ ] Add failing tests for invalid/empty windows and lock-country fallback behavior.
- [ ] Run `node --test server/test/routes-spin.test.js` and confirm helper exports are missing or behavior fails.
- [ ] Export `editionsWithImportedSquads()`, `windowImportedEditions()`, and `pickSpinResult()`.
- [ ] Make empty windows return `null` and route `/spin` return `400` instead of falling back to all years.
- [ ] Keep lock-country rerolls inside the window; if that country has no in-window edition, reroll another in-window country.
- [ ] Re-run route tests and the existing server tests.

### Task 3: Positions Are Narrow And Reliable

**Files:**
- Modify: `server/test/playerCatalog.test.js`
- Modify: `server/src/playerCatalog.js`
- Modify: `server/src/db.js`
- Modify: `server/scripts/importWorldCupSquads.js`

- [ ] Add failing tests showing a generic historical defender exposes only `CB`, and a long fallback position list is capped to two positions.
- [ ] Run `node --test server/test/playerCatalog.test.js` and confirm the new tests fail.
- [ ] Add a shared local normalizer in both runtime modules that uppercases, deduplicates, keeps the primary position first, and caps to two positions.
- [ ] Change the import script so `DF/MF/FW` no longer expand to whole groups.
- [ ] Re-run the import script to regenerate `server/data/importedPlayers.json`.
- [ ] Re-run all server tests.

### Task 4: Confirm Button Shows Progress Into The Next Phase

**Files:**
- Modify: `client/src/components/Draft.jsx`
- Modify: `client/src/App.jsx`

- [ ] Update draft completion so the button text covers both saving and entering the match.
- [ ] Move the phase out of `draft` before the potentially slow event/opponent request, using the existing `preparing` phase once possible.
- [ ] Run `npm --prefix client run build` to verify the client compiles.
