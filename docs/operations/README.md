# Operations Guide

## Environments

| Environment | Purpose | Data | Secrets |
|---|---|---|---|
| development | local laptops, `docker compose up` | synthetic only (`npm run seed`, bootstrap admin) | `backend/.env` (never committed) |
| staging | pre-production validation, migration rehearsal | anonymised or synthetic | AWS Secrets Manager → task environment |
| production | live clinics | real PHI | AWS Secrets Manager, rotated; no human copies |

`NODE_ENV` drives validation in `backend/src/config/env.js`: production refuses the console email transport, local storage, password-only login, wildcard CORS and missing Redis/Mongo/RabbitMQ.

## Runbook: first deployment

1. Provision PostgreSQL 16 (RDS), MongoDB (Atlas), Redis (ElastiCache), RabbitMQ (Amazon MQ). Private subnets only; TLS on every connection.
2. Create the two database roles: `smaart_migrator` (schema owner) and `smaart_app` (`LOGIN NOSUPERUSER NOBYPASSRLS`, DML only). See `deploy/postgres-init.sql`.
3. Store secrets in Secrets Manager and map them to the task/instance environment (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `MONGODB_URI`, `REDIS_URL`, `RABBITMQ_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `EMAIL_*`).
4. Run `npm run migrate && npm run seed` with the migrator credentials (CI "deploy" job).
5. Create the first Super Master Admin once: `BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:admin`.
6. Start `api` (N replicas behind the load balancer/WAF) and `worker` (1..N replicas; the outbox publisher is lock protected).
7. Verify `/health/ready` is green and `/metrics` is scraped by Prometheus.

## Data migration from the legacy MongoDB

Rehearse on staging first, from a **backup restore** of the legacy database:

```
npm run migrate:data -- --mongo "$LEGACY_MONGODB_URI" --dry-run --report dry.json   # analyse + validate
npm run migrate:data -- --mongo "$LEGACY_MONGODB_URI" --apply  --report apply.json  # idempotent
```

The tool never writes to the legacy database. Review `warnings` (plaintext passwords hashed, legacy roles dropped, orphans skipped, inline base64 images not migrated) and `validation.failures` (counts, orphan references, duplicate identifiers, dates). Re-runs update rows in place through `legacy_id_map`. Retire the legacy MongoDB only after clinical sign-off (`legacy-data-retirement.md`).

## Backups

| Store | Mechanism | Frequency | Retention | Restore test |
|---|---|---|---|---|
| PostgreSQL (RDS) | automated snapshots + continuous WAL (PITR) | daily snapshot, 5-minute PITR granularity | 35 days snapshots, quarterly archived copies 7 years (audit) | monthly restore into staging, run `npm run test:integration` against it |
| MongoDB (Atlas) | cloud backups with PITR | hourly | 30 days | monthly |
| Redis | none (cache only); RDB snapshot for rate-limit continuity optional | – | – | – |
| RabbitMQ | durable queues on persistent volume; outbox in PostgreSQL is the source | – | – | replay from outbox |
| Cloudinary | Cloudinary backup add-on **plus** a nightly export job listing `documents` rows and copying assets to an encrypted cold-storage bucket (implemented as a worker consumer when the bucket is provisioned) | nightly | 7 years | quarterly sample restore |

Never rely on Cloudinary alone as disaster recovery: the `documents` table holds the authoritative index (`storage_key`, checksum, patient, clinic).

## Disaster recovery

Targets: **RPO 15 minutes** (PostgreSQL PITR, Mongo PITR), **RTO 2 hours** for the API, 8 hours for full file restore.

| Failure | Procedure |
|---|---|
| PostgreSQL failure | RDS Multi-AZ failover (automatic). Full loss: restore latest PITR to a new instance, point `DATABASE_URL`, run `npm run migrate` (no-op), restart api/worker, verify `/health/ready`. |
| MongoDB failure | Atlas replica set failover (automatic). Full loss: restore snapshot; clinical notes/community posts reference PostgreSQL UUIDs so no re-linking is needed. |
| Redis failure | API keeps serving (limiter falls back to memory store per instance, session cache misses go to PostgreSQL). Restore the cluster; no data to recover. |
| RabbitMQ failure | Events accumulate in `outbox_events` (metric `smaart_outbox_pending`). Restore broker; publisher drains automatically. Dead-letter queue is inspected via the management UI. |
| Cloudinary/storage failure | Signed URL generation fails closed (documents report `DOCUMENT_UNAVAILABLE`). Restore from the cold-storage copy by re-uploading with the same `storage_key` mapping. |
| API failure | Roll back to the previous image tag; migrations are backward compatible for one release. |
| Complete infrastructure loss | Rebuild from IaC, restore PostgreSQL PITR → MongoDB snapshot → files; rotate all secrets; run the verification gate. |

## Monitoring and alerting

Prometheus scrapes `/metrics` from api and worker. Alert rules (Grafana/Alertmanager):

* `smaart_http_errors_total` rate > 1% of requests for 5 minutes
* p95 `smaart_http_request_duration_seconds` > 1s
* `smaart_auth_failures_total{kind="forbidden"}` spike (possible cross-clinic probing)
* `smaart_outbox_pending` > 1000 or growing for 10 minutes
* `smaart_rabbitmq_dlq_depth` > 0
* `/health/ready` != 200 (load balancer health check)
* RDS CPU/connections/replica lag, Atlas ops/sec, ElastiCache memory, MQ queue depth via CloudWatch

Logs are JSON (pino) shipped to Loki/CloudWatch Logs; each line carries `requestId`, `userId`, `clinicId`, `method`, `url`, `status`, `responseTime`. Passwords, tokens, OTPs and request bodies are redacted at the source.

## Security operations

* Rotate `JWT_SECRET` by deploying the new value; all sessions are invalidated (users sign in again).
* Revoke a user: `PUT /api/v1/users/:id {isActive:false}` (sessions revoked immediately).
* Deactivate a clinic: `PUT /api/v1/clinics/:id {isActive:false}` (all its sessions revoked).
* Audit review: `GET /api/v1/audit` (append-only table; the app role cannot update or delete rows).
* The credentials that were committed in the legacy repository (MongoDB Atlas URI, Gmail app password, JWT secret) must be considered compromised and rotated.
