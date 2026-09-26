# SMAART Healthcare EMR

Secure, multi-tenant Electronic Medical Record for SMAART Healthcare: the same React UI, backed by a modular-monolith Node.js API on MongoDB (the only database) + Redis + RabbitMQ + Cloudinary with an HL7 FHIR R4 interoperability layer.

* Architecture: `docs/architecture/` (current-state report, target architecture, migration plan)
* Operations: `docs/operations/` (environments, backups, disaster recovery, monitoring, legacy data retirement)
* API docs: `http://localhost:5001/api/docs` (OpenAPI, non-production)

## Roles

Only two EMR roles exist: `super_master_admin` (platform) and `clinic_admin` (one clinic). Doctors, nurses and lab technicians are practitioners (clinical resources), not logins.

## Quick start

```bash
cp backend/.env.example backend/.env         # edit JWT_SECRET etc.
docker compose up --build                     # mongodb (replica set), redis, rabbitmq, api, worker, web
# first admin
docker compose exec -e BOOTSTRAP_ADMIN_EMAIL=you@example.com -e BOOTSTRAP_ADMIN_PASSWORD='ChangeMe123' api npm run bootstrap:admin
open http://localhost:8080
```

Without Docker: run MongoDB (as a single-node replica set, e.g. `mongod --replSet rs0` then `rs.initiate()`) and Redis locally, then in `backend/`: `npm ci && npm run migrate && npm run bootstrap:admin && npm run dev`; in `frontend/`: `npm ci && npm run dev` (Vite proxies `/api` to the API).

## Backend scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm start` | API |
| `npm run worker` | outbox publisher, consumers, schedulers |
| `npm run migrate` | MongoDB collections, JSON-schema validators, indexes and reference data (idempotent) |
| `npm run bootstrap:admin` | create the first Super Master Admin from env |
| `npm run migrate:data -- --mongo <uri> --dry-run` | legacy (mongoose-era) MongoDB → new data model migration with validation report |
| `npm run lint`, `npm test` | ESLint, Vitest (unit + integration + security + migration + workers) |
| `cd frontend && npm run test:e2e` | Playwright end-to-end tests of the real UI against the API |

## Optional infrastructure

`CLAMAV_HOST`/`CLAMAV_PORT` enable malware scanning of uploads (infected files are quarantined); `BACKUP_DIR` (+ `BACKUP_COPY_FILES=true`) enables the nightly document backup export; `deploy/monitoring` holds Prometheus scrape config, alert rules and a Grafana dashboard; `deploy/aws` holds the ECS task definition used by the pipeline.

## Security summary

Argon2id passwords, 15-minute access tokens with rotating httpOnly refresh tokens and server-side sessions, OTP second factor, central RBAC, clinic scope derived from the token and enforced by the tenant data-access layer on every MongoDB query and write, Zod validation on every route, Helmet/CORS allow-list/rate limiting, append-only audit log, signed short-lived document URLs, structured redacted logging.
