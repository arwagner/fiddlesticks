// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest'
import { setupDecant } from './decant'
import { newGameFromBottles, type GameState } from './decant-logic'
import { shelfLayout, bottleRect } from './decant-layout'

// jsdom draws nothing, so the canvas hands back a context that records nothing and refuses nothing. What
// is under test is the wiring — clicks, pours, undo — not the pixels.
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
    return {
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height,
      width: this.width,
      height: this.height,
    } as DOMRect
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  stubCanvas()
  // Reduced motion commits a pour at once, so a test never waits on an animation frame.
  window.matchMedia = ((query: string) => ({ matches: true, media: query })) as typeof window.matchMedia
})

// One pour from bottle 0 into bottle 1 fills it and wins this board; bottle 2 is the spare.
const BOARD = [[0], [0], []]
const CAPACITY = 2
const WIDTH = 280 // what the view falls back to when jsdom reports no container width

type MakeGame = (options: { colors?: number; capacity?: number; empties?: number }) => GameState

function mount(makeGame: MakeGame = () => newGameFromBottles(BOARD, CAPACITY)) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  setupDecant(element, {}, makeGame)

  return element
}

function clickBottle(element: HTMLElement, index: number): void {
  const layout = shelfLayout(BOARD.length, CAPACITY, WIDTH)
  const rect = bottleRect(index, layout)
  const canvas = element.querySelector<HTMLCanvasElement>('#decant-canvas')!

  canvas.dispatchEvent(
    new MouseEvent('pointerdown', {
      clientX: rect.x + rect.w / 2,
      clientY: rect.y + rect.h / 2,
      bubbles: true,
    }),
  )
}

function status(element: HTMLElement): string {
  return element.querySelector('#decant-status')!.textContent ?? ''
}

test('the shelf opens with a toolbar, a canvas and nothing poured yet', () => {
  const element = mount()

  expect(element.querySelector('#decant-canvas')).not.toBeNull()
  expect(element.querySelector<HTMLButtonElement>('#decant-undo')!.disabled).toBe(true)
  expect(status(element)).toBe('Pours: 0')
})

test('a click on the source then the destination pours, and winning says so', () => {
  const element = mount()

  clickBottle(element, 0)
  clickBottle(element, 1)

  expect(status(element)).toBe('Solved in 1 pour.')
  expect(element.querySelector('#decant-status')!.classList.contains('decant-status-won')).toBe(true)
})

test('a destination that cannot take the sand becomes the new source instead', () => {
  // Bottle 0 tops out in red, bottle 1 in blue: the pour is refused, and bottle 1 is picked up instead.
  const element = mount(() => newGameFromBottles([[0, 1], [1, 0], []], 2))

  clickBottle(element, 0)
  clickBottle(element, 1) // refused as a destination
  clickBottle(element, 2) // ...so this pours bottle 1 into the spare

  expect(status(element)).toBe('Pours: 1')
})

test('undo puts the sand back and is disabled again at the deal', () => {
  const element = mount(() => newGameFromBottles([[1, 0], [0], []], 2))
  const undo = element.querySelector<HTMLButtonElement>('#decant-undo')!

  clickBottle(element, 0)
  clickBottle(element, 1)
  expect(undo.disabled).toBe(false)

  undo.click()

  expect(status(element)).toBe('Pours: 0')
  expect(undo.disabled).toBe(true)
})

test('a new puzzle follows the knobs in the toolbar', () => {
  const asked: Array<{ colors?: number; capacity?: number; empties?: number }> = []
  const element = mount((options) => {
    asked.push(options)
    return newGameFromBottles(BOARD, CAPACITY)
  })

  element.querySelector<HTMLSelectElement>('#decant-layers')!.value = '4'
  element.querySelector<HTMLSelectElement>('#decant-colors')!.dispatchEvent(new Event('change'))

  expect(asked[asked.length - 1]).toEqual({ colors: 6, capacity: 4, empties: 1 })
})
