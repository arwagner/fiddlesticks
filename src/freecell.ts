// The FreeCell board: draws what freecell-logic.ts and freecell-layout.ts give it, and turns presses, drags and
// taps into calls on them. No rule and no piece of geometry is decided here.
import {
  newGame,
  moveThenAutoPlay,
  tapMove,
  undo,
  isSolved,
  cardsOnFoundations,
  CASCADE_COUNT,
  FOUNDATION_COUNT,
  FREE_CELL_COUNT,
  type Card,
  type GameState,
  type Place,
} from './freecell-logic'
import {
  freeCellLayout,
  placeRect,
  cascadeCardRects,
  boardHeight,
  hitTest,
  type Layout,
  type Rect,
} from './freecell-layout'
import { drawCardFace, drawEmptySlot } from './card-draw'

// How far, in board pixels, a press may wander and still count as a tap rather than a drag.
const TAP_SLOP = 6

type Point = { x: number; y: number }

// The cards a press has picked up: where they came from, the rects they were drawn in there, and where the
// pointer went down, so they follow the pointer by the distance it has moved.
type Lifted = {
  from: Place
  index: number
  cards: Card[]
  rects: Rect[]
  start: Point
  at: Point
  dragging: boolean
}

const places = (kind: Place['kind'], count: number): Place[] =>
  Array.from({ length: count }, (_, index) => ({ kind, index }))

