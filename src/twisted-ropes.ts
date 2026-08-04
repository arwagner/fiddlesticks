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
const GAP = 10
const RELAX_DRAG = 10
const RELAX_SETTLE = 40

const MIN_ROPES = 3
const MAX_ROPES = 8

type Pt = { x: number; y: number }
type Post = Pt & { h: number }
type Rope = { pa: Post; pb: Post; pts: Pt[]; seg: number; hue: number }

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

function makeRope(pa: Post, pb: Post, hue: number): Rope {
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const chord = Math.hypot(dx, dy) || 1
  const bulge = chord * (0.16 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1)
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

// Posts sit on a ring and every rope joins two opposite posts, so the chords all
// pass near the middle and cross each other. Each rope gets one high anchor and
// one low anchor, so no rope sits on top of everything by default.
function buildBoard(count: number): Rope[] {
  const posts: Post[] = []
  const ropes: Rope[] = []
  const total = count * 2

  for (let j = 0; j < total; j += 1) {
    const angle = (j / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.2

    posts.push({ x: CX + Math.cos(angle) * RING, y: CY + Math.sin(angle) * RING, h: 0 })
  }

  for (let j = 0; j < count; j += 1) {
    const pa = posts[j]
    const pb = posts[j + count]
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

  return ropes
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
function freshBoard(count: number): Rope[] {
  let best: Rope[] = []

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const ropes = buildBoard(count)

    liftFree(ropes)

    if (ropes.length > best.length) {
      best = ropes
    }

    if (best.length >= Math.max(MIN_ROPES, count - 1)) {
      return best
    }
  }

  return best
}

export function setupTwistedRopes(container: HTMLElement): void {
  container.innerHTML = `
    <div class="ropes">
      <div class="ropes-toolbar">
        <button id="ropes-new" type="button">New board</button>
        <div class="ropes-count" role="group" aria-label="Rope count">
          <button id="ropes-fewer" type="button" aria-label="Fewer ropes">&minus;</button>
          <span id="ropes-count-label">Size: 5</span>
          <button id="ropes-more" type="button" aria-label="More ropes">+</button>
        </div>
        <p id="ropes-status" aria-live="polite"></p>
      </div>
      <canvas id="ropes-canvas" width="${BOARD}" height="${BOARD}" aria-label="Rope board"></canvas>
      <p class="hint">Drag a rope end. A rope lifts away once it lies on top at every crossing.</p>
    </div>
  `

  const canvasEl = container.querySelector<HTMLCanvasElement>('#ropes-canvas')
  const statusEl = container.querySelector<HTMLParagraphElement>('#ropes-status')
  const countLabel = container.querySelector<HTMLSpanElement>('#ropes-count-label')
  const newButton = container.querySelector<HTMLButtonElement>('#ropes-new')
  const fewerButton = container.querySelector<HTMLButtonElement>('#ropes-fewer')
  const moreButton = container.querySelector<HTMLButtonElement>('#ropes-more')

  if (!canvasEl || !statusEl || !countLabel || !newButton || !fewerButton || !moreButton) {
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
  let ropes: Rope[] = []
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

  function drawPost(rope: Rope, post: Post, held: boolean): void {
    const r = 7 + post.h * 6

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

  function render(): void {
    ctx.clearRect(0, 0, BOARD, BOARD)

    ctx.beginPath()
    ctx.arc(CX, CY, RING, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(154, 235, 213, 0.22)'
    ctx.stroke()

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const rope of ropes) {
      drawShadow(rope)
    }

    const crossings = crossingsOf(ropes)

    ropes.forEach((rope, i) => {
      drawRope(rope, crossings[i])
    })

    for (const rope of ropes) {
      const heldA = drag !== null && drag.rope === rope && drag.head === 0
      const heldB = drag !== null && drag.rope === rope && drag.head === LAST

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

  function reset(): void {
    ropes = freshBoard(count)
    moves = 0
    solved = ropes.length === 0
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

    for (const rope of ropes) {
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
    const post = drag.head === 0 ? rope.pa : rope.pb
    const counted = drag.moved

    rope.pts[drag.head] = { x: post.x, y: post.y }
    relax(rope, RELAX_SETTLE)
    drag = null

    // A tap on a post that never moved is not a move.
    if (counted) {
      moves += 1
      liftFree(ropes)
      solved = ropes.length === 0
    }

    render()
  }

  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)

  newButton.addEventListener('click', reset)

  fewerButton.addEventListener('click', () => {
    count = Math.max(MIN_ROPES, count - 1)
    reset()
  })

  moreButton.addEventListener('click', () => {
    count = Math.min(MAX_ROPES, count + 1)
    reset()
  })

  reset()
}
