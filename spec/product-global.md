# Product-global — Fiddlesticks

> Reverse-engineered cross-cutting requirements via `/spec-flow:adopt` on 2026-07-15. Main-branch-only;
> embedded verbatim into the generated `product.md` and hashed into every feature's analyze gate. Keep
> it spec-grade. Owner: verify the invariants below match your intent.

## Vision
A small, fast, static browser arcade: browse a catalog of games and play the ones that are built,
starting with Canvas Solitaire.

## Glossary
- **Game** — a catalog entry: a `{ title, genre, description }` record in `src/games.ts`. May or may not
  have a playable implementation.
- **Slug** — a game's URL identifier, derived from its title by the shared `slugify` rule (below). The
  key that links a catalog card (`/game.html?game=<slug>`) to the detail page's game lookup.
- **Catalog** — the searchable landing-page list of all games (feat-001).
- **Detail page** — the per-game page reached by slug (feat-002); hosts a playable game or a placeholder.
- **Foundation / Tableau / Stock / Waste** — the four Klondike pile types used by Canvas Solitaire (feat-003).

## Global non-functional requirements
- Performance: fast static load; catalog is a small in-memory list. No hard numeric target.
- Security: no user-generated or externally-sourced content anywhere; dynamic HTML interpolates only
  trusted static data (escaping is required before that assumption changes).
- Mobile / touch: every feature must be **phone-friendly, particularly on iOS Safari** — usable and
  correctly laid out on small touch screens, with touch input working as a first-class pointer (not just
  mouse). As-built today: pages carry a responsive `viewport` meta tag, the catalog reflows via CSS, and
  the solitaire board scales to its container and uses Pointer Events with `touch-action: none` on the
  canvas (so touch drags work and don't hijack page scrolling). This target is **not yet verified on real
  iOS devices** — a known gap, not a claim of done.
- Accessibility: provide basic affordances where practical (labels, aria-live status regions). Not
  currently enforced; the solitaire game is pointer-only.
- Reliability / availability: single static nginx host; no runtime dependencies to fail.
- Privacy / data handling: no data collected, stored, or transmitted.

## Product invariants
- **Slug agreement.** A game's slug is derived by exactly one rule — `slugify(title)`: lowercase, replace
  each run of non-alphanumeric characters with a single `-`, strip leading/trailing `-`. The catalog uses
  it to build links and the detail page uses it to look games up; both MUST use the same rule or links
  break. (Currently implemented as duplicated `slugify` functions in `main.ts` and `game.ts` — a
  centralization candidate, not yet centralized.)
- **Static, client-only.** Every feature runs entirely in the browser with no server or persistence.
- **Single source of games.** All game metadata lives in `src/games.ts`; features read it, none redefine it.

## Cross-cutting constraints
- Pages are separate Vite entry points (`index.html`, `game.html`); cross-page navigation is via plain
  links and the `?game=<slug>` query param — no shared client-side router or app state.
- Shared styling lives in `src/style.css`, imported by both page entry modules.
