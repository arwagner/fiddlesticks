# Research — Game detail page

**Provenance:** Reverse-engineered from code on 2026-07-15 — describes the system as built.
`readiness.research` is `ready` because the running system is the research.

## Evidence
- `game.html` — mounts `src/game.ts` into `#app`.
- `src/game.ts` — reads the `?game=` query param, builds a slug→game map, renders detail / missing /
  placeholder states, and mounts solitaire for the Canvas Solitaire slug.
- `src/games.ts` — the shared game catalog data.
- `src/style.css` — `.game-page`, `.game-detail`, `.back-link`, `.hint` styling.

## Real user / job context
- A visitor arrives here by clicking a card in the catalog (or via a direct/bookmarked link).
- Intended job: show what the chosen game is and, where implemented, let the visitor play it.
- Placeholder text ("connect your real game here") signals this is a scaffold for games not yet built —
  intent captured as a clarification in `spec.md`.
