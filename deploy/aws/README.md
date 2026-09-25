# AWS deployment (ECS Fargate)

Topology: CloudFront + WAF → Application Load Balancer (TLS, private subnets) → ECS services `api` and `worker` → RDS PostgreSQL (Multi-AZ, private), MongoDB Atlas (VPC peering), ElastiCache Redis, Amazon MQ (RabbitMQ), Cloudinary (files), Secrets Manager (all secrets), CloudWatch + Prometheus/Grafana (`deploy/monitoring`).

The GitHub Actions pipeline builds and pushes images to GHCR, then, when the repository variables `AWS_REGION`, `AWS_ROLE_ARN`, `ECS_CLUSTER`, `ECS_SERVICE_API`, `ECS_SERVICE_WORKER` are set (per environment), registers a new task definition from `task-definition.api.json` (replace `ACCOUNT_ID`/`REGION`) and updates the services. Migrations run as a one-off ECS task (`npm run migrate`) before the service update. Production requires the manual approval configured on the `production` GitHub environment.
