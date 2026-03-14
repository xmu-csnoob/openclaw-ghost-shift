# Deployment Guide

Ghost Shift ships as a single Go server that serves the SPA, public API, health checks, and Prometheus metrics on the same port. The repository now includes three deployment paths:

- raw Docker / Compose for single-host delivery
- raw Kubernetes manifests under [deploy/kubernetes](../deploy/kubernetes)
- Helm chart under [deploy/helm/ghost-shift](../deploy/helm/ghost-shift)

## 1. Prepare runtime configuration

Copy [`.env.production.example`](../.env.production.example) to `.env.production` and fill in the gateway credentials:

```bash
cp .env.production.example .env.production
```

Required values:

- `GATEWAY_URL`
- `GATEWAY_TOKEN` or `GATEWAY_CONFIG_PATH`
- `PUBLIC_ID_SALT`

Recommended production values:

- `REDIS_URL=redis://redis:6379/0` for shared response caching
- `CACHE_WARM_ON_STARTUP=true` for Kubernetes and blue/green cutovers
- `REQUEST_SLOW_THRESHOLD_MS=250` or lower if you want aggressive slow-request logging
- `ENABLE_INTERNAL_API=true` and `INTERNAL_API_TOKEN=...` only when you need internal control-plane endpoints

## 2. Local release verification

Before shipping, run the same checks the deployment scripts assume:

```bash
npm ci
npm run build
cd server
go test ./...
go build -trimpath -o ghost-shift-server .
```

If the local environment does not have Go installed, perform the validation in CI or your release image instead.

## 3. Docker and Compose

The root [Dockerfile](../Dockerfile) builds both frontend and backend into one runtime image.

Build and run locally:

```bash
docker build -t ghost-shift:local .
docker run --env-file .env.production -p 3002:3002 ghost-shift:local
```

The single-host stack lives in [deploy/docker-compose.yml](../deploy/docker-compose.yml).

Examples:

```bash
docker compose -f deploy/docker-compose.yml up --build
docker compose -f deploy/docker-compose.yml --profile cache up --build
docker compose -f deploy/docker-compose.yml --profile cache --profile observability up --build
```

When the `observability` profile is enabled you get:

- Prometheus on `http://127.0.0.1:9090`
- Grafana on `http://127.0.0.1:3000`
- default Grafana login `admin` / `admin`
- dashboard provisioning from [deploy/grafana/dashboards/ghost-shift-overview.json](../deploy/grafana/dashboards/ghost-shift-overview.json)
- alert rule loading from [deploy/prometheus/alerts.yml](../deploy/prometheus/alerts.yml)

## 4. Helm

The Helm chart lives in [deploy/helm/ghost-shift](../deploy/helm/ghost-shift).

Minimal install:

```bash
helm upgrade --install ghost-shift deploy/helm/ghost-shift \
  --namespace ghost-shift \
  --create-namespace \
  --set secretEnv.GATEWAY_TOKEN=replace-me \
  --set secretEnv.PUBLIC_ID_SALT=replace-me \
  --set config.GATEWAY_URL=wss://gateway.example.com/ws \
  --set ingress.enabled=true
```

Recommended workflow uses the helper script:

```bash
RELEASE=ghost-shift \
NAMESPACE=ghost-shift \
VALUES_FILE=deploy/helm/ghost-shift/values.yaml \
IMAGE_TAG=latest \
./scripts/deploy-helm.sh
```

Useful chart features:

- ingress TLS, CORS, and rate limiting annotations
- persistent storage for public history and device identity
- optional `ServiceMonitor`
- optional `PrometheusRule`

## 5. Blue-Green Deployments

Blue-green support is driven by [scripts/blue-green-deploy.sh](../scripts/blue-green-deploy.sh). It deploys color-coded Helm releases and switches a stable Service selector between them.

Deploy the inactive color:

```bash
./scripts/blue-green-deploy.sh deploy green 2026.03.14
```

Inspect active state:

```bash
./scripts/blue-green-deploy.sh status
```

Cut traffic to the new color:

```bash
HOST=ghostshift.example.com ./scripts/blue-green-deploy.sh switch green
```

Rollback is just another switch:

```bash
HOST=ghostshift.example.com ./scripts/blue-green-deploy.sh switch blue
```

For blue-green deployments, disable the chart-managed ingress on the color releases and let the stable Service or ingress created by the script own the public hostname.

## 6. Monitoring and Alerts

Operational endpoints:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /openapi.yaml`

Prometheus and Grafana assets:

- [deploy/prometheus/prometheus.yml](../deploy/prometheus/prometheus.yml)
- [deploy/prometheus/alerts.yml](../deploy/prometheus/alerts.yml)
- [deploy/grafana/dashboards/ghost-shift-overview.json](../deploy/grafana/dashboards/ghost-shift-overview.json)

Kubernetes monitoring add-ons:

- [deploy/kubernetes/monitoring-optional.yaml](../deploy/kubernetes/monitoring-optional.yaml)
- Helm values `monitoring.serviceMonitor.enabled=true`
- Helm values `monitoring.prometheusRule.enabled=true`

The metrics endpoint now exports both platform and business metrics, including:

- request rate and latency histograms
- cache hit/miss/store counters
- gateway connectivity
- public agent counts by status, zone, role, origin, and model
- public token and message totals
- average activity score by zone

## 7. Security Hardening

Production examples now include HTTPS, CORS, and rate-limiting examples:

- [deploy/nginx/ghost-shift.conf](../deploy/nginx/ghost-shift.conf)
- [deploy/Caddyfile](../deploy/Caddyfile)
- [deploy/kubernetes/ghost-shift.yaml](../deploy/kubernetes/ghost-shift.yaml)

Recommended defaults:

- publish only `443`; redirect `80` to HTTPS
- keep `/metrics` private to the cluster, VPN, or bastion
- allow CORS only for the exact portfolio or embed origins that need cross-origin API access
- apply edge rate limits to `/api/*` and `/internal-api/*`
- put Redis behind private networking if you use it for shared cache state

## 8. Post-Deploy Checks

Cache warmup:

```bash
./scripts/warm-cache.sh https://ghostshift.example.com
```

Smoke test:

```bash
./scripts/ops-smoke-test.sh https://ghostshift.example.com
```

The smoke test validates `healthz`, `readyz`, public API routes, OpenAPI export, and the presence of Prometheus business metrics.

## 9. Related Docs

- [docs/api.md](./api.md)
- [docs/performance-tuning.md](./performance-tuning.md)
- [docs/troubleshooting.md](./troubleshooting.md)
