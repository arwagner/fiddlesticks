---
schema_version: 2
id: "feat-002"
slug: "game-detail"
title: "Game detail page"
status: active
owner: "andrew"
sprint: null
external: null
depends_on: []
requires_design: null
readiness:
  research: ready
  design:   n/a
  spec:     ready
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

# Feature notes — Game detail page

> Reverse-engineered from existing code via `/spec-flow:adopt` on 2026-07-15. Manifest is canonical;
> `spec.md` describes the system **as built** and starts at `spec: draft`. `depth` omitted → effective `mvp`.

## Notes
- Per-game page reached from the catalog. Source: `game.html`, `src/game.ts`, `src/games.ts`, `src/style.css`.
- Recomputes slugs from the same `slugify` rule as `game-catalog` (see `product-global.md`); the two
  must stay in agreement for links to resolve.
- Mounts `canvas-solitaire` (feat-003) when the slug is `canvas-solitaire`; every other known game gets
  a placeholder.
