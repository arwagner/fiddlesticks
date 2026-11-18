import {
  newGame,
  pour,
  undo,
  pourAmount,
  DEFAULT_DEAL,
  type Bottle,
  type GameState,
  type GameOptions,
  type Move,
} from './decant-logic'
import { solve } from './decant-solver'
import { shelfLayout, bottleRect, bandInRect, bottleAt, boardSize, type Layout, type Rect } from './decant-layout'

// The knobs the toolbar offers. Every combination deals in well under a tenth of a second; more colors
// than this against a single spare bottle leaves the solver rejecting deals all day.
export const COLOR_CHOICES = [4, 5, 6]
export const LAYER_CHOICES = [3, 4, 5]
export const EMPTY_CHOICES = [1, 2]

// One per color, in deal order. Neighbouring bottles never share a hue at a glance.
export const SAND = ['#e0583f', '#f0a63a', '#ecd85f', '#79c46a', '#4bb8d0', '#7f7ce6', '#cd6bd0', '#c9a07a']

const GLASS_LINE = 'rgba(214, 250, 240, 0.5)'
const GLASS_FILL = 'rgba(255, 255, 255, 0.05)'
const LIT = '#ffe08a'
const WON_LINE = '#ffb400'

// A pour reads as one gesture: tilt over the target, run the sand across, tip back. The middle stretches
// with the amount poured, so five layers take visibly longer to empty than one.
const TILT_MS = 130
const POUR_BASE_MS = 110
const POUR_PER_LAYER_MS = 90
const SETTLE_MS = 150
const TILT_RADIANS = 1.15

type Pouring = {
  move: Move
  amount: number
  color: number
  began: number
}

