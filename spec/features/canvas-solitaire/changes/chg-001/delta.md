# Delta — canvas-solitaire

> The change expressed against the current spec as explicit operations. Source: converge gap-001.

## ADDED
_(none)_

## MODIFIED
- **AC-3 — foundation acceptance rule**
  - Was: "A card is accepted on a foundation only when it is the next ascending rank of the same suit,
    with an Ace required on an empty foundation." (Reads as suit-locked foundations.)
  - Now: "Foundations are not pre-assigned to suits. Any Ace may start any empty foundation; thereafter
    a card is accepted only when it is the next ascending rank of the same suit as that foundation's
    current top card. Empty foundation slots are drawn without a suit label."
- **Behavior scenario "Foundation move"**
  - Was: Given a card is the next ascending rank of a suit (Ace onto an empty foundation) …
  - Now: Given a card is an Ace (for any empty foundation) or the next ascending rank of the suit already
    on a foundation …

## REMOVED
_(none)_
