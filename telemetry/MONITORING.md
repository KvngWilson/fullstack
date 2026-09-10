# 📊 Telemetry Monitoring Guide

## 📋 Overview

Complete observability stack for the e-commerce platform featuring:

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **Redis Exporter** - Redis metrics
- **Custom Metrics** - Application-specific metrics
- **Alerting Rules** - Automated alert notifications
- **Request Tracing** - Active correlation IDs and request-span capture at app bootstrap

## 🧭 Terminology

- **Observability** is the umbrella capability.
- **Telemetry** is this deployment/documentation layer.
- **Monitoring** is the Prometheus/Grafana configuration under [monitoring/](/home/wilson/Desktop/fullstack/telemetry/monitoring).
- **Runtime observability primitives** live in [server/infrastructure/observability/](/home/wilson/Desktop/fullstack/server/infrastructure/observability).

---

## 🚀 Quick Start

### Local Development (Docker Compose)

```bash
# Start all services with monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Access services
# Grafana: http://localhost:3000 (admin/admin123)
# Prometheus: http://localhost:9091
# Application: http://localhost:8080
# API: http://localhost:5001
```

### Kubernetes Deployment

```bash
# Deploy monitoring stack
./deploy-monitoring.sh

# Or manually
kubectl apply -f k8s/prometheus-config.yaml
kubectl apply -f k8s/prometheus-deployment.yaml
kubectl apply -f k8s/grafana-config.yaml
kubectl apply -f k8s/grafana-deployment.yaml
kubectl apply -f k8s/redis-exporter.yaml

# Port forward Grafana
kubectl port-forward -n <monitoring-namespace> svc/grafana 3000:3000

# Port forward Prometheus
kubectl port-forward -n <monitoring-namespace> svc/prometheus 9090:9090
```

---

## 📊 Available Metrics

### Application Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `http_request_duration_seconds` | Histogram | HTTP request latency |
| `active_connections` | Gauge | Current active connections |
| `grocery_items_total` | Gauge | Total number of grocery items |
| `redis_operations_total` | Counter | Redis operations by type and status |
| `redis_operation_duration_seconds` | Histogram | Redis operation latency |

### System Metrics (Default)

- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_heap_size_total_bytes` - Heap memory
- `nodejs_heap_size_used_bytes` - Used heap memory

### Redis Metrics

- `redis_up` - Redis availability
- `redis_connected_clients` - Connected clients
- `redis_memory_used_bytes` - Memory usage
- `redis_memory_max_bytes` - Maximum memory
- `redis_commands_processed_total` - Total commands
- `redis_keyspace_hits_total` - Cache hits
- `redis_keyspace_misses_total` - Cache misses

---

## 📈 Grafana Dashboards

### Platform Monitoring Dashboard

Pre-configured dashboard with 12 panels:

1. **Server Status** - Service health indicator
2. **Redis Status** - Redis health indicator
3. **Total Items** - Current item count
4. **Active Connections** - Live connection count
5. **HTTP Request Rate** - Requests per second by endpoint
6. **HTTP Response Time** - p50, p95, p99 latency
7. **CPU Usage** - CPU utilization over time
8. **Memory Usage** - Memory consumption
9. **Redis Operations Rate** - Operations per second
10. **Redis Operation Latency** - Redis response times
11. **Redis Memory Usage** - Redis memory consumption
12. **Redis Connections** - Redis client connections

### Access Dashboards

```bash
# Default credentials
Username: admin
Password: admin123

# Change password on first login!
```

### Import Additional Dashboards

1. Go to Grafana → Dashboards → Import
2. Enter dashboard ID or upload JSON:
   - Node Exporter Full: `1860`
   - Redis Dashboard: `763`
   - Kubernetes Cluster: `7249`

---

## 🚨 Alert Rules

### Configured Alerts

| Alert Name | Condition | Severity | Duration |
|-----------|-----------|----------|----------|
| HighCPUUsage | CPU > 80% | warning | 5m |
| HighMemoryUsage | Memory > 400MB | warning | 5m |
| PodDown | Service unavailable | critical | 2m |
| HighErrorRate | 5xx errors > 5% | warning | 5m |
| RedisDown | Redis unavailable | critical | 2m |
| SlowResponseTime | p95 latency > 1s | warning | 5m |

### View Active Alerts

```bash
# Prometheus UI
http://localhost:9090/alerts

# Or via kubectl
kubectl logs -n <monitoring-namespace> -l app=prometheus | grep -i alert
```

---

## 🔍 Querying Metrics

### Prometheus Query Examples

```promql
# Request rate per minute
rate(http_requests_total[1m])

# Average response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate percentage
(rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100

# Redis hit rate
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))

# Memory usage growth
deriv(process_resident_memory_bytes[10m])

