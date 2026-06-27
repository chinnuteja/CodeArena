# AI-Native Online Judge

This repository follows the `OJ_BUILD_PHASES_1-6.md` specifications. Phases 7+ will extend it directly.

## Development

- Copy `.env.example` to `.env` and fill in the values.
- Start MongoDB and Redis: `docker compose up -d` (dev compose — API/worker run on the host).
- Run `npm i` to install dependencies.
- Run `npm run dev` for the API and `npm run worker:dev` for the judge worker (separate terminal).
- Frontend: `cd frontend && npm i && npm run dev`.

## Production (AWS EC2 + ECR)

See **[deploy/README.md](deploy/README.md)** for the full guide: ECR image push, `docker-compose.prod.yml`, nginx TLS, env secrets, judge runtime images, and EBS storage.
