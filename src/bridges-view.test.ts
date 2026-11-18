// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupBridges, SIZES } from './bridges'
import { makePuzzle, newGameFromBoard, pairBetween, type GameState } from './bridges-logic'
import { drag, press, type Spot } from './gestures.test-helper'

beforeEach(() => {
  document.body.innerHTML = ''
})

//   1 . 1
//   . . .
//   2 . 2
// The answer is a U: one bridge down each side and one along the bottom.
const SQUARE = makePuzzle(3, [
  { row: 0, col: 0, count: 1 },
  { row: 0, col: 2, count: 1 },
  { row: 2, col: 0, count: 2 },
  { row: 2, col: 2, count: 2 },
])
const ANSWER = SQUARE.pairs.map(({ a, b }) => (a === 0 && b === 1 ? 0 : 1))
const square = (): GameState => newGameFromBoard(SQUARE, ANSWER)

// A bridge across and a bridge down that would cross in the middle.
const PLUS = makePuzzle(5, [
  { row: 0, col: 2, count: 1 },
  { row: 2, col: 0, count: 1 },
  { row: 2, col: 4, count: 1 },
  { row: 4, col: 2, count: 1 },
])
const plus = (): GameState => newGameFromBoard(PLUS, [0, 0])

function mount(makeGame: (size: number) => GameState = square, size = 3): HTMLElement {
  const element = document.createElement('div')
  document.body.appendChild(element)
  setupBridges(element, size, makeGame)
  return element
}

function island(element: HTMLElement, i: number): Spot {
  return () => element.querySelector(`[data-island="${i}"] .bridges-hit`)!
}

// Once a tap takes a bridge away, what is left under the pointer is water.
function bridge(element: HTMLElement, p: number): Spot {
  return () => element.querySelector(`[data-pair="${p}"] .bridges-hit`) ?? water(element)()
}

function water(element: HTMLElement): Spot {
  return () => element.querySelector('#bridges-board')!
}

// How many lines each pair's bridge is drawn with, 0 for none.
function drawn(element: HTMLElement, puzzle = SQUARE): number[] {
  return puzzle.pairs.map((_, p) => element.querySelectorAll(`[data-pair="${p}"] .bridges-line`).length)
}

function status(element: HTMLElement): string {
  return element.querySelector('#bridges-status')!.textContent ?? ''
}

function note(element: HTMLElement): string {
  return element.querySelector('#bridges-note')!.textContent ?? ''
}

function button(element: HTMLElement, selector: string): HTMLButtonElement {
  return element.querySelector<HTMLButtonElement>(selector)!
}

const LEFT = pairBetween(SQUARE, 0, 2)
const RIGHT = pairBetween(SQUARE, 1, 3)
const BOTTOM = pairBetween(SQUARE, 2, 3)

test('the board shows every island with its count and no bridges', () => {
  const element = mount()
  const counts = Array.from(element.querySelectorAll('[data-island] text')).map((text) => text.textContent)

  expect(counts).toEqual(['1', '1', '2', '2'])
  expect(drawn(element)).toEqual([0, 0, 0, 0])
  expect(status(element)).toBe('')
})

test('dragging from an island to a neighbour cycles that pair through one, two and no bridges', () => {
  const element = mount()
  const lines = () => drawn(element)[LEFT]

  drag([island(element, 0), water(element), island(element, 2)])
  expect(lines()).toBe(1)

  drag([island(element, 2), island(element, 0)]) // either way along the pair
  expect(lines()).toBe(2)

  drag([island(element, 0), island(element, 2)])
  expect(lines()).toBe(0)
})

test('a drag that ends anywhere but a neighbour does nothing', () => {
  const element = mount()

  drag([island(element, 0), island(element, 3)]) // diagonal: not a neighbour
  drag([island(element, 0), water(element)])
  press(island(element, 0)) // ends where it started

  expect(drawn(element)).toEqual([0, 0, 0, 0])
})

test('a drag that ends on a bridge does nothing, even with the click that follows', () => {
  const element = mount()

  drag([island(element, 0), island(element, 2)])
  drag([island(element, 1), bridge(element, LEFT)])

  expect(drawn(element)).toEqual(SQUARE.pairs.map((_, p) => (p === LEFT ? 1 : 0)))
})

test('a preview line follows the drag and goes when it ends', () => {
  const element = mount()
  const preview = element.querySelector('#bridges-preview')!

  drag([island(element, 0), island(element, 2)])
  expect(preview.getAttribute('visibility')).toBe('hidden')

  // Hold the press over the neighbour without letting go.
  island(element, 0)().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, buttons: 1 }))
  document.elementFromPoint = () => island(element, 2)()
  island(element, 2)().dispatchEvent(new MouseEvent('pointermove', { bubbles: true, cancelable: true, buttons: 1 }))

  expect(preview.getAttribute('visibility')).toBe('visible')
  expect([preview.getAttribute('x2'), preview.getAttribute('y2')]).toEqual(['0.5', '2.5'])
})

