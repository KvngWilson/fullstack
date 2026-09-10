# Hardened Temporary Kubernetes Scaffold

These manifests mirror the current Docker Compose topology closely enough to bootstrap a Kubernetes deployment for this repository while applying safer production-oriented defaults for rollout safety, persistence, and network isolation.

## Included workloads

- `postgres`
- `redis`
- `rabbitmq`
- in-cluster `postfix`/`dovecot` mail stack
- `server` / `server-replica` Services backed by a single 2-replica API Deployment
- `worker`
- `client`
- `gateway`
- pod disruption budgets and ingress-restricting network policies

## Why this shape

The root [docker-compose.yml](/home/wilson/Desktop/fullstack/docker-compose.yml) and [nginx/proxy.conf](/home/wilson/Desktop/fullstack/nginx/proxy.conf) already expect service names like `server`, `server-replica`, `client`, `postgres`, `redis`, and `rabbitmq`. The temporary scaffold preserves those names so the existing gateway image can be reused without editing its upstream configuration.

## Apply

```bash
kubectl apply -k infra/kubernetes/
```

## HTTPS overlay

Use [infra/kubernetes/https/](/home/wilson/Desktop/fullstack/infra/kubernetes/https) for cert-manager and Let’s Encrypt support:

```bash
# Apply base first
kubectl apply -k infra/kubernetes/
# Then apply HTTPS resources/overrides
kubectl apply -k infra/kubernetes/https
```

## Hardened defaults

- namespace-level pod security labels (`baseline` enforce, `restricted` audit/warn)
- immutable application and TLS Secret stubs that must be replaced before deployment
- multi-replica `client`, `server`, and `gateway` Deployments with rolling updates
- resource requests/limits, startup probes, and graceful termination settings
- persistent volumes for `postgres`, `redis`, `rabbitmq`, and mail data/state
- NetworkPolicies that only allow edge-to-app and app-to-data ingress

## Remaining limitations

- Image names are placeholders and must be replaced with your registry paths.
- Secrets in these manifests are placeholders and must be replaced via your secret management flow before any real deployment.
- The mail stack is provisioned as an internal Postfix/Dovecot bootstrap and still needs real domains, TLS, and mailbox credentials before production use.
- Upload storage is not shared across API replicas yet.
- Database bootstrap and migration workflows still need to be wired for your target environment.
