// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupNonogram, SIZES } from './nonogram'
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

// X_GRID needs a guess to start: no single line decides anything on an empty board, so it yields no hints.
// This grid opens with a full row, which one clue settles at once.
const HINT_GRID: boolean[][] = [
  [T, T, T, T, T],
  [T, T, F, T, T],
  [T, F, F, F, T],
  [T, T, F, T, T],
  [T, T, T, T, T],
]
const makeHintable = () => newGameFromSolution(HINT_GRID)

function mountHintable() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  setupNonogram(el, 5, makeHintable)
  return el
}

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

test('Hint rings one blank cell and names the line that decides it', () => {
  const el = mountHintable()

  expect(el.querySelectorAll('.nono-hint').length).toBe(0)

  el.querySelector<HTMLButtonElement>('#nono-hint')!.click()

  const ringed = el.querySelectorAll<HTMLButtonElement>('.nono-hint')

  expect(ringed.length).toBe(1)
  expect(ringed[0].classList.contains('nono-blank')).toBe(true) // still the player's call to make
  expect(el.querySelector('#nono-hint-note')!.textContent).toMatch(/^Look at (row|column) \d+\./)
})

test('marking a cell clears the hint', () => {
  const el = mountHintable()
  el.querySelector<HTMLButtonElement>('#nono-hint')!.click()
  const ringed = el.querySelector<HTMLButtonElement>('.nono-hint')!
  const r = Number(ringed.dataset.r)
  const c = Number(ringed.dataset.c)

  cell(el, r, c).click()

  expect(el.querySelectorAll('.nono-hint').length).toBe(0)
  expect(el.querySelector('#nono-hint-note')!.textContent).toBe('')
})

test('Hint turns off once the puzzle is solved', () => {
  const el = mount()
  const hintButton = el.querySelector<HTMLButtonElement>('#nono-hint')!

  expect(hintButton.disabled).toBe(false)

  X_GRID.forEach((row, r) => row.forEach((filled, c) => filled && cell(el, r, c).click()))

  expect(hintButton.disabled).toBe(true)
})

test('the size menu offers every size and starts on the one the caller asked for', () => {
  const el = mount()
  const select = el.querySelector<HTMLSelectElement>('#nono-size')!

  expect([...select.options].map((option) => option.value)).toEqual(SIZES.map(String))
  expect(select.value).toBe('5')
})

test('picking a size deals a new puzzle at that size', () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  setupNonogram(el, 5) // the real generator, so the size actually changes
  const select = el.querySelector<HTMLSelectElement>('#nono-size')!

  expect(el.querySelectorAll('.nono-cell').length).toBe(25)

  select.value = '10'
  select.dispatchEvent(new Event('change'))

  expect(el.querySelectorAll('.nono-cell').length).toBe(100)
  expect(el.querySelectorAll('.nono-clue-col').length).toBe(10)
  expect(el.querySelector('#nono-grid')!.getAttribute('data-scale')).toBe('md')
})

test('a size the caller asks for joins the menu when it is not on the list', () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  setupNonogram(el, 7)
  const select = el.querySelector<HTMLSelectElement>('#nono-size')!

  expect([...select.options].map((option) => option.value)).toEqual(['5', '7', '8', '10', '15', '20'])
  expect(select.value).toBe('7')
})

function rightClick(target: HTMLElement): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

test('a right-click marks an X and blocks the browser menu', () => {
  const el = mount()

  const event = rightClick(cell(el, 0, 1)) // solution[0][1] = empty → a correct X

  expect(cell(el, 0, 1).classList.contains('nono-x')).toBe(true)
  expect(event.defaultPrevented).toBe(true)
  expect(status(el)).toBe('Mistakes: 0')
})

test('a right-click marks an X while Fill mode stays selected', () => {
  const el = mount()
  const [fillBtn] = el.querySelectorAll<HTMLButtonElement>('.nono-mode button')

  rightClick(cell(el, 0, 1))

  expect(fillBtn.classList.contains('active')).toBe(true) // the mode did not change
  cell(el, 0, 0).click() // a left-click still fills, as Fill mode is still on
  expect(cell(el, 0, 0).classList.contains('nono-filled')).toBe(true)
})

test('a right-click on a solution-filled cell counts a mistake', () => {
  const el = mount()

  rightClick(cell(el, 0, 0)) // solution[0][0] = filled → a wrong X

  expect(cell(el, 0, 0).classList.contains('nono-wrong-filled')).toBe(true)
  expect(status(el)).toBe('Mistakes: 1')
})

test('feat-004/AC-8: New puzzle resets the board and the mistake count', () => {
  const el = mount()
  cell(el, 0, 1).click() // a mistake
  expect(status(el)).toBe('Mistakes: 1')
  el.querySelector<HTMLButtonElement>('#nono-new')!.click()
  expect(status(el)).toBe('Mistakes: 0')
  expect(el.querySelectorAll('.nono-filled, .nono-x').length).toBe(0)
})
