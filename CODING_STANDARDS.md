# Coding standards

The rules a review holds a change to. Formatting and lint rules are not here: Prettier and ESLint enforce them
(`npm run lint`), and the pre-commit hook runs them on every commit.

## Game rules live in a pure module

A game's rules go in a pure module (`src/<game>-logic.ts`, `-solver.ts`, `-layout.ts`, ...) behind an entry
point a test can call. The view (`src/<game>.ts`) turns input into calls on that module and draws the result.
Rules written inline in canvas or DOM code are a breach, even when they are short.

## Production code has no test-only branches

Code in `src/` behaves the same under test as in the browser. When jsdom lacks an API the view needs
(`elementFromPoint`, layout, canvas), the test stubs it. The view never checks whether the API exists in
order to fall back to something that only makes sense in jsdom.

## Tests ship with the change

Every change to behaviour comes with tests for it: logic tests on the pure module, and a view test when the
input handling or the drawing changes. A test's name says the behaviour it checks. The `feat-NNN/AC-n:`
prefix on older tests is optional.

## Input tests send what the browser sends

A view test that presses, clicks or drags goes through `src/gestures.test-helper.ts` (`press`, `drag`,
`hover`). The helper sends the whole sequence a browser sends, including the `click` or `contextmenu` that
follows the release, at the worst-case target. A test that dispatches only the events its handler listens to
misses bugs in that follow-up event. Firing a lone event directly is fine when that event is the point of the
test (a key press, a `change` on a select).

## Names come from the glossary

UI text, identifiers and comments use the terms in `GLOSSARY.md` for their game, and avoid the words it lists
under _Avoid_. A term the glossary already defines keeps that one meaning: a new idea gets a new word. A
change to a game with no glossary section adds the section, covering the terms the change uses.

## One shape per concept

Within a game, a concept has one type. When the logic module already has a type for it (a position, a mark,
a line), new code uses that type, instead of adding a second name, a tuple or a loose pair of arguments for
the same thing.

## Touch input on boards

A board may set `touch-action: none` so that a finger drag plays the game instead of scrolling. The page
stays scrollable by a swipe that starts outside the board. A board must not cover the whole screen with
nothing outside it to swipe on.
