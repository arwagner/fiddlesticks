// Twisted Ropes - throwaway prototype.
//
// The rule we are testing: every rope slopes evenly between the heights of its
// two posts. Where two ropes cross, the locally higher one lies on top. A rope
// that lies on top at EVERY crossing can be lifted clear, so it leaves the
// board. Ropes have a fixed length, so you cannot route one around the outside.
//
// No tests and no logic/view split on purpose. This exists to be played and
// then rewritten. See the grilling session that produced it.

const BOARD = 640
const CX = BOARD / 2
const CY = BOARD / 2
const RING = 246

const NODES = 36
const LAST = NODES - 1

const GRAB = 26
const SNAP = 46
const GAP = 10
const POSTS_PER_ROPE = 3

// The fixed test board: a GRID x GRID pegboard, row 1 at the top, column 1 at
// the left. It exists to make the mechanic inspectable, not to be a good puzzle.
const GRID = 12
const MARGIN = 64
const RELAX_DRAG = 10
const RELAX_SETTLE = 40

const MIN_ROPES = 3
const MAX_ROPES = 8

type Pt = { x: number; y: number }
type Post = Pt & { h: number }
type Rope = { pa: Post; pb: Post; pts: Pt[]; seg: number; hue: number }
// `grid` is 0 for a random ring board, or the side length of the pegboard for
// the fixed test board. Layout, post size, and snap distance all key off it.
type Board = { posts: Post[]; ropes: Rope[]; grid: number }

// `f` is a fractional node index into a rope's `pts`, so 4.5 is halfway along
// the fifth segment. Height and arc length are both looked up from it.
type Cross = { f: number; over: boolean }
type Sample = Pt & { f: number }

function cumulative(pts: Pt[]): number[] {
  const cum = [0]

  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }

  return cum
}

function arcOf(cum: number[], f: number): number {
  const i = Math.min(Math.max(Math.floor(f), 0), cum.length - 2)

  return cum[i] + (cum[i + 1] - cum[i]) * (f - i)
}

function sampleAt(pts: Pt[], cum: number[], s: number): Sample {
  let i = 0

  while (i < cum.length - 2 && cum[i + 1] < s) {
    i += 1
  }

  const span = cum[i + 1] - cum[i] || 1e-6
  const t = Math.min(Math.max((s - cum[i]) / span, 0), 1)

  return {
    x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
    y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
    f: i + t,
  }
}

function sliceRange(pts: Pt[], cum: number[], s0: number, s1: number): Sample[] {
  const out: Sample[] = [sampleAt(pts, cum, s0)]

  for (let i = 0; i < pts.length; i += 1) {
    if (cum[i] > s0 && cum[i] < s1) {
      out.push({ x: pts[i].x, y: pts[i].y, f: i })
    }
  }

  out.push(sampleAt(pts, cum, s1))

  return out
}

function resample(dense: Pt[], count: number): Pt[] {
  const cum = cumulative(dense)
  const total = cum[cum.length - 1]
  const out: Pt[] = []

  for (let i = 0; i < count; i += 1) {
    const point = sampleAt(dense, cum, (total * i) / (count - 1))

    out.push({ x: point.x, y: point.y })
  }

  return out
}

function segCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): { t: number; u: number } | null {
  const rx = p2.x - p1.x
  const ry = p2.y - p1.y
  const sx = p4.x - p3.x
  const sy = p4.y - p3.y
  const d = rx * sy - ry * sx

  if (Math.abs(d) < 1e-9) {
    return null
  }

  const qx = p3.x - p1.x
  const qy = p3.y - p1.y
  const t = (qx * sy - qy * sx) / d
  const u = (qx * ry - qy * rx) / d

  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null
  }

  return { t, u }
}

function heightAt(rope: Rope, f: number): number {
  return rope.pa.h + (rope.pb.h - rope.pa.h) * (f / LAST)
}

function crossingsOf(ropes: Rope[]): Cross[][] {
  const out: Cross[][] = ropes.map(() => [])

  for (let i = 0; i < ropes.length; i += 1) {
    for (let j = i + 1; j < ropes.length; j += 1) {
      const r = ropes[i]
      const s = ropes[j]

      for (let a = 0; a < LAST; a += 1) {
        for (let b = 0; b < LAST; b += 1) {
          const hit = segCross(r.pts[a], r.pts[a + 1], s.pts[b], s.pts[b + 1])

          if (!hit) {
            continue
          }

          const fr = a + hit.t
          const fs = b + hit.u
          const zr = heightAt(r, fr)
          const zs = heightAt(s, fs)

          out[i].push({ f: fr, over: zr > zs })
          out[j].push({ f: fs, over: zs >= zr })
        }
      }
    }
  }

  return out
}