export function setupFreeCell(container: HTMLElement, createGame: () => GameState = newGame): void {
  container.innerHTML = `
    <div class="freecell">
      <div class="freecell-toolbar">
        <button id="freecell-new" type="button">New game</button>
        <button id="freecell-undo" type="button">Undo</button>
        <p id="freecell-status" aria-live="polite"></p>
      </div>
      <p class="freecell-help">Drag a card or a sequence to move it. Tap a card to send it where it can go.</p>
      <canvas id="freecell-canvas" aria-label="FreeCell board"></canvas>
    </div>
  `

  const canvasElement = container.querySelector<HTMLCanvasElement>('#freecell-canvas')
  const statusElement = container.querySelector<HTMLParagraphElement>('#freecell-status')
  const newButtonElement = container.querySelector<HTMLButtonElement>('#freecell-new')
  const undoButtonElement = container.querySelector<HTMLButtonElement>('#freecell-undo')

  if (!canvasElement || !statusElement || !newButtonElement || !undoButtonElement) {
    throw new Error('FreeCell UI elements are missing')
  }

  const context = canvasElement.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context is not available')
  }

  const canvas = canvasElement
  const status = statusElement
  const undoButton = undoButtonElement
  const ctx = context

  let state = createGame()
  let lifted: Lifted | null = null
  let layout: Layout = freeCellLayout(container.clientWidth)

  // The canvas is as wide as the container and as tall as the board, at the screen's pixel density.
  function fitCanvas(): void {
    layout = freeCellLayout(container.clientWidth)

    const ratio = window.devicePixelRatio || 1
    const width = Math.round(layout.width * ratio)
    const height = Math.round(boardHeight(state, layout) * ratio)

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  // A point on the page as a point on the board. The canvas keeps the board's shape, so one factor serves both.
  function boardPoint(event: MouseEvent): Point {
    const bounds = canvas.getBoundingClientRect()
    const factor = layout.width / bounds.width

    return { x: (event.clientX - bounds.left) * factor, y: (event.clientY - bounds.top) * factor }
  }

  function isLifted(place: Place, index: number): boolean {
    return (
      !!lifted &&
      lifted.dragging &&
      lifted.from.kind === place.kind &&
      lifted.from.index === place.index &&
      index >= lifted.index
    )
  }

  function drawTopRow(): void {
    places('free-cell', FREE_CELL_COUNT).forEach((place) => {
      const card = state.freeCells[place.index]
      const rect = placeRect(place, layout)

      if (card && !isLifted(place, 0)) {
        drawCardFace(ctx, card, rect)
      } else {
        drawEmptySlot(ctx, rect)
      }
    })

    places('foundation', FOUNDATION_COUNT).forEach((place) => {
      const card = state.foundations[place.index].at(-1)
      const rect = placeRect(place, layout)

      if (card) {
        drawCardFace(ctx, card, rect)
      } else {
        drawEmptySlot(ctx, rect, 'A')
      }
    })
  }

  function drawCascades(): void {
    places('cascade', CASCADE_COUNT).forEach((place) => {
      const cards = state.cascades[place.index]

      if (cards.length === 0) {
        drawEmptySlot(ctx, placeRect(place, layout))
        return
      }

      cascadeCardRects(place.index, state, layout).forEach((rect, index) => {
        if (!isLifted(place, index)) {
          drawCardFace(ctx, cards[index], rect)
        }
      })
    })
  }

  function drawLifted(): void {
    const held = lifted

    if (!held?.dragging) {
      return
    }

    const dx = held.at.x - held.start.x
    const dy = held.at.y - held.start.y

    held.rects.forEach((rect, index) => {
      drawCardFace(ctx, held.cards[index], { ...rect, x: rect.x + dx, y: rect.y + dy })
    })
  }

  function draw(): void {
    fitCanvas()
    drawTopRow()
    drawCascades()
    drawLifted()
  }

  function render(): void {
    const solved = isSolved(state)

    status.textContent = solved
      ? 'Solved! All 52 cards are on the foundations.'
      : `${cardsOnFoundations(state)} of 52 cards on the foundations`
    status.classList.toggle('freecell-status-solved', solved)
    undoButton.disabled = state.past.length === 0
    draw()
  }

  // A move the rules refuse gives null, and the board stays as it was: the lifted cards go back.
  function play(from: Place, to: Place, count: number): void {
    state = moveThenAutoPlay(state, from, to, count) ?? state
  }

  // What a press on `point` picks up: a cascade's card and every card below it, or a free cell's card.
  function lift(point: Point): Lifted | null {
    const hit = hitTest(point, state, layout)

    if (hit?.place.kind === 'cascade' && hit.cardIndex !== null) {
      const index = hit.cardIndex

      return {
        from: hit.place,
        index,
        cards: state.cascades[hit.place.index].slice(index),
        rects: cascadeCardRects(hit.place.index, state, layout).slice(index),
        start: point,
        at: point,
        dragging: false,
      }
    }

    const card = hit?.place.kind === 'free-cell' ? state.freeCells[hit.place.index] : null

    if (hit && card) {
      const rects = [placeRect(hit.place, layout)]

      return { from: hit.place, index: 0, cards: [card], rects, start: point, at: point, dragging: false }
    }

    return null
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return
    }

    lifted = lift(boardPoint(event))

    if (lifted) {
      event.preventDefault()
    }
  })

  window.addEventListener('pointermove', (event) => {
    if (!lifted) {
      return
    }

    lifted.at = boardPoint(event)
    lifted.dragging ||= Math.hypot(lifted.at.x - lifted.start.x, lifted.at.y - lifted.start.y) > TAP_SLOP
    draw()
  })

  window.addEventListener('pointerup', (event) => {
    const ended = lifted
    lifted = null

    if (!ended) {
      return
    }

    if (ended.dragging) {
      const hit = hitTest(boardPoint(event), state, layout)

      if (hit) {
        play(ended.from, hit.place, ended.cards.length)
      }
    } else {
      const tapped = tapMove(state, ended.from, ended.index)

      if (tapped) {
        play(tapped.from, tapped.to, tapped.count)
      }
    }

    render()
  })

  window.addEventListener('pointercancel', () => {
    lifted = null
    render()
  })

  undoButton.addEventListener('click', () => {
    state = undo(state)
    render()
  })

  newButtonElement.addEventListener('click', () => {
    state = createGame()
    lifted = null
    render()
  })

  new ResizeObserver(() => draw()).observe(container)

  render()
}
