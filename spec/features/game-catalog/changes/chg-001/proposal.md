# Proposal — game-catalog

**Trigger:** Owner decision (2026-07-15, during `/spec-flow:clarify game-detail`): remove all the fake /
flavor games, leaving only games that are actually implemented. Today that is exactly one — Canvas Solitaire.
**Summary:** The as-built catalog listed 31 games, 30 of which were flavor entries with no implementation
(they resolved to a placeholder on the detail page). The owner ruled the arcade should show only real
games. `src/games.ts` is trimmed to the single implemented game. The catalog code is data-driven (renders
and counts `games.length`), so no `main.ts` logic changes — but the spec hardcoded "31" in several places
and must be dehardcoded to the catalog's actual size so it stays true as the roster changes.

## Blast radius
- Requirements affected: AC-1, AC-4, AC-6 (dehardcode the "31" count); Initial-load / Filtering / No-matches
  scenarios (same).
- Design decisions affected: none.
- Tasks affected (regenerate these): none (no tasks.md); the code change is a one-array-literal edit built inline.
- Already-built code affected: `src/games.ts` (data only). NOT affected: `src/main.ts` (renders `games.length`
  dynamically already).
- Cross-feature: resolves `game-detail`'s placeholder `[NEEDS CLARIFICATION]` marker (handled in that
  feature's own clarify pass); `game-detail` behavior/code is unchanged.

## Status
- [x] delta reviewed (analyze) — mechanical dehardcoding + data trim; owner-directed. Full analyze not run.
- [x] implemented & verified — `src/games.ts` trimmed; `tsc` clean, `npm run build` clean.
- [x] folded into spec.md (CI regenerates product.md)
