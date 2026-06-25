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
npm run build
rsync -az --delete dist/ <user>@187.124.159.132:/var/www/fiddlesticks/
```

## 5) Useful checks

On the VPS:

```bash
sudo nginx -t
sudo systemctl status nginx
```

## Notes

- The app is fully static after build, so runtime Node.js is not required on the VPS.
- If you later add a domain, set `server_name` to that domain and add HTTPS via Certbot.
