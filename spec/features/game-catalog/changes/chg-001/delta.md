# Delta — game-catalog

> The change expressed against the current spec as explicit operations. Source: owner decision to
> remove the fake games (leaving only implemented games; currently just Canvas Solitaire).

## ADDED
_(none)_

## MODIFIED
- **AC-1 — initial render**
  - Was: "On load, all 31 games render as cards, each showing its genre, title, description, and a 'Play' link."
  - Now: "On load, every game in the catalog renders as a card, each showing its genre, title, description,
    and a 'Play' link. (The catalog holds only implemented games — currently just Canvas Solitaire.)"
- **AC-4 — empty state**
  - Was: "When nothing matches, a 'No games found' empty state with a broadening hint is shown and the count reads '0 of 31 games'."
  - Now: "When nothing matches, a 'No games found' empty state with a broadening hint is shown and the count reads '0 of <total> games'."
- **AC-6 — empty query**
  - Was: "An empty or whitespace-only query shows all 31 games (the count returns to '31 of 31 games')."
  - Now: "An empty or whitespace-only query shows every game (the count returns to '<total> of <total> games')."

## REMOVED
_(none — the 30 flavor games were catalog data, not spec requirements; no acceptance criterion is removed.)_
