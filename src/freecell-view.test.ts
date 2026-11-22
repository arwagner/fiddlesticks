// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupFreeCell } from './freecell'
import { CASCADE_COUNT, fullDeck, newGame, places, type Card, type GameState, type Place } from './freecell-logic'
import { freeCellLayout, placeRect, cascadeCardRects, type Rect } from './freecell-layout'
import { drag, press, type PagePoint } from './gestures.test-helper'
import { seeded } from './seeded.test-helper'
import { rankLabels, suitLabels } from './cards'

// Wide enough for the board at full size, so a board pixel is a page pixel.
const WIDTH = 800
const layout = freeCellLayout(WIDTH)

// Each card index drawn since the canvas was last cleared: its text ("9♠") and where it was written.
let written: { text: string; x: number; y: number }[] = []

// Tells the board its container has been resized, as the browser's ResizeObserver would.
let resize: () => void = () => undefined

// jsdom has no layout and draws nothing: the container reports a width, the canvas sits at the page's origin
// as wide as the container, and its context only notes the card indexes written on it.
function stubLayoutAndCanvas(): void {
  const recorded: Record<string, unknown> = {
    clearRect: () => {
      written = []
    },
    fillText: (text: string, x: number, y: number) => {
      written.push({ text, x, y })
    },
    measureText: () => ({ width: 0 }),
  }
  const context = new Proxy(recorded, {
    get: (target, name: string) => {
      if (!(name in target)) {
        target[name] = () => undefined
      }

      return target[name]
    },
    set: () => true,
  })

  HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement['getContext']
  HTMLCanvasElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, 600)
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { value: WIDTH, configurable: true })
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this as unknown as ResizeObserver)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const allPlaces: Place[] = [...places('cascade'), ...places('free-cell'), ...places('foundation')]

// Where every card on the board is drawn now, by its index.
function whereIsEvery(): Record<string, Place | null> {
  return Object.fromEntries(written.map(({ text }) => [text, whereIs(text)]))
}

// Where a card is drawn now, found from the first place whose column and row its index was written in.
function whereIs(text: string): Place | null {
  const drawn = written.find((each) => each.text === text)

  if (!drawn) {
    return null
  }

  return (
    allPlaces.find((place) => {
      const rect = placeRect(place, layout)
      const inColumn = drawn.x >= rect.x && drawn.x < rect.x + rect.w
      const inRow = place.kind === 'cascade' ? drawn.y >= rect.y : drawn.y < rect.y + rect.h

      return inColumn && inRow
    }) ?? null
  )
}

beforeEach(() => {
  document.body.innerHTML = ''
  written = []
  stubLayoutAndCanvas()
})

// A card's index as drawn on it: "9♠".
const indexOf = ({ rank, suit }: Card) => `${rankLabels[rank - 1]}${suitLabels[suit]}`
const card = (rank: number, suit: Card['suit']): Card => ({ rank, suit })
const cascade = (index: number): Place => ({ kind: 'cascade', index })
const freeCell = (index: number): Place => ({ kind: 'free-cell', index })
const foundation = (index: number): Place => ({ kind: 'foundation', index })

// A game with these cascades (padded to eight), free cells and foundations, and no history.
function table(
  cascades: Card[][],
  freeCells: (Card | null)[] = [null, null, null, null],
  foundations: Card[][] = [[], [], [], []],
): GameState {
  return {
    cascades: [...cascades, ...Array.from({ length: CASCADE_COUNT - cascades.length }, () => [])],
    freeCells,
    foundations,
    past: [],
  }
}

function mount(createGame: () => GameState) {
  const element = document.createElement('div')
  let width = WIDTH
  Object.defineProperty(element, 'clientWidth', { get: () => width })
  document.body.appendChild(element)
  setupFreeCell(element, createGame)

  const canvas = element.querySelector<HTMLCanvasElement>('#freecell-canvas')!
  const at =
    (rect: Rect, down = rect.h / 2) =>
    (): PagePoint => ({ target: canvas, clientX: rect.x + rect.w / 2, clientY: rect.y + down })

  return {
    element,
    resizeTo: (newWidth: number) => {
      width = newWidth
      resize()
    },
    // The middle of a place: a free cell's or foundation's card, or a cascade's first card.
    place: (place: Place) => at(placeRect(place, layout)),
    // A cascade's card, on the strip that still shows when cards lie over it, in the game as dealt.
    card: (state: GameState, index: number, cardIndex: number) =>
      at(cascadeCardRects(index, state, layout)[cardIndex], 4),
    status: () => element.querySelector('#freecell-status')!.textContent,
    undoButton: () => element.querySelector<HTMLButtonElement>('#freecell-undo')!,
    newButton: () => element.querySelector<HTMLButtonElement>('#freecell-new')!,
  }
}

