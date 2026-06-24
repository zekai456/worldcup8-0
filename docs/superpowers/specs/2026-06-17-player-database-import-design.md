# Player Database Import Design

## Goal

Replace slow and unstable model-generated player rosters with a curated local database import. The draft flow should return real players with structured ratings, and the completed 11-player squad should be saved to MySQL before the match flow starts.

## Data Source Strategy

Use a curated seed dataset in the repository as the first implementation step.

- World Cup squad identity data: year, country, player name, and primary position.
- Player ratings: overall plus ability fields suitable for match prompts and UI display.
- Source labels are stored with each record so future imports can distinguish curated data, external datasets, and LLM fallback data.

The first seed should focus on high-impact teams already present in the spin pools rather than trying to cover every historical squad at once. Missing squads continue to fall back to the current LLM generation path and are cached with a fallback source label.

## Database Model

Add durable player tables next to the existing `wc_squads` cache.

- `wc_players`: one row per player appearance in a World Cup squad.
- `wc_player_ratings`: one row per player appearance with `overall`, `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`, and optional note.
- `wc_draft_squads`: one row per completed user draft, storing formation, center year, and the full selected-player snapshot as JSON.

Keep `wc_squads` for compatibility and LLM fallback caching, but make imported player rows the preferred source for `/api/squad`.

## Backend Flow

`/api/squad` changes from cache-first LLM generation to imported-data-first lookup:

1. Validate year and country.
2. Query imported `wc_players` joined to `wc_player_ratings`.
3. If imported players exist, return them with `source: "database"`.
4. If no imported players exist, use the existing `wc_squads` cache.
5. If cache misses, call the LLM, cache the result, and return `source: "llm_fallback"`.

Add `POST /api/draft/complete`:

1. Validate formation and selected squad array.
2. Require 11 selected players for a normal completed draft.
3. Store the selected slots and complete player ability snapshot in `wc_draft_squads`.
4. Return `draftId` for later debugging and future persistence features.

## Frontend Flow

The draft UI continues to request `/api/squad` after each spin. Player chips show the richer ability data while preserving the compact pick flow.

When the user confirms the completed squad:

1. Send formation, center year, and selected squad to `/api/draft/complete`.
2. Attach the returned `draftId` to the local run state.
3. Continue into the existing event and match flow.

The match prompt receives the same squad structure as before, with additional ability fields available inside `player`.

## Error Handling

- If MySQL is unavailable, the game still runs through the existing fallback path.
- If imported data is missing for a specific year and country, only that squad falls back to cache or LLM.
- If saving a completed draft fails, the frontend should show an error and avoid silently starting the match with an unsaved squad.
- Imported-data failures should not overwrite existing `wc_squads` LLM cache data.

## Testing

Backend checks:

- Imported squad lookup returns structured ratings.
- Missing imported squad falls back to existing cache or LLM path.
- Completed 11-player draft is persisted and returns a `draftId`.
- Invalid or incomplete draft payload is rejected.

Frontend checks:

- Player chips render ratings without breaking the draft layout.
- Confirming the squad calls the save endpoint before starting round 1.
- Save failure displays an error and keeps the user in the draft flow.

