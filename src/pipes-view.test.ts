// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupPipes, SIZES } from './pipes'
import { newGameFromBoards, generateSolvableTree, rotateCW, N, E, S, W, type GameState } from './pipes-logic'
import { boardLayout, MIN_TILE } from './pipes-layout'

// jsdom draws nothing, so the canvas hands back a context that records nothing and refuses nothing. What
// is under test is the wiring: clicks, locks, undo. Not the pixels.
function stubCanvas(): void {
  const context = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, name: string) => {
        if (!(name in target)) {
          target[name] = () => undefined
        }

        return target[name]
      },
      set: () => true,
    },
  )

  HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement['getContext']
  HTMLCanvasElement.prototype.getBoundingClientRect = function boundingRect(this: HTMLCanvasElement) {
    return { left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height } as DOMRect
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  stubCanvas()
  // Reduced motion draws every change at once, so a test never waits on an animation frame.
  window.matchMedia = ((query: string) => ({ matches: true, media: query })) as typeof window.matchMedia
})

// A 3×3 answer with a tee at the source. One tile, the top-left end, starts turned once off its answer.
const TREE: number[][] = [
  [E, W | E | S, W],
  [E, N | W | S, S],
  [E, N | W | E, W | N],
]
const WIDTH = 280 // what the view falls back to when jsdom reports no container width

function turned(board: number[][], r: number, c: number, times = 1): number[][] {
  const copy = board.map((row) => [...row])
  for (let i = 0; i < times; i += 1) copy[r][c] = rotateCW(copy[r][c])
  return copy
}

// Three more clockwise turns put the top-left end back in place.
const oneOff = (): GameState => newGameFromBoards(TREE, turned(TREE, 0, 0))

function mount(makeGame: (size: number) => GameState = oneOff, size = 3, width?: number) {
  const element = document.createElement('div')
  if (width !== undefined) Object.defineProperty(element, 'clientWidth', { value: width })
  document.body.appendChild(element)
  setupPipes(element, size, makeGame)
  return element
}

function canvasOf(element: HTMLElement): HTMLCanvasElement {
  return element.querySelector<HTMLCanvasElement>('#pipes-canvas')!
}

function pressTile(element: HTMLElement, r: number, c: number, button = 0, size = 3, width = WIDTH): MouseEvent {
  const layout = boardLayout(size, width)
  const event = new MouseEvent(button === 2 ? 'contextmenu' : 'pointerdown', {
    clientX: (c + 0.5) * layout.tile,
    clientY: (r + 0.5) * layout.tile,
    button,
    bubbles: true,
    cancelable: true,
  })
  canvasOf(element).dispatchEvent(event)
  return event
}

function status(element: HTMLElement): string {
  return element.querySelector('#pipes-status')!.textContent ?? ''
}

test('the board opens with a toolbar and a canvas sized to the board', () => {
  const element = mount()
  const layout = boardLayout(3, WIDTH)

  expect(element.querySelector('#pipes-new')).not.toBeNull()
  expect(canvasOf(element).width).toBe(3 * layout.tile)
  expect(status(element)).not.toMatch(/solved/i)
})

test('clicking the one tile that is off three times solves the board', () => {
  const element = mount()

  pressTile(element, 0, 0)
  pressTile(element, 0, 0)
  expect(status(element)).not.toMatch(/solved/i)

  pressTile(element, 0, 0)
  expect(status(element)).toMatch(/solved/i)
})

test('clicks land on the tile under the pointer', () => {
  const element = mount()

  pressTile(element, 2, 2) // a different tile: three of these would not solve the board
  pressTile(element, 0, 0)
  pressTile(element, 0, 0)
  pressTile(element, 0, 0)

  expect(status(element)).not.toMatch(/solved/i)
})

test('a solved board ignores clicks', () => {
  const element = mount()

  for (let i = 0; i < 3; i += 1) pressTile(element, 0, 0)
  pressTile(element, 1, 1)

  expect(status(element)).toMatch(/solved/i)
})

test('New puzzle deals a fresh board', () => {
  let deals = 0
  const element = mount(() => {
    deals += 1
    return oneOff()
  })

  for (let i = 0; i < 3; i += 1) pressTile(element, 0, 0)
  element.querySelector<HTMLButtonElement>('#pipes-new')!.click()

  expect(deals).toBe(2)
  expect(status(element)).not.toMatch(/solved/i)
})

function button(element: HTMLElement, selector: string): HTMLButtonElement {
  return element.querySelector<HTMLButtonElement>(selector)!
}

