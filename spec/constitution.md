# Constitution — Fiddlesticks

> Reverse-engineered from the codebase via `/spec-flow:adopt` on 2026-07-15. Describes the project
> **as it actually is**, not an aspiration. Main-branch-only; every spec-flow phase reads it.
> Owner: review and correct anything below that misreads intent.

## Mission
Fiddlesticks is a static, client-only browser arcade: a searchable catalog of games plus in-browser
playable games. Today the catalog lists 31 games and exactly one — Canvas Solitaire — is fully
implemented; the rest are catalog entries with a placeholder detail page.

## Non-negotiables
Observed from how the code is actually built and shipped:
- **Client-only, fully static.** No backend, no server runtime, no network calls, no persistence — the
  built output is static HTML/CSS/JS served by nginx. A feature that needs a server is a deliberate
  departure, called out explicitly.
- **Multi-page via Vite inputs.** Pages are real HTML entry points (`index.html`, `game.html`) wired in
  `vite.config.ts`; navigation is plain links, not a client-side router.
- **TypeScript for all app logic** under `src/`, compiled with `tsc` before `vite build`.

## Tech & architecture defaults
- Languages / frameworks: TypeScript (ES2023 target, ESNext modules), Vite 8 build/dev server. No UI
  framework — direct DOM (`innerHTML`, `querySelector`) and the Canvas 2D API.
- Architecture style: small multi-page static site. Each page has one entry module in `src/`; shared
  data (`games.ts`) and game modules (`solitaire.ts`) are plain ES modules.
- Data & integration defaults: no database, no APIs, no external services at runtime. The game catalog
  is a hard-coded array in `src/games.ts`. Assets are bundled or served from `public/`.
- TypeScript config: `noEmit` (Vite bundles), bundler module resolution, `noUnusedLocals` /
  `noUnusedParameters` / `noFallthroughCasesInSwitch` on. NOTE: `strict` is **not** currently enabled —
  a real gap worth closing, recorded here honestly rather than pretended away.
- Deploy: `npm run build` → `dist/`, then `rsync --delete dist/` to `/var/www/fiddlesticks/` on a single
  nginx VPS (`187.124.159.132`). Documented in `DEPLOYMENT.md`. No CI/CD pipeline.

## Security & compliance
- No user accounts, no user-generated content, no secrets in the app, no data collection or storage.
- Dynamic HTML is built by interpolating **trusted, static** data into `innerHTML` without escaping.
  This is safe only while all interpolated data is static; introducing any user- or externally-sourced
  content requires escaping first (tracked as a sharp edge in the catalog/detail specs).
- No compliance framework applies (static hobby site, no personal data).

## Quality bar
- Testing expectation: automated tests are **wanted but not yet started** — none exist today
  (`tests: null`), so verification is currently manual (playing the app). Standing up a test suite is
  an explicit near-term goal, not a deferred nicety; once a harness exists, new work should land with
  tests. (Current *state*, forward *intent* — not a rule that the project has no tests.)
- Mobile / touch: the arcade and its games must be **phone-friendly, particularly on iOS Safari** —
  playable and correctly laid out on small touch screens. Treated as a product-wide bar (see
  `product-global.md`), not an afterthought.
- Accessibility / performance / observability minimums: basic a11y affordances are present in places
  (aria-live regions, visually-hidden labels, canvas aria-label) but there is no enforced bar and the
  solitaire game is pointer-only / not keyboard-operable. No observability.
- Review expectation: none enforced historically. Going forward, the spec-flow `analyze` gate applies
  to new work on adopted features (they read effective `mvp`).

## Out of scope (project-wide)
- Server-side logic, databases, authentication, and anything requiring a runtime beyond static files.
- Implementing the 30 non-solitaire catalog games (they are intentionally placeholder today — pending
  the owner's call; see `game-detail` spec's clarification).
