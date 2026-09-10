# Monitoring Configuration

This folder contains the monitoring-specific configuration used by the telemetry stack.

## Contents

- [prometheus.yml](/home/wilson/Desktop/fullstack/telemetry/monitoring/prometheus.yml)
  - Prometheus scrape configuration
- [rules.yml](/home/wilson/Desktop/fullstack/telemetry/monitoring/rules.yml)
  - alert and rule definitions
- [grafana/](/home/wilson/Desktop/fullstack/telemetry/monitoring/grafana)
  - Grafana datasources, dashboards, and provisioning assets

## Relationship to the rest of the layout

- [telemetry/](/home/wilson/Desktop/fullstack/telemetry) is the environment-level home for the monitoring stack.
- [server/infrastructure/observability/](/home/wilson/Desktop/fullstack/server/infrastructure/observability) is the runtime-code home for tracing and metrics primitives.
