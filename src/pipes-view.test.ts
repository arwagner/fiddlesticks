// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupPipes } from './pipes'
import { newGameFromBoards, rotateCW, N, E, S, W, type GameState } from './pipes-logic'
import { boardLayout } from './pipes-layout'

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

function mount(makeGame: (size: number) => GameState = oneOff, size = 3) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  setupPipes(element, size, makeGame)
  return element
}

function canvasOf(element: HTMLElement): HTMLCanvasElement {
  return element.querySelector<HTMLCanvasElement>('#pipes-canvas')!
}

function pressTile(element: HTMLElement, r: number, c: number, button = 0, size = 3): MouseEvent {
  const layout = boardLayout(size, WIDTH)
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
