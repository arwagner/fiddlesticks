import { test, expect } from 'vitest'
import { BLACK_INK, RED_INK, drawCardBack, drawCardFace, drawEmptySlot } from './card-draw'
import { CARD_H, CARD_W, type Suit } from './cards'

type Call = { name: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown }

// A 2D context that records every method call, with the fill and stroke styles in force at the time.
// measureText answers a fixed width, since there are no fonts to measure.
function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  const state: Record<string | symbol, unknown> = {}
  const ctx = new Proxy(state, {
    get: (target, name) => {
      if (name in target) {
        return target[name]
      }

      return (...args: unknown[]) => {
        calls.push({ name: String(name), args, fillStyle: target.fillStyle, strokeStyle: target.strokeStyle })
        return name === 'measureText' ? { width: 30 } : undefined
      }
    },
    set: (target, name, value) => {
      target[name] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D

  return { ctx, calls }
}

const RECT = { x: 10, y: 20, w: CARD_W, h: CARD_H }

const cases: { suit: Suit; rank: number; index: string; ink: string }[] = [
  { suit: 'hearts', rank: 10, index: '10♥', ink: RED_INK },
  { suit: 'diamonds', rank: 1, index: 'A♦', ink: RED_INK },
  { suit: 'clubs', rank: 7, index: '7♣', ink: BLACK_INK },
  { suit: 'spades', rank: 13, index: 'K♠', ink: BLACK_INK },
]

test.each(cases)(
  'a $suit face draws its index, rank and pip, twice in its suit colour',
  ({ suit, rank, index, ink }) => {
    const { ctx, calls } = recordingContext()

    drawCardFace(ctx, { suit, rank }, RECT)

    const texts = calls.filter((call) => call.name === 'fillText')
    expect(texts.map((call) => call.args[0])).toEqual([index, index])
    expect(texts.map((call) => call.fillStyle)).toEqual([ink, ink])
  },
)

test('a face draws its top index in the top-left of the card and its lower index in the bottom-right', () => {
  const { ctx, calls } = recordingContext()

  drawCardFace(ctx, { suit: 'clubs', rank: 7 }, RECT)

  const [top, bottom] = calls.filter((call) => call.name === 'fillText').map((call) => call.args as number[])
  expect(top[1]).toBeLessThan(RECT.x + RECT.w / 2)
  expect(top[2]).toBeLessThan(RECT.y + RECT.h / 2)
  expect(bottom[1]).toBeGreaterThan(RECT.x + RECT.w / 2)
  expect(bottom[2]).toBeGreaterThan(RECT.y + RECT.h / 2)
})

test('a back draws no index', () => {
  const { ctx, calls } = recordingContext()

  drawCardBack(ctx, RECT)

  expect(calls.some((call) => call.name === 'fillText')).toBe(false)
  expect(calls.some((call) => call.name === 'fill')).toBe(true)
})

test('an empty slot outlines the card rect and draws its label when it has one', () => {
  const plain = recordingContext()
  drawEmptySlot(plain.ctx, RECT)
  expect(plain.calls.find((call) => call.name === 'strokeRect')?.args).toEqual([RECT.x, RECT.y, RECT.w, RECT.h])
  expect(plain.calls.some((call) => call.name === 'fillText')).toBe(false)

  const labelled = recordingContext()
  drawEmptySlot(labelled.ctx, RECT, 'A-K')
  expect(labelled.calls.filter((call) => call.name === 'fillText').map((call) => call.args[0])).toEqual(['A-K'])
})
