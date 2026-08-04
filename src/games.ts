export type GameItem = {
  title: string
  genre: string
  description: string
}

export const games: GameItem[] = [
  { title: 'Canvas Solitaire', genre: 'Card Game', description: 'Classic Klondike solitaire rendered on a canvas board.' },
  { title: 'Nonogram', genre: 'Puzzle', description: 'Solve generated picross grids from their row and column clues.' },
  { title: 'Twisted Ropes', genre: 'Puzzle', description: 'Drag rope ends until each rope lies on top and lifts clear of the tangle.' }
]
