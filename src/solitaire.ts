type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

type Card = {
  id: string
  suit: Suit
  rank: number
  faceUp: boolean
}

type Source =
  | { kind: 'waste' }
  | { kind: 'tableau'; col: number; index: number }

type DragState = {
  cards: Card[]
  source: Source
  x: number
  y: number
  offsetX: number
  offsetY: number
}

const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const rankLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const suitLabels: Record<Suit, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
}

const CARD_W = 86
const CARD_H = 120
const GAP_X = 18
const GAP_TOP = 24
const TABLEAU_Y = 172
const FACEDOWN_SHIFT = 12
const FACEUP_SHIFT = 28

export function setupSolitaire(container: HTMLElement): void {
  container.innerHTML = `
    <div class="solitaire-toolbar">
      <button id="restart-solitaire" type="button">Restart</button>
      <p id="solitaire-status" aria-live="polite">Build all 4 foundations from Ace to King.</p>
    </div>
    <canvas id="solitaire-canvas" aria-label="Solitaire board"></canvas>
  `

  const canvasElement = container.querySelector<HTMLCanvasElement>('#solitaire-canvas')
  const statusElement = container.querySelector<HTMLParagraphElement>('#solitaire-status')
  const restartButtonElement = container.querySelector<HTMLButtonElement>('#restart-solitaire')

  if (!canvasElement || !statusElement || !restartButtonElement) {
    throw new Error('Solitaire UI elements are missing')
  }

  const context = canvasElement.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context is not available')
  }

  const canvas = canvasElement
  const status = statusElement
  const restartButton = restartButtonElement
  const ctx = context

  let stock: Card[] = []
  let waste: Card[] = []
  let foundations: Record<Suit, Card[]> = {
    hearts: [],
    diamonds: [],
    clubs: [],
    spades: [],
  }
  let tableau: Card[][] = [[], [], [], [], [], [], []]
  let drag: DragState | null = null

  // Calculate responsive scale based on container width
  function getResponsiveScale(): number {
    const containerWidth = container.clientWidth - 16 // subtract padding margin
    const minimumNeededWidth = GAP_TOP + (7 * CARD_W) + (6 * GAP_X) + GAP_TOP
    return Math.max(0.5, containerWidth / minimumNeededWidth)
  }

  let scale = getResponsiveScale()
  let scaledCardW = CARD_W * scale
  let scaledCardH = CARD_H * scale
  let scaledGapX = GAP_X * scale
  let scaledGapTop = GAP_TOP * scale
  let scaledTableauY = TABLEAU_Y * scale
  let scaledFacedownShift = FACEDOWN_SHIFT * scale
  let scaledFaceupShift = FACEUP_SHIFT * scale

  // Set canvas size based on scaled dimensions
  function updateCanvasSize(): void {
    scale = getResponsiveScale()
    scaledCardW = CARD_W * scale
    scaledCardH = CARD_H * scale
    scaledGapX = GAP_X * scale
    scaledGapTop = GAP_TOP * scale
    scaledTableauY = TABLEAU_Y * scale
    scaledFacedownShift = FACEDOWN_SHIFT * scale
    scaledFaceupShift = FACEUP_SHIFT * scale

    const containerWidth = container.clientWidth - 16
    const boardWidth = scaledGapTop + (7 * scaledCardW) + (6 * scaledGapX) + scaledGapTop
    const tallestTableauHeight = tableau.reduce((tallest, column) => {
      const positions = tableauCardPositions(column)
      const columnHeight = positions.length === 0 ? 0 : positions[positions.length - 1] + scaledCardH
      return Math.max(tallest, columnHeight)
    }, scaledTableauY + scaledCardH)
    const boardHeight = Math.max(scaledTableauY + (scaledCardH * 2) + 20, tallestTableauHeight + scaledGapTop)
    canvas.width = Math.ceil(Math.max(boardWidth, containerWidth))
    canvas.height = Math.ceil(boardHeight)
  }

  updateCanvasSize()
  window.addEventListener('resize', () => {
    updateCanvasSize()
    draw()
  })

  const rect = () => canvas.getBoundingClientRect()

  function cardColor(card: Card): 'red' | 'black' {
    return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'
  }

  function shuffle<T>(values: T[]): T[] {
    const next = [...values]

    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      const current = next[index]
      next[index] = next[randomIndex]
      next[randomIndex] = current
    }

    return next
  }

  function createDeck(): Card[] {
    return shuffle(
      suits.flatMap((suit) =>
        Array.from({ length: 13 }, (_, rankIndex) => ({
          id: `${suit}-${rankIndex + 1}-${Math.random().toString(36).slice(2, 8)}`,
          suit,
          rank: rankIndex + 1,
          faceUp: false,
        })),
      ),
    )
  }

  function dealNewGame(): void {
    const deck = createDeck()

    stock = []
    waste = []
    foundations = {
      hearts: [],
      diamonds: [],
      clubs: [],
      spades: [],
    }
    tableau = [[], [], [], [], [], [], []]
    drag = null

    for (let col = 0; col < 7; col += 1) {
      for (let row = 0; row <= col; row += 1) {
        const card = deck.pop()

        if (!card) {
          throw new Error('Deck underflow while dealing')
        }

        card.faceUp = row === col
        tableau[col].push(card)
      }
    }

    stock = deck
    status.textContent = 'Build all 4 foundations from Ace to King.'
    draw()
  }

  function canvasPointFromPointer(event: PointerEvent): { x: number; y: number } {
    const bounds = rect()
    const scaleX = canvas.width / bounds.width
    const scaleY = canvas.height / bounds.height

    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    }
  }

  function pileX(index: number): number {
    return scaledGapTop + index * (scaledCardW + scaledGapX)
  }

  function stockRect() {
    return { x: pileX(0), y: scaledGapTop, w: scaledCardW, h: scaledCardH }
  }

  function wasteRect() {
    return { x: pileX(1), y: scaledGapTop, w: scaledCardW, h: scaledCardH }
  }

  function foundationRect(suitIndex: number) {
    return { x: pileX(3 + suitIndex), y: scaledGapTop, w: scaledCardW, h: scaledCardH }
  }

  function tableauCardPositions(column: Card[]): number[] {
    return column.map((_, index) => {
      if (index === 0) {
        return scaledTableauY
      }

      let y = scaledTableauY

      for (let cursor = 0; cursor < index; cursor += 1) {
        y += column[cursor].faceUp ? scaledFaceupShift : scaledFacedownShift
      }

      return y
    })
  }

  function pointInRect(x: number, y: number, shape: { x: number; y: number; w: number; h: number }): boolean {
    return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h
  }

  function drawSlot(x: number, y: number, label = ''): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(196, 246, 232, 0.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 6])
    ctx.strokeRect(x, y, scaledCardW, scaledCardH)
    ctx.setLineDash([])

    if (label) {
      ctx.fillStyle = 'rgba(196, 246, 232, 0.7)'
      ctx.font = `600 ${Math.max(9, 13 * scale)}px Trebuchet MS`
      ctx.fillText(label, x + scaledCardW * 0.1, y + scaledCardH * 0.3)
    }

    ctx.restore()
  }

  function drawCard(card: Card, x: number, y: number): void {
    const radius = 10 * scale

    ctx.save()

    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + scaledCardW, y, x + scaledCardW, y + scaledCardH, radius)
    ctx.arcTo(x + scaledCardW, y + scaledCardH, x, y + scaledCardH, radius)
    ctx.arcTo(x, y + scaledCardH, x, y, radius)
    ctx.arcTo(x, y, x + scaledCardW, y, radius)
    ctx.closePath()

    if (!card.faceUp) {
      ctx.fillStyle = '#12495a'
      ctx.fill()
      ctx.strokeStyle = '#6dd4b8'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      const patternCount = Math.max(4, Math.floor(scaledCardH / 15))
      for (let row = 0; row < patternCount; row += 1) {
        ctx.fillRect(x + 8, y + 10 + row * (scaledCardH / patternCount), scaledCardW - 16, 5)
      }
    } else {
      ctx.fillStyle = '#f3fff8'
      ctx.fill()
      ctx.strokeStyle = '#bdd8cd'
      ctx.lineWidth = 1.5
      ctx.stroke()

      const color = cardColor(card) === 'red' ? '#cf3d48' : '#1f2d3a'
      const label = `${rankLabels[card.rank - 1]}${suitLabels[card.suit]}`

      ctx.fillStyle = color
      const fontSize = Math.max(10, 20 * scale)
      const smallFontSize = fontSize * 0.85
      ctx.font = `700 ${fontSize}px Trebuchet MS`
      ctx.fillText(label, x + scaledCardW * 0.1, y + scaledCardH * 0.2)
      ctx.font = `700 ${smallFontSize}px Trebuchet MS`
      ctx.fillText(label, x + scaledCardW * 0.6, y + scaledCardH * 0.95)
    }

    ctx.restore()
  }

  function canPlaceOnFoundation(card: Card, suit: Suit): boolean {
    const pile = foundations[suit]

    if (pile.length === 0) {
      return card.rank === 1
    }

    const top = pile[pile.length - 1]
    return top.suit === card.suit && card.rank === top.rank + 1
  }

  function canPlaceOnTableau(card: Card, column: Card[]): boolean {
    const top = column[column.length - 1]

    if (!top) {
      return card.rank === 13
    }

    if (!top.faceUp) {
      return false
    }

    return cardColor(card) !== cardColor(top) && card.rank === top.rank - 1
  }

  function revealLastInTableau(column: Card[]): void {
    const top = column[column.length - 1]

    if (top && !top.faceUp) {
      top.faceUp = true
    }
  }

  function moveWasteToFoundation(suit: Suit): boolean {
    const card = waste[waste.length - 1]

    if (!card || !canPlaceOnFoundation(card, suit)) {
      return false
    }

    waste.pop()
    foundations[suit].push(card)
    return true
  }

  function moveTableauToFoundation(col: number, suit: Suit): boolean {
    const column = tableau[col]
    const card = column[column.length - 1]

    if (!card || !card.faceUp || !canPlaceOnFoundation(card, suit)) {
      return false
    }

    column.pop()
    foundations[suit].push(card)
    revealLastInTableau(column)
    return true
  }

  function recycleWaste(): void {
    if (waste.length === 0) {
      return
    }

    while (waste.length > 0) {
      const card = waste.pop()

      if (!card) {
        break
      }

      card.faceUp = false
      stock.push(card)
    }
  }

  function drawFromStock(): void {
    const card = stock.pop()

    if (!card) {
      recycleWaste()
      return
    }

    card.faceUp = true
    waste.push(card)
  }

  function validateDraggedRun(cards: Card[]): boolean {
    if (cards.length <= 1) {
      return true
    }

    for (let index = 1; index < cards.length; index += 1) {
      const prev = cards[index - 1]
      const current = cards[index]

      if (cardColor(prev) === cardColor(current) || prev.rank !== current.rank + 1) {
        return false
      }
    }

    return true
  }

  function startDragFromWaste(pointX: number, pointY: number): void {
    const card = waste[waste.length - 1]

    if (!card) {
      return
    }

    waste.pop()
    drag = {
      cards: [card],
      source: { kind: 'waste' },
      x: pointX,
      y: pointY,
      offsetX: CARD_W / 2,
      offsetY: CARD_H / 2,
    }
  }

  function startDragFromTableau(col: number, index: number, pointX: number, pointY: number): void {
    const column = tableau[col]
    const cards = column.slice(index)

    if (cards.length === 0 || !cards[0].faceUp || !validateDraggedRun(cards)) {
      return
    }

    column.splice(index)

    drag = {
      cards,
      source: { kind: 'tableau', col, index },
      x: pointX,
      y: pointY,
      offsetX: pointX - pileX(col),
      offsetY: pointY - tableauCardPositions([...column, ...cards])[index],
    }
  }

  function returnDragToSource(): void {
    if (!drag) {
      return
    }

    if (drag.source.kind === 'waste') {
      waste.push(...drag.cards)
    } else {
      tableau[drag.source.col].push(...drag.cards)
    }

    drag = null
  }

  function tryDropDrag(pointX: number, pointY: number): void {
    if (!drag) {
      return
    }

    const movingTop = drag.cards[0]

    for (let foundationIndex = 0; foundationIndex < suits.length; foundationIndex += 1) {
      const suit = suits[foundationIndex]
      const slot = foundationRect(foundationIndex)

      if (pointInRect(pointX, pointY, slot) && drag.cards.length === 1 && canPlaceOnFoundation(movingTop, suit)) {
        foundations[suit].push(movingTop)
        drag = null
        checkWin()
        draw()
        return
      }
    }

    for (let col = 0; col < tableau.length; col += 1) {
      const x = pileX(col)
      const column = tableau[col]
      const ys = tableauCardPositions(column)
      const bottomY = ys.length === 0 ? TABLEAU_Y + CARD_H : ys[ys.length - 1] + CARD_H
      const insideColumn = pointX >= x && pointX <= x + CARD_W && pointY >= TABLEAU_Y && pointY <= bottomY + FACEUP_SHIFT

      if (insideColumn && canPlaceOnTableau(movingTop, column)) {
        column.push(...drag.cards)
        drag = null
        draw()
        return
      }
    }

    returnDragToSource()
    draw()
  }

  function checkWin(): void {
    const totalInFoundations = suits.reduce((total, suit) => total + foundations[suit].length, 0)

    if (totalInFoundations === 52) {
      status.textContent = 'You won. Nice run!'
    }
  }

  function onPointerDown(event: PointerEvent): void {
    event.preventDefault()
    const point = canvasPointFromPointer(event)

    if (drag) {
      return
    }

    canvas.setPointerCapture(event.pointerId)

    const stockArea = stockRect()

    if (pointInRect(point.x, point.y, stockArea)) {
      drawFromStock()
      draw()
      return
    }

    const wasteArea = wasteRect()

    if (pointInRect(point.x, point.y, wasteArea) && waste.length > 0) {
      startDragFromWaste(point.x, point.y)
      draw()
      return
    }

    for (let foundationIndex = 0; foundationIndex < suits.length; foundationIndex += 1) {
      const suit = suits[foundationIndex]
      const slot = foundationRect(foundationIndex)

      if (!pointInRect(point.x, point.y, slot)) {
        continue
      }

      if (moveWasteToFoundation(suit)) {
        draw()
        checkWin()
        return
      }

      for (let col = 0; col < tableau.length; col += 1) {
        if (moveTableauToFoundation(col, suit)) {
          draw()
          checkWin()
          return
        }
      }
    }

    for (let col = 0; col < tableau.length; col += 1) {
      const x = pileX(col)
      const column = tableau[col]
      const positions = tableauCardPositions(column)

      for (let index = column.length - 1; index >= 0; index -= 1) {
        const y = positions[index]

        if (!pointInRect(point.x, point.y, { x, y, w: CARD_W, h: CARD_H })) {
          continue
        }

        if (index === column.length - 1 && !column[index].faceUp) {
          column[index].faceUp = true
          draw()
          return
        }

        startDragFromTableau(col, index, point.x, point.y)
        draw()
        return
      }
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!drag) {
      return
    }

    const point = canvasPointFromPointer(event)
    drag.x = point.x
    drag.y = point.y
    draw()
  }

  function onPointerUp(event: PointerEvent): void {
    if (!drag) {
      return
    }

    const point = canvasPointFromPointer(event)
    tryDropDrag(point.x, point.y)

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }

  function drawTableau(): void {
    for (let col = 0; col < tableau.length; col += 1) {
      const x = pileX(col)
      const column = tableau[col]
      const positions = tableauCardPositions(column)

      if (column.length === 0) {
        drawSlot(x, scaledTableauY)
        continue
      }

      for (let index = 0; index < column.length; index += 1) {
        drawCard(column[index], x, positions[index])
      }
    }
  }

  function drawFoundationsAndTopRow(): void {
    const stockArea = stockRect()
    const wasteArea = wasteRect()

    drawSlot(stockArea.x, stockArea.y, 'Stock')
    drawSlot(wasteArea.x, wasteArea.y, 'Waste')

    if (stock.length > 0) {
      const top = stock[stock.length - 1]
      drawCard(top, stockArea.x, stockArea.y)
    }

    if (waste.length > 0) {
      drawCard(waste[waste.length - 1], wasteArea.x, wasteArea.y)
    }

    for (let suitIndex = 0; suitIndex < suits.length; suitIndex += 1) {
      const suit = suits[suitIndex]
      const slot = foundationRect(suitIndex)
      drawSlot(slot.x, slot.y, suitLabels[suit])

      const top = foundations[suit][foundations[suit].length - 1]
      if (top) {
        drawCard(top, slot.x, slot.y)
      }
    }
  }

  function drawDragLayer(): void {
    if (!drag) {
      return
    }

    const baseX = drag.x - drag.offsetX
    const baseY = drag.y - drag.offsetY

    drag.cards.forEach((card, index) => {
      drawCard(card, baseX, baseY + index * scaledFaceupShift)
    })
  }

  function draw(): void {
    updateCanvasSize()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawFoundationsAndTopRow()
    drawTableau()
    drawDragLayer()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', (event) => {
    if (!drag) {
      return
    }

    returnDragToSource()
    draw()

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  })

  restartButton.addEventListener('click', dealNewGame)
  dealNewGame()
}
