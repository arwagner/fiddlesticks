// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupNonogram } from './nonogram'
import { newGameFromSolution } from './nonogram-logic'

beforeEach(() => {
  document.body.innerHTML = '' // fresh document per test — avoid duplicate-id collisions across mounts
})

const T = true
const F = false
// Deterministic solution injected via the game factory, so clicks have known outcomes.
const X_GRID: boolean[][] = [
  [T, F, F, F, T],
  [F, T, F, T, F],
  [F, F, T, F, F],
  [F, T, F, T, F],
  [T, F, F, F, T],
]
const makeFixed = () => newGameFromSolution(X_GRID)

function mount() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  setupNonogram(el, 5, makeFixed)
  return el
}
function cell(el: HTMLElement, r: number, c: number): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(`.nono-cell[data-r="${r}"][data-c="${c}"]`)!
}
function status(el: HTMLElement): string {
  return el.querySelector('#nono-status')!.textContent ?? ''
}

test('feat-004/AC-1: view renders a 5×5 cell grid, both clue axes, and Mistakes: 0', () => {
  const el = mount()
  expect(el.querySelectorAll('.nono-cell').length).toBe(25)
  expect(el.querySelectorAll('.nono-clue-col').length).toBe(5)
  expect(el.querySelectorAll('.nono-clue-row').length).toBe(5)
  expect(status(el)).toBe('Mistakes: 0')
})

test('feat-004/AC-3: clicking a solution-filled cell in Fill mode fills it, no mistake', () => {
  const el = mount()
  cell(el, 0, 0).click() // solution[0][0] = filled
  expect(cell(el, 0, 0).classList.contains('nono-filled')).toBe(true)
  expect(status(el)).toBe('Mistakes: 0')
})

test('feat-004/AC-4 + AC-6: a wrong mark counts and reveals the correct value flagged red', () => {
  const el = mount()
  cell(el, 0, 1).click() // Fill mode, solution[0][1] = empty → wrong; correct value X, red
  expect(cell(el, 0, 1).classList.contains('nono-wrong-x')).toBe(true)
  expect(status(el)).toBe('Mistakes: 1')
})

test('mode toggle to Mark X, then a correct X commits', () => {
  const el = mount()
  const [fillBtn, xBtn] = el.querySelectorAll<HTMLButtonElement>('.nono-mode button')
  xBtn.click()
  expect(xBtn.classList.contains('active')).toBe(true)
  expect(fillBtn.classList.contains('active')).toBe(false)
  cell(el, 0, 1).click() // Mark-X mode, solution[0][1] = empty → correct X
  expect(cell(el, 0, 1).classList.contains('nono-x')).toBe(true)
  expect(status(el)).toBe('Mistakes: 0')
})

test('solving the puzzle marks the grid won, so the board can show the win sweep', () => {
  const el = mount()
  const grid = el.querySelector('#nono-grid')!

  expect(grid.classList.contains('nono-won')).toBe(false)

  X_GRID.forEach((row, r) => {
    row.forEach((filled, c) => {
      if (filled) {
        cell(el, r, c).click()
      }
    })
  })

  expect(grid.classList.contains('nono-won')).toBe(true)
  expect(el.querySelector('#nono-status')!.classList.contains('nono-status-won')).toBe(true)
  expect(status(el)).toBe('Solved! Mistakes: 0')
})

test('a click on a decided cell leaves the board alone, so the win sweep does not replay', () => {
  const el = mount()
  cell(el, 0, 0).click() // correct fill
  const filled = cell(el, 0, 0)

  filled.click() // the cell is decided, so this click changes nothing

  expect(cell(el, 0, 0)).toBe(filled) // the same element, so render() did not rebuild the grid
})

test('feat-004/AC-8: New puzzle resets the board and the mistake count', () => {
  const el = mount()
  cell(el, 0, 1).click() // a mistake
  expect(status(el)).toBe('Mistakes: 1')
  el.querySelector<HTMLButtonElement>('#nono-new')!.click()
  expect(status(el)).toBe('Mistakes: 0')
  expect(el.querySelectorAll('.nono-filled, .nono-x').length).toBe(0)
})
