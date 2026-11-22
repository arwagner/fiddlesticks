import { test, expect } from 'vitest'
import { seeded } from './seeded.test-helper'
import { newGame, fullDeck, cardColor, type Card } from './freecell-logic'

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
