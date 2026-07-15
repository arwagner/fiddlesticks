# Canvas Klondike Solitaire — spec (as-built, draft)

> Reverse-engineered from `src/solitaire.ts` on 2026-07-15, then reconciled with the chg-001 /
> gap-001 / gap-002 fixes. Describes current observable behavior. Inherits product-wide NFRs from
> `product-global.md`.

## Why
The arcade needs at least one real, playable game. Canvas Solitaire is a self-contained Klondike
implementation that renders on a canvas and works with mouse or touch.

## User stories
- As a player, I want a freshly shuffled Klondike deal so that every game is different.
- As a player, I want to draw from the stock and move cards between tableau, foundations, and waste so that I can play the game.
- As a player, I want the game to enforce legal moves so that I can't cheat by accident.
- As a player, I want to know when I've won and to restart at any time.
- As a player, I want the board to fit my screen so that it's playable on narrow and wide viewports.

## Behavior & scenarios
- **Scenario: Deal**
  - Given I load the game or press Restart
  - When the deal completes
  - Then 7 tableau columns hold 1..7 cards with only the last of each face-up, the remaining 24 cards
    form the stock, and the waste and all 4 foundations are empty.
- **Scenario: Draw from stock**
  - Given the stock has cards
  - When I click the stock pile
  - Then the top stock card turns face-up onto the waste.
- **Scenario: Recycle waste**
  - Given the stock is empty
  - When I click the stock pile
  - Then the entire waste is turned face-down and returned to the stock (recyclable without limit).
- **Scenario: Foundation move**
  - Given a card is an Ace (for any empty foundation) or the next ascending rank of the suit already on a foundation
  - When I drag it onto that foundation, or click the foundation slot to auto-play an eligible waste/tableau top
  - Then the card moves to the foundation.
- **Scenario: Tableau move**
  - Given a card or valid run whose head is one rank below and the opposite color of a column's face-up top card (or a King onto an empty column)
  - When I drop it on that column
  - Then the card(s) move there.
- **Scenario: Illegal move**
  - Given a move that violates the foundation/tableau rules
  - When I drop the card(s)
  - Then they return to their source pile unchanged.
- **Scenario: Flip and reveal**
  - Given a tableau column whose top card is face-down
  - When I click that top card, or a move exposes it
  - Then it flips face-up.
- **Scenario: Win**
  - Given all 52 cards have reached the foundations
  - When the last card lands
  - Then the status shows a win message.
- **Scenario: Pick up a run**
  - Given a face-up run of cards in a tableau column
  - When I try to drag starting from one of its cards
  - Then the run lifts only if it is a contiguous descending, alternating-color sequence; otherwise nothing is picked up.
- **Scenario: Restart**
  - Given a game in progress
  - When I click Restart
  - Then a fresh shuffled game is dealt and the status text resets to the build instruction.
- **Scenario: Responsive scaling**
  - Given the board is shown in its container
  - When the container/viewport width changes (including on window resize)
  - Then the board rescales to fit the width, down to a minimum scale of 0.5, and redraws.
- **Scenario: Pointer targeting at scale**
  - Given the board is rendered at a responsive scale other than 1.0
  - When I click or drag-drop aimed at a card's drawn rectangle
  - Then that card is the one selected/targeted, matching its drawn position rather than an offset one.

## Acceptance criteria
- [ ] AC-1: A deal produces 7 tableau columns of 1..7 cards with only each column's last card face-up, 24 cards in the stock, and empty waste and foundations.
- [ ] AC-2: Clicking a non-empty stock turns its top card face-up onto the waste; clicking an empty stock recycles the whole waste back into the stock face-down (unlimited passes).
- [ ] AC-3: Foundations are not pre-assigned to suits. Any Ace may start any empty foundation; thereafter a card is accepted only when it is the next ascending rank of the same suit as that foundation's current top card. Empty foundation slots are drawn without a suit label.
- [ ] AC-4: A card/run is accepted on a tableau column only when its head is one rank below and the opposite color of the column's face-up top card; an empty column accepts only a King.
- [ ] AC-5: A tableau run can be picked up for dragging only when it is a contiguous descending, alternating-color sequence.
- [ ] AC-6: Clicking a foundation slot auto-plays an eligible card from the waste, or failing that from the leftmost eligible tableau column's top card, when one is placeable.
- [ ] AC-7: Clicking a face-down top card in a tableau column flips it face-up.
- [ ] AC-8: Removing a tableau card that exposes a face-down card flips the newly exposed card face-up.
- [ ] AC-9: An illegal drop returns the dragged card(s) to their source pile with no state change.
- [ ] AC-10: When all 52 cards are on the foundations, the status region shows a win message.
- [ ] AC-11: Restart deals a fresh shuffled game and resets the status text.
- [ ] AC-12: The board scales to the container width (minimum scale 0.5) and redraws on window resize.
- [ ] AC-13: During a drag the moving card(s) follow the pointer, and a `pointercancel` returns them to their source. (manual)
- [ ] AC-14: Pointer targeting matches rendered card positions at **every** responsive scale — a click or drop aimed at a card's drawn rectangle selects/places on that card whether the board is scaled below or above 1.0, not only at scale 1.0. (Required by the `product-global.md` mobile/iOS NFR: phones render at non-1.0 scales.)

## Known limitations (by design)
- No undo, no move hints, no auto-complete, no scoring, and no timer.
- No detection of unwinnable deals.
- Shuffle and card ids rely on `Math.random` (not cryptographic; fine for a casual game).

_Resolved defects (kept for provenance):_ the earlier scale-mixing hit-test defect — pointer targeting
drifted at scale ≠ 1 — was fixed under converge **gap-002**; pickup, drop, and the drag anchor now
hit-test in scaled coordinates (AC-14). The suit-locked-foundation misread was corrected under **gap-001**
/ chg-001 (AC-3).

## Edge cases & errors  _(mvp+ depth)_
- Deck underflow while dealing → throws "Deck underflow while dealing" (defensive; unreachable with a full 52-card deck).
- Missing canvas / status / restart elements, or no 2D context → throws at setup.
- Starting a drag while one is in progress is ignored (`if (drag) return`).
- Empty stock **and** empty waste click → no-op (recycle of an empty waste does nothing).
- Viewport narrower than the minimum-scale (0.5) floor → the board stops shrinking at scale 0.5 rather
  than scaling arbitrarily small; the canvas may then be wider than the container.
- A window resize mid-drag recomputes the board scale immediately, but the in-flight drag's anchor was
  captured at drag-start and is not re-derived, so the lifted card can sit slightly off-pointer until
  dropped (the drop itself still hit-tests against the current scale). Minor.

## Non-functional requirements  _(mvp+ depth)_
- Performance: the board fully redraws on every pointer move during a drag; this must stay visually
  smooth (no perceptible lag, interactive frame rate) during a drag on a current mobile browser at the
  standard 52-card board size.
- Security: none (self-contained, no I/O, no network, no persistence).
- Accessibility: the canvas has `aria-label="Solitaire board"` and the status is `aria-live="polite"`,
  but the game itself is not keyboard-operable and card state is not exposed to assistive tech
  (pointer-only). No feature-specific bar is met beyond these labels.

## Open questions
- None. Stock rules are deliberately the most forgiving Klondike variant — single-card draw with
  unlimited recycling (encoded in AC-2), confirmed intended on 2026-07-15.
