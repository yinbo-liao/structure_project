# Production Deployment Guide (Docker Compose + Nginx + PostgreSQL + Certbot + GitHub Actions)

## Overview
- Architecture uses separate subdomains: `app.sampleproject.site` for frontend and `api.sampleproject.site` for backend API.
- Components:
  - API: FastAPI served by Gunicorn with Uvicorn workers
  - DB: PostgreSQL 16 with persistent volume
  - Frontend: Built static assets served by Nginx
  - Nginx: Reverse proxy and TLS termination
  - Certbot: ACME client for issuing and renewing TLS certificates
  - CI/CD: GitHub Actions for build, test, and deployment

## Prerequisites
- DNS A records pointing to your server IP:
  - `app.sampleproject.site`
  - `api.sampleproject.site`
- Server with `docker` and `docker compose` installed and ports `80` and `443` open.
- GitHub repository secrets configured for deploy (see CI/CD section).

## Repo Files
- `deploy/docker-compose.yml`: Orchestrates API, PostgreSQL, Nginx, Certbot
- `nginx/nginx.conf`: TLS, ACME, static site, and proxy to API
- `.github/workflows/deploy.yml`: CI workflow for build/test and deployment

## Environment Variables
- Backend
  - `DATABASE_URL`: `postgresql://<user>:<password>@db:5432/<db>`
  - `JWT_SECRET`: long random string
  - `ALLOWED_HOSTS`: `app.sampleproject.site,api.sampleproject.site`
  - `ALLOW_ORIGINS`: `https://app.sampleproject.site`
  - `TEST_LOGIN_BYPASS`: `false`
  - `USE_SQLITE`: `false`
- Database
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Certbot
  - `CERTBOT_EMAIL`: email for Let’s Encrypt notifications

## First Deployment (Server)
- Clone repo to server: `git clone https://github.com/Marshmellow589/sample_project.git /srv/sample_project`
- Create `deploy/.env` (or use CI to write it) with the variables above.
- Bring up services: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`
- Issue initial certificates (one-time):
  - `docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm certbot certonly --webroot -w /var/www/certbot -d app.sampleproject.site -d api.sampleproject.site --agree-tos -m <email>`
  - `docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T nginx nginx -s reload`

## Renewal
- Certbot container runs a renewal loop; alternatively add a cron on host:
  - `0 3 * * * docker compose -f /srv/sample_project/deploy/docker-compose.yml --env-file /srv/sample_project/deploy/.env run --rm certbot renew && docker compose -f /srv/sample_project/deploy/docker-compose.yml --env-file /srv/sample_project/deploy/.env exec -T nginx nginx -s reload`

## CI/CD (GitHub Actions)
- Workflow: `.github/workflows/deploy.yml`
- Jobs:
  - Build & Test:
    - Backend: install `backend/requirements.txt`, compile modules
    - Frontend: `npm ci`, `npm run build`
  - Deploy:
    - Rsync `frontend/dist/` to server `/srv/sample_project/frontend/dist/`
    - SSH to server, reset repo to `origin/main`, write `deploy/.env`, run compose up, issue certs, reload Nginx
- Required repository secrets:
  - `PROD_SSH_HOST`: server hostname or IP
  - `PROD_SSH_USER`: SSH user
  - `PROD_SSH_KEY`: SSH private key (PEM)
  - `CERTBOT_EMAIL`: Let’s Encrypt contact email

## Nginx
- `nginx/nginx.conf` handles:
  - HTTP → HTTPS redirects
  - ACME challenge via `/.well-known/acme-challenge/` at `/var/www/certbot`
  - Frontend serving for `app.sampleproject.site`
  - API proxy for `api.sampleproject.site` to `http://api:8000`
  - TLS cert paths under `/etc/letsencrypt/live/<domain>/`

## Security
- Enforce HTTPS and HSTS; limit CORS to `https://app.sampleproject.site`.
- Disable test login bypass (`TEST_LOGIN_BYPASS=false`).
- Set strong `JWT_SECRET` and rotate periodically.
- Avoid committing `.env`, logs, databases, and exports (already excluded by `.gitignore`).

## Operations
- Logs: `docker compose logs -f` or per-service logs.
- Healthchecks: PostgreSQL `pg_isready`; API can expose `/verify-token`.
- Backups: nightly `pg_dump` to mounted volume or object storage; define retention (e.g., 7 daily, 4 weekly).
- Monitoring: add uptime checks for `app` and `api`, basic error tracking.

## Troubleshooting
- Cert issuance fails:
  - Verify DNS records and that port `80` is open.
  - Ensure Nginx serves `/.well-known/acme-challenge/` from `/var/www/certbot`.
- 502 on API:
  - Check `api` container health and logs; verify `proxy_pass` to `api:8000`.
- Static files not updating:
  - Confirm `frontend/dist` is present and mounted to Nginx; rerun build step.
- CORS errors:
  - Confirm `ALLOW_ORIGINS` matches exactly `https://app.sampleproject.site`.

## Domain Customization
- Replace `app.sampleproject.site` and `api.sampleproject.site` everywhere with your actual domains.
- Update in:
  - `deploy/docker-compose.yml` (`ALLOWED_HOSTS`, `ALLOW_ORIGINS`)
  - `nginx/nginx.conf` (`server_name` and cert paths)
  - `.github/workflows/deploy.yml` (domains in cert issuance command)

## Suggested Improvements (Follow-up)
- Push images to a container registry with tags and use `docker compose pull` for faster deploys.
- Add Alembic migrations and run `alembic upgrade head` in deploy script.
- Zero-downtime restarts with Nginx `graceful` reload and multiple API replicas.
- Object storage (S3-compatible) for large files; serve via signed URLs.
- Metrics and alerts: request latency, error rate, DB connections, disk space.
- WAF/rate-limiting for `api.sampleproject.site` and secure headers tuning.

## Quick Commands
- Start: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`
- Logs: `docker compose -f deploy/docker-compose.yml logs -f nginx api db`
- Reload Nginx: `docker compose -f deploy/docker-compose.yml exec -T nginx nginx -s reload`
- Renew certs now: `docker compose -f deploy/docker-compose.yml run --rm certbot renew`