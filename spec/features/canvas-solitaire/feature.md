---
schema_version: 2
id: "feat-003"
slug: "canvas-solitaire"
title: "Canvas Klondike Solitaire"
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
converge:
  last_run: 2026-07-15
  open: 0
  contradicts: 0
human_signoff: []
open_decisions: []
overrides: []
extends: []
---

# Feature notes — Canvas Klondike Solitaire

> Reverse-engineered from existing code via `/spec-flow:adopt` on 2026-07-15. Manifest is canonical;
> `spec.md` describes the system **as built** and starts at `spec: draft`. `depth` omitted → effective `mvp`.

## Notes
- The only fully-implemented game. Source: `src/solitaire.ts` (single module, `setupSolitaire(container)`).
- Mounted by `game-detail` (feat-002) for the `canvas-solitaire` slug.
- Rendered entirely on a `<canvas>` with pointer-event drag-and-drop; no DOM cards.
- Carries real as-built sharp edges (scale-mixing in hit-testing) documented in `spec.md`; a good first
  target for `/spec-flow:converge` and `/spec-flow:break`.

## Work log
- [x] **gap-003 fidelity defect** (converge run 1, 2026-07-15) — AC-8: tableau→tableau drag moves now
  flip the exposed source card (`tryDropDrag` reveals the source column on any successful commit to a
  different pile). Fix in `src/solitaire.ts` (comment cites `feat-003/AC-8` + `gap-003`); `tsc` clean.
- [x] **gap-001 spec change (chg-001) + code fix** (2026-07-15) — AC-3: foundations are not suit-locked
  (owner ruling). Delta in `changes/chg-001/` MODIFIED AC-3 + the Foundation-move scenario, folded into
  `spec.md`. Code: empty foundations no longer drawn with a fixed suit label (`drawFoundationsAndTopRow`,
  now a generic "A-K" hint) — placement logic was already correct. `tsc` clean.
- [x] **gap-002 fidelity defect** (2026-07-15) — AC-4/AC-14: tableau pickup + drop hit-testing and the
  waste drag anchor now use SCALED dimensions, so pointer targeting matches drawn positions at every
  responsive scale (serves the mobile/iOS NFR). Fix in `src/solitaire.ts` (comments cite `feat-003/AC-4`,
  `AC-14`, `gap-002`); `tsc` clean.

**Test debt (all three fixes):** regression tests deferred — no test harness exists yet (`tests: null`)
and the game logic is a non-exported closure, so real coverage needs a harness (Vitest) stood up first
(see the constitution's testing goal). Verified by inspection + `tsc`; a device play-test — especially
for gap-002's scale targeting on iOS — is still owed.
