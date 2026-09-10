# Kubernetes Deployment Notes

This repo includes Kubernetes manifests for the ecommerce platform under `infra/kubernetes/`.

## What is deployed

- client frontend
- server API
- Redis
- RabbitMQ
- PostgreSQL
- gateway / ingress resources

## Current usage

- Local clusters can use `admin.localhost` and `localhost` routing.
- Environment-specific URLs and certificates live in the manifest overlays.
- Health endpoints come from the server runtime, not from these docs.

## Useful commands

```bash
kubectl apply -k infra/kubernetes/
kubectl apply -k infra/kubernetes/https
kubectl get pods
kubectl logs -f deployment/server
kubectl rollout restart deployment/server
```

## Notes

- Keep this guide aligned with the manifests, not with past project names.
- Prefer environment variables and overlays for hostnames, origins, and TLS settings.
- Replace placeholder values in [app-secrets.yaml](/home/wilson/Desktop/fullstack/infra/kubernetes/app-secrets.yaml) and [mail-tls.yaml](/home/wilson/Desktop/fullstack/infra/kubernetes/mail-tls.yaml) before deployment.
- Apply [infra/kubernetes/](/home/wilson/Desktop/fullstack/infra/kubernetes/) before [infra/kubernetes/https/](/home/wilson/Desktop/fullstack/infra/kubernetes/https/).
