# Game detail page — spec (as-built, draft)

> Reverse-engineered from `src/game.ts` + `src/games.ts` on 2026-07-15. Describes current observable
> behavior. Inherits the `slugify` invariant and product-wide NFRs from `product-global.md`.

## Why
Each game needs its own page: a stable, linkable URL that identifies the game and either hosts the
playable game or clearly signals it isn't built yet.

## User stories
- As a visitor, I want a page that names the game I clicked so that I know I'm in the right place.
- As a visitor, I want to actually play the game when it exists so that the link is worth following.
- As a visitor, I want a clear message when a link is stale or the game isn't implemented so that I'm not confused.
- As a visitor, I want a way back to the catalog so that I can pick another game.

## Behavior & scenarios
- **Scenario: Known game**
  - Given I open `/game.html?game=<slug>` for a game in the catalog
  - When the page renders
  - Then it shows the game's genre (eyebrow), title, and description, plus a "Back to games" link to `/`.
- **Scenario: Missing / unknown game**
  - Given the `game` param is empty, absent, or matches no game
  - When the page renders
  - Then it shows a "That game is missing" not-found state, still with the "Back to games" link.
- **Scenario: Canvas Solitaire**
  - Given the slug is `canvas-solitaire`
  - When the detail renders
  - Then a solitaire board is mounted inside `#solitaire-root` (feat-003) below the detail.
- **Scenario: Other known game (placeholder)**
  - Given the slug is a known game other than Canvas Solitaire
  - When the detail renders
  - Then a "Game screen placeholder: connect your real game here." hint is shown in place of a game.

## Acceptance criteria
- [ ] AC-1: `/game.html?game=<known-slug>` renders the matching game's genre, title, and description with a "Back to games" link pointing at `/`.
- [ ] AC-2: A missing, empty, or unknown `game` param renders the "That game is missing" not-found state (with the back link).
- [ ] AC-3: For the `canvas-solitaire` slug, the page mounts the playable solitaire board in `#solitaire-root`.
- [ ] AC-4: For any known game other than Canvas Solitaire, the page shows the "Game screen placeholder" hint instead of a game. (Latent fallback: the catalog now holds only implemented games, so no current entry triggers this — it guards any future known-but-unimplemented game.)
- [ ] AC-5: The slug used to look up the game is derived by the same shared `slugify` rule the catalog uses to build links.

## Known sharp edges (as-built)
- The slug is recomputed here independently of the catalog; the two `slugify` implementations must stay
  identical or links silently fall through to the not-found state (a reason to centralize the rule).
- Genre/title/description are interpolated into `innerHTML` without escaping (safe only while game data is trusted).
- The catalog now holds only implemented games (currently just Canvas Solitaire), so the placeholder
  branch is a defensive fallback that no current catalog entry reaches. A future game added to the
  catalog without an implementation would land on it.

## Edge cases & errors  _(mvp+ depth)_
- No `game` param, or a slug not in the catalog → not-found state (handled).
- `#app` missing → throws "App root not found".
- Solitaire slug but `#solitaire-root` missing after render → throws "Solitaire root not found" (defensive; not reachable in normal flow).

## Non-functional requirements  _(mvp+ depth)_
- Performance: none beyond product-global.
- Security: no user-generated content today; escaping required before that changes.
- Accessibility: the back link is a plain anchor; states use semantic headings. No further feature-specific bar.

## Open questions
- None. Resolved 2026-07-15 (owner): the 30 flavor games were removed from the catalog (game-catalog
  chg-001), so the arcade lists only implemented games. The placeholder is not a permanent UI for flavor
  entries — it survives only as a defensive fallback for a future known-but-unimplemented game (AC-4).
  A new game is added the way Canvas Solitaire was: its own catalog entry plus a real implementation.
