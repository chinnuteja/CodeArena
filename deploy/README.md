# AWS Deployment Guide (ECR + EC2 Linux)

Deploy the Online Judge to a single EC2 instance using Docker images in **AWS ECR**, orchestrated with **`docker-compose.prod.yml`**. Local development is unchanged: use `docker-compose.yml` (Mongo + Redis only) and run `npm run dev` / `npm run worker:dev` on the host.

---

## Quick start

1. **EC2 instance** — Amazon Linux 2023 or Ubuntu 22.04+, `t3.medium` or larger (judge sandboxes need CPU/RAM). Security group: `80`, `443` (and `22` for SSH).
2. **Bootstrap host** — `sudo bash deploy/ec2-setup.sh`
3. **Judge runtime images** (on EC2 host, not in ECR):
   ```bash
   cd /opt/online-judge   # or your clone path
   npm run build:images
   ```
4. **Secrets** — `cp .env.production.example .env.production` and set `JWT_ACCESS_SECRET` (e.g. `openssl rand -base64 48`).
5. **Build & push app images to ECR** (from dev machine or CI):
   ```bash
   AWS_ACCOUNT=123456789012
   AWS_REGION=us-east-1
   ECR_BASE=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

   aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BASE

   for repo in oj-api oj-worker oj-nginx; do
     aws ecr create-repository --repository-name $repo --region $AWS_REGION 2>/dev/null || true
   done

   docker build -t $ECR_BASE/oj-api:latest -f Dockerfile .
   docker build -t $ECR_BASE/oj-worker:latest -f Dockerfile.worker .
   docker build -t $ECR_BASE/oj-nginx:latest -f Dockerfile.nginx .
   docker push $ECR_BASE/oj-api:latest
   docker push $ECR_BASE/oj-worker:latest
   docker push $ECR_BASE/oj-nginx:latest
   ```
6. **On EC2** — set image URIs in `.env.production`:
   ```env
   ECR_API_IMAGE=123456789012.dkr.ecr.us-east-1.amazonaws.com/oj-api:latest
   ECR_WORKER_IMAGE=123456789012.dkr.ecr.us-east-1.amazonaws.com/oj-worker:latest
   ECR_NGINX_IMAGE=123456789012.dkr.ecr.us-east-1.amazonaws.com/oj-nginx:latest
   ```