function constrain(pts: Pt[], i: number, j: number, seg: number): void {
  const pi = pts[i]
  const pj = pts[j]
  const dx = pj.x - pi.x
  const dy = pj.y - pi.y
  const d = Math.hypot(dx, dy) || 1e-6
  const k = (d - seg) / d
  const iPinned = i === 0 || i === LAST
  const jPinned = j === 0 || j === LAST

  if (iPinned && jPinned) {
    return
  }

  const wi = iPinned ? 0 : jPinned ? 1 : 0.5
  const wj = jPinned ? 0 : iPinned ? 1 : 0.5

  pi.x += dx * k * wi
  pi.y += dy * k * wi
  pj.x -= dx * k * wj
  pj.y -= dy * k * wj
}

function relax(rope: Rope, iters: number): void {
  for (let k = 0; k < iters; k += 1) {
    for (let i = 0; i < LAST; i += 1) {
      constrain(rope.pts, i, i + 1, rope.seg)
    }

    for (let i = LAST - 1; i >= 0; i -= 1) {
      constrain(rope.pts, i, i + 1, rope.seg)
    }
  }
}

// `bulgeFrac` is how far the rope bows off the straight line, as a fraction of
// the distance between its posts. It sets the rope's length, and the length is
// what limits how far a dragged end can reach.
function makeRope(
  pa: Post,
  pb: Post,
  hue: number,
  bulgeFrac = (0.16 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1),
): Rope {
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const chord = Math.hypot(dx, dy) || 1
  const bulge = chord * bulgeFrac
  const cx = (pa.x + pb.x) / 2 + (-dy / chord) * bulge
  const cy = (pa.y + pb.y) / 2 + (dx / chord) * bulge
  const dense: Pt[] = []

  for (let i = 0; i <= 240; i += 1) {
    const t = i / 240
    const m = 1 - t

    dense.push({
      x: m * m * pa.x + 2 * m * t * cx + t * t * pb.x,
      y: m * m * pa.y + 2 * m * t * cy + t * t * pb.y,
    })
  }

  const pts = resample(dense, NODES)
  const cum = cumulative(pts)

  return { pa, pb, pts, seg: cum[cum.length - 1] / LAST, hue }
}

// The ring carries three posts per rope, so a third of them are always empty and
// a dragged end has somewhere to go. Posts are laid out so that occupied ones sit
// at index 0 mod 3, their partners at 1 mod 3, and the spares at 2 mod 3. That
// spreads the empty posts evenly around the ring instead of bunching them.
//
// Every rope joins two near-opposite posts, so the chords pass near the middle
// and cross each other. Each rope starts with one high anchor and one low anchor,
// so no rope sits on top of everything before you touch it.
function buildBoard(count: number): Board {
  const posts: Post[] = []
  const ropes: Rope[] = []
  const total = count * POSTS_PER_ROPE
  const span = 3 * Math.floor(count / 2) + 1

  for (let j = 0; j < total; j += 1) {
    const angle = (j / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.12

    posts.push({
      x: CX + Math.cos(angle) * RING,
      y: CY + Math.sin(angle) * RING,
      h: Math.random(),
    })
  }

  for (let j = 0; j < count; j += 1) {
    const pa = posts[3 * j]
    const pb = posts[(3 * j + span) % total]
    const high = 0.58 + Math.random() * 0.42
    const low = Math.random() * 0.42

    if (Math.random() < 0.5) {
      pa.h = high
      pb.h = low
    } else {
      pa.h = low
      pb.h = high
    }

    ropes.push(makeRope(pa, pb, (j * 360) / count + Math.random() * 18))
  }

  return { posts, ropes, grid: 0 }
}

function gridPos(row: number, col: number, grid: number): Pt {
  const step = (BOARD - MARGIN * 2) / (grid - 1)

  return { x: MARGIN + (col - 1) * step, y: MARGIN + (row - 1) * step }
}

function gridSnap(grid: number): number {
  return grid ? ((BOARD - MARGIN * 2) / (grid - 1)) * 0.55 : SNAP
}

// Every hole needs a height, because height is what decides who lies on top.
// You did not say what the heights should be, so the test board ramps them down
// the rows: row 1 is 0, row 12 is 1, and the column does not matter. That makes
// the row label on screen also the height, so you can read the whole board by
// eye. This is a placeholder. Say the word and it becomes anything else.
function gridHeight(row: number): number {
  return (row - 1) / (GRID - 1)
}

// The fixed board: 12 x 12 holes, a red rope from row 1 column 1 to row 7
// column 10, and a green rope from row 1 column 2 to row 12 column 2.
function buildTestBoard(): Board {
  const rows: Post[][] = []
  const posts: Post[] = []

  for (let row = 1; row <= GRID; row += 1) {
    const line: Post[] = []

    for (let col = 1; col <= GRID; col += 1) {
      const at = gridPos(row, col, GRID)
      const post: Post = { x: at.x, y: at.y, h: gridHeight(row) }

      line.push(post)
      posts.push(post)
    }

    rows.push(line)
  }

  const hole = (row: number, col: number): Post => rows[row - 1][col - 1]

  const ropes = [
    makeRope(hole(1, 1), hole(7, 10), 0, 0.32),
    makeRope(hole(1, 2), hole(12, 2), 135, -0.32),
  ]

  return { posts, ropes, grid: GRID }
}

function liftFree(ropes: Rope[]): number {
  let lifted = 0

  for (;;) {
    const crossings = crossingsOf(ropes)
    const idx = crossings.findIndex((list) => list.every((cross) => cross.over))

    if (idx < 0) {
      return lifted
    }

    ropes.splice(idx, 1)
    lifted += 1
  }
}

// Keep rebuilding until the opening board holds most of its ropes. Boards that
// collapse on sight are the generator's fault, not the player's.
function freshBoard(count: number): Board {
  let best: Board = { posts: [], ropes: [], grid: 0 }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const board = buildBoard(count)

    liftFree(board.ropes)

    if (board.ropes.length > best.ropes.length) {
      best = board
    }

    if (best.ropes.length >= Math.max(MIN_ROPES, count - 1)) {
      return best
    }
  }

  return best
}

