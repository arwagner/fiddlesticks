# Plan — canvas-solitaire (feat-003)

> The HOW behind `spec.md`'s WHAT. This is a brownfield-adopted feature: the game is already built,
> verified, and converge-clean (ledger runs 1–2, `contradicts: 0`). So this plan does two things —
> (1) documents the as-built architecture for the record, and (2) scopes the one piece of genuinely
> remaining work: automated test coverage, which the constitution names as a near-term goal.

## Design decisions

### Architecture (as-built)
- **One self-contained module.** `src/solitaire.ts` exposes a single entry, `setupSolitaire(container)`,
  holding all state (stock / waste / foundations / tableau / drag) in closure variables and rendering the
  whole board to one `<canvas>` via the 2D context. No framework, no DOM cards — matches the
  constitution's no-UI-framework, direct-Canvas default.
- **Immediate-mode rendering.** Every state change calls `draw()`, which clears and repaints the full
  board (top row + tableau + drag layer). Fine at a 52-card board size (see the Performance NFR).
- **Unified pointer input.** Pointer Events (down/move/up/cancel) with `touch-action: none` on the canvas,
  so mouse and touch share one code path — this is what serves the product-global mobile/iOS NFR.
  Hit-testing maps client coords → canvas coords → pile/card rects.
- **Single responsive scale.** `getResponsiveScale()` derives one `scale` from container width (floor 0.5);
  every layout constant is multiplied by it, and — since gap-002 — both drawing AND hit-testing use the
  scaled values (AC-12, AC-14).
- **Coupling.** Mounted by game-detail (feat-002) for the `canvas-solitaire` slug; otherwise standalone —
  no network, storage, or shared state, per the static/client-only constitution rule.

### Test strategy (the new work)
- **Toolchain: Vitest** — native to the existing Vite stack, no extra bundler config, runs the TS
  directly. Add as a devDependency; declare `tests: "src/**/*.test.ts"` in `.spec-flow.md`.
- **Testability refactor.** The rules behind AC-1..AC-10 / AC-14 (deal shape, foundation & tableau
  legality, run validation, reveal-on-move, recycle, win, scaled hit-testing) are currently
  closure-private in `setupSolitaire`, and `getContext('2d')` isn't available under jsdom — so the clean
  seam is to **extract the pure rules into `src/solitaire-rules.ts`** (no canvas/DOM), and have
  `solitaire.ts` import them. This is behavior-preserving structure-only change; a converge re-run
  confirms nothing shifted. Rendering + pointer plumbing stay in `solitaire.ts`.
- **What stays manual.** AC-13 (drag visually follows the pointer) and the pixel-level render are
  observed by play-test, not asserted — canvas pixels are a poor unit-test seam. The **targeting math**
  behind AC-14 IS unit-testable once the scaled point→card mapping is a pure helper.
- **Deviation note:** the constitution lists tests as "wanted but not yet started" — this plan starts
  them; no other constitution/ENG deviation.

## Task breakdown

### Group 1 — implementation (already built; `[x]`, cited for provenance)
- [x] Deck / shuffle / deal; stock/waste/foundations/tableau state — `src/solitaire.ts:143-186` — AC-1
- [x] Stock draw + unlimited recycle — `:358-385` — AC-2
- [x] Foundation legality (any-suit, ascending) — `:299-308` — AC-3
- [x] Tableau legality + draggable-run validation — `:310-322`, `:387-402` — AC-4, AC-5
- [x] Foundation auto-play (waste→leftmost tableau), flip-on-click, reveal-on-move — `:529-575`, `:465-471` — AC-6, AC-7, AC-8
- [x] Illegal-drop return, win detection, restart — `:442-454`, `:495-501`, `:683-684` — AC-9, AC-10, AC-11
- [x] Responsive scaling + scaled hit-testing/anchor — `:80-122`, `:487-503`, `:566-589` — AC-12, AC-14
- [x] Drag layer + pointercancel return — `:646-681` — AC-13

### Group 2 — test coverage (new; `[ ]`)
- [ ] T1: Add Vitest devDependency + `test` / `test:run` npm scripts; set `tests: "src/**/*.test.ts"` in `.spec-flow.md`.
- [ ] T2: Extract pure rules into `src/solitaire-rules.ts` (deal, `canPlaceOnFoundation`, `canPlaceOnTableau`, `validateDraggedRun`, `revealLast`, recycle, win-count, scaled point→card mapping) and wire `solitaire.ts` to import them. Behavior-preserving.
- [ ] T3 [P]: `src/solitaire-rules.test.ts` — deal shape, foundation & tableau legality, run validation, reveal-on-move, illegal-drop, win (cite `feat-003/AC-1,3,4,5,8,9,10`).
- [ ] T4 [P]: `src/solitaire-hittest.test.ts` — a scaled pointer aimed at a card's drawn rect selects that card at scales below and above 1.0 (cite `feat-003/AC-14`).
- [ ] T5 [P]: `src/solitaire-stock.test.ts` — single-card draw, unlimited recycle, foundation auto-play precedence (cite `feat-003/AC-2,AC-6`).
- [ ] T6 [H]: Manual play-test on a real iOS device — drag follows the pointer (AC-13), board scales/redraws (AC-12), and targeting is correct at the phone's scale (AC-14). Record the result. Human-gated: needs a physical device and human observation. → `human_signoff hs-1`.
- [ ] T7: Re-run `/spec-flow:converge` after the T2 refactor to confirm the code still matches the spec (behavior unchanged).

**Self-check:** T3/T4/T5 are `[P]` (independent of each other) but both depend on T1+T2, which precede them — no `[P]` task depends on a `[P]` sibling. Good.

## Verification approach

| AC | How verified | Seam / test |
|---|---|---|
| AC-1 deal shape | unit (T3) | `deal()` exported result |
| AC-2 draw/recycle | unit (T5) | `drawFromStock` / `recycleWaste` on a state object |
| AC-3 foundation legality | unit (T3) | `canPlaceOnFoundation()` |
| AC-4 tableau legality | unit (T3) | `canPlaceOnTableau()` |
| AC-5 run validity | unit (T3) | `validateDraggedRun()` |
| AC-6 auto-play precedence | unit (T5) | move helpers on a state object |
| AC-7 flip face-down top | unit (T3) | reveal helper |
| AC-8 reveal-on-move | unit (T3) | reveal-on-commit helper |
| AC-9 illegal drop returns | unit (T3) | drop resolver on a state object |
| AC-10 win | unit (T3) | win-count helper |
| AC-11 restart | covered by AC-1 deal test + manual (T6) | `deal()` reset |
| AC-12 responsive scaling | manual (T6) | visual / resize observation |
| AC-13 drag follows pointer (manual) | manual (T6) | play-test observation |
| AC-14 scaled targeting | unit (T4) | scaled point→card mapping helper |

Converge (runs 1–2) already verified the code against the spec by independent reading — the tests above
formalize that into an executable, re-runnable check and close the standing test debt.
