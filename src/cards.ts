// A playing card's suit, rank labels, colour and proportions, shared by every card game. No game's rules
// live here: Klondike's are in solitaire-rules.ts.

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const rankLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
// Each suit's pip, a filled Unicode symbol (U+2660..U+2666). Colour comes from cardColor, so the solid pips suit both.
export const pips: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }

// A card's base (unscaled) size. A game scales both by the same factor.
export const CARD_W = 86
export const CARD_H = 120
// Fraction of the card height at which the rank+pip index sits (its text baseline). card-draw.ts draws
// against this, and a game that fans cards over each other derives the fan from it.
export const INDEX_BASELINE = 0.36

export type Rect = { x: number; y: number; w: number; h: number }

export function cardColor(card: { suit: Suit }): 'red' | 'black' {
  return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'
}
