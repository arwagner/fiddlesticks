import {
  newGame,
  rotate,
  toggleLock,
  undo,
  findHints,
  applyHint,
  lightDepths,
  armCount,
  ARMS,
  type GameState,
  type Hint,
  type Position,
} from './pipes-logic'
import { boardLayout, boardSize, tileAt, type Layout } from './pipes-layout'

const TILE_FILL = '#062c35'
const LOCKED_FILL = '#031317'
const BOLT = 'rgba(154, 235, 213, 0.5)'
const UNLIT = '#4a6a70'
const LIT = '#ffb400'
const SOURCE = '#f46f3d'
const SOURCE_RING = '#ffe08a'
const SOLVED_FILL = '#6dd4b8'
const SOLVED_PIPE = '#05161a'
const HINT_RING = '#ffd264'
const WRONG_RING = '#cf3d48'

// Animation timings, in milliseconds.
const TURN_MS = 160
const WIGGLE_MS = 220
const LIGHT_MS = 140
const LIGHT_STEP_MS = 45 // each step further from the source lights this much later
const SWEEP_SPAN_MS = 700 // the win sweep crosses the whole board in this long, whatever its size
const SWEEP_TILE_MS = 380
const SWEEP_START_MS = 150

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3)
}

// Blend two #rrggbb colours.
function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
  const parts = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * clamp01(t)))

  return `rgb(${parts.join(', ')})`
}

// The angle each arm points at, in canvas terms (y grows downward).
const ARM_ANGLE = new Map<number, number>([
  [ARMS[0].bit, -Math.PI / 2],
  [ARMS[1].bit, 0],
  [ARMS[2].bit, Math.PI / 2],
  [ARMS[3].bit, Math.PI],
])

// The board sizes the player can pick. Even 15×15 deals in a few milliseconds.
export const SIZES = [5, 7, 9, 12, 15]