7. **Start stack**:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production pull
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```
8. **TLS** — certbot on the host or terminate TLS at an **ALB** in front of the instance (see [HTTPS + cookies](#8-https--cookies)).

---

## Architecture

```
Internet → nginx (80/443) → /api/* → api:4000
                         → /*     → frontend static (SPA)
         worker → docker.sock (host) → oj-runtime-* sandbox containers
         api + worker → MongoDB, Redis, shared storage volume
```

| Process | Role | Production |
|---------|------|------------|
| **nginx** | Static frontend + `/api` reverse proxy | `Dockerfile.nginx` |
| **api** | Express API (`node dist/index.js`) | `Dockerfile` |
| **worker** | BullMQ judge (`node dist/worker.js`) | `Dockerfile.worker` |
| **mongodb** | Primary database | `mongo:6` |
| **redis** | Sessions, queues, SSE pub/sub | `redis:7-alpine` |

**Without the worker**, submissions are enqueued but never judged — they stay in `JUDGING` or queue forever.

---

## Environment variables

Copy `.env.production.example` → `.env.production`. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | yes | `production` |
| `JWT_ACCESS_SECRET` | yes | Min 10 chars; use a strong random value |
| `MONGO_URI` | yes | Set by compose to `mongodb://mongodb:27017/online_judge` |
| `REDIS_URL` | yes | Set by compose to `redis://redis:6379` |
| `REFRESH_COOKIE_PATH` | yes | `/api/auth/refresh` (matches nginx `/api` strip) |
| `STORAGE_PATH` | yes | `/data/storage` in containers (persistent volume) |
| `JUDGE_WORKDIR` | yes | `/data/workdir` in worker (host-visible for Docker binds) |
| `DOCKER_SOCKET` | worker | `/var/run/docker.sock` |
| `TRUST_PROXY` | yes | `true` behind nginx |
| `CORS_ORIGIN` | no | Omit when using same-origin nginx (recommended) |

See `.env.example` for local development defaults.

---

## EBS persistent storage

Compose defines Docker volumes `oj_storage` and `oj_workdir`. For production durability, bind them to an EBS volume:

```yaml
# In docker-compose.prod.yml (example override)
volumes:
  oj_storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/oj/storage
  oj_workdir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/oj/workdir
```

Mount EBS at `/data/oj` on the instance (`mkfs`, `/etc/fstab`). Both **api** and **worker** mount the same paths so submission source files written by the API are readable by the worker.

---

## TLS options

### A. certbot on EC2 (nginx container or host nginx)

1. Obtain certs: `certbot certonly --standalone -d your-domain.example.com`
2. Mount certs into nginx and uncomment the `443` server block in `deploy/nginx.conf`
3. Reload nginx

### B. Application Load Balancer (ALB)

- Target group → EC2 instance port `80`
- ACM certificate on HTTPS listener
- Set `TRUST_PROXY=true` (already in `.env.production.example`) so Express sees `X-Forwarded-Proto: https` for secure cookies

---

## systemd alternative

If you prefer not to run api/worker in Docker (only Mongo/Redis in compose):

```ini
# /etc/systemd/system/oj-api.service
[Unit]
Description=Online Judge API
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/online-judge
EnvironmentFile=/opt/online-judge/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/oj-worker.service
[Unit]
Description=Online Judge Worker
After=docker.service oj-api.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/online-judge
EnvironmentFile=/opt/online-judge/.env.production
ExecStart=/usr/bin/node dist/worker.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Run `npm run build` on the host, ensure `ec2-user` is in the `docker` group for the worker, and keep `STORAGE_PATH` / `JUDGE_WORKDIR` on the host filesystem.

---

## Operations

```bash
# Logs
npm run compose:prod:logs

# Restart after env change
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Health
curl http://localhost/health          # nginx
curl http://localhost/api/health      # API via proxy

# Rebuild judge runtimes after language image updates
npm run build:images
```

---

## Deployment blockers — what, why, how

### 1. Docker socket

**What**  
The judge worker runs user submissions in isolated Docker containers via `dockerode`, which talks to the Docker daemon through a Unix socket (default `/var/run/docker.sock`).

**Why**  
Sandboxing requires the host Docker engine. The worker process must create short-lived `oj-runtime-*` containers for compile/run steps.

**How we fixed it**  
- `DOCKER_SOCKET` is validated in `src/config/env.ts` and used in `src/lib/execution/docker.engine.ts`.
- `docker-compose.prod.yml` mounts `${DOCKER_SOCKET_HOST:-/var/run/docker.sock}:/var/run/docker.sock` on the **worker** service.
- Worker runs as `root` (or matching docker GID) via `WORKER_USER` / `WORKER_GROUP` so it can access the socket on EC2.
- Documented in this guide and `.env.production.example`.

---

### 2. Three processes (API, worker, MongoDB, Redis)

**What**  
Production needs four cooperating services: HTTP API, background judge worker, MongoDB, and Redis. Dev `docker-compose.yml` only started databases.

**Why**  
The API enqueues submissions; the worker consumes the queue and executes sandboxes. MongoDB stores data; Redis powers BullMQ, sessions, and SSE.

**How we fixed it**  
- `Dockerfile` — multi-stage build, runs `node dist/index.js`.
- `Dockerfile.worker` — same build, runs `node dist/worker.js`.
- `docker-compose.prod.yml` — `api`, `worker`, `mongodb`, `redis`, `nginx` with healthchecks and `depends_on`.
- `package.json` scripts: `compose:prod`, `compose:prod:down`, `compose:prod:logs`.
- Dev workflow unchanged: `docker compose up -d` + `npm run dev` + `npm run worker:dev`.

---

### 3. Environment secrets

**What**  
Production requires explicit configuration for JWT secrets, database URLs, cookie paths, and sandbox settings.

**Why**  
`src/config/env.ts` uses Zod validation and exits on missing/invalid values. Hard-coded dev secrets are unsafe in production.

**How we fixed it**  
- Expanded `.env.example` with all supported variables and comments.
- Added `.env.production.example` with production paths and ECR image placeholders.
- Compose passes `MONGO_URI`, `REDIS_URL`, `STORAGE_PATH`, `TRUST_PROXY` for container networking.

---

### 4. HTTPS + cookies

**What**  
Refresh tokens are stored in `httpOnly` cookies with `secure: true` when `NODE_ENV=production`.

**Why**  
Browsers only send `Secure` cookies over HTTPS. The cookie `path` must match the URL the browser uses for `/auth/refresh` (here `/api/auth/refresh` behind nginx).

**How we fixed it**  
- Verified `auth.controller.ts` uses `env.REFRESH_COOKIE_PATH` and `env.NODE_ENV === 'production'` for `secure`.
- `REFRESH_COOKIE_PATH=/api/auth/refresh` in production env templates.
- `deploy/nginx.conf` proxies `/api/` → API with path strip (same as Vite dev proxy).
- `TRUST_PROXY=true` in production so Express respects `X-Forwarded-Proto` from nginx/ALB.
- Documented certbot and ALB TLS paths above.

---

### 5. No app Dockerfile (ECR push)

**What**  
There were only judge *runtime* Dockerfiles (`docker/*.Dockerfile`), not images for the Node API/worker app.

**Why**  
ECR deployment needs reproducible, pushable images for the application tier.

**How we fixed it**  
- `Dockerfile` — API image (build TS → `dist/`, `npm ci --omit=dev`).
- `Dockerfile.worker` — worker image.
- `Dockerfile.nginx` — frontend build + nginx.
- `.dockerignore` to keep images small.
- ECR push commands in this guide.

---

### 6. Frontend build + nginx

**What**  
The React SPA must be built and served, with `/api` proxied to the backend (same-origin).

**Why**  
The frontend uses `API_URL = '/api'` (`frontend/src/lib/api.ts`). Production needs the same behavior as Vite's dev proxy.

**How we fixed it**  
- `deploy/nginx.conf` — serves `frontend/dist`, proxies `/api/` to `api:4000`, disables buffering for SSE streams.
- `Dockerfile.nginx` — multi-stage: `npm run build` in `frontend/`, copy to nginx.
- Optional: build frontend on the host with `cd frontend && npm run build` and serve with host nginx using the same config.

---

### 7. CORS

**What**  
Cross-Origin Resource Sharing is required only when the browser loads the SPA from a different origin than the API.

**Why**  
Cookies and `fetch` need proper CORS headers for cross-origin setups.

**How we fixed it**  
- **Preferred**: same-origin via nginx (`Dockerfile.nginx`) — frontend and `/api` share one host; **no CORS needed**; leave `CORS_ORIGIN` unset.
- **Alternative**: set `CORS_ORIGIN=https://app.example.com` (comma-separated list) in `.env.production`; `src/app.ts` enables credential-bearing CORS for those origins only.

---

### 8. Storage (submission source files)

**What**  
Submissions store source code on disk via `DiskStorage`, not in MongoDB.

**Why**  
Large sources stay off the database; API writes, worker reads during judging.

**How we fixed it**  
- Added `STORAGE_PATH` to `env.ts` (default `.tmp/storage` locally, `/data/storage` in production).
- `src/lib/storage/index.ts` resolves path from env.
- `docker-compose.prod.yml` mounts shared volume `oj_storage` on **api** and **worker**.
- Documented EBS bind mounts for durability.

---

### 9. Worker dependency + healthchecks

**What**  
The worker must be running and healthy; API health alone is insufficient for a working judge.

**Why**  
`submission.queue` enqueues jobs processed only by `src/worker.ts`. No worker → no verdicts.

**How we fixed it**  
- Worker `depends_on` api + databases with `condition: service_healthy`.
- `scripts/healthcheck-api.js` — HTTP `/health`.
- `scripts/healthcheck-worker.js` — Redis ping (queue connectivity).
- Compose healthchecks on all services.
- Documented operational checks and systemd alternative.

---

### 10. Judge workdir host paths (Docker bind mounts)

**What**  
When the worker uses the host Docker socket, sandbox bind mounts (`workdir:/app`) are resolved on the **host** filesystem, not inside the worker container.

**Why**  
Docker daemon path resolution would fail if temp dirs lived only in the container's private `/tmp`.

**How we fixed it**  
- Added `JUDGE_WORKDIR` env var; `judge.service.ts` creates temp dirs under that path.
- Production compose mounts `oj_workdir` at `/data/workdir` in the worker.
- Documented that this path must be host-visible (shared volume).

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Submissions stuck in JUDGING | `docker logs oj_worker`; is worker healthy? Redis up? |
| `permission denied` on docker.sock | Set `WORKER_USER=0` or add user to `docker` group |
| Sandbox `bind` errors | `JUDGE_WORKDIR` volume mounted; run `npm run build:images` on host |
| Login works locally, refresh fails in prod | HTTPS enabled? `REFRESH_COOKIE_PATH=/api/auth/refresh`? |
| 502 on `/api` | `docker logs oj_api`; Mongo/Redis healthy? |

---

## File reference

| File | Purpose |
|------|---------|
| `Dockerfile` | API image for ECR |
| `Dockerfile.worker` | Judge worker image |
| `Dockerfile.nginx` | Frontend + reverse proxy |
| `docker-compose.yml` | Dev: Mongo + Redis only |
| `docker-compose.prod.yml` | Production full stack |
| `deploy/nginx.conf` | nginx routing |
| `deploy/ec2-setup.sh` | EC2 bootstrap |
| `.env.example` | Local dev template |
| `.env.production.example` | Production template |
