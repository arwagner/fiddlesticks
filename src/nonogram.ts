import { newGame, applyMark, type GameState } from './nonogram-logic'

export function setupNonogram(
  container: HTMLElement,
  size = 5,
  createGame: (size: number) => GameState = newGame,
): void {
  container.innerHTML = `
    <div class="nonogram">
      <div class="nono-toolbar">
        <button id="nono-new" type="button">New puzzle</button>
        <div class="nono-mode" role="group" aria-label="Mark mode">
          <button type="button" data-mode="fill" class="active">Fill</button>
          <button type="button" data-mode="x">Mark X</button>
        </div>
        <p id="nono-status" aria-live="polite">Mistakes: 0</p>
      </div>
      <div id="nono-grid" class="nono-grid"></div>
    </div>
  `

  const gridEl = container.querySelector<HTMLDivElement>('#nono-grid')
  const statusEl = container.querySelector<HTMLParagraphElement>('#nono-status')
  const newButton = container.querySelector<HTMLButtonElement>('#nono-new')
  const modeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.nono-mode button'))

  if (!gridEl || !statusEl || !newButton) {
    throw new Error('Nonogram UI elements are missing')
  }

  const grid = gridEl
  const status = statusEl

  let state: GameState = createGame(size)
  let mode: 'fill' | 'x' = 'fill'

  function render(): void {
    grid.style.setProperty('--n', String(state.size))

    let html = '<div class="nono-corner"></div>'
    for (let c = 0; c < state.size; c += 1) {
      html += `<div class="nono-clue nono-clue-col">${state.colClues[c].join('<br>')}</div>`
    }
    for (let r = 0; r < state.size; r += 1) {
      html += `<div class="nono-clue nono-clue-row">${state.rowClues[r].join(' ')}</div>`
      for (let c = 0; c < state.size; c += 1) {
        const cell = state.board[r][c]
        const glyph = cell === 'x' || cell === 'wrong-x' ? '✕' : ''
        html += `<button type="button" class="nono-cell nono-${cell}" data-r="${r}" data-c="${c}" aria-label="row ${r + 1} column ${c + 1}">${glyph}</button>`
      }
    }
    grid.innerHTML = html

    status.textContent = state.won ? `Solved! Mistakes: ${state.mistakes}` : `Mistakes: ${state.mistakes}`
  }

  grid.addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('.nono-cell')

    if (!cell) {
      return
    }

    state = applyMark(state, Number(cell.dataset.r), Number(cell.dataset.c), mode)
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
    render()
  })

  render()
}