export function setupPipes(container: HTMLElement, size = 7, createGame: (size: number) => GameState = newGame): void {
  // Keep the starting size on the menu even when a caller asks for one that is not on the list.
  const sizes = SIZES.includes(size) ? SIZES : [...SIZES, size].sort((a, b) => a - b)
  const options = sizes.map((n) => `<option value="${n}"${n === size ? ' selected' : ''}>${n} × ${n}</option>`).join('')

  container.innerHTML = `
    <div class="pipes">
      <div class="pipes-toolbar">
        <button id="pipes-new" type="button">New puzzle</button>
        <button id="pipes-undo" type="button">Undo</button>
        <button id="pipes-hint" type="button">Hint</button>
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
      <p id="pipes-note" class="pipes-note" aria-live="polite"></p>
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
  const hintButtonElement = container.querySelector<HTMLButtonElement>('#pipes-hint')
  const noteElement = container.querySelector<HTMLParagraphElement>('#pipes-note')
  const modeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.pipes-mode button'))
  const context = canvasElement?.getContext('2d')

  if (
    !canvasElement ||
    !statusElement ||
    !newButtonElement ||
    !undoButtonElement ||
    !sizeSelectElement ||
    !hintButtonElement ||
    !noteElement ||
    !context
  ) {
    throw new Error('Pipes UI elements are missing')
  }

  const canvas = canvasElement
  const status = statusElement
  const undoButton = undoButtonElement
  const sizeSelect = sizeSelectElement
  const hintButton = hintButtonElement
  const note = noteElement
  const ctx = context

  let state = createGame(size)
  let mode: 'rotate' | 'lock' = 'rotate'
  // The tile the last hint pointed at. Any later action clears it.
  let hint: Hint | null = null
  let layout: Layout = boardLayout(state.size, 280)

  // Animation state, all in performance.now() time. A tile turning or refusing to turn, when each lit tile
  // started to light up (null while unlit), and when the win sweep starts.
  let motion = new Map<number, { type: 'turn' | 'wiggle'; at: number }>()
  let litAt: (number | null)[][] = []
  let solvedAt: number | null = null
  let frameRequested = false

  function updateCanvasSize(): void {
    layout = boardLayout(state.size, Math.max(280, container.clientWidth - 16))
    const { width, height } = boardSize(layout)

    // Assigning either one wipes the canvas and resets the context, so only do it on a real change.
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  // How far each part of a tile's animation has got at time now, from 0 to 1.
  function sweepOf(r: number, c: number, now: number): number {
    if (solvedAt === null) {
      return 0
    }

    const delay = ((r + c) / Math.max(1, 2 * state.size - 2)) * SWEEP_SPAN_MS
    return easeOutCubic((now - solvedAt - delay) / SWEEP_TILE_MS)
  }

  function lightOf(r: number, c: number, now: number): number {
    const at = litAt[r]?.[c]
    return at === null || at === undefined ? 0 : easeOutCubic((now - at) / LIGHT_MS)
  }

  // A turn runs from a quarter back to square. A refusal is a small shake that dies away.
  function angleOf(r: number, c: number, now: number): number {
    const moving = motion.get(r * state.size + c)

    if (!moving) {
      return 0
    }

    if (moving.type === 'turn') {
      return -(Math.PI / 2) * (1 - easeOutCubic((now - moving.at) / TURN_MS))
    }

    const t = clamp01((now - moving.at) / WIGGLE_MS)
    return Math.sin(t * Math.PI * 3) * 0.08 * (1 - t)
  }

  function drawTile(r: number, c: number, now: number): void {
    const t = layout.tile
    const half = t / 2 - 2 // a 2px gap between tiles
    const mask = state.masks[r][c]
    const isSource = r === state.source.r && c === state.source.c
    const sweep = sweepOf(r, c, now)

    ctx.save()
    ctx.translate(c * t + t / 2, r * t + t / 2)

    const locked = state.locked[r][c]
    ctx.fillStyle = locked && !state.solved ? LOCKED_FILL : TILE_FILL
    ctx.beginPath()
    ctx.roundRect(-half, -half, 2 * half, 2 * half, 6)
    ctx.fill()

    // The win sweep: a green square grows out of each tile, one diagonal after another.
    if (sweep > 0) {
      ctx.fillStyle = SOLVED_FILL
      ctx.beginPath()
      ctx.roundRect(-half * sweep, -half * sweep, 2 * half * sweep, 2 * half * sweep, 6)
      ctx.fill()
    }

    // A locked tile is bolted down at the corners.
    if (locked && !state.solved) {
      ctx.fillStyle = BOLT

      for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath()
        ctx.arc(x * (half - 6), y * (half - 6), 2.2, 0, 2 * Math.PI)
        ctx.fill()
      }
    }

    ctx.rotate(angleOf(r, c, now))
    const pipe = sweep > 0.5 ? SOLVED_PIPE : mix(UNLIT, LIT, lightOf(r, c, now))
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

    if (hint && hint.r === r && hint.c === c) {
      ctx.strokeStyle = hint.type === 'wrong-lock' ? WRONG_RING : HINT_RING
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(-half + 1.5, -half + 1.5, 2 * half - 3, 2 * half - 3, 6)
      ctx.stroke()
    }

    ctx.restore()
  }

  function draw(now = performance.now()): void {
    updateCanvasSize()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let r = 0; r < state.size; r += 1) {
      for (let c = 0; c < state.size; c += 1) {
        drawTile(r, c, now)
      }
    }
  }

  // Light spreads out from the source: newly lit tiles start fading in one step apart, counted from the
  // nearest of them. A tile that is cut off goes dark at once.
  function relight(now: number): void {
    const depths = lightDepths(state.masks, state.source)
    const nearest = Math.min(
      ...depths.flatMap((row, r) => row.filter((depth, c) => depth >= 0 && litAt[r]?.[c] == null)),
    )

    litAt = depths.map((row, r) =>
      row.map((depth, c) => {
        if (depth < 0) return null
        return litAt[r]?.[c] ?? now + (depth - nearest) * LIGHT_STEP_MS
      }),
    )
  }

  function animating(now: number): boolean {
    const turning = [...motion.values()].some((m) => now - m.at < (m.type === 'turn' ? TURN_MS : WIGGLE_MS))
    const lighting = litAt.some((row) => row.some((at) => at !== null && now - at < LIGHT_MS))
    const sweeping = solvedAt !== null && now - solvedAt < SWEEP_SPAN_MS + SWEEP_TILE_MS

    return turning || lighting || sweeping
  }

  function frame(now: number): void {
    frameRequested = false
    draw(now)

    if (animating(now)) {
      requestFrame()
    } else {
      motion = new Map()
    }
  }

  function requestFrame(): void {
    if (!frameRequested) {
      frameRequested = true
      requestAnimationFrame(frame)
    }
  }

  // With reduced motion, every animation is already over the moment it starts.
  function timeline(): number {
    return prefersReducedMotion() ? Number.NEGATIVE_INFINITY : performance.now()
  }

  function startAnimations(wasSolved: boolean): void {
    const now = timeline()
    relight(now)

    if (state.solved && !wasSolved) {
      solvedAt = now + SWEEP_START_MS
    }

    if (Number.isFinite(now)) {
      requestFrame()
    }
  }

  function render(): void {
    status.textContent = state.solved ? 'Solved! Every pipe joins up.' : ''
    status.classList.toggle('pipes-status-solved', state.solved)
    undoButton.disabled = state.past.length === 0 || state.solved
    hintButton.disabled = state.solved
    note.textContent = hint?.type === 'wrong-lock' ? 'This lock is wrong.' : ''
    draw()
  }

  function tileFromPointer(event: MouseEvent): Position | null {
    const bounds = canvas.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * (canvas.width / bounds.width)
    const y = (event.clientY - bounds.top) * (canvas.height / bounds.height)

    return tileAt(x, y, layout)
  }

  // A move returns the same state when it changes nothing. Then only a stale hint needs clearing.
  function apply(next: GameState): void {
    if (next === state) {
      if (hint) {
        hint = null
        render()
      }

      return
    }

    const wasSolved = state.solved
    state = next
    hint = null
    startAnimations(wasSolved)
    render()
  }

  function deal(sizeToDeal: number): void {
    state = createGame(sizeToDeal)
    hint = null
    motion = new Map()
    litAt = []
    solvedAt = null
    startAnimations(false)
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

    if (!tile) {
      return
    }

    if (mode === 'lock') {
      apply(toggleLock(state, tile.r, tile.c))
      return
    }

    const now = timeline()
    const next = rotate(state, tile.r, tile.c)

    // A locked tile refuses with a shake, so the player sees why nothing turned.
    if (next === state && state.locked[tile.r][tile.c] && !state.solved) {
      motion.set(tile.r * state.size + tile.c, { type: 'wiggle', at: now })
    } else if (next !== state) {
      motion.set(tile.r * state.size + tile.c, { type: 'turn', at: now })
    }

    if (Number.isFinite(now)) {
      requestFrame()
    }

    apply(next)
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

  // Pick at random, so pressing Hint again gives a different tile when several are ready.
  hintButton.addEventListener('click', () => {
    const hints = findHints(state)

    if (hints.length === 0) {
      return
    }

    const chosen = hints[Math.floor(Math.random() * hints.length)]
    apply(applyHint(state, chosen))
    hint = chosen // set after apply, which clears the old one
    render()
  })

  newButtonElement.addEventListener('click', () => deal(state.size))

  // A new size means a new puzzle. There is no way to keep the current board.
  sizeSelect.addEventListener('change', () => deal(Number(sizeSelect.value)))

  window.addEventListener('resize', () => draw())

  startAnimations(false)
  render()
}
