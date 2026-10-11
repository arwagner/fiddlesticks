export type GameItem = {
  title: string
  genre: string
  description: string
}

export const games: GameItem[] = [
  { title: 'Canvas Solitaire', genre: 'Card Game', description: 'Classic Klondike solitaire rendered on a canvas board.' },
  { title: 'Nonogram', genre: 'Puzzle', description: 'Solve generated picross grids from their row and column clues.' },
  { title: 'Decant', genre: 'Puzzle', description: 'Pour layered sand from bottle to bottle until every bottle is filled with a single color.' }
]
