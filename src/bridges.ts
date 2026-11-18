import {
  newGame,
  cycle,
  undo,
  blockers,
  findHints,
  applyHint,
  islandStatuses,
  pairBetween,
  type GameState,
  type Hint,
} from './bridges-logic'
import { HIT_RADIUS, ISLAND_RADIUS, boardPoint, bridgeLines, islandCentre, viewBox, type Point } from './bridges-layout'

const SVG = 'http://www.w3.org/2000/svg'
// How long a refused bridge shakes, as Pipes' wiggle. The shake itself is a CSS animation.
const WIGGLE_MS = 220

// The board sizes the player can pick. Bigger boards are harder.
export const SIZES = [7, 10, 13]

export function setupBridges(
  container: HTMLElement,
  size = 7,
  createGame: (size: number) => GameState = newGame,
): void {
  // Keep the starting size on the menu even when a caller asks for one that is not on the list.
  const sizes = SIZES.includes(size) ? SIZES : [...SIZES, size].sort((a, b) => a - b)
  const options = sizes.map((n) => `<option value="${n}"${n === size ? ' selected' : ''}>${n} × ${n}</option>`).join('')

  container.innerHTML = `
    <div class="bridges">
      <div class="bridges-toolbar">
        <button id="bridges-new" type="button">New puzzle</button>
        <button id="bridges-undo" type="button">Undo</button>
        <button id="bridges-hint" type="button">Hint</button>
        <label class="bridges-size">Size
          <select id="bridges-size">${options}</select>
        </label>
        <p id="bridges-status" aria-live="polite"></p>
      </div>
      <p class="bridges-help">Drag from an island to a neighbour to add a bridge. Tap a bridge to change it.</p>
      <p id="bridges-note" class="bridges-note" aria-live="polite"></p>
      <svg id="bridges-board" xmlns="${SVG}" role="img" aria-label="Board of islands">
        <g id="bridges-bridges"></g>
        <line id="bridges-preview" class="bridges-preview" visibility="hidden"></line>
        <g id="bridges-islands"></g>
      </svg>
    </div>
  `

  const boardElement = container.querySelector<SVGSVGElement>('#bridges-board')
  const bridgeLayerElement = container.querySelector<SVGGElement>('#bridges-bridges')
  const islandLayerElement = container.querySelector<SVGGElement>('#bridges-islands')
  const previewElement = container.querySelector<SVGLineElement>('#bridges-preview')
  const statusElement = container.querySelector<HTMLParagraphElement>('#bridges-status')
  const noteElement = container.querySelector<HTMLParagraphElement>('#bridges-note')
  const newButtonElement = container.querySelector<HTMLButtonElement>('#bridges-new')
  const undoButtonElement = container.querySelector<HTMLButtonElement>('#bridges-undo')
  const hintButtonElement = container.querySelector<HTMLButtonElement>('#bridges-hint')
  const sizeSelectElement = container.querySelector<HTMLSelectElement>('#bridges-size')

  if (
    !boardElement ||
    !bridgeLayerElement ||
    !islandLayerElement ||
    !previewElement ||
    !statusElement ||
    !noteElement ||
    !newButtonElement ||
    !undoButtonElement ||
    !hintButtonElement ||
    !sizeSelectElement
  ) {
    throw new Error('Bridges UI elements are missing')
  }

  const board = boardElement
  const bridgeLayer = bridgeLayerElement
  const islandLayer = islandLayerElement
  const preview = previewElement
  const status = statusElement
  const note = noteElement
  const undoButton = undoButtonElement
  const hintButton = hintButtonElement
  const sizeSelect = sizeSelectElement

  let state = createGame(size)
  // The pair the last hint pointed at. Any later action clears it.
  let hint: Hint | null = null
  // The bridges that just blocked a move, shaking for a moment.
  let refused: number[] = []
  let refusedTimer: ReturnType<typeof setTimeout> | undefined
  // A press on an island starts a drag towards a neighbour. A press on a bridge is a tap if it ends there too.
  let press: { type: 'island'; island: number } | { type: 'bridge'; pair: number } | null = null

  function element<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
    const created = document.createElementNS(SVG, tag)
    Object.entries(attributes).forEach(([name, value]) => created.setAttribute(name, String(value)))
    return created
  }

  function drawBridges(): void {
    bridgeLayer.replaceChildren(
      ...state.levels.flatMap((level, p) => {
        if (level === 0) {
          return []
        }

        const classes = ['bridges-bridge']
        if (hint?.pair === p) classes.push(hint.type === 'wrong' ? 'bridges-wrong' : 'bridges-hinted')
        if (refused.includes(p)) classes.push('bridges-refused')

        const group = element('g', { class: classes.join(' '), 'data-pair': p })
        const lines = bridgeLines(state.puzzle, p, level)
        lines.forEach(({ from, to }) =>
          group.append(element('line', { class: 'bridges-line', x1: from.x, y1: from.y, x2: to.x, y2: to.y })),
        )

        // A wide, invisible line over the bridge, so a finger doesn't have to land on the thin one.
        const [centre] = bridgeLines(state.puzzle, p, 1)
        group.append(
          element('line', {
            class: 'bridges-hit',
            x1: centre.from.x,
            y1: centre.from.y,
            x2: centre.to.x,
            y2: centre.to.y,
          }),
        )

        return [group]
      }),
    )
  }

  function drawIslands(): void {
    const statuses = islandStatuses(state.puzzle, state.levels)

    islandLayer.replaceChildren(
      ...state.puzzle.islands.map((island, i) => {
        const { x, y } = islandCentre(island)
        const group = element('g', { class: `bridges-island bridges-island-${statuses[i]}`, 'data-island': i })
        // A press anywhere near the island takes, as a finger hides small targets. Islands are never side by
        // side, and diagonal ones are far enough apart that these circles don't overlap.
        group.append(element('circle', { class: 'bridges-hit', cx: x, cy: y, r: HIT_RADIUS }))
        group.append(element('circle', { cx: x, cy: y, r: ISLAND_RADIUS }))
        const count = element('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' })
        count.textContent = String(island.count)
        group.append(count)
        return group
      }),
    )
  }

  function render(): void {
    board.setAttribute('viewBox', viewBox(state.puzzle.size))
    board.classList.toggle('bridges-solved', state.solved)
    status.textContent = state.solved ? 'Solved! Every island is done and joined up.' : ''
    status.classList.toggle('bridges-status-solved', state.solved)
    undoButton.disabled = state.past.length === 0 || state.solved
    hintButton.disabled = state.solved
    note.textContent = hint?.type === 'wrong' ? 'This bridge is wrong.' : ''
    drawBridges()
    drawIslands()
  }

  // Any action clears the last hint, even one that changes nothing.
  function apply(next: GameState): void {
    state = next
    hint = null
    render()
  }

  function refuse(pairs: number[]): void {
    refused = pairs
    clearTimeout(refusedTimer)
    refusedTimer = setTimeout(() => {
      refused = []
    }, WIGGLE_MS)
  }

  function move(pair: number): void {
    const next = cycle(state, pair)

    // A bridge in the way refuses the move with a shake, so the player sees why nothing changed.
    if (next === state && !state.solved) {
      refuse(blockers(state.puzzle, state.levels, pair))
    }

    apply(next)
  }

  function deal(sizeToDeal: number): void {
    state = createGame(sizeToDeal)
    hint = null
    refused = []
    endPress()
    render()
  }

  function islandOf(target: Element | null): number | null {
    const island = target?.closest('[data-island]')?.getAttribute('data-island')
    return island == null ? null : Number(island)
  }

  function pairOf(target: Element | null): number | null {
    const pair = target?.closest('[data-pair]')?.getAttribute('data-pair')
    return pair == null ? null : Number(pair)
  }

  function showPreview(from: Point, to: Point): void {
    preview.setAttribute('x1', String(from.x))
    preview.setAttribute('y1', String(from.y))
    preview.setAttribute('x2', String(to.x))
    preview.setAttribute('y2', String(to.y))
    preview.setAttribute('visibility', 'visible')
  }

  function endPress(): void {
    press = null
    preview.setAttribute('visibility', 'hidden')
  }

  // Only pointer events act. The click a browser sends after the release would land on whatever is under
  // it, so it is ignored.
  board.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || state.solved) {
      return
    }

    const target = event.target as Element
    const island = islandOf(target)
    const pair = pairOf(target)

    if (island !== null) {
      event.preventDefault()
      press = { type: 'island', island }
    } else if (pair !== null) {
      event.preventDefault()
      press = { type: 'bridge', pair }
    }
  })

  // The line follows the pointer, and snaps to a neighbour while over one.
  board.addEventListener('pointermove', (event) => {
    if (press?.type !== 'island') {
      return
    }

    const from = state.puzzle.islands[press.island]
    const over = islandOf(document.elementFromPoint(event.clientX, event.clientY))
    const to =
      over !== null && pairBetween(state.puzzle, press.island, over) >= 0
        ? islandCentre(state.puzzle.islands[over])
        : boardPoint(event.clientX, event.clientY, board.getBoundingClientRect(), state.puzzle.size)

    if (to) {
      showPreview(islandCentre(from), to)
    }
  })

  window.addEventListener('pointerup', (event) => {
    const ended = press
    endPress()
    const under = document.elementFromPoint(event.clientX, event.clientY)

    if (ended?.type === 'island') {
      const over = islandOf(under)
      const pair = over === null ? -1 : pairBetween(state.puzzle, ended.island, over)

      if (pair >= 0) {
        move(pair)
      }
    } else if (ended?.type === 'bridge' && islandOf(under) === null && pairOf(under) === ended.pair) {
      move(ended.pair)
    }
  })

  window.addEventListener('pointercancel', endPress)

  undoButton.addEventListener('click', () => apply(undo(state)))

  // Pick at random, so pressing Hint again gives a different pair when several are ready.
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

  newButtonElement.addEventListener('click', () => deal(state.puzzle.size))

  // A new size means a new puzzle. There is no way to keep the current board.
  sizeSelect.addEventListener('change', () => deal(Number(sizeSelect.value)))

  render()
}
