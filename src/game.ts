import './style.css'
import { games } from './games'
import { setupSolitaire } from './solitaire'
import { setupNonogram } from './nonogram'
import { setupDecant } from './decant'
import { setupPipes } from './pipes'
import { setupBridges } from './bridges'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

type Launcher = {
  rootId: string
  rootClass?: string
  setup: (container: HTMLElement) => void
}

const launchers = new Map<string, Launcher>([
  [slugify('Canvas Solitaire'), { rootId: 'solitaire-root', rootClass: 'solitaire-root', setup: setupSolitaire }],
  [slugify('Nonogram'), { rootId: 'nonogram-root', setup: setupNonogram }],
  [slugify('Decant'), { rootId: 'decant-root', setup: setupDecant }],
  [slugify('Pipes'), { rootId: 'pipes-root', setup: (container) => setupPipes(container) }],
  [slugify('Bridges'), { rootId: 'bridges-root', setup: (container) => setupBridges(container) }],
])

const gameMap = new Map(games.map((game) => [slugify(game.title), game]))
const params = new URLSearchParams(window.location.search)
const gameKey = params.get('game') ?? ''
const game = gameMap.get(gameKey)
const launcher = launchers.get(gameKey)

if (!game) {
  app.innerHTML = `
    <main class="game-page">
      <a class="back-link" href="/">Back to games</a>
      <article class="game-detail missing">
        <p class="eyebrow">Not found</p>
        <h1>That game is missing</h1>
        <p>It may have moved or the link is out of date.</p>
      </article>
    </main>
  `
} else {
  app.innerHTML = `
    <main class="game-page">
      <a class="back-link" href="/">Back to games</a>
      <article class="game-detail">
        <p class="eyebrow">${game.genre}</p>
        <h1>${game.title}</h1>
        <p>${game.description}</p>
        ${
          launcher
            ? `<div id="${launcher.rootId}"${launcher.rootClass ? ` class="${launcher.rootClass}"` : ''}></div>`
            : '<p class="hint">Game screen placeholder: connect your real game here.</p>'
        }
      </article>
    </main>
  `

  if (launcher) {
    const root = document.querySelector<HTMLDivElement>(`#${launcher.rootId}`)

    if (!root) {
      throw new Error(`Game root not found: ${launcher.rootId}`)
    }

    launcher.setup(root)
  }
}
