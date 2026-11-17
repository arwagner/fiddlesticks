import { newGame, rotate, toggleLock, undo, lightDepths, armCount, ARMS, type GameState } from './pipes-logic'
import { boardLayout, boardSize, tileAt, type Layout } from './pipes-layout'

const TILE_FILL = 'rgba(6, 44, 53, 0.93)'
const LOCKED_FILL = '#031317'
const BOLT = 'rgba(154, 235, 213, 0.5)'
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

// The board sizes the player can pick. Even 15×15 deals in a few milliseconds.
export const SIZES = [5, 7, 9, 12, 15]

export function setupPipes(
  container: HTMLElement,
  size = 7,
  createGame: (size: number) => GameState = newGame,
): void {
  // Keep the starting size on the menu even when a caller asks for one that is not on the list.
  const sizes = SIZES.includes(size) ? SIZES : [...SIZES, size].sort((a, b) => a - b)
  const options = sizes
    .map((n) => `<option value="${n}"${n === size ? ' selected' : ''}>${n} × ${n}</option>`)
    .join('')

  container.innerHTML = `
    <div class="pipes">
      <div class="pipes-toolbar">
        <button id="pipes-new" type="button">New puzzle</button>
        <button id="pipes-undo" type="button">Undo</button>
        <label class="pipes-size">Size
          <select id="pipes-size">${options}</select>
        </label>
        <div class="pipes-mode" role="group" aria-label="Click mode">
          <button type="button" data-mode="rotate" class="active">Rotate</button>
          <button type="button" data-mode="lock">Lock</button>
        </div>
        <p id="pipes-status" aria-live="polite"></p>
      </div>
      <p class="pipes-tip">Click to rotate. Right-click to lock.</p>
      <div class="pipes-board">
        <canvas id="pipes-canvas" aria-label="Board of pipe tiles"></canvas>
      </div>
    </div>
  `

  const canvasElement = container.querySelector<HTMLCanvasElement>('#pipes-canvas')
  const statusElement = container.querySelector<HTMLParagraphElement>('#pipes-status')
  const newButtonElement = container.querySelector<HTMLButtonElement>('#pipes-new')
  const undoButtonElement = container.querySelector<HTMLButtonElement>('#pipes-undo')
  const sizeSelectElement = container.querySelector<HTMLSelectElement>('#pipes-size')
  const modeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.pipes-mode button'))
  const context = canvasElement?.getContext('2d')

  if (!canvasElement || !statusElement || !newButtonElement || !undoButtonElement || !sizeSelectElement || !context) {
    throw new Error('Pipes UI elements are missing')
  }

  const canvas = canvasElement
  const status = statusElement
  const undoButton = undoButtonElement
  const sizeSelect = sizeSelectElement
  const ctx = context

  let state = createGame(size)
  let mode: 'rotate' | 'lock' = 'rotate'
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

    const locked = state.locked[r][c]
    ctx.fillStyle = state.solved ? WON : locked ? LOCKED_FILL : TILE_FILL
    ctx.beginPath()
    ctx.roundRect(-half, -half, 2 * half, 2 * half, 6)
    ctx.fill()

    // A locked tile is bolted down at the corners.
    if (locked && !state.solved) {
      ctx.fillStyle = BOLT

      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath()
        ctx.arc(x * (half - 6), y * (half - 6), 2.2, 0, 2 * Math.PI)
        ctx.fill()
      }
    }

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
    undoButton.disabled = state.past.length === 0 || state.solved
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

  // A right-click also sends a pointerdown first. Only the main button turns tiles, and the right button's
  // contextmenu does the locking.
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    const tile = tileFromPointer(event)

    if (tile) {
      apply(mode === 'lock' ? toggleLock(state, tile.r, tile.c) : rotate(state, tile.r, tile.c))
    }
  })

  // A right-click always locks, whatever the mode buttons say. No browser menu over the board.
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const tile = tileFromPointer(event)

    if (tile) {
      apply(toggleLock(state, tile.r, tile.c))
    }
  })

  undoButton.addEventListener('click', () => apply(undo(state)))

  modeButtons.forEach((modeButton) => {
    modeButton.addEventListener('click', () => {
      mode = modeButton.dataset.mode === 'lock' ? 'lock' : 'rotate'
      modeButtons.forEach((other) => other.classList.toggle('active', other === modeButton))
    })
  })

  newButtonElement.addEventListener('click', () => {
    state = createGame(state.size)
    render()
  })

  // A new size means a new puzzle. There is no way to keep the current board.
  sizeSelect.addEventListener('change', () => {
    state = createGame(Number(sizeSelect.value))
    render()
  })

  window.addEventListener('resize', draw)

  render()
}