# Active connections trend
avg_over_time(active_connections[5m])
```

### Using Prometheus UI

1. Open http://localhost:9090
2. Go to **Graph** tab
3. Enter PromQL query
4. Click **Execute**
5. View as **Table** or **Graph**

---

## 📦 Docker Compose Configuration

### Services

```yaml
prometheus:   # Port 9091
grafana:      # Port 3000
redis-exporter: # Port 9121
server:       # Ports 5001 (API), 9090 (Metrics)
client:       # Port 8080
redis:        # Port 6380
```

### Volumes

- `prometheus-data` - Prometheus time-series database
- `grafana-data` - Grafana dashboards and settings
- `redis-data` - Redis persistence

### Start Specific Services

```bash
# Only monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d prometheus grafana redis-exporter

# Everything except monitoring
docker-compose -f docker-compose.dev.yml up -d

# Combine both
docker-compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml up -d
```

---

## 🔧 Configuration

### Prometheus Configuration

Edit `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s     # How often to scrape targets
  evaluation_interval: 15s # How often to evaluate rules

scrape_configs:
  - job_name: 'platform-server'
    static_configs:
      - targets: ['server:5000']
```

### Alert Rules

Edit `monitoring/rules.yml`:

```yaml
groups:
  - name: custom-alerts
    rules:
      - alert: CustomAlert
        expr: metric > threshold
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alert summary"
```

### Grafana Data Sources

Edit `monitoring/grafana/datasources.yml`:

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

---

## 🐛 Troubleshooting

### Prometheus Not Scraping Metrics

```bash
# Check targets status
curl http://localhost:9091/targets

# View Prometheus logs
docker logs <prometheus-container>

# Verify metrics endpoint
curl http://localhost:5001/metrics
```

### Grafana Dashboard Empty

```bash
# Check data source connection
# Grafana → Configuration → Data Sources → Prometheus → Test

# Verify Prometheus has data
curl 'http://localhost:9091/api/v1/query?query=up'

# Check time range in dashboard (top right)
```

### Redis Exporter Not Working

```bash
# Check Redis connectivity
docker exec <redis-exporter-container> redis-cli -h redis ping

# View exporter logs
docker logs <redis-exporter-container>

# Test metrics endpoint
curl http://localhost:9121/metrics
```

### High Memory Usage

```bash
# Check Prometheus retention
# Default: 7 days for Docker, 30 days for Kubernetes

# Reduce retention
prometheus --storage.tsdb.retention.time=3d

# Check storage size
du -sh prometheus-data/
```

---

## 📊 Best Practices

### 1. Set Appropriate Retention

```yaml
# Prometheus retention
--storage.tsdb.retention.time=30d  # Keep 30 days
--storage.tsdb.retention.size=10GB # Or max 10GB
```

### 2. Use Recording Rules for Complex Queries

```yaml
# monitoring/rules.yml
groups:
  - name: recording_rules
    interval: 30s
    rules:
      - record: job:request_rate:5m
        expr: rate(http_requests_total[5m])
```

### 3. Configure Alert Thresholds

```yaml
# Adjust thresholds based on your workload
- alert: HighCPUUsage
  expr: rate(process_cpu_seconds_total[5m]) > 0.8  # Adjust threshold
  for: 5m  # Adjust duration
```

### 4. Add Labels to Metrics

```javascript
// server/metrics.js
httpRequestTotal.inc({
  method: req.method,
  route: req.route.path,
  status: res.statusCode,
  environment: process.env.NODE_ENV  // Add environment
});
```

### 5. Create Custom Dashboards

- Use variables for filtering
- Add annotations for deployments
- Set appropriate refresh intervals
- Save dashboard versions

---

## 🔒 Security

### Change Default Passwords

```bash
# Grafana
GF_SECURITY_ADMIN_PASSWORD=<strong-password>

# Kubernetes Secret
kubectl create secret generic grafana-credentials \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=<strong-password> \
  -n <monitoring-namespace>
```

### Enable Authentication

```yaml
# Prometheus (basic auth)
basic_auth:
  username: admin
  password: <password>

# Grafana (OAuth)
GF_AUTH_GOOGLE_ENABLED=true
GF_AUTH_GOOGLE_CLIENT_ID=<client-id>
GF_AUTH_GOOGLE_CLIENT_SECRET=<secret>
```

### Network Policies

```yaml
# Restrict Prometheus scraping
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prometheus-ingress
spec:
  podSelector:
    matchLabels:
      app: server
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: prometheus
      ports:
        - port: 9090
```

---

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Node.js Prometheus Client](https://github.com/siimon/prom-client)

---

## 🎓 Next Steps

1. **Customize dashboards** for your specific needs
2. **Set up Alertmanager** for notifications (Slack, email, PagerDuty)
3. **Add more exporters** (Node Exporter, cAdvisor)
4. **Export active traces** to Jaeger, Zipkin, or OpenTelemetry collector
5. **Set up log aggregation** with ELK stack or Loki
6. **Configure long-term storage** with Thanos or Cortex
7. **Create SLI/SLO dashboards** for reliability tracking

---

Your monitoring stack is ready! 📊✨