test('the board opens with a canvas that a finger drag plays on, and a status line counting the foundations', () => {
  const { element, status } = mount(() => newGame(seeded(1)))

  expect(element.querySelector('#freecell-canvas')).not.toBeNull()
  expect(status()).toBe('0 of 52 cards on the foundations')
})

test('dragging a card onto a cascade that takes it moves it there', () => {
  const state = table([[card(13, 'clubs'), card(9, 'spades')], [card(10, 'hearts')]])
  const board = mount(() => state)

  expect(whereIs('9♠')).toEqual(cascade(0))

  // The press, a move on the way over the free cells, then the release and the click that follows it.
  drag([board.card(state, 0, 1), board.place(freeCell(2)), board.place(cascade(1))])

  expect(whereIs('9♠')).toEqual(cascade(1))
  expect(board.undoButton().disabled).toBe(false)
})

test('a sequence dragged onto a cascade moves with it', () => {
  const state = table([[card(13, 'clubs'), card(9, 'spades'), card(8, 'hearts')], [card(10, 'hearts')]])
  const board = mount(() => state)

  drag([board.card(state, 0, 1), board.place(cascade(1))])

  expect(whereIs('9♠')).toEqual(cascade(1))
  expect(whereIs('8♥')).toEqual(cascade(1))
  expect(whereIs('K♣')).toEqual(cascade(0))
})

test('an illegal drop leaves the board as it was', () => {
  const state = table([[card(13, 'clubs'), card(9, 'spades'), card(8, 'hearts')], [card(4, 'clubs')]])
  const board = mount(() => state)
  const before = whereIsEvery()

  drag([board.card(state, 0, 1), board.place(cascade(1))]) // the Nine is not one below the Four
  expect(whereIsEvery()).toEqual(before)

  drag([board.card(state, 0, 1), board.place(foundation(0))]) // two cards cannot go onto a foundation
  expect(whereIsEvery()).toEqual(before)

  drag([board.card(state, 0, 0), board.place(cascade(1))]) // the King, Nine and Eight are not a sequence
  expect(whereIsEvery()).toEqual(before)

  drag([board.card(state, 0, 2), board.place(cascade(0))]) // dropped back where it came from
  expect(whereIsEvery()).toEqual(before)
  expect(board.undoButton().disabled).toBe(true)
})

test('a card dragged into a free cell and out again lands where it is dropped', () => {
  const state = table([[card(13, 'clubs'), card(5, 'diamonds')], [card(6, 'spades')]])
  const board = mount(() => state)

  drag([board.card(state, 0, 1), board.place(freeCell(3))])
  expect(whereIs('5♦')).toEqual(freeCell(3))

  drag([board.place(freeCell(3)), board.place(cascade(1))])
  expect(whereIs('5♦')).toEqual(cascade(1))
})

test('a tap sends an Ace to a foundation', () => {
  const state = table([[card(9, 'spades'), card(1, 'diamonds')], [card(4, 'clubs')]])
  const board = mount(() => state)

  press(board.card(state, 0, 1))

  expect(whereIs('A♦')).toEqual(foundation(0))
  expect(board.status()).toBe('1 of 52 cards on the foundations')
})

test('a tap on a card with nowhere to go, or on an empty foundation, does nothing', () => {
  // The Five of diamonds has no black Six to go onto, no empty cascade and no empty free cell.
  const full = [card(3, 'spades'), card(3, 'clubs'), card(4, 'spades'), card(4, 'clubs')]
  const others = [2, 7, 8, 9, 10, 11, 12].map((rank) => [card(rank, 'hearts')])
  const state = table([[card(13, 'clubs'), card(5, 'diamonds')], ...others], full)
  const board = mount(() => state)
  const before = whereIsEvery()

  press(board.card(state, 0, 1))
  press(board.place(foundation(0)))

  expect(whereIsEvery()).toEqual(before)
  expect(board.undoButton().disabled).toBe(true)
})

