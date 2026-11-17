// Where the tiles sit on the canvas at whatever width the page gives us (no DOM). pipes.ts both draws from
// this and hit-tests against it, so a click always lands on the tile the player aimed at.

import type { Position } from './pipes-logic'

export type Layout = { size: number; tile: number }

// Below this a tile is hard to hit with a finger, so a big board on a small screen scrolls instead.
export const MIN_TILE = 34
const MAX_TILE = 64

export function boardLayout(size: number, containerWidth: number): Layout {
  const tile = Math.min(MAX_TILE, Math.max(MIN_TILE, Math.floor(containerWidth / size)))

  return { size, tile }
}

export function tileAt(x: number, y: number, layout: Layout): Position | null {
  const r = Math.floor(y / layout.tile)
  const c = Math.floor(x / layout.tile)

  return r >= 0 && r < layout.size && c >= 0 && c < layout.size ? { r, c } : null
}

export function boardSize(layout: Layout): { width: number; height: number } {
  return { width: layout.size * layout.tile, height: layout.size * layout.tile }
}
