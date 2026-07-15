# Research — Arcade catalog browser

**Provenance:** Reverse-engineered from code on 2026-07-15 — describes the system as built.
This is why `readiness.research` is `ready`: the "research" is the running system itself.

## Evidence
- `index.html` — mounts `src/main.ts` into `#app`.
- `src/main.ts` — renders the catalog header + search, holds `renderGames()` and the `slugify()` helper.
- `src/games.ts` — the `GameItem` type and the static array of games (`title`, `genre`, `description`);
  trimmed to the single implemented game (Canvas Solitaire) under chg-001.
- `src/style.css` — catalog layout, cards, empty state, search styling.

## Real user / job context
- Users open the landing page to find a game to play and jump straight into it.
- Intended job-to-be-done: browse/filter a growing game collection and open a game's page in one click.
- (Any richer product context — audience, goals — to be supplied by the owner.)