test('Undo is disabled at the start and takes back the last move', () => {
  const state = table([
    [card(9, 'spades'), card(1, 'diamonds')],
    [card(10, 'hearts'), card(2, 'clubs')],
  ])
  const board = mount(() => state)

  expect(board.undoButton().disabled).toBe(true)

  press(board.card(state, 0, 1))
  expect(board.status()).toBe('1 of 52 cards on the foundations')

  board.undoButton().click()
  expect(whereIs('A♦')).toEqual(cascade(0))
  expect(board.status()).toBe('0 of 52 cards on the foundations')
  expect(board.undoButton().disabled).toBe(true)

  // The Ace is back at the foot of its cascade, where a tap still finds it.
  press(board.card(state, 0, 1))
  expect(board.status()).toBe('1 of 52 cards on the foundations')
})

test('a game one move from solved says it is solved when that move is made', () => {
  const bySuit = (suit: Card['suit']) => fullDeck().filter((each) => each.suit === suit)
  const king = card(13, 'spades')
  const state = table(
    [],
    [null, king, null, null],
    [bySuit('hearts'), bySuit('diamonds'), bySuit('clubs'), bySuit('spades').slice(0, -1)],
  )
  const board = mount(() => state)

  expect(board.status()).toBe('51 of 52 cards on the foundations')

  drag([board.place(freeCell(1)), board.place(foundation(3))])

  expect(board.status()).toBe('Solved! All 52 cards are on the foundations.')
})

test('New game deals again', () => {
  const deals = [table([[card(9, 'spades'), card(1, 'diamonds')]]), newGame(seeded(2))]
  let dealt = 0
  const board = mount(() => deals[dealt++])

  press(board.card(deals[0], 0, 1))
  expect(board.undoButton().disabled).toBe(false)

  board.newButton().click()

  expect(dealt).toBe(2)
  // Every card of the second deal is drawn in the cascade it was dealt to.
  deals[1].cascades.forEach((cards, index) => {
    cards.forEach((each) => expect(whereIs(indexOf(each))).toEqual(cascade(index)))
  })
  expect(board.status()).toBe('0 of 52 cards on the foundations')
  expect(board.undoButton().disabled).toBe(true)
})

// One pointer's event, sent on its own: which pointer sends it is the point of the test.
function pointer(type: string, aim: () => PagePoint, pointerId: number): void {
  const { target, clientX, clientY } = aim()
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  target.dispatchEvent(event)
}

test('a second finger neither takes over nor drops the cards the first finger is dragging', () => {
  const state = table([[card(13, 'clubs'), card(9, 'spades')], [card(10, 'hearts')], [card(1, 'diamonds')]])
  const board = mount(() => state)

  pointer('pointerdown', board.card(state, 0, 1), 1)
  pointer('pointermove', board.place(freeCell(2)), 1)

  // A second finger taps the Ace, which a tap would send to a foundation, and lifts off over a free cell.
  pointer('pointerdown', board.card(state, 2, 0), 2)
  pointer('pointerup', board.place(freeCell(0)), 2)
  expect(whereIs('A♦')).toEqual(cascade(2))
  expect(whereIs('9♠')).not.toEqual(freeCell(0))

  pointer('pointermove', board.place(cascade(1)), 1)
  pointer('pointerup', board.place(cascade(1)), 1)
  expect(whereIs('9♠')).toEqual(cascade(1))
})

test('a resize in the middle of a drag puts the lifted cards back', () => {
  const state = table([[card(13, 'clubs'), card(9, 'spades')], [card(10, 'hearts')]])
  const board = mount(() => state)

  pointer('pointerdown', board.card(state, 0, 1), 1)
  pointer('pointermove', board.place(freeCell(2)), 1)
  board.resizeTo(WIDTH - 100)
  pointer('pointerup', board.place(cascade(1)), 1)

  expect(board.undoButton().disabled).toBe(true)
})
