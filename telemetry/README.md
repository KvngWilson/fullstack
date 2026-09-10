# Telemetry and Monitoring Assets

This folder is the canonical home for environment-level observability assets.

## Terminology

- **Observability** = the full operational picture across traces, metrics, logs, and dashboards.
- **Telemetry** = the deployable assets and guides used to run that operational stack.
- **Monitoring** = the Prometheus/Grafana configuration inside this telemetry area.

## Layout

- [MONITORING.md](/home/wilson/Desktop/fullstack/telemetry/MONITORING.md)
  - operational guide for the monitoring stack and active tracing context
- [docker-compose.monitoring.yml](/home/wilson/Desktop/fullstack/telemetry/docker-compose.monitoring.yml)
  - local monitoring stack bootstrap
- [deploy-monitoring.sh](/home/wilson/Desktop/fullstack/telemetry/deploy-monitoring.sh)
  - deployment helper for the monitoring stack
- [monitoring/](/home/wilson/Desktop/fullstack/telemetry/monitoring)
  - Prometheus config, alert rules, Grafana provisioning, and monitoring config index

## Scope

Use [server/infrastructure/observability/](/home/wilson/Desktop/fullstack/server/infrastructure/observability) for application-level tracing and metrics primitives.
Use [telemetry/](/home/wilson/Desktop/fullstack/telemetry) for Prometheus/Grafana and deployment-oriented monitoring assets.
