# Fiddlesticks VPS Deployment

The app is static HTML/CSS/JS. It lives at https://fiddlesticks.vawagners.cloud/.

## Where it is served

- VPS: `187.124.159.132`.
- Web server: Caddy, in Docker, run by the millwright repo at `/srv/millwright` on the VPS. Its
  `caddy/Caddyfile` serves `fiddlesticks.vawagners.cloud` from `/srv/millwright/sites/fiddlesticks` (mounted
  into the container as `/srv/sites/fiddlesticks`), and gets the HTTPS certificate itself.
- Caddy sends `index.html` for unknown paths and caches `/assets/*` forever: Vite puts a content hash in each
  asset name.

## Deploy on every merge to main

`.github/workflows/deploy.yml` runs on each push to `main`: `npm run check`, then `npm run deploy`. It uses two
repository secrets:

- `DEPLOY_SSH_KEY`: the private half of the deploy key. Its public half is in root's
  `~/.ssh/authorized_keys` on the VPS, locked to rsync into the web root:
  `command="rrsync /srv/millwright/sites/fiddlesticks",restrict ssh-ed25519 ... fiddlesticks-deploy`.
- `DEPLOY_KNOWN_HOSTS`: the VPS's host keys, from `ssh-keyscan 187.124.159.132`.

`rrsync` makes every path the key asks for relative to the web root, so the workflow sets `DEPLOY_PATH=.`.

## Deploy by hand

```bash
npm run deploy
```

That builds, rsyncs `dist/` to the VPS with `scripts/deploy.mjs`, then fetches
`https://fiddlesticks.vawagners.cloud/` and fails unless it serves the `index.html` just built. It uses your own
ssh access as root. Set `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PATH`, `DEPLOY_URL` or `DEPLOY_SSH_KEY` to deploy
somewhere else; the script's header lists the defaults.

Keep the trailing slash on `dist/` if you ever rsync by hand. Without it, rsync makes a `dist/` folder inside the
web root and the site answers 404.