test('tapping a bridge cycles it to two bridges, then none', () => {
  const element = mount()

  drag([island(element, 0), island(element, 2)])
  press(bridge(element, LEFT))
  expect(drawn(element)[LEFT]).toBe(2)

  press(bridge(element, LEFT))
  expect(drawn(element)[LEFT]).toBe(0)
})

test('a press on a bridge that is let go off it does nothing', () => {
  const element = mount()

  drag([island(element, 0), island(element, 2)])
  drag([bridge(element, LEFT), water(element)])

  expect(drawn(element)[LEFT]).toBe(1)
})

test('a bridge that would cross another is refused with a shake of the bridge in the way', () => {
  const element = mount(plus, 5)
  const across = pairBetween(PLUS, 1, 2)
  const down = pairBetween(PLUS, 0, 3)

  drag([island(element, 1), island(element, 2)])
  drag([island(element, 0), island(element, 3)])

  expect(drawn(element, PLUS)[down]).toBe(0)
  expect(element.querySelector(`[data-pair="${across}"]`)!.classList).toContain('bridges-refused')
})

test('done islands and over islands are marked', () => {
  const element = mount()
  const classes = (i: number) => element.querySelector(`[data-island="${i}"]`)!.classList

  drag([island(element, 0), island(element, 2)])
  expect(classes(0)).toContain('bridges-island-done')

  drag([island(element, 0), island(element, 1)])
  expect(classes(0)).toContain('bridges-island-over')
  expect(classes(1)).toContain('bridges-island-done')
})

function solve(element: HTMLElement): void {
  drag([island(element, 0), island(element, 2)])
  drag([island(element, 1), island(element, 3)])
  drag([island(element, 2), island(element, 3)])
}

test('the last bridge solves the board, and then the board ignores drags, taps, Undo and Hint', () => {
  const element = mount()

  solve(element)
  expect(status(element)).toMatch(/solved/i)
  expect(button(element, '#bridges-undo').disabled).toBe(true)
  expect(button(element, '#bridges-hint').disabled).toBe(true)

  drag([island(element, 0), island(element, 1)])
  press(bridge(element, LEFT))
  expect(drawn(element)).toEqual(ANSWER)
})

test('Undo is off at the deal, and takes back the last action', () => {
  const element = mount()
  const undo = button(element, '#bridges-undo')

  expect(undo.disabled).toBe(true)

  drag([island(element, 0), island(element, 2)])
  press(bridge(element, LEFT))
  undo.click()

  expect(drawn(element)[LEFT]).toBe(1)
})

test('New puzzle deals again at the same size and clears the undo history', () => {
  const asked: number[] = []
  const element = mount((size) => {
    asked.push(size)
    return square()
  })

  solve(element)
  button(element, '#bridges-new').click()

  expect(asked).toEqual([3, 3])
  expect(status(element)).toBe('')
  expect(drawn(element)).toEqual([0, 0, 0, 0])
  expect(button(element, '#bridges-undo').disabled).toBe(true)
})

test('the size menu offers 7×7, 10×10 and 13×13, starting at 7×7, and a pick deals that size', () => {
  const asked: number[] = []
  const element = mount((size) => {
    asked.push(size)
    return square()
  }, 7)
  const menu = element.querySelector<HTMLSelectElement>('#bridges-size')!

  expect(SIZES).toEqual([7, 10, 13])
  expect(Array.from(menu.options).map((option) => option.value)).toEqual(['7', '10', '13'])
  expect(menu.value).toBe('7')

  menu.value = '13'
  menu.dispatchEvent(new Event('change'))
  expect(asked).toEqual([7, 13])
})

test('Hint points out a bridge with too many, changes nothing, and the note clears on the next move', () => {
  const element = mount()
  const top = pairBetween(SQUARE, 0, 1)

  drag([island(element, 0), island(element, 1)])
  button(element, '#bridges-hint').click()

  expect(note(element)).toMatch(/this bridge is wrong/i)
  expect(element.querySelector(`[data-pair="${top}"]`)!.classList).toContain('bridges-wrong')
  expect(drawn(element)[top]).toBe(1)

  press(bridge(element, top))
  expect(note(element)).toBe('')
})

test('pressing Hint enough times solves the board, one undoable step at a time', () => {
  const element = mount()
  const hint = button(element, '#bridges-hint')

  hint.click()
  expect(button(element, '#bridges-undo').disabled).toBe(false)
  expect(drawn(element).filter((lines) => lines > 0)).toHaveLength(1)

  for (let i = 0; i < 5 && !hint.disabled; i += 1) hint.click()

  expect(status(element)).toMatch(/solved/i)
  expect(drawn(element)[RIGHT]).toBe(1)
  expect(drawn(element)[BOTTOM]).toBe(1)
})