test('a right-click locks a tile, so clicks no longer turn it, and keeps the browser menu away', () => {
  const element = mount()

  const menu = pressTile(element, 0, 0, 2)
  for (let i = 0; i < 3; i += 1) pressTile(element, 0, 0)

  expect(menu.defaultPrevented).toBe(true)
  expect(status(element)).not.toMatch(/solved/i)

  pressTile(element, 0, 0, 2) // unlock
  for (let i = 0; i < 3; i += 1) pressTile(element, 0, 0)
  expect(status(element)).toMatch(/solved/i)
})

test('in Lock mode a click locks instead of turning', () => {
  const element = mount()

  button(element, '[data-mode="lock"]').click()
  pressTile(element, 0, 0)
  button(element, '[data-mode="rotate"]').click()
  for (let i = 0; i < 3; i += 1) pressTile(element, 0, 0)

  expect(status(element)).not.toMatch(/solved/i)
})

test('Undo is off at the deal, and takes back the last action', () => {
  const element = mount()
  const undoButton = button(element, '#pipes-undo')

  expect(undoButton.disabled).toBe(true)

  pressTile(element, 0, 0)
  pressTile(element, 0, 0)
  expect(undoButton.disabled).toBe(false)

  undoButton.click() // back to two turns off
  pressTile(element, 0, 0)
  pressTile(element, 0, 0)
  expect(status(element)).toMatch(/solved/i)
})

test('New puzzle clears the undo history', () => {
  const element = mount()

  pressTile(element, 1, 1)
  button(element, '#pipes-new').click()

  expect(button(element, '#pipes-undo').disabled).toBe(true)
})

function sizeMenu(element: HTMLElement): HTMLSelectElement {
  return element.querySelector<HTMLSelectElement>('#pipes-size')!
}

test('the size menu offers every size and starts on the one asked for', () => {
  const element = mount(oneOff, 3)
  const values = Array.from(sizeMenu(element).options).map((option) => Number(option.value))

  expect(SIZES).toEqual([5, 7, 9, 12, 15])
  expect(values).toEqual([3, 5, 7, 9, 12, 15]) // 3 is not on the list, so it joins in order
  expect(sizeMenu(element).value).toBe('3')
})

test('picking a size deals a new puzzle at that size', () => {
  const asked: number[] = []
  const element = mount((size) => {
    asked.push(size)
    return oneOff()
  })

  sizeMenu(element).value = '12'
  sizeMenu(element).dispatchEvent(new Event('change'))

  expect(asked).toEqual([3, 12])
})

// A board one tile off its answer, at the bottom right where scaling errors land furthest from home.
function cornerOff(size: number): () => GameState {
  const solution = generateSolvableTree(size, () => 0.37)
  return () => newGameFromBoards(solution, turned(solution, size - 1, size - 1))
}

test('clicks land on the tile under the pointer at every size and width', () => {
  for (const size of SIZES) {
    for (const width of [320, 700, 1100]) {
      document.body.innerHTML = ''
      const element = mount(cornerOff(size), size, width)
      const last = size - 1

      const press = (r: number, c: number, times: number) => {
        for (let i = 0; i < times; i += 1) pressTile(element, r, c, 0, size, width - 16)
      }

      expect(boardLayout(size, width - 16).tile).toBeGreaterThanOrEqual(MIN_TILE)
      press(last, last - 1, 1) // knock the neighbour off too
      press(last, last, 3) // the corner is back, but the neighbour is not
      expect(status(element)).not.toMatch(/solved/i)

      press(last, last - 1, 3) // four turns in all bring the neighbour home
      expect(status(element)).toMatch(/solved/i)
    }
  }
})

function note(element: HTMLElement): string {
  return element.querySelector('#pipes-note')!.textContent ?? ''
}

test('pressing Hint enough times finishes the board, one undoable step at a time', () => {
  const element = mount()
  const hint = button(element, '#pipes-hint')

  hint.click()
  expect(button(element, '#pipes-undo').disabled).toBe(false)

  for (let i = 0; i < 9 && !hint.disabled; i += 1) hint.click()

  expect(status(element)).toMatch(/solved/i)
  expect(hint.disabled).toBe(true) // nothing left to hint once solved
})

test('Hint points out a wrong lock before giving anything away, and the note clears on the next move', () => {
  const element = mount()

  pressTile(element, 0, 0, 2) // locks the one tile that is off
  button(element, '#pipes-hint').click()
  expect(note(element)).toMatch(/this lock is wrong/i)

  pressTile(element, 0, 0, 2) // unlock it
  expect(note(element)).toBe('')
})
