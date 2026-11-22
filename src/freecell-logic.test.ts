import { test, expect } from 'vitest'
import { seeded } from './seeded.test-helper'
import {
  newGame,
  fullDeck,
  cardColor,
  move,
  capacity,
  isSolved,
  cardsOnFoundations,
  undo,
  autoPlay,
  isSafe,
  moveThenAutoPlay,
  tapMove,
  type Card,
  type GameState,
  type Place,
  places,
} from './freecell-logic'

const key = (card: Card) => `${card.suit}-${card.rank}`

test('a deal holds all 52 distinct cards', () => {
  const cards = newGame(seeded(1)).cascades.flat()

  expect(cards).toHaveLength(52)
  expect(new Set(cards.map(key)).size).toBe(52)
  for (const card of cards) {
    expect(card.rank).toBeGreaterThanOrEqual(1)
    expect(card.rank).toBeLessThanOrEqual(13)
  }
})

test('the eight cascades hold 7, 7, 7, 7, 6, 6, 6, 6 cards', () => {
  expect(newGame(seeded(2)).cascades.map((cascade) => cascade.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
})

test('the deck is dealt left to right in turn across the cascades', () => {
  // With a random that never swaps, the deck stays in suit order, Ace to King: the first eight cards
  // become the first card of each of the eight cascades.
  const { cascades } = newGame(() => 0.999999)
  const inOrder = [...Array(52).keys()].map((index) => cascades[index % 8][Math.floor(index / 8)])

  expect(inOrder).toEqual(fullDeck())
  expect(cascades[0][0]).toEqual({ suit: 'hearts', rank: 1 })
  expect(cascades[1][0]).toEqual({ suit: 'hearts', rank: 2 })
})

test('the four free cells, four foundations and past start empty', () => {
  const state = newGame(seeded(3))

  expect(state.freeCells).toEqual([null, null, null, null])
  expect(state.foundations).toEqual([[], [], [], []])
  expect(state.past).toEqual([])
})

test('the same random gives the same deal, and a different one a different deal', () => {
  expect(newGame(seeded(4))).toEqual(newGame(seeded(4)))
  expect(newGame(seeded(4)).cascades).not.toEqual(newGame(seeded(5)).cascades)
})

test('cards are coloured by suit, as in Klondike', () => {
  const diamond: Card = { suit: 'diamonds', rank: 5 }
  const club: Card = { suit: 'clubs', rank: 5 }

  expect(cardColor(diamond)).toBe('red')
  expect(cardColor(club)).toBe('black')
})

// Short names for cards and places, so an arrangement reads like the table.
const card = (rank: number, suit: Card['suit']): Card => ({ suit, rank })
const cascade = (index: number): Place => ({ kind: 'cascade', index })
const freeCell = (index: number): Place => ({ kind: 'free-cell', index })
const foundation = (index: number): Place => ({ kind: 'foundation', index })

// A table with the given cascades (the rest empty, up to eight), free cells and foundations. A filler card
// fills each cascade left unnamed, so that none counts as empty unless the test says so.
function table(
  cascades: Card[][],
  freeCells: (Card | null)[] = [null, null, null, null],
  foundations: Card[][] = [[], [], [], []],
): GameState {
  const filler = card(13, 'spades')
  const all = Array.from({ length: 8 }, (_, index) => cascades[index] ?? [filler])

  return { cascades: all, freeCells, foundations, past: [] }
}

// A sequence running down from `top` for `length` cards, alternating hearts and clubs.
function sequence(top: number, length: number): Card[] {
  return Array.from({ length }, (_, index) => card(top - index, index % 2 === 0 ? 'hearts' : 'clubs'))
}

test('a card one rank below and the other colour goes onto the foot of a cascade', () => {
  const state = table([[card(9, 'spades')], [card(8, 'hearts')]])
  const next = move(state, cascade(1), cascade(0), 1)

  expect(next?.cascades[0]).toEqual([card(9, 'spades'), card(8, 'hearts')])
  expect(next?.cascades[1]).toEqual([])
})

test('a card of the same colour or the wrong rank is refused on a cascade', () => {
  const sameColour = table([[card(9, 'spades')], [card(8, 'clubs')]])
  const wrongRank = table([[card(9, 'spades')], [card(7, 'hearts')]])

  expect(move(sameColour, cascade(1), cascade(0), 1)).toBeNull()
  expect(move(wrongRank, cascade(1), cascade(0), 1)).toBeNull()
})

test('any card goes into an empty cascade', () => {
  const state = table([[], [card(5, 'diamonds')]])

  expect(move(state, cascade(1), cascade(0), 1)?.cascades[0]).toEqual([card(5, 'diamonds')])
})

test('one card goes onto an empty free cell, and a second card is refused on a full one', () => {
  const state = table([[card(4, 'clubs')], [card(9, 'hearts')]])
  const next = move(state, cascade(0), freeCell(2), 1)

  expect(next?.freeCells).toEqual([null, null, card(4, 'clubs'), null])
  expect(move(next!, cascade(1), freeCell(2), 1)).toBeNull()
})

test('two cards are refused on a free cell, and one card comes back from it onto a cascade', () => {
  const state = table([sequence(9, 2), [card(5, 'spades')]], [card(4, 'hearts'), null, null, null])

  expect(move(state, cascade(0), freeCell(1), 2)).toBeNull()
  expect(move(state, freeCell(0), cascade(1), 1)?.cascades[1]).toEqual([card(5, 'spades'), card(4, 'hearts')])
  expect(move(state, freeCell(0), cascade(1), 2)).toBeNull()
})

test('foundations are built from the Ace up by suit', () => {
  const state = table([[card(2, 'hearts'), card(1, 'hearts')], [card(2, 'spades')], [card(3, 'hearts')]])

  expect(move(state, cascade(1), foundation(0), 1)).toBeNull()

  const ace = move(state, cascade(0), foundation(0), 1)!
  expect(ace.foundations[0]).toEqual([card(1, 'hearts')])
  expect(move(ace, cascade(1), foundation(0), 1)).toBeNull()
  expect(move(ace, cascade(2), foundation(0), 1)).toBeNull()

  const two = move(ace, cascade(0), foundation(0), 1)!
  expect(two.foundations[0]).toEqual([card(1, 'hearts'), card(2, 'hearts')])
  expect(move(two, cascade(2), foundation(0), 1)?.foundations[0]).toHaveLength(3)
})

test('one card comes off a foundation onto a cascade', () => {
  const state = table([[card(3, 'clubs')]], undefined, [[card(1, 'hearts'), card(2, 'hearts')], [], [], []])
  const next = move(state, foundation(0), cascade(0), 1)

  expect(next?.cascades[0]).toEqual([card(3, 'clubs'), card(2, 'hearts')])
  expect(next?.foundations[0]).toEqual([card(1, 'hearts')])
})

test('a sequence of exactly the capacity moves, and one card more is refused', () => {
  // Two empty free cells and one empty cascade: (2 + 1) × 2 = 6.
  const state = table([[card(10, 'spades')], sequence(9, 7), []], [card(1, 'clubs'), card(1, 'spades'), null, null])

  expect(capacity(state, cascade(0))).toBe(6)
  expect(move(state, cascade(1), cascade(0), 7)).toBeNull()

  const shorter = table([[card(10, 'spades')], sequence(9, 6), []], [card(1, 'clubs'), card(1, 'spades'), null, null])
  expect(move(shorter, cascade(1), cascade(0), 6)?.cascades[0]).toEqual([card(10, 'spades'), ...sequence(9, 6)])
})

test('a sequence going into an empty cascade has the smaller capacity', () => {
  // Two empty free cells and two empty cascades: 12 onto a card, but 6 into one of the empty cascades.
  const state = table([[card(10, 'spades')], sequence(9, 7), [], []], [card(1, 'clubs'), card(1, 'spades'), null, null])

  expect(capacity(state, cascade(0))).toBe(12)
  expect(capacity(state, cascade(2))).toBe(6)
  expect(move(state, cascade(1), cascade(2), 6)?.cascades[2]).toEqual(sequence(9, 7).slice(1))
  expect(move(state, cascade(1), cascade(2), 7)).toBeNull()
})

test('a free cell or a foundation has a capacity of one card', () => {
  const state = table([])

  expect(capacity(state, freeCell(0))).toBe(1)
  expect(capacity(state, foundation(0))).toBe(1)
})

test('cards at the foot of a cascade that are not a sequence are refused', () => {
  const sameColour = table([[card(10, 'spades')], [card(9, 'hearts'), card(8, 'diamonds')]])
  const wrongRank = table([[card(10, 'spades')], [card(9, 'hearts'), card(7, 'clubs')]])

  // The 9 of hearts on top of each pair could go onto the 10 of spades: only the card below it breaks the sequence.
  expect(move(sameColour, cascade(1), cascade(0), 2)).toBeNull()
  expect(move(wrongRank, cascade(1), cascade(0), 2)).toBeNull()
})

test('a move of no cards, more cards than the cascade holds, or onto its own place is refused', () => {
  const state = table([sequence(9, 2), [card(10, 'spades')]])

  expect(move(state, cascade(0), cascade(1), 0)).toBeNull()
  expect(move(state, cascade(0), cascade(1), 3)).toBeNull()
  expect(move(state, cascade(0), cascade(0), 1)).toBeNull()
  expect(move(state, freeCell(0), cascade(1), 1)).toBeNull()
})

test('a move of part of a card or of NaN cards is refused', () => {
  const state = table([[card(10, 'spades')], sequence(9, 2)])

  expect(move(state, cascade(1), cascade(0), 1.5)).toBeNull()
  expect(move(state, cascade(1), cascade(0), Number.NaN)).toBeNull()
})

test('move never changes the state it was given', () => {
  const state = table([[card(10, 'spades')], sequence(9, 2), [card(1, 'hearts')]])
  const before = structuredClone(state)

  move(state, cascade(1), cascade(0), 2)
  move(state, cascade(2), foundation(0), 1)
  move(state, cascade(1), freeCell(0), 1)

  expect(state).toEqual(before)
})

test('isSolved is true only with all 52 cards on the foundations', () => {
  const bySuit = (suit: Card['suit']) => fullDeck().filter((each) => each.suit === suit)
  const foundations = [bySuit('hearts'), bySuit('diamonds'), bySuit('clubs'), bySuit('spades')]
  const solved: GameState = {
    cascades: Array.from({ length: 8 }, () => []),
    freeCells: [null, null, null, null],
    foundations,
    past: [],
  }
  const king = foundations[3].at(-1)!
  const oneShort: GameState = {
    ...solved,
    cascades: [[king], [], [], [], [], [], [], []],
    foundations: [...foundations.slice(0, 3), foundations[3].slice(0, -1)],
  }

  expect(isSolved(solved)).toBe(true)
  expect(isSolved(oneShort)).toBe(false)
  expect(isSolved(newGame(seeded(6)))).toBe(false)
})

test('cardsOnFoundations counts the cards on every foundation', () => {
  const state = table([[card(9, 'spades')]], undefined, [
    [card(1, 'hearts'), card(2, 'hearts')],
    [],
    [card(1, 'clubs')],
    [],
  ])

  expect(cardsOnFoundations(state)).toBe(3)
  expect(cardsOnFoundations(newGame(seeded(6)))).toBe(0)
})

test('a move pushes the state before it onto past, and undo goes back one move', () => {
  const state = table([[card(9, 'spades')], [card(8, 'hearts')]])
  const once = move(state, cascade(1), cascade(0), 1)!
  const twice = move(once, cascade(0), freeCell(0), 1)!

  expect(twice.past).toHaveLength(2)
  expect(undo(twice)).toEqual(once)
  expect(undo(undo(twice))).toEqual(state)
})

test('undo does nothing with an empty past', () => {
  const state = newGame(seeded(7))

  expect(undo(state)).toBe(state)
})

test('an Ace at the foot of a cascade goes up to a foundation', () => {
  const state = table([[card(9, 'spades'), card(1, 'diamonds')]])
  const next = autoPlay(state)

  expect(next.cascades[0]).toEqual([card(9, 'spades')])
  expect(next.foundations).toContainEqual([card(1, 'diamonds')])
})

test('a Two goes up onto its Ace, whatever is on the other foundations', () => {
  const state = table([[card(2, 'clubs')]], undefined, [[card(1, 'clubs')], [], [], []])

  expect(isSafe(state, card(2, 'clubs'))).toBe(true)
  expect(autoPlay(state).foundations[0]).toEqual([card(1, 'clubs'), card(2, 'clubs')])
})

test('a Three of hearts goes up only once both black Twos are up', () => {
  const hearts = [card(1, 'hearts'), card(2, 'hearts')]
  const oneBlackTwo = table([[card(3, 'hearts')]], undefined, [
    hearts,
    [card(1, 'clubs'), card(2, 'clubs')],
    [card(1, 'spades')],
    [],
  ])
  const bothBlackTwos = table([[card(3, 'hearts')]], undefined, [
    hearts,
    [card(1, 'clubs'), card(2, 'clubs')],
    [card(1, 'spades'), card(2, 'spades')],
    [],
  ])

  expect(isSafe(oneBlackTwo, card(3, 'hearts'))).toBe(false)
  expect(autoPlay(oneBlackTwo).cascades[0]).toEqual([card(3, 'hearts')])
  expect(isSafe(bothBlackTwos, card(3, 'hearts'))).toBe(true)
  expect(autoPlay(bothBlackTwos).foundations[0]).toEqual([...hearts, card(3, 'hearts')])
})

test('a card that is not safe stays put, in a cascade or a free cell', () => {
  // The Two of spades has no Ace to go onto; the Four of diamonds could go up, but the black Threes are not.
  const diamonds = [card(1, 'diamonds'), card(2, 'diamonds'), card(3, 'diamonds')]
  const state = table(
    [[card(2, 'spades')]],
    [card(4, 'diamonds'), null, null, null],
    [diamonds, [card(1, 'clubs'), card(2, 'clubs')], [], []],
  )

  expect(isSafe(state, card(2, 'spades'))).toBe(false)
  expect(isSafe(state, card(4, 'diamonds'))).toBe(false)
  expect(autoPlay(state)).toEqual(state)
})

test('a safe card in a free cell goes up', () => {
  const state = table([], [null, card(1, 'spades'), null, null])
  const next = autoPlay(state)

  expect(next.freeCells).toEqual([null, null, null, null])
  expect(next.foundations).toContainEqual([card(1, 'spades')])
})

test('a chain where one card going up frees the next all goes up', () => {
  // The Ace of clubs going up uncovers the Ace of hearts, and that uncovers the Two of clubs. The Two of
  // hearts in the free cell can only follow once its Ace is up.
  const state = table(
    [[card(9, 'diamonds'), card(2, 'clubs'), card(1, 'hearts'), card(1, 'clubs')]],
    [card(2, 'hearts'), null, null, null],
  )
  const next = autoPlay(state)

  expect(next.cascades[0]).toEqual([card(9, 'diamonds')])
  expect(next.freeCells).toEqual([null, null, null, null])
  expect(next.foundations).toEqual([
    [card(1, 'clubs'), card(2, 'clubs')],
    [card(1, 'hearts'), card(2, 'hearts')],
    [],
    [],
  ])
})

test('auto-play adds nothing to past, and keeps what is already there', () => {
  const earlier = table([[card(1, 'hearts'), card(5, 'clubs')]])
  const state = { ...table([[card(1, 'hearts')]]), past: [earlier] }

  expect(autoPlay(state).past).toEqual([earlier])
})

test('a move sets off auto-play, and one undo brings back the state from before that move', () => {
  // Moving the Nine of clubs onto the Ten of hearts uncovers an Ace, which goes up on its own.
  const state = table([[card(10, 'hearts')], [card(1, 'spades'), card(9, 'clubs')]])
  const next = moveThenAutoPlay(state, cascade(1), cascade(0), 1)!

  expect(next.cascades[0]).toEqual([card(10, 'hearts'), card(9, 'clubs')])
  expect(next.cascades[1]).toEqual([])
  expect(next.foundations).toContainEqual([card(1, 'spades')])
  expect(undo(next)).toEqual(state)
})

test('a move the rules refuse sets off no auto-play', () => {
  const state = table([[card(1, 'spades'), card(9, 'clubs')], [card(9, 'hearts')]])

  expect(moveThenAutoPlay(state, cascade(0), cascade(1), 1)).toBeNull()
})

// The move a tap picks, after checking that `move` accepts it.
function tapped(state: GameState, from: Place, index: number) {
  const picked = tapMove(state, from, index)

  if (picked) {
    expect(move(state, picked.from, picked.to, picked.count)).not.toBeNull()
  }

  return picked
}

test('a tapped card that can go onto a foundation goes there, before any cascade', () => {
  const state = table([[card(1, 'hearts')], [card(2, 'spades')]], undefined, [[card(1, 'spades')], [], [], []])

  expect(tapped(state, cascade(0), 0)).toEqual({ from: cascade(0), to: foundation(1), count: 1 })
})

test('otherwise a tap goes onto the first cascade from the left that takes it and is not empty', () => {
  const state = table([[], [card(8, 'hearts'), card(7, 'clubs')], [card(8, 'diamonds')], [card(9, 'clubs')]])

  expect(tapped(state, cascade(1), 1)).toEqual({ from: cascade(1), to: cascade(2), count: 1 })
  expect(tapped(state, cascade(1), 0)).toEqual({ from: cascade(1), to: cascade(3), count: 2 })
})

test('otherwise a tap goes into the first empty cascade, sequence and all, within the capacity', () => {
  const state = table([[card(13, 'clubs'), ...sequence(5, 3)], [card(13, 'clubs')], [], []])

  expect(tapped(state, cascade(0), 3)).toEqual({ from: cascade(0), to: cascade(2), count: 1 })
  expect(tapped(state, cascade(0), 1)).toEqual({ from: cascade(0), to: cascade(2), count: 3 })
})

test('otherwise a single tapped card goes into the first empty free cell', () => {
  const state = table([[card(13, 'clubs'), card(5, 'diamonds')]], [card(3, 'spades'), null, null, null])

  expect(tapped(state, cascade(0), 1)).toEqual({ from: cascade(0), to: freeCell(1), count: 1 })
})

test('a tap with nowhere to go gives null', () => {
  const full = [card(3, 'spades'), card(3, 'clubs'), card(4, 'spades'), card(4, 'clubs')]
  const state = table([[card(13, 'clubs'), card(5, 'diamonds')]], full)

  expect(tapped(state, cascade(0), 1)).toBeNull()
})

test('a sequence that takes a whole cascade is not moved into an empty one, and a lone card goes to a free cell', () => {
  const state = table([sequence(6, 2), [card(5, 'diamonds')], []])

  expect(tapped(state, cascade(0), 0)).toBeNull()
  expect(tapped(state, cascade(1), 0)).toEqual({ from: cascade(1), to: freeCell(0), count: 1 })
})

test('a tapped card buried under cards that are not a sequence with it gives null', () => {
  const state = table([[card(9, 'spades'), card(4, 'hearts'), card(2, 'clubs')], [card(5, 'clubs')], []])

  expect(tapped(state, cascade(0), 1)).toBeNull()
  expect(tapped(state, cascade(0), 0)).toBeNull()
})

test('a sequence longer than the capacity gives null, even with a cascade that would take its top card', () => {
  const full = [card(3, 'spades'), card(3, 'clubs'), card(4, 'spades'), null]
  const state = table([[card(13, 'clubs'), ...sequence(8, 3)], [card(9, 'spades')]], full)

  expect(tapped(state, cascade(0), 1)).toBeNull()
  expect(tapped(state, cascade(0), 3)).toEqual({ from: cascade(0), to: freeCell(3), count: 1 })
})

test('a card in a free cell goes onto a cascade or into an empty one, but never into another free cell', () => {
  const onto = table([[card(6, 'spades')]], [card(5, 'hearts'), null, null, null])
  const into = table([[], [card(9, 'clubs')]], [card(5, 'clubs'), null, null, null])
  const stuck = table([[card(9, 'clubs')]], [card(5, 'clubs'), null, null, null])

  expect(tapped(onto, freeCell(0), 0)).toEqual({ from: freeCell(0), to: cascade(0), count: 1 })
  expect(tapped(into, freeCell(0), 0)).toEqual({ from: freeCell(0), to: cascade(0), count: 1 })
  expect(tapped(stuck, freeCell(0), 0)).toBeNull()
})

test('a tap on a foundation, an empty free cell or past the end of a cascade gives null', () => {
  const state = table([[card(5, 'clubs')], []], undefined, [[card(1, 'hearts')], [], [], []])

  expect(tapped(state, foundation(0), 0)).toBeNull()
  expect(tapped(state, freeCell(0), 0)).toBeNull()
  expect(tapped(state, cascade(0), 1)).toBeNull()
  expect(tapped(state, cascade(0), -1)).toBeNull()
})

test('a sequence too long for the capacity into the only empty cascade gives null, though its foot card fits', () => {
  const full = [card(3, 'spades'), card(3, 'clubs'), card(4, 'spades'), card(4, 'clubs')]
  const state = table([[card(13, 'clubs'), ...sequence(8, 2)], []], full)

  expect(tapped(state, cascade(0), 1)).toBeNull()
  expect(tapped(state, cascade(0), 2)).toEqual({ from: cascade(0), to: cascade(1), count: 1 })
})

test('places lists every place of a kind, in order', () => {
  expect(places('cascade')).toHaveLength(8)
  expect(places('free-cell')).toEqual([0, 1, 2, 3].map((index) => ({ kind: 'free-cell', index })))
  expect(places('foundation').map((place) => place.index)).toEqual([0, 1, 2, 3])
})
