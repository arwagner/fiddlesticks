# Agents in fiddlesticks

For any agent working here, including the aint-farm factory's runs (its tasks are configured in
`.factory.yml`).

## Standards

Read `CODING_STANDARDS.md` and `GLOSSARY.md` before you change anything: a review holds every change to both.
Name things in the glossary's words.

## Checks

`npm run check` is lint, format, typecheck, build and tests. Run it before every commit, and commit only when
it passes. The pre-commit hook formats and lints the files you stage, and typechecks.

Leave `.github/` untouched.

## The browser

Drive a game with `agent-browser`, installed with its Chrome. `agent-browser skills get agent-browser` lists
its commands: `open`, `mouse move|down|up`, `set device` for a phone, `screenshot`. Serve the app with
`npx vite --port 5173 --strictPort &`; a game is at `http://localhost:5173/game.html?game=<slug>`.

When a change shows in the UI, check it in the browser, before and after. Describe what you saw in the pull
request's description; screenshots can't be attached to it yet.

## Pull request descriptions

Write them in the voice of the `pr` skill (`.agents/skills/pr/SKILL.md`): what the ticket asked for, what you
built, what you deliberately left out.
