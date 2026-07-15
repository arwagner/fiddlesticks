# Tasks — canvas-solitaire (feat-003)

Glyphs: `[x]` done · `[ ]` not started · `[~]` partial · `[-]` n/a · `[H]` human-gated · `[P]` = parallelizable.
See `plan.md` for rationale and the AC verification table.

## Implementation (already built — adopted)
- [x] Deck/shuffle/deal + core state — `src/solitaire.ts:143-186` — feat-003/AC-1
- [x] Stock draw + unlimited recycle — `:358-385` — feat-003/AC-2
- [x] Foundation legality (any-suit) — `:299-308` — feat-003/AC-3
- [x] Tableau legality + run validation — `:310-322`, `:387-402` — feat-003/AC-4, AC-5
- [x] Auto-play, flip-on-click, reveal-on-move — `:529-575`, `:465-471` — feat-003/AC-6, AC-7, AC-8
- [x] Illegal-drop return, win, restart — `:442-454`, `:495-501`, `:683-684` — feat-003/AC-9, AC-10, AC-11
- [x] Responsive scaling + scaled hit-testing — `:80-122`, `:487-503`, `:566-589` — feat-003/AC-12, AC-14
- [x] Drag layer + pointercancel — `:646-681` — feat-003/AC-13

## Test coverage (new work)
- [ ] T1: Add Vitest devDependency + `test`/`test:run` scripts; set `tests:` in `.spec-flow.md`
- [ ] T2: Extract pure rules → `src/solitaire-rules.ts`; wire `solitaire.ts` to import them (behavior-preserving)
- [ ] T3 [P]: `src/solitaire-rules.test.ts` — feat-003/AC-1, AC-3, AC-4, AC-5, AC-8, AC-9, AC-10
- [ ] T4 [P]: `src/solitaire-hittest.test.ts` — feat-003/AC-14
- [ ] T5 [P]: `src/solitaire-stock.test.ts` — feat-003/AC-2, AC-6
- [ ] T6 [H]: Manual iOS-device play-test — feat-003/AC-11, AC-12, AC-13 (→ human_signoff hs-1)
- [ ] T7: Re-run `/spec-flow:converge` after T2 to confirm behavior unchanged
