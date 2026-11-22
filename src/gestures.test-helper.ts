// Pointer gestures for view tests, sent as the whole sequence a browser sends: pointerdown, the moves,
// pointerup, then the click or contextmenu that follows the release. A handler that listens only to pointer
// events still has to cope with that follow-up event, so tests fire it too.
//
// Where the browsers differ, these send the worst case: the follow-up lands on the element under the release
// (Windows sends contextmenu there when the right button comes up), not where the press started.
//
// jsdom has no layout, so document.elementFromPoint is stubbed to answer with the element the gesture is over.

export type GestureOptions = { button?: 0 | 2; ctrlKey?: boolean }

// A point on the page over an element, for a board drawn on one canvas, where only the point says what is hit.
export type Point = { target: Element; clientX: number; clientY: number }

// An element to aim at, looked up when the gesture reaches it: a redraw may replace the one that was there.
export type Spot = () => Element

// A spot or a point to aim at, looked up the same way.
export type Aim = Spot | (() => Point)

let over: Element | null = null

function aim(spot: Aim): Point {
  const found = spot()
  const aimed = found instanceof Element ? { target: found, clientX: 0, clientY: 0 } : found
  over = aimed.target
  document.elementFromPoint = () => over
  return aimed
}

function send(type: string, at: Point, { button = 0, ctrlKey = false }: GestureOptions, down: boolean): void {
  const buttons = down ? (button === 2 ? 2 : 1) : 0
  const { clientX, clientY } = at
  at.target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, button, buttons, ctrlKey, clientX, clientY }),
  )
}

// What the browser sends after the button comes up: contextmenu for the right button or a Mac Ctrl-click,
// otherwise click. Returns the event, to check defaultPrevented.
function followUp(at: Point, { button = 0, ctrlKey = false }: GestureOptions): MouseEvent {
  const event = new MouseEvent(button === 2 || ctrlKey ? 'contextmenu' : 'click', {
    bubbles: true,
    cancelable: true,
    button,
    ctrlKey,
    clientX: at.clientX,
    clientY: at.clientY,
  })
  at.target.dispatchEvent(event)
  return event
}

// A press and release on one spot.
export function press(spot: Aim, options: GestureOptions = {}): MouseEvent {
  const target = aim(spot)
  send('pointerdown', target, options, true)
  send('pointerup', aim(spot), options, false)
  return followUp(aim(spot), options)
}

// A press on the first spot, a move over each of the rest, and a release on the last.
export function drag(path: Aim[], options: GestureOptions = {}): MouseEvent {
  send('pointerdown', aim(path[0]), options, true)
  path.slice(1).forEach((spot) => send('pointermove', aim(spot), options, true))
  send('pointerup', aim(path[path.length - 1]), options, false)
  return followUp(aim(path[path.length - 1]), options)
}

// A move with no button down, as a mouse hovering after the drag ended.
export function hover(spot: Aim, buttons = 0): void {
  const { target, clientX, clientY } = aim(spot)
  target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, cancelable: true, buttons, clientX, clientY }))
}
