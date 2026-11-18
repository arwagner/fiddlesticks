# Fiddlesticks VPS Deployment

This project deploys as static HTML/CSS/JS files (no Docker).

## Target

- VPS IP: `187.124.159.132`
- App URL after deploy: `http://187.124.159.132/`

## 1) Prepare the VPS (one-time)

SSH into the server:

```bash
ssh <user>@187.124.159.132
```

Install nginx (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Allow web traffic if UFW is enabled:

```bash
sudo ufw allow 80/tcp
```

Create a web root for the app:

```bash
sudo mkdir -p /var/www/fiddlesticks
sudo chown -R "$USER":"$USER" /var/www/fiddlesticks
```

Create nginx site config:

```bash
sudo tee /etc/nginx/sites-available/fiddlesticks >/dev/null <<'EOF'
server {
	listen 80;
	server_name 187.124.159.132;

	root /var/www/fiddlesticks;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location /assets/ {
		add_header Cache-Control "public, max-age=31536000, immutable";
		try_files $uri =404;
	}
}
EOF
```

Enable the site and reload nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/fiddlesticks /etc/nginx/sites-enabled/fiddlesticks
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 2) Build static files locally

From your project root:

```bash
npm run build
```

This outputs deployable files into `dist/`.

## 3) Upload built files to VPS

From your local machine:

```bash
rsync -az --delete dist/ <user>@187.124.159.132:/var/www/fiddlesticks/
```

Important: keep the trailing slash in `dist/`. Without it, rsync may create `/var/www/fiddlesticks/dist/` and nginx can return `403 Forbidden` at `/`.

Open the app at:

```text
http://187.124.159.132/
```

## 4) Update deploys

After code changes:

```bash
npm run deploy
```

That builds, rsyncs `dist/` to the VPS with `scripts/deploy.mjs`, then fetches
`https://fiddlesticks.vawagners.cloud/` and fails unless it serves the `index.html` just built. Set
`DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PATH`, `DEPLOY_URL` or `DEPLOY_SSH_KEY` to deploy somewhere else; the
script's header lists the defaults.

## 5) Deploy on every merge to main

A workflow at `.github/workflows/deploy.yml` runs the checks on each push to `main` and, when they pass, runs
`scripts/deploy.mjs`. It needs two repository secrets:

- `DEPLOY_SSH_KEY`: a private key whose public half is in the deploy user's `~/.ssh/authorized_keys` on the VPS.
- `DEPLOY_KNOWN_HOSTS`: the VPS's host key lines, from `ssh-keyscan 187.124.159.132`.

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read

# One deploy at a time, and never cancel one half-way through an rsync.
concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Install the deploy key
        env:
          KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "$KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          printf '%s\n' "$KNOWN_HOSTS" >> ~/.ssh/known_hosts
      - run: DEPLOY_SSH_KEY="$HOME/.ssh/deploy_key" node scripts/deploy.mjs
```

The live check needs nginx to answer `https://fiddlesticks.vawagners.cloud/`: set `server_name` to that domain
and add HTTPS with Certbot (`sudo certbot --nginx -d fiddlesticks.vawagners.cloud`).

## 6) Useful checks

On the VPS:

```bash
sudo nginx -t
sudo systemctl status nginx
```

## Notes

- The app is fully static after build, so runtime Node.js is not required on the VPS.
- The domain is `fiddlesticks.vawagners.cloud`; its nginx `server_name` and Certbot certificate are in step 5.
