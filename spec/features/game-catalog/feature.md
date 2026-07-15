---
schema_version: 2
id: "feat-001"
slug: "game-catalog"
title: "Arcade catalog browser"
status: active
owner: "andrew"
sprint: null
external: null
depends_on: []
requires_design: null
readiness:
  research: ready
  design:   n/a
  spec:     draft
  plan:     none
  tasks:    none
gate:
  analyze: not-run
  product_global_hash: ""
  constitution_hash: ""
human_signoff: []
open_decisions: []
overrides: []
extends: []
---

# Feature notes — Arcade catalog browser

> Reverse-engineered from existing code via `/spec-flow:adopt` on 2026-07-15. The frontmatter
> is the canonical manifest; `spec.md` describes the system **as built** and starts at `spec: draft`.
> `depth` is omitted deliberately → effective `mvp` (shipped code earns real gates).

## Notes
- Landing page of the Fiddlesticks arcade. Source: `index.html`, `src/main.ts`, `src/games.ts`, `src/style.css`.
- Shares the `slugify` slug-derivation invariant with `game-detail` (see `product-global.md`).

## Work log
- [x] **chg-001 spec change** (2026-07-15) — owner removed the 30 flavor games; `src/games.ts` trimmed to
  Canvas Solitaire only. Delta in `changes/chg-001/` dehardcoded the "31" count in AC-1/AC-4/AC-6 +
  scenarios, folded into `spec.md`. Code is data-driven, so `main.ts` was untouched. `tsc` + build clean.
