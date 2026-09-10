# GCP Terraform Notes

This guide covers the GCP/Terraform deployment layer for the ecommerce platform.

## Scope

- GKE cluster provisioning
- VPC, subnet, and NAT setup
- Artifact Registry for images
- ingress and load balancer resources
- monitoring and alerting hooks

## Current guidance

- Keep project, region, and domain values environment-specific.
- Build client and server images separately before deployment.
- Align Terraform variables with the Kubernetes overlays in `infra/kubernetes/`.

## Notes

- Do not reuse old project names or sample domains in new environments.
- Update this guide whenever the Terraform modules or cluster layout change.
