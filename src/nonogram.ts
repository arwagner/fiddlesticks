import { newGame, applyMark, findHints, type GameState, type Hint } from './nonogram-logic'

// The board sizes the player can pick. Even 20×20 generates in about 15ms, so every one of these is cheap.
export const SIZES = [5, 8, 10, 15, 20]

// Below 46px a cell still takes a comfortable tap, so wide boards trade cell size for a board that fits.
function scaleFor(size: number): 'sm' | 'md' | 'lg' {
  if (size >= 15) {
    return 'lg'
  }

  return size >= 10 ? 'md' : 'sm'
}

export function setupNonogram(
  container: HTMLElement,
  size = 8,
  createGame: (size: number) => GameState = newGame,
): void {
  // Keep the starting size on the menu even when a caller asks for one that is not on the list.
  const sizes = SIZES.includes(size) ? SIZES : [...SIZES, size].sort((a, b) => a - b)
  const options = sizes
    .map((n) => `<option value="${n}"${n === size ? ' selected' : ''}>${n} × ${n}</option>`)
    .join('')

  container.innerHTML = `
    <div class="nonogram">
      <div class="nono-toolbar">
        <button id="nono-new" type="button">New puzzle</button>
        <button id="nono-hint" type="button">Hint</button>
        <label class="nono-size">Size
          <select id="nono-size">${options}</select>
        </label>
        <div class="nono-mode" role="group" aria-label="Mark mode">
          <button type="button" data-mode="fill" class="active">Fill</button>
          <button type="button" data-mode="x">Mark X</button>
        </div>
        <span class="nono-tip">Right-click marks an X</span>
        <p id="nono-status" aria-live="polite">Mistakes: 0</p>
      </div>
      <p id="nono-hint-note" class="nono-hint-note" aria-live="polite"></p>
      <div id="nono-grid" class="nono-grid"></div>
    </div>
  `

  const gridEl = container.querySelector<HTMLDivElement>('#nono-grid')
  const statusEl = container.querySelector<HTMLParagraphElement>('#nono-status')
  const newButton = container.querySelector<HTMLButtonElement>('#nono-new')
  const hintButtonEl = container.querySelector<HTMLButtonElement>('#nono-hint')
  const hintNoteEl = container.querySelector<HTMLParagraphElement>('#nono-hint-note')
  const sizeSelect = container.querySelector<HTMLSelectElement>('#nono-size')
  const modeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.nono-mode button'))

  if (!gridEl || !statusEl || !newButton || !hintButtonEl || !hintNoteEl || !sizeSelect) {
    throw new Error('Nonogram UI elements are missing')
  }

  const grid = gridEl
  const status = statusEl
  const hintNote = hintNoteEl
  const hintButton = hintButtonEl

  let state: GameState = createGame(size)
  let mode: 'fill' | 'x' = 'fill'
  let hint: Hint | null = null

  function render(): void {
    grid.style.setProperty('--n', String(state.size))
    grid.dataset.scale = scaleFor(state.size)

    // Hold the sweep to about 0.7s whatever the board size, so a 20×20 win does not crawl.
    const step = 700 / Math.max(1, 2 * (state.size - 1))

    let html = '<div class="nono-corner"></div>'
    for (let c = 0; c < state.size; c += 1) {
      html += `<div class="nono-clue nono-clue-col">${state.colClues[c].join('<br>')}</div>`
    }
    for (let r = 0; r < state.size; r += 1) {
      html += `<div class="nono-clue nono-clue-row">${state.rowClues[r].join(' ')}</div>`
      for (let c = 0; c < state.size; c += 1) {
        const cell = state.board[r][c]
        const glyph = cell === 'x' || cell === 'wrong-x' ? '✕' : ''
        // The win sweep runs on a diagonal, so each cell waits for the one up and to the left of it.
        const delay = `--nono-delay:${Math.round((r + c) * step)}ms`
        const marked = hint && hint.r === r && hint.c === c ? ' nono-hint' : ''
        html += `<button type="button" style="${delay}" class="nono-cell nono-${cell}${marked}" data-r="${r}" data-c="${c}" aria-label="row ${r + 1} column ${c + 1}">${glyph}</button>`
      }
    }
    grid.innerHTML = html

    // The class drives the win sweep, which turns every cell to the filled color.
    grid.classList.toggle('nono-won', state.won)
    status.classList.toggle('nono-status-won', state.won)

    status.textContent = state.won ? `Solved! Mistakes: ${state.mistakes}` : `Mistakes: ${state.mistakes}`

    // The note names the line that proves the cell. It never says which mark to make.
    hintNote.textContent = hint ? `Look at ${hint.line} ${hint.index + 1}. It decides the marked cell.` : ''
    hintButton.disabled = state.won
  }

  function markAt(event: Event, intent: 'fill' | 'x'): void {
    const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('.nono-cell')

    if (!cell) {
      return
    }

    const next = applyMark(state, Number(cell.dataset.r), Number(cell.dataset.c), intent)

    // applyMark returns the same state when it ignores a click. Skip the redraw, or the win sweep replays.
    if (next === state) {
      return
    }

    state = next
    hint = null // the board moved on, so the old hint no longer applies
    render()
  }

  grid.addEventListener('click', (event) => markAt(event, mode))

  // A right-click always marks an X, whatever the mode buttons say. The mode itself does not change.
  grid.addEventListener('contextmenu', (event) => {
    event.preventDefault() // no browser menu over the board, even between the cells
    markAt(event, 'x')
  })

  // Pick at random, so pressing Hint again points somewhere else instead of repeating itself.
  hintButton.addEventListener('click', () => {
    const hints = findHints(state)

    hint = hints.length > 0 ? hints[Math.floor(Math.random() * hints.length)] : null
    render()
  })

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode === 'x' ? 'x' : 'fill'
      modeButtons.forEach((other) => other.classList.toggle('active', other === button))
    })
  })

  newButton.addEventListener('click', () => {
    state = createGame(state.size)
    hint = null
    render()
  })

  // A new size means a new puzzle. There is no way to keep the current board.
  sizeSelect.addEventListener('change', () => {
    state = createGame(Number(sizeSelect.value))
    hint = null
    render()
  })

  render()
}
