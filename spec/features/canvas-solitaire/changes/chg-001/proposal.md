# Proposal — canvas-solitaire

**Trigger:** converge run 1, gap-001 (contradicts AC-3). The as-built spec's AC-3 was reverse-engineered
as "next ascending rank of the **same suit**, Ace required on an empty foundation," which reads as
*suit-locked* foundations. The owner ruled (2026-07-15) that any foundation accepts any suit — foundations
are not pre-assigned — so AC-3 states the wrong intended behavior. This is a spec change, not just a defect.
**Summary:** Correct AC-3 to say foundations are suit-agnostic slots: any Ace may start any empty
foundation, and thereafter a card is accepted only if it is the next ascending rank of the same suit as
that foundation's current top. The placement *logic* in code (`canPlaceOnFoundation`) already implements
exactly this (empty pile → any Ace; non-empty → match the top card's suit), so no logic change is needed —
the only code defect is cosmetic: empty foundations are drawn with a fixed suit label (H/D/C/S), which
wrongly implies suit-locking. That label is dropped.

## Blast radius
- Requirements affected: AC-3 (MODIFIED); "Foundation move" scenario wording (clarified, same edit).
- Design decisions affected: none (no plan.md for this feature).
- Tasks affected (regenerate these): none (no tasks.md); the code change is a one-line label fix built inline.
- Already-built code affected: `drawFoundationsAndTopRow` empty-foundation label at `src/solitaire.ts:637`.
  NOT affected (already correct): `canPlaceOnFoundation`, `moveWasteToFoundation`, `moveTableauToFoundation`,
  `tryDropDrag` foundation branch, `checkWin`.

## Status
- [x] delta reviewed (analyze) — trivial spec correction confirming code behavior; owner-directed. Full analyze not run for a one-criterion clarifying MODIFY.
- [x] implemented & verified — label dropped; `tsc` clean.
- [x] folded into spec.md (CI regenerates product.md)
