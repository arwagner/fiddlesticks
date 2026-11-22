export type GameItem = {
  title: string
  genre: string
  description: string
}

export const games: GameItem[] = [
  {
    title: 'Canvas Solitaire',
    genre: 'Card Game',
    description: 'Classic Klondike solitaire rendered on a canvas board.',
  },
  { title: 'Nonogram', genre: 'Puzzle', description: 'Solve generated picross grids from their row and column clues.' },
  {
    title: 'Decant',
    genre: 'Puzzle',
    description: 'Pour layered sand from bottle to bottle until every bottle is filled with a single color.',
  },
  {
    title: 'Pipes',
    genre: 'Puzzle',
    description: 'Rotate the tiles until every pipe joins up and the whole network lights from the source.',
  },
  {
    title: 'Bridges',
    genre: 'Puzzle',
    description: 'Join the islands. Each number says how many bridges touch it.',
  },
  {
    title: 'FreeCell',
    genre: 'Card Game',
    description: 'Every card is dealt face up. Use the four free cells to build each suit up from Ace to King.',
  },
]