function isTaken(post: Post, ropes: Rope[]): boolean {
  return ropes.some((rope) => rope.pa === post || rope.pb === post)
}

// A dragged end may only land on an empty post that the rope is long enough to
// reach from its other anchor. Anything else drops it back where it started.
function dropTarget(board: Board, rope: Rope, head: number, at: Pt): Post | null {
  const anchor = head === 0 ? rope.pb : rope.pa
  const reach = rope.seg * LAST * 0.985
  let best: Post | null = null
  let bestDist = gridSnap(board.grid)

  for (const post of board.posts) {
    if (isTaken(post, board.ropes)) {
      continue
    }

    if (Math.hypot(post.x - anchor.x, post.y - anchor.y) > reach) {
      continue
    }

    const d = Math.hypot(post.x - at.x, post.y - at.y)

    if (d < bestDist) {
      bestDist = d
      best = post
    }
  }

  return best
}

export function setupTwistedRopes(container: HTMLElement): void {
  container.innerHTML = `
    <div class="ropes">
      <div class="ropes-toolbar">
        <button id="ropes-test" type="button">Test board</button>
        <button id="ropes-new" type="button">Random board</button>
        <div class="ropes-count" role="group" aria-label="Rope count">
          <button id="ropes-fewer" type="button" aria-label="Fewer ropes">&minus;</button>
          <span id="ropes-count-label">Size: 5</span>
          <button id="ropes-more" type="button" aria-label="More ropes">+</button>
        </div>
        <p id="ropes-status" aria-live="polite"></p>
      </div>
      <canvas id="ropes-canvas" width="${BOARD}" height="${BOARD}" aria-label="Rope board"></canvas>
      <p class="hint">Drag a rope end onto an empty post to re-slope the rope. A rope lifts away once it lies on top at every crossing.</p>
    </div>
  `

  const canvasEl = container.querySelector<HTMLCanvasElement>('#ropes-canvas')
  const statusEl = container.querySelector<HTMLParagraphElement>('#ropes-status')
  const countLabel = container.querySelector<HTMLSpanElement>('#ropes-count-label')
  const newButton = container.querySelector<HTMLButtonElement>('#ropes-new')
  const testButton = container.querySelector<HTMLButtonElement>('#ropes-test')
  const fewerButton = container.querySelector<HTMLButtonElement>('#ropes-fewer')
  const moreButton = container.querySelector<HTMLButtonElement>('#ropes-more')

  if (
    !canvasEl ||
    !statusEl ||
    !countLabel ||
    !newButton ||
    !testButton ||
    !fewerButton ||
    !moreButton
  ) {
    throw new Error('Twisted Ropes UI elements are missing')
  }

  const context = canvasEl.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D context is not available')
  }

  const canvas = canvasEl
  const ctx = context
  const status = statusEl
  const label = countLabel

  let count = 5
  let board: Board = { posts: [], ropes: [], grid: 0 }
  let moves = 0
  let solved = false
  let drag: { rope: Rope; head: number; pointerId: number; from: Pt; moved: boolean } | null = null

  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = BOARD * dpr
  canvas.height = BOARD * dpr
  ctx.scale(dpr, dpr)

  function strokeRange(rope: Rope, cum: number[], s0: number, s1: number): void {
    const pts = sliceRange(rope.pts, cum, s0, s1)

    for (let i = 0; i < pts.length - 1; i += 1) {
      const h = (heightAt(rope, pts[i].f) + heightAt(rope, pts[i + 1].f)) / 2

      ctx.lineWidth = 7 + h * 5
      ctx.strokeStyle = `hsl(${rope.hue} 72% ${42 + h * 24}%)`
      ctx.beginPath()
      ctx.moveTo(pts[i].x, pts[i].y)
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y)
      ctx.stroke()
    }
  }

  function drawShadow(rope: Rope): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'

    for (let i = 0; i < LAST; i += 1) {
      const h = (heightAt(rope, i) + heightAt(rope, i + 1)) / 2
      const off = 4 + h * 16

      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.moveTo(rope.pts[i].x + off, rope.pts[i].y + off)
      ctx.lineTo(rope.pts[i + 1].x + off, rope.pts[i + 1].y + off)
      ctx.stroke()
    }
  }

  // The gaps are the whole point of the 2.5D view: a rope is broken wherever it
  // passes under another, so a still picture tells you what is on top.
  function drawRope(rope: Rope, crossings: Cross[]): void {
    const cum = cumulative(rope.pts)
    const total = cum[cum.length - 1]
    const breaks = crossings
      .filter((cross) => !cross.over)
      .map((cross) => arcOf(cum, cross.f))
      .sort((a, b) => a - b)
    const merged: Array<[number, number]> = []

    for (const at of breaks) {
      const last = merged[merged.length - 1]

      if (last && at - GAP <= last[1]) {
        last[1] = Math.max(last[1], at + GAP)
      } else {
        merged.push([at - GAP, at + GAP])
      }
    }

    let cursor = 0

    for (const [from, to] of merged) {
      if (from > cursor) {
        strokeRange(rope, cum, cursor, Math.min(from, total))
      }

      cursor = Math.max(cursor, to)
    }

    if (cursor < total) {
      strokeRange(rope, cum, cursor, total)
    }
  }

  function postRadius(post: Post): number {
    return (7 + post.h * 6) * (board.grid ? 0.62 : 1)
  }

  function drawPost(rope: Rope, post: Post, held: boolean): void {
    const r = postRadius(post)

    ctx.beginPath()
    ctx.arc(post.x, post.y, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(3, 26, 32, 0.85)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(post.x, post.y, r, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${rope.hue} 72% ${42 + post.h * 24}%)`
    ctx.fill()
    ctx.lineWidth = held ? 3 : 2
    ctx.strokeStyle = held ? '#ffe08a' : 'rgba(217, 255, 242, 0.75)'
    ctx.stroke()
  }

  // An empty post reads as a hollow ring. Its size is its height, so you can
  // pick a landing spot by eye. While you drag, the posts you can actually reach
  // light up and the rest stay dim.
  function drawEmptyPost(post: Post, reachable: boolean): void {
    const r = postRadius(post)

    ctx.beginPath()
    ctx.arc(post.x, post.y, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(3, 26, 32, 0.8)'
    ctx.fill()
    ctx.lineWidth = reachable ? 3 : 1.5
    ctx.strokeStyle = reachable ? '#ffe08a' : 'rgba(154, 235, 213, 0.35)'
    ctx.stroke()
  }

  // Row and column numbers along the top and left edges, so you can name a hole
  // when you tell me what the board did.
  function drawGridLabels(grid: number): void {
    ctx.fillStyle = 'rgba(154, 235, 213, 0.5)'
    ctx.font = '11px "Trebuchet MS", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 1; i <= grid; i += 1) {
      const top = gridPos(1, i, grid)
      const left = gridPos(i, 1, grid)

      ctx.fillText(String(i), top.x, MARGIN - 30)
      ctx.fillText(String(i), MARGIN - 32, left.y)
    }
  }

  function render(): void {
    ctx.clearRect(0, 0, BOARD, BOARD)

    if (board.grid) {
      drawGridLabels(board.grid)
    } else {
      ctx.beginPath()
      ctx.arc(CX, CY, RING, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(154, 235, 213, 0.22)'
      ctx.stroke()
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const ropes = board.ropes
    const held = drag

    for (const post of board.posts) {
      if (isTaken(post, ropes)) {
        continue
      }

      const anchor = held ? (held.head === 0 ? held.rope.pb : held.rope.pa) : null
      const reach = held ? held.rope.seg * LAST * 0.985 : 0
      const reachable =
        anchor !== null && Math.hypot(post.x - anchor.x, post.y - anchor.y) <= reach

      drawEmptyPost(post, reachable)
    }

    for (const rope of ropes) {
      drawShadow(rope)
    }

    const crossings = crossingsOf(ropes)

    ropes.forEach((rope, i) => {
      drawRope(rope, crossings[i])
    })

    for (const rope of ropes) {
      const heldA = held !== null && held.rope === rope && held.head === 0
      const heldB = held !== null && held.rope === rope && held.head === LAST

      drawPost(rope, rope.pa, heldA)
      drawPost(rope, rope.pb, heldB)
    }

    if (solved) {
      status.textContent = `Solved in ${moves} ${moves === 1 ? 'move' : 'moves'}`
    } else {
      status.textContent = `Ropes left: ${ropes.length} · Moves: ${moves}`
    }

    label.textContent = `Size: ${count}`
  }

  function start(next: Board): void {
    board = next
    moves = 0
    solved = board.ropes.length === 0
    drag = null
    render()
  }

  function pointOf(event: PointerEvent): Pt {
    const rect = canvas.getBoundingClientRect()

    return {
      x: ((event.clientX - rect.left) / rect.width) * BOARD,
      y: ((event.clientY - rect.top) / rect.height) * BOARD,
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (solved || drag) {
      return
    }

    const p = pointOf(event)
    let bestDist = GRAB

    for (const rope of board.ropes) {
      for (const head of [0, LAST]) {
        const end = rope.pts[head]
        const d = Math.hypot(end.x - p.x, end.y - p.y)

        if (d < bestDist) {
          bestDist = d
          drag = {
            rope,
            head,
            pointerId: event.pointerId,
            from: { x: end.x, y: end.y },
            moved: false,
          }
        }
      }
    }

    if (drag) {
      canvas.setPointerCapture(event.pointerId)
      render()
    }
  })

  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }

    const p = pointOf(event)
    const rope = drag.rope
    const anchor = rope.pts[drag.head === 0 ? LAST : 0]
    const reach = rope.seg * LAST * 0.985
    const d = Math.hypot(p.x - anchor.x, p.y - anchor.y)
    const scale = d > reach ? reach / d : 1

    rope.pts[drag.head] = {
      x: anchor.x + (p.x - anchor.x) * scale,
      y: anchor.y + (p.y - anchor.y) * scale,
    }

    if (Math.hypot(p.x - drag.from.x, p.y - drag.from.y) > 3) {
      drag.moved = true
    }

    relax(rope, RELAX_DRAG)
    render()
  })

  function endDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }

    const rope = drag.rope
    const head = drag.head
    const counted = drag.moved
    const landing = counted ? dropTarget(board, rope, head, rope.pts[head]) : null

    // Land on an empty post and the rope takes that post's height, which is what
    // re-slopes it. Land anywhere else and the end goes back where it started.
    if (landing) {
      if (head === 0) {
        rope.pa = landing
      } else {
        rope.pb = landing
      }
    }

    const post = head === 0 ? rope.pa : rope.pb

    rope.pts[head] = { x: post.x, y: post.y }
    relax(rope, RELAX_SETTLE)
    drag = null

    // A tap on a post that never moved is not a move.
    if (counted) {
      moves += 1
      liftFree(board.ropes)
      solved = board.ropes.length === 0
    }

    render()
  }

  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)

  testButton.addEventListener('click', () => {
    start(buildTestBoard())
  })

  newButton.addEventListener('click', () => {
    start(freshBoard(count))
  })

  fewerButton.addEventListener('click', () => {
    count = Math.max(MIN_ROPES, count - 1)
    start(freshBoard(count))
  })

  moreButton.addEventListener('click', () => {
    count = Math.min(MAX_ROPES, count + 1)
    start(freshBoard(count))
  })

  start(buildTestBoard())
}
