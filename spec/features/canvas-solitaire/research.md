# Research — Canvas Klondike Solitaire

**Provenance:** Reverse-engineered from code on 2026-07-15 — describes the system as built.
`readiness.research` is `ready` because the running game is the research.

## Evidence
- `src/solitaire.ts` — the whole game: deck/deal, stock/waste/foundations/tableau state, canvas
  rendering (`drawCard`, `drawSlot`, `drawTableau`, `drawFoundationsAndTopRow`, `drawDragLayer`),
  pointer handlers (`onPointerDown/Move/Up` + `pointercancel`), move rules (`canPlaceOnFoundation`,
  `canPlaceOnTableau`, `validateDraggedRun`), responsive scaling (`getResponsiveScale`,
  `updateCanvasSize`), and win detection (`checkWin`).
- `src/game.ts` — mounts it via `setupSolitaire(#solitaire-root)`.
- `src/style.css` — `.solitaire-root`, `.solitaire-toolbar`, canvas styling.

## Real user / job context
- A visitor who opens the Canvas Solitaire page plays a standard game of Klondike.
- Intended job: a self-contained, playable, mouse/touch-friendly solitaire that fits its container.

## As-built rules observed
- Standard Klondike deal: 7 columns of 1..7 cards, last face-up; remaining 24 → stock.
- Single-card stock draw to waste; empty-stock click recycles the whole waste face-down (unlimited passes).
- Foundations build A→K by suit; tableau builds down by alternating color; empty columns take Kings only.
- Runs drag as a unit only when they form a valid descending alternating-color sequence.
- Click a foundation slot to auto-play an eligible waste/tableau top; click a face-down top card to flip it.
- Win when all 52 cards reach the foundations.
