// Draws a card's face, a card's back and an empty slot on a 2D canvas, for every card game. It knows how a
// card looks, not where it goes or which moves are legal: the caller passes the rect to draw in.
import { type Rect, type Suit, CARD_W, INDEX_BASELINE, cardColor, rankLabels, pips } from './cards'

// Trebuchet first for the rank digits; the symbol fonts back it up wherever it lacks a suit pip.
const CARD_FONT = '"Trebuchet MS", "Apple Symbols", "Segoe UI Symbol", sans-serif'

export const RED_INK = '#cf3d48'
export const BLACK_INK = '#1f2d3a'

// The sizes below are tuned for a card CARD_W wide and grow with the card.
function scaleOf(rect: Rect): number {
  return rect.w / CARD_W
}

function roundedCardPath(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const { x, y, w, h } = rect
  const radius = 10 * scaleOf(rect)

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

// A card's face: its index (rank and pip) in the top-left corner, and again, smaller, in the bottom-right.
export function drawCardFace(ctx: CanvasRenderingContext2D, card: { suit: Suit; rank: number }, rect: Rect): void {
  const { x, y, w, h } = rect

  ctx.save()
  roundedCardPath(ctx, rect)
  ctx.fillStyle = '#f3fff8'
  ctx.fill()
  ctx.strokeStyle = '#bdd8cd'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const index = `${rankLabels[card.rank - 1]}${pips[card.suit]}`
  ctx.fillStyle = cardColor(card) === 'red' ? RED_INK : BLACK_INK
  const fontSize = Math.max(20, 40 * scaleOf(rect))
  const smallFontSize = fontSize * 0.85
  // At this size a two-character index ("10♥") nearly spans the card, so the corners are padded by a
  // fixed inset and the lower index is right-aligned by measurement rather than a fraction of the width.
  const pad = w * 0.06

  ctx.font = `700 ${fontSize}px ${CARD_FONT}`
  ctx.fillText(index, x + pad, y + h * INDEX_BASELINE)
  ctx.font = `700 ${smallFontSize}px ${CARD_FONT}`
  ctx.fillText(index, x + w - pad - ctx.measureText(index).width, y + h * 0.94)

  ctx.restore()
}

// A face-down card's back: dark, striped across.
export function drawCardBack(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const { x, y, w, h } = rect

  ctx.save()
  roundedCardPath(ctx, rect)
  ctx.fillStyle = '#12495a'
  ctx.fill()
  ctx.strokeStyle = '#6dd4b8'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  const patternCount = Math.max(4, Math.floor(h / 15))
  for (let row = 0; row < patternCount; row += 1) {
    ctx.fillRect(x + 8, y + 10 + row * (h / patternCount), w - 16, 5)
  }

  ctx.restore()
}

// Where a card can go and none is: a dashed outline, with an optional label in its top-left.
export function drawEmptySlot(ctx: CanvasRenderingContext2D, rect: Rect, label = ''): void {
  const { x, y, w, h } = rect

  ctx.save()
  ctx.strokeStyle = 'rgba(196, 246, 232, 0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 6])
  ctx.strokeRect(x, y, w, h)
  ctx.setLineDash([])

  if (label) {
    ctx.fillStyle = 'rgba(196, 246, 232, 0.7)'
    ctx.font = `600 ${Math.max(18, 26 * scaleOf(rect))}px ${CARD_FONT}`
    ctx.fillText(label, x + w * 0.1, y + h * 0.35)
  }

  ctx.restore()
}
