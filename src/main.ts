import './style.css'
import { games } from './games'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="catalog">
    <header class="catalog-header">
      <p class="eyebrow">Fiddlesticks Arcade</p>
      <h1>Choose your next game</h1>
      <p class="subtitle">Search instantly across the full collection and jump in.</p>
      <label class="search-wrap" for="game-search">
        <span class="visually-hidden">Search games</span>
        <input id="game-search" type="search" placeholder="Search by title, genre, or mood..." autocomplete="off" />
      </label>
      <p id="results-count" class="results-count" aria-live="polite"></p>
    </header>

    <ul id="game-list" class="game-list" aria-label="Games list"></ul>
  </main>
`

const searchInput = document.querySelector<HTMLInputElement>('#game-search')
const gameList = document.querySelector<HTMLUListElement>('#game-list')
const resultsCount = document.querySelector<HTMLParagraphElement>('#results-count')

if (!searchInput || !gameList || !resultsCount) {
  throw new Error('Required UI elements are missing')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function renderGames(query: string): void {
  const normalized = query.trim().toLowerCase()
  const filtered = games.filter((game) => {
    return [game.title, game.genre, game.description].some((field) =>
      field.toLowerCase().includes(normalized),
    )
  })

  resultsCount!.textContent = `${filtered.length} of ${games.length} games`

  if (filtered.length === 0) {
    gameList!.innerHTML = `
      <li class="empty-state" role="status">
        <h2>No games found</h2>
        <p>Try a broader search like "puzzle" or "party".</p>
      </li>
    `
    return
  }

  gameList!.innerHTML = filtered
    .map((game) => {
      const slug = slugify(game.title)

      return `
        <li class="game-card">
          <a class="game-link" href="/game.html?game=${encodeURIComponent(slug)}">
            <div>
              <p class="genre">${game.genre}</p>
              <h2>${game.title}</h2>
              <p>${game.description}</p>
            </div>
            <span class="play-cta">Play</span>
          </a>
        </li>
      `
    })
    .join('')
}

searchInput.addEventListener('input', () => {
  renderGames(searchInput.value)
})

renderGames('')
