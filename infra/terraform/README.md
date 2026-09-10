# GKE Infrastructure Stack

This Terraform stack is the canonical GKE provisioning entrypoint for the repository. It provisions a hardened GCP network and GKE cluster that can host the manifests in [infra/kubernetes/temp/](/home/wilson/Desktop/fullstack/infra/kubernetes/temp).

## What it creates

- dedicated VPC and private subnet with flow logs and Private Google Access
- Cloud Router and Cloud NAT for private-node egress
- regional private GKE cluster with Workload Identity
- Calico network policy support
- autoscaled managed node pool
- dedicated least-privilege node service account
- maintenance window, release channel, secure boot, and integrity monitoring defaults

Reusable building blocks remain under [modules/](/home/wilson/Desktop/fullstack/infra/terraform/modules), but the root stack is what the checked-in environment files target.

## Restricted-IAM deployments

If your IAM principal cannot create networks or service accounts, set:

- `create_network_resources = false`
- `create_node_service_account = false`

Then provide all of:

- `existing_network_name`
- `existing_subnetwork_name`
- `existing_pods_range_name`
- `existing_services_range_name`
- `existing_node_service_account_email`

This lets the stack create only the GKE control plane and node pool against pre-provisioned shared infrastructure.

If you rely on an existing node service account, keep `manage_node_service_account_iam = true` so Terraform can bind required roles (including `roles/container.defaultNodeServiceAccount`). If your principal cannot bind IAM roles, set `manage_node_service_account_iam = false` and ensure those roles are already granted.

## Usage

1. Choose an environment variables file or copy the example:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Checked-in environment presets:

- [environments/dev/terraform.tfvars](/home/wilson/Desktop/fullstack/infra/terraform/environments/dev/terraform.tfvars)
- [environments/prod/terraform.tfvars](/home/wilson/Desktop/fullstack/infra/terraform/environments/prod/terraform.tfvars)

2. Replace all placeholder values, especially:

- `project_id`
- `master_authorized_networks`
- image registry references in the Kubernetes manifests
- secret placeholders in [app-secrets.yaml](/home/wilson/Desktop/fullstack/infra/kubernetes/temp/app-secrets.yaml)

3. Plan and apply:

```bash
terraform init
terraform plan -var-file=environments/dev/terraform.tfvars -out tfplan
terraform apply tfplan
```

4. Fetch cluster credentials with the output command, then apply the Kubernetes manifests:

```bash
kubectl apply -k infra/kubernetes/temp
```

## Intentional temporary gaps

- This stack does not yet provision managed Postgres, Redis, secret managers, or shared object storage.
- Public ingress is still represented as a `LoadBalancer` Service instead of a fully managed ingress controller.
- The application manifests still use placeholder image tags and bootstrap Secrets that must be replaced before use.

## Optional Cloud DNS

Terraform now reserves a regional external IP for the gateway automatically.

Set `enable_cloud_dns = true` and either:

- provide `dns_domain_name` to create a new public Cloud DNS managed zone, or
- set `dns_use_existing_managed_zone = true` and provide `dns_existing_zone_name` to reuse an existing zone

Terraform creates:

- an apex A record
- `www` and `admin` CNAMEs pointing at the apex

The apex A record points at the reserved gateway IP by default. If you also provide `dns_record_ipv4_addresses`, Terraform uses those addresses instead.

Use the emitted `gateway_static_ip_address` and `dns_name_servers` outputs to validate routing and delegate the domain at your registrar.