// What a bottle shows while sand is in the air: whole layers, then a part-layer on top of them.
type Contents = {
  layers: Bottle
  partialColor: number
  partialLayers: number
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function optionsHtml(values: number[], chosen: number): string {
  return values
    .map((value) => `<option value="${value}"${value === chosen ? ' selected' : ''}>${value}</option>`)
    .join('')
}

export function setupDecant(
  container: HTMLElement,
  options: Partial<GameOptions> = {},
  createGame: (options: Partial<GameOptions>) => GameState = newGame,
): void {
  const settings = { ...DEFAULT_DEAL, ...options }

  container.innerHTML = `
    <div class="decant">
      <div class="decant-toolbar">
        <button id="decant-new" type="button">New puzzle</button>
        <button id="decant-undo" type="button">Undo</button>
        <button id="decant-hint" type="button">Hint</button>
        <label class="decant-knob">Colors
          <select id="decant-colors">${optionsHtml(COLOR_CHOICES, settings.colors)}</select>
        </label>
        <label class="decant-knob">Layers
          <select id="decant-layers">${optionsHtml(LAYER_CHOICES, settings.capacity)}</select>
        </label>
        <label class="decant-knob">Spare bottles
          <select id="decant-empties">${optionsHtml(EMPTY_CHOICES, settings.empties)}</select>
        </label>
        <p id="decant-status" aria-live="polite"></p>
      </div>
      <p id="decant-note" class="decant-note" aria-live="polite">Click a bottle, then the one to pour it into.</p>
      <canvas id="decant-canvas" aria-label="Shelf of sand bottles"></canvas>
    </div>
  `

  const canvasElement = container.querySelector<HTMLCanvasElement>('#decant-canvas')
  const statusElement = container.querySelector<HTMLParagraphElement>('#decant-status')
  const noteElement = container.querySelector<HTMLParagraphElement>('#decant-note')
  const newButtonElement = container.querySelector<HTMLButtonElement>('#decant-new')
  const undoButtonElement = container.querySelector<HTMLButtonElement>('#decant-undo')
  const hintButtonElement = container.querySelector<HTMLButtonElement>('#decant-hint')
  const colorSelectElement = container.querySelector<HTMLSelectElement>('#decant-colors')
  const layerSelectElement = container.querySelector<HTMLSelectElement>('#decant-layers')
  const emptySelectElement = container.querySelector<HTMLSelectElement>('#decant-empties')

  if (
    !canvasElement ||
    !statusElement ||
    !noteElement ||
    !newButtonElement ||
    !undoButtonElement ||
    !hintButtonElement ||
    !colorSelectElement ||
    !layerSelectElement ||
    !emptySelectElement
  ) {
    throw new Error('Decant UI elements are missing')
  }

  const context = canvasElement.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context is not available')
  }

  const canvas = canvasElement
  const status = statusElement
  const note = noteElement
  const newButton = newButtonElement
  const undoButton = undoButtonElement
  const hintButton = hintButtonElement
  const colorSelect = colorSelectElement
  const layerSelect = layerSelectElement
  const emptySelect = emptySelectElement
  const ctx = context

  let state = createGame(settings)
  let selected: number | null = null
  let hint: Move | null = null
  let pouring: Pouring | null = null

  // One scaled layout, recomputed from the container width; drawing AND hit-testing read from it.
  let layout: Layout = shelfLayout(state.bottles.length, state.capacity, container.clientWidth)

  function updateCanvasSize(): void {
    layout = shelfLayout(state.bottles.length, state.capacity, Math.max(280, container.clientWidth - 16))

    const size = boardSize(state.bottles.length, layout)
    const width = Math.ceil(size.width)
    const height = Math.ceil(size.height)

    // Assigning either one wipes the canvas and resets the context, so only do it on a real change —
    // this runs on every frame of a pour.
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  function canvasPointFromPointer(event: PointerEvent): { x: number; y: number } {
    const bounds = canvas.getBoundingClientRect()

    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    }
  }

  function bottlePath(rect: Rect): void {
    const neckW = rect.w * 0.46
    const neckX = rect.x + (rect.w - neckW) / 2
    const shoulder = rect.y + layout.neckH
    const radius = 12 * layout.scale

    ctx.beginPath()
    ctx.moveTo(neckX, rect.y)
    ctx.lineTo(neckX + neckW, rect.y)
    ctx.lineTo(neckX + neckW, shoulder - 8 * layout.scale)
    ctx.quadraticCurveTo(rect.x + rect.w, shoulder, rect.x + rect.w, shoulder + radius)
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - radius)
    ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - radius, rect.y + rect.h)
    ctx.lineTo(rect.x + radius, rect.y + rect.h)
    ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - radius)
    ctx.lineTo(rect.x, shoulder + radius)
    ctx.quadraticCurveTo(rect.x, shoulder, neckX, shoulder - 8 * layout.scale)
    ctx.closePath()
  }

  function drawSand(rect: Rect, contents: Contents): void {
    ctx.save()
    bottlePath(rect)
    ctx.clip()

    for (let layer = 0; layer < contents.layers.length; layer += 1) {
      const band = bandInRect(rect, layer, layout)
      ctx.fillStyle = SAND[contents.layers[layer] % SAND.length]
      ctx.fillRect(band.x, band.y, band.w, band.h)
      // A lighter line where one layer meets the next, so five of one color still read as five.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.fillRect(band.x, band.y, band.w, Math.max(1, layout.scale))
    }

    if (contents.partialLayers > 0) {
      const base = bandInRect(rect, contents.layers.length, layout)
      const height = contents.partialLayers * layout.layerH
      ctx.fillStyle = SAND[contents.partialColor % SAND.length]
      ctx.fillRect(base.x, base.y + base.h - height, base.w, height)
    }

    ctx.restore()
  }

  function drawBottle(rect: Rect, contents: Contents, outline: string | null, dashed = false): void {
    ctx.save()
    bottlePath(rect)
    ctx.fillStyle = GLASS_FILL
    ctx.fill()
    ctx.restore()

    drawSand(rect, contents)

    ctx.save()
    bottlePath(rect)
    ctx.strokeStyle = outline ?? GLASS_LINE
    ctx.lineWidth = (outline ? 3 : 2) * layout.scale

    if (dashed) {
      ctx.setLineDash([8 * layout.scale, 6 * layout.scale])
    }

    ctx.stroke()
    ctx.restore()
  }

  function contentsOf(index: number): Contents {
    return { layers: state.bottles[index], partialColor: 0, partialLayers: 0 }
  }

  function outlineFor(index: number): { color: string | null; dashed: boolean } {
    if (state.won) {
      return { color: WON_LINE, dashed: false }
    }

    if (index === selected || (hint !== null && index === hint.from)) {
      return { color: LIT, dashed: false }
    }

    if (hint !== null && index === hint.to) {
      return { color: LIT, dashed: true }
    }

    return { color: null, dashed: false }
  }

  function rotateAbout(x: number, y: number, cx: number, cy: number, angle: number): { x: number; y: number } {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    return { x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos }
  }

  // The mouth of a bottle, where sand goes in.
  function mouthOf(rect: Rect): { x: number; y: number } {
    return { x: rect.x + rect.w / 2, y: rect.y + layout.neckH * 0.7 }
  }

  // Hang the tilted bottle so its own lip ends up over the destination's mouth: rotate the lip about the
  // bottle's centre, then place the bottle by that offset. Tilting around a fixed spot instead leaves the
  // lip pointing off into the air.
  function placeOver(move: Move, fromLeft: boolean): { rect: Rect; tilt: number } {
    const source = bottleRect(move.from, layout)
    const target = bottleRect(move.to, layout)
    const tilt = (fromLeft ? 1 : -1) * TILT_RADIANS
    const lip = rotateAbout(source.w / 2, 0, source.w / 2, source.h / 2, tilt)
    const mouth = mouthOf(target)

    return {
      rect: { x: mouth.x - lip.x, y: mouth.y - layout.bottleH * 0.16 - lip.y, w: source.w, h: source.h },
      tilt,
    }
  }

  // Pour from the side the bottle came from, unless that hangs it off the edge of the shelf.
  function pourPlacement(move: Move): { rect: Rect; tilt: number } {
    const fromLeft = bottleRect(move.from, layout).x <= bottleRect(move.to, layout).x
    const placement = placeOver(move, fromLeft)
    const onShelf = placement.rect.x >= 0 && placement.rect.x + placement.rect.w <= canvas.width

    return onShelf ? placement : placeOver(move, !fromLeft)
  }

  function drawStream(lip: { x: number; y: number }, target: Rect, color: number): void {
    const mouth = mouthOf(target)

    ctx.save()
    ctx.strokeStyle = SAND[color % SAND.length]
    ctx.lineWidth = layout.bottleW * 0.17
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(lip.x, lip.y)
    ctx.quadraticCurveTo(lip.x, lerp(lip.y, mouth.y, 0.75), mouth.x, mouth.y)
    ctx.stroke()
    ctx.restore()
  }

  // How far through the pour we are: where the bottle sits between shelf and target, and how much sand
  // has crossed. Anything past the end reports done, so the caller can commit the move.
  function progressOf(pouring: Pouring, now: number): { travel: number; moved: number; done: boolean } {
    const elapsed = now - pouring.began
    const pourMs = POUR_BASE_MS + POUR_PER_LAYER_MS * pouring.amount

    if (elapsed < TILT_MS) {
      return { travel: easeInOut(elapsed / TILT_MS), moved: 0, done: false }
    }

    if (elapsed < TILT_MS + pourMs) {
      return { travel: 1, moved: pouring.amount * easeInOut((elapsed - TILT_MS) / pourMs), done: false }
    }

    const back = (elapsed - TILT_MS - pourMs) / SETTLE_MS

    return { travel: 1 - easeInOut(Math.min(1, back)), moved: pouring.amount, done: back >= 1 }
  }

  function drawPour(now: number): void {
    if (!pouring) {
      return
    }

    const { move, amount, color } = pouring
    const { travel, moved } = progressOf(pouring, now)
    const rest = bottleRect(move.from, layout)
    const placement = pourPlacement(move)
    const rect = {
      x: lerp(rest.x, placement.rect.x, travel),
      y: lerp(rest.y, placement.rect.y, travel),
      w: rest.w,
      h: rest.h,
    }
    const tilt = placement.tilt * travel
    const centerX = rect.x + rect.w / 2
    const centerY = rect.y + rect.h / 2
    const source = state.bottles[move.from]

    if (moved > 0 && moved < amount) {
      const lip = rotateAbout(centerX, rect.y, centerX, centerY, tilt)
      drawStream(lip, bottleRect(move.to, layout), color)
    }

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(tilt)
    ctx.translate(-centerX, -centerY)
    drawBottle(
      rect,
      {
        layers: source.slice(0, source.length - amount),
        partialColor: color,
        partialLayers: amount - moved,
      },
      LIT,
    )
    ctx.restore()
  }

  function draw(now = 0): void {
    updateCanvasSize()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const moved = pouring ? progressOf(pouring, now).moved : 0

    for (let index = 0; index < state.bottles.length; index += 1) {
      if (pouring && index === pouring.move.from) {
        continue // drawn last, above the shelf
      }

      const rect = bottleRect(index, layout)
      const lift = index === selected ? layout.bottleH * 0.07 : 0
      const outline = outlineFor(index)
      const contents = contentsOf(index)

      if (pouring && index === pouring.move.to) {
        contents.partialColor = pouring.color
        contents.partialLayers = moved
      }

      drawBottle({ ...rect, y: rect.y - lift }, contents, outline.color, outline.dashed)
    }

    drawPour(now)
  }

  function render(): void {
    const par = state.par === null ? '' : ` · Par ${state.par}`

    const pours = `${state.moves} ${state.moves === 1 ? 'pour' : 'pours'}`

    status.textContent = state.won
      ? `Solved in ${pours}.${state.par === null ? '' : ` Par was ${state.par}.`}`
      : `Pours: ${state.moves}${par}`
    status.classList.toggle('decant-status-won', state.won)
    undoButton.disabled = state.past.length === 0
    hintButton.disabled = state.won
    draw()
  }

  function commit(move: Move): void {
    pouring = null
    state = pour(state, move.from, move.to)

    if (state.won) {
      note.textContent = 'Every bottle, one color. Nicely poured.'
    }

    render()
  }

  function step(now: number): void {
    if (!pouring) {
      return
    }

    const move = pouring.move

    if (progressOf(pouring, now).done) {
      commit(move)
      return
    }

    draw(now)
    requestAnimationFrame(step)
  }

  function startPour(move: Move, amount: number): void {
    const source = state.bottles[move.from]

    selected = null
    hint = null

    if (prefersReducedMotion()) {
      commit(move)
      return
    }

    pouring = { move, amount, color: source[source.length - 1], began: performance.now() }
    requestAnimationFrame(step)
  }

  function onPointerDown(event: PointerEvent): void {
    event.preventDefault()

    if (pouring || state.won) {
      return
    }

    const point = canvasPointFromPointer(event)
    const index = bottleAt(point.x, point.y, state.bottles.length, layout)

    if (index === null || index === selected) {
      selected = null
      draw()
      return
    }

    // With nothing picked up yet, a click picks the bottle to pour from — an empty one has nothing to give.
    if (selected === null) {
      selected = state.bottles[index].length > 0 ? index : null
      draw()
      return
    }

    const amount = pourAmount(state.bottles[selected], state.bottles[index], state.capacity)

    // A bottle that will not take the pour is read as picking a new one to pour from instead.
    if (amount === 0) {
      selected = state.bottles[index].length > 0 ? index : null
      draw()
      return
    }

    startPour({ from: selected, to: index }, amount)
  }

  function deal(): void {
    state = createGame({
      ...options,
      colors: Number(colorSelect.value),
      capacity: Number(layerSelect.value),
      empties: Number(emptySelect.value),
    })
    selected = null
    hint = null
    pouring = null
    note.textContent = 'Click a bottle, then the one to pour it into.'
    render()
  }

  canvas.addEventListener('pointerdown', onPointerDown)

  newButton.addEventListener('click', deal)

  undoButton.addEventListener('click', () => {
    if (pouring) {
      return
    }

    state = undo(state)
    selected = null
    hint = null
    render()
  })

  // The hint reads the board as it stands, so it stays honest after an undo or a detour.
  hintButton.addEventListener('click', () => {
    if (pouring) {
      return
    }

    const moves = solve(state.bottles, state.capacity)

    hint = moves && moves.length > 0 ? moves[0] : null
    note.textContent = moves
      ? 'Pour the lit bottle into the ringed one.'
      : 'No way home from here. Undo a pour or start again.'
    selected = null
    render()
  })

  for (const select of [colorSelect, layerSelect, emptySelect]) {
    // A new setting means a new puzzle. There is no way to keep the current shelf.
    select.addEventListener('change', deal)
  }

  window.addEventListener('resize', () => draw(performance.now()))

  render()
}
