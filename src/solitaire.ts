import {
  type Card,
  type Suit,
  type Layout,
  type Source,
  suits,
  rankLabels,
  suitLabels,
  INDEX_BASELINE,
  cardColor,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  validateDraggedRun,
  revealLast,
  foundationTotal,
  buildDeck,
  dealFromDeck,
  getResponsiveScale,
  scaledLayout,
  pileX,
  tableauCardPositions,
  pointInRect,
  drawStock,
  autoPlayToFoundation,
  sendTableauTopToFoundation,
  sendWasteToFoundationAuto,
  returnToSource,
} from './solitaire-rules'

// onPointerDown calls preventDefault, which can suppress the compatibility dblclick event, so a
// double-click is recognised from the pointer stream: two presses close together in time and place.
const DOUBLE_CLICK_MS = 350
const DOUBLE_CLICK_SLOP = 10

// Trebuchet first for the rank digits; the symbol fonts back it up wherever it lacks a suit pip.
const CARD_FONT = '"Trebuchet MS", "Apple Symbols", "Segoe UI Symbol", sans-serif'

type DragState = {
  cards: Card[]
  source: Source
  x: number
  y: number
  offsetX: number
  offsetY: number
}

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
  let lastPress: { x: number; y: number; time: number } | null = null

  // Single scaled layout, recomputed from container width; render AND hit-testing read from it.
  let layout: Layout = scaledLayout(getResponsiveScale(container.clientWidth))

  function updateCanvasSize(): void {
    layout = scaledLayout(getResponsiveScale(container.clientWidth))

    const containerWidth = container.clientWidth - 16
    const boardWidth = layout.gapTop + 7 * layout.cardW + 6 * layout.gapX + layout.gapTop
    const tallestTableauHeight = tableau.reduce((tallest, column) => {
      const positions = tableauCardPositions(column, layout)
      const columnHeight = positions.length === 0 ? 0 : positions[positions.length - 1] + layout.cardH
      return Math.max(tallest, columnHeight)
    }, layout.tableauY + layout.cardH)
    const boardHeight = Math.max(layout.tableauY + layout.cardH * 2 + 20, tallestTableauHeight + layout.gapTop)
    canvas.width = Math.ceil(Math.max(boardWidth, containerWidth))
    canvas.height = Math.ceil(boardHeight)
  }

  updateCanvasSize()
  window.addEventListener('resize', () => {
    updateCanvasSize()
    draw()
  })

  const rect = () => canvas.getBoundingClientRect()

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

  function dealNewGame(): void {
    const dealt = dealFromDeck(shuffle(buildDeck()))

    stock = dealt.stock
    waste = []
    foundations = {
      hearts: [],
      diamonds: [],
      clubs: [],
      spades: [],
    }
    tableau = dealt.tableau
    drag = null

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

  function stockRect() {
    return { x: pileX(0, layout), y: layout.gapTop, w: layout.cardW, h: layout.cardH }
  }

  function wasteRect() {
    return { x: pileX(1, layout), y: layout.gapTop, w: layout.cardW, h: layout.cardH }
  }

  function foundationRect(suitIndex: number) {
    return { x: pileX(3 + suitIndex, layout), y: layout.gapTop, w: layout.cardW, h: layout.cardH }
  }

  function drawSlot(x: number, y: number, label = ''): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(196, 246, 232, 0.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 6])
    ctx.strokeRect(x, y, layout.cardW, layout.cardH)
    ctx.setLineDash([])

    if (label) {
      ctx.fillStyle = 'rgba(196, 246, 232, 0.7)'
      ctx.font = `600 ${Math.max(18, 26 * layout.scale)}px ${CARD_FONT}`
      ctx.fillText(label, x + layout.cardW * 0.1, y + layout.cardH * 0.35)
    }

    ctx.restore()
  }

  function drawCard(card: Card, x: number, y: number): void {
    const radius = 10 * layout.scale

    ctx.save()

    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + layout.cardW, y, x + layout.cardW, y + layout.cardH, radius)
    ctx.arcTo(x + layout.cardW, y + layout.cardH, x, y + layout.cardH, radius)
    ctx.arcTo(x, y + layout.cardH, x, y, radius)
    ctx.arcTo(x, y, x + layout.cardW, y, radius)
    ctx.closePath()

    if (!card.faceUp) {
      ctx.fillStyle = '#12495a'
      ctx.fill()
      ctx.strokeStyle = '#6dd4b8'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      const patternCount = Math.max(4, Math.floor(layout.cardH / 15))
      for (let row = 0; row < patternCount; row += 1) {
        ctx.fillRect(x + 8, y + 10 + row * (layout.cardH / patternCount), layout.cardW - 16, 5)
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
      const fontSize = Math.max(20, 40 * layout.scale)
      const smallFontSize = fontSize * 0.85
      // At this size a two-glyph label ("10♥") nearly spans the card, so the corners are padded by a
      // fixed inset and the lower index is right-aligned by measurement rather than a fraction of the width.
      const pad = layout.cardW * 0.06

      ctx.font = `700 ${fontSize}px ${CARD_FONT}`
      ctx.fillText(label, x + pad, y + layout.cardH * INDEX_BASELINE)
      ctx.font = `700 ${smallFontSize}px ${CARD_FONT}`
      ctx.fillText(label, x + layout.cardW - pad - ctx.measureText(label).width, y + layout.cardH * 0.94)
    }

    ctx.restore()
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
      // feat-003/AC-14: scaled drag anchor so the lifted card sits under the pointer at any scale.
      offsetX: layout.cardW / 2,
      offsetY: layout.cardH / 2,
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
      offsetX: pointX - pileX(col, layout),
      offsetY: pointY - tableauCardPositions([...column, ...cards], layout)[index],
    }
  }

  function returnDragToSource(): void {
    if (!drag) {
      return
    }

    returnToSource(drag.cards, drag.source, waste, tableau)
    drag = null
  }

  function tryDropDrag(pointX: number, pointY: number): void {
    if (!drag) {
      return
    }

    const movingTop = drag.cards[0]
    const source = drag.source

    // feat-003/AC-8 (gap-003): when a run leaves a tableau column for another pile, flip the card it
    // exposed underneath. Skip when the cards land back on their own column (nothing net-exposed).
    const revealExposedSource = (destCol: number | null): void => {
      if (source.kind === 'tableau' && source.col !== destCol) {
        revealLast(tableau[source.col])
      }
    }

    for (let foundationIndex = 0; foundationIndex < suits.length; foundationIndex += 1) {
      const suit = suits[foundationIndex]
      const slot = foundationRect(foundationIndex)

      if (pointInRect(pointX, pointY, slot) && drag.cards.length === 1 && canPlaceOnFoundation(foundations[suit], movingTop)) {
        foundations[suit].push(movingTop)
        drag = null
        revealExposedSource(null)
        checkWin()
        draw()
        return
      }
    }

    for (let col = 0; col < tableau.length; col += 1) {
      const x = pileX(col, layout)
      const column = tableau[col]
      const ys = tableauCardPositions(column, layout)
      // feat-003/AC-4 + AC-14 (gap-002): hit-test in SCALED coordinates so drop targeting tracks the
      // drawn card positions at every responsive scale, not only at scale 1.
      const bottomY = ys.length === 0 ? layout.tableauY + layout.cardH : ys[ys.length - 1] + layout.cardH
      const insideColumn = pointX >= x && pointX <= x + layout.cardW && pointY >= layout.tableauY && pointY <= bottomY + layout.faceupShift

      if (insideColumn && canPlaceOnTableau(column, movingTop)) {
        column.push(...drag.cards)
        drag = null
        revealExposedSource(col)
        draw()
        return
      }
    }

    returnDragToSource()
    draw()
  }

  // Double-click on a column's exposed card sends it to a foundation if one will take it. Returns
  // whether it handled the press, so a miss falls through to the normal pick-up path.
  function sendExposedCardHome(pointX: number, pointY: number): boolean {
    if (pointInRect(pointX, pointY, wasteRect()) && waste.length > 0) {
      if (sendWasteToFoundationAuto(foundations, waste) === null) {
        return false
      }

      checkWin()
      draw()
      return true
    }

    for (let col = 0; col < tableau.length; col += 1) {
      const column = tableau[col]
      const index = column.length - 1

      if (index < 0) {
        continue
      }

      const shape = {
        x: pileX(col, layout),
        y: tableauCardPositions(column, layout)[index],
        w: layout.cardW,
        h: layout.cardH,
      }

      if (!pointInRect(pointX, pointY, shape)) {
        continue
      }

      if (sendTableauTopToFoundation(foundations, tableau, col) === null) {
        return false
      }

      checkWin()
      draw()
      return true
    }

    return false
  }

  function checkWin(): void {
    if (foundationTotal(foundations) === 52) {
      status.textContent = 'You won. Nice run!'
    }
  }

  function onPointerDown(event: PointerEvent): void {
    event.preventDefault()
    const point = canvasPointFromPointer(event)

    if (drag) {
      return
    }

    const isSecondPress =
      lastPress !== null &&
      event.timeStamp - lastPress.time <= DOUBLE_CLICK_MS &&
      Math.abs(point.x - lastPress.x) <= DOUBLE_CLICK_SLOP &&
      Math.abs(point.y - lastPress.y) <= DOUBLE_CLICK_SLOP

    lastPress = { x: point.x, y: point.y, time: event.timeStamp }

    // The first press of the pair lifted this card and its pointerup put it straight back, so the
    // column is intact by the time the second press arrives.
    if (isSecondPress && sendExposedCardHome(point.x, point.y)) {
      lastPress = null
      return
    }

    canvas.setPointerCapture(event.pointerId)

    const stockArea = stockRect()

    if (pointInRect(point.x, point.y, stockArea)) {
      drawStock(stock, waste)
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

      if (autoPlayToFoundation(foundations, waste, tableau, suit) !== null) {
        draw()
        checkWin()
        return
      }
    }

    for (let col = 0; col < tableau.length; col += 1) {
      const x = pileX(col, layout)
      const column = tableau[col]
      const positions = tableauCardPositions(column, layout)

      for (let index = column.length - 1; index >= 0; index -= 1) {
        const y = positions[index]

        // feat-003/AC-4 + AC-14 (gap-002): scaled pickup hit-test, matching the drawn card rect.
        if (!pointInRect(point.x, point.y, { x, y, w: layout.cardW, h: layout.cardH })) {
          continue
        }

        // feat-003/AC-7: clicking a face-down top card flips it face-up.
        if (index === column.length - 1 && !column[index].faceUp) {
          revealLast(column)
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
      const x = pileX(col, layout)
      const column = tableau[col]
      const positions = tableauCardPositions(column, layout)

      if (column.length === 0) {
        drawSlot(x, layout.tableauY)
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
      // feat-003/AC-3 (gap-001): foundations are not suit-locked — any Ace starts any empty
      // foundation — so an empty slot shows a generic build hint, never a fixed suit label.
      drawSlot(slot.x, slot.y, 'A-K')

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
      drawCard(card, baseX, baseY + index * layout.faceupShift)
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
