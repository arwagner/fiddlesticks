# Arcade catalog browser — spec (as-built, draft)

> Reverse-engineered from `src/main.ts` + `src/games.ts` on 2026-07-15. Describes current
> observable behavior, not aspiration. Inherits the `slugify` invariant and product-wide NFRs
> from `product-global.md`.

## Why
The arcade needs a single landing page where a visitor can scan the whole collection, narrow it
by typing, and open a game in one click.

## User stories
- As a visitor, I want to see every available game at a glance so that I can pick one to play.
- As a visitor, I want to filter the list by typing so that I can find a game by title, genre, or theme.
- As a visitor, I want each game to link straight to its page so that I can start playing immediately.

## Behavior & scenarios
- **Scenario: Initial load**
  - Given I open the landing page
  - When the page renders
  - Then every game in the catalog appears as a card, each showing genre, title, description, and a
    "Play" action, and the results count reads "&lt;total&gt; of &lt;total&gt; games". (The catalog holds
    only implemented games — currently just Canvas Solitaire.)
- **Scenario: Filtering**
  - Given the catalog is showing
  - When I type a query into the search box
  - Then the list is filtered to games whose title, genre, OR description contains the query as a
    case-insensitive substring, and the count updates to "&lt;matches&gt; of &lt;total&gt; games" on every keystroke.
- **Scenario: No matches (empty state)**
  - Given I have typed a query
  - When no game matches
  - Then the list shows a "No games found" message with a hint to try a broader search, and the
    count reads "0 of &lt;total&gt; games".
- **Scenario: Clearing the query**
  - Given I have typed a query that filtered the list
  - When I clear the box or leave only whitespace
  - Then the full list returns and the count reads "&lt;total&gt; of &lt;total&gt; games" (an
    all-whitespace query is treated as empty).
- **Scenario: Opening a game**
  - Given a game card is visible
  - When I click it
  - Then the browser navigates to `/game.html?game=<slug>`, where `<slug>` is the title lowercased
    with each run of non-alphanumeric characters replaced by a single hyphen and leading/trailing
    hyphens removed.

## Acceptance criteria
- [ ] AC-1: On load, every game in the catalog renders as a card, each showing its genre, title, description, and a "Play" link. (The catalog holds only implemented games — currently just Canvas Solitaire.)
- [ ] AC-2: Typing filters the list to games whose title, genre, or description contains the query (case-insensitive substring), re-filtering on every `input` event.
- [ ] AC-3: The results count reads "&lt;matches&gt; of &lt;total&gt; games" and updates on every input.
- [ ] AC-4: When nothing matches, a "No games found" empty state with a broadening hint is shown and the count reads "0 of &lt;total&gt; games".
- [ ] AC-5: Each card links to `/game.html?game=<slug>`, where `<slug>` is the title run through the shared `slugify` rule.
- [ ] AC-6: An empty or whitespace-only query shows every game (the count returns to "&lt;total&gt; of &lt;total&gt; games").

## Known sharp edges (as-built)
- Game fields are interpolated into `innerHTML` without escaping. Safe today because the game list is
  static/trusted, but any user- or externally-sourced game data would be an injection vector.
- Substring matching spans the description too, so a query can match on words a user didn't expect
  (a match can come from the description, not just the title/genre).
- No search debounce — re-renders on every keystroke (negligible at the current catalog size).
- Slug collisions are possible if two future titles slugify to the same string; not the case for the
  current catalog.

## Edge cases & errors  _(mvp+ depth)_
- Empty/whitespace query → full list (handled).
- Zero matches → empty state (handled).
- A title made only of punctuation would slugify to an empty/all-hyphen string, producing a `?game=`
  link that resolves to the detail page's not-found state; not the case for the current catalog.
- `#app` missing → throws "App root not found"; required UI elements missing → throws.

## Non-functional requirements  _(mvp+ depth)_
- Performance: none beyond product-global (the catalog is a small static list).
- Security: no user-generated content today; escaping would be required before that changes (see sharp edges).
- Accessibility: search has a visually-hidden label; the results count is an `aria-live="polite"` region; the empty state uses `role="status"`.

## Open questions
- None blocking. Whether the game list will grow large enough to need pagination/virtualization is a
  future concern, not current behavior.
