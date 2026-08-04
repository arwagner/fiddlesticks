import './style.css'
import { games } from './games'
import { setupSolitaire } from './solitaire'
import { setupNonogram } from './nonogram'

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

const gameMap = new Map(games.map((game) => [slugify(game.title), game]))
const params = new URLSearchParams(window.location.search)
const gameKey = params.get('game') ?? ''
const game = gameMap.get(gameKey)
const solitaireSlug = slugify('Canvas Solitaire')
const nonogramSlug = slugify('Nonogram')

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
          gameKey === solitaireSlug
            ? '<div id="solitaire-root" class="solitaire-root"></div>'
            : gameKey === nonogramSlug
              ? '<div id="nonogram-root"></div>'
              : '<p class="hint">Game screen placeholder: connect your real game here.</p>'
        }
      </article>
    </main>
  `

  if (gameKey === solitaireSlug) {
    const solitaireRoot = document.querySelector<HTMLDivElement>('#solitaire-root')

    if (!solitaireRoot) {
      throw new Error('Solitaire root not found')
    }

    setupSolitaire(solitaireRoot)
  } else if (gameKey === nonogramSlug) {
    const nonogramRoot = document.querySelector<HTMLDivElement>('#nonogram-root')

    if (!nonogramRoot) {
      throw new Error('Nonogram root not found')
    }

    setupNonogram(nonogramRoot)
  }
}
