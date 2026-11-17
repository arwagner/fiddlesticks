import { newGame, rotate, lightDepths, armCount, ARMS, type GameState } from './pipes-logic'
import { boardLayout, boardSize, tileAt, type Layout } from './pipes-layout'

const TILE_FILL = 'rgba(6, 44, 53, 0.93)'
const UNLIT = '#4a6a70'
const LIT = '#ffb400'
const SOURCE = '#f46f3d'
const SOURCE_RING = '#ffe08a'
const WON = '#6dd4b8'
const WON_PIPE = '#05161a'

// The angle each arm points at, in canvas terms (y grows downward).
const ARM_ANGLE = new Map<number, number>([
  [ARMS[0].bit, -Math.PI / 2],
  [ARMS[1].bit, 0],
  [ARMS[2].bit, Math.PI / 2],
  [ARMS[3].bit, Math.PI],
])

export function setupPipes(
  container: HTMLElement,
  size = 7,
  createGame: (size: number) => GameState = newGame,
): void {
  container.innerHTML = `
    <div class="pipes">
      <div class="pipes-toolbar">
        <button id="pipes-new" type="button">New puzzle</button>
        <p id="pipes-status" aria-live="polite"></p>
      </div>
      <p class="pipes-tip">Click a tile to rotate it.</p>
      <div class="pipes-board">
        <canvas id="pipes-canvas" aria-label="Board of pipe tiles"></canvas>
      </div>
    </div>
  `

  const canvasElement = container.querySelector<HTMLCanvasElement>('#pipes-canvas')
  const statusElement = container.querySelector<HTMLParagraphElement>('#pipes-status')
  const newButtonElement = container.querySelector<HTMLButtonElement>('#pipes-new')
  const context = canvasElement?.getContext('2d')

  if (!canvasElement || !statusElement || !newButtonElement || !context) {
    throw new Error('Pipes UI elements are missing')
  }

  const canvas = canvasElement
  const status = statusElement
  const ctx = context

  let state = createGame(size)
  let layout: Layout = boardLayout(state.size, 280)

  function updateCanvasSize(): void {
    layout = boardLayout(state.size, Math.max(280, container.clientWidth - 16))
    const { width, height } = boardSize(layout)

    // Assigning either one wipes the canvas and resets the context, so only do it on a real change.
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  function drawTile(r: number, c: number, lit: boolean): void {
    const t = layout.tile
    const half = t / 2 - 2 // a 2px gap between tiles
    const mask = state.masks[r][c]
    const isSource = r === state.source.r && c === state.source.c

    ctx.save()
    ctx.translate(c * t + t / 2, r * t + t / 2)

    ctx.fillStyle = state.solved ? WON : TILE_FILL
    ctx.beginPath()
    ctx.roundRect(-half, -half, 2 * half, 2 * half, 6)
    ctx.fill()

    const pipe = state.solved ? WON_PIPE : lit ? LIT : UNLIT
    ctx.strokeStyle = pipe
    ctx.fillStyle = pipe
    ctx.lineCap = 'round'
    ctx.lineWidth = t * 0.24

    for (const [bit, angle] of ARM_ANGLE) {
      if (mask & bit) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo((Math.cos(angle) * t) / 2, (Math.sin(angle) * t) / 2)
        ctx.stroke()
      }
    }

    if (armCount(mask) === 1 && !isSource) {
      ctx.beginPath()
      ctx.arc(0, 0, t * 0.2, 0, 2 * Math.PI)
      ctx.fill()
    }

    if (isSource) {
      ctx.fillStyle = SOURCE
      ctx.strokeStyle = SOURCE_RING
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, t * 0.27, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    }

    ctx.restore()
  }

  function draw(): void {
    updateCanvasSize()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const depths = lightDepths(state.masks, state.source)

    for (let r = 0; r < state.size; r += 1) {
      for (let c = 0; c < state.size; c += 1) {
        drawTile(r, c, depths[r][c] >= 0)
      }
    }
  }

  function render(): void {
    status.textContent = state.solved ? 'Solved! Every pipe joins up.' : ''
    status.classList.toggle('pipes-status-won', state.solved)
    draw()
  }

  function tileFromPointer(event: MouseEvent): { r: number; c: number } | null {
    const bounds = canvas.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * (canvas.width / bounds.width)
    const y = (event.clientY - bounds.top) * (canvas.height / bounds.height)

    return tileAt(x, y, layout)
  }

  // A move returns the same state when it changes nothing, so there is nothing to redraw.
  function apply(next: GameState): void {
    if (next === state) {
      return
    }

    state = next
    render()
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const tile = tileFromPointer(event)

    if (tile) {
      apply(rotate(state, tile.r, tile.c))
    }
  })

  newButtonElement.addEventListener('click', () => {
    state = createGame(state.size)
    render()
  })

  window.addEventListener('resize', draw)

  render()
}
