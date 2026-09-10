variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "gcp_svc_key" {
  description = "Optional GCP service account key JSON content or local file path."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition = (
      trimspace(var.gcp_svc_key) == "" ||
      can(jsondecode(var.gcp_svc_key)) ||
      fileexists(var.gcp_svc_key)
    )
    error_message = "gcp_svc_key must be empty, raw JSON credentials content, or a path to an existing key file."
  }
}

variable "region" {
  description = "GCP region for the cluster and network resources."
  type        = string
  default     = "us-east1"
}

variable "zone" {
  description = "Primary zone hint for provider operations."
  type        = string
  default     = "us-east1-b"
}

variable "environment" {
  description = "Environment name used in resource naming and labels."
  type        = string
  default     = "dev"
}

variable "name_prefix" {
  description = "Resource name prefix."
  type        = string
  default     = "fullstack"
}

variable "cluster_name" {
  description = "Optional override for the GKE cluster name."
  type        = string
  default     = null
}

variable "create_network_resources" {
  description = "Whether Terraform should create the VPC, subnet, router, and NAT resources."
  type        = bool
  default     = true
}

variable "network_cidr" {
  description = "Primary subnet CIDR for the cluster."
  type        = string
  default     = "10.50.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR range for Pods."
  type        = string
  default     = "10.60.0.0/16"
}

variable "services_cidr" {
  description = "Secondary CIDR range for Services."
  type        = string
  default     = "10.70.0.0/20"
}

variable "master_ipv4_cidr" {
  description = "Private CIDR range used by the GKE control plane."
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_cloud_dns" {
  description = "Whether Terraform should provision a public Cloud DNS managed zone."
  type        = bool
  default     = false
}

variable "dns_use_existing_managed_zone" {
  description = "Whether Terraform should use an existing Cloud DNS managed zone instead of creating a new one."
  type        = bool
  default     = false
}

variable "dns_zone_name" {
  description = "Optional override for the Cloud DNS managed zone name. When null, Terraform derives a default from the name prefix and environment."
  type        = string
  default     = null
}

variable "dns_existing_zone_name" {
  description = "Existing Cloud DNS managed zone name to use when dns_use_existing_managed_zone is true."
  type        = string
  default     = null

  validation {
    condition = (
      !var.dns_use_existing_managed_zone ||
      trimspace(var.dns_existing_zone_name != null ? var.dns_existing_zone_name : "") != ""
    )
    error_message = "dns_existing_zone_name must be provided when dns_use_existing_managed_zone is true."
  }
}

variable "dns_domain_name" {
  description = "DNS zone apex name, such as example.com."
  type        = string
  default     = null
}

variable "dns_description" {
  description = "Description for the Cloud DNS managed zone."
  type        = string
  default     = "Public DNS zone for the fullstack platform"
}

variable "dns_record_ttl" {
  description = "TTL in seconds for DNS records created by Terraform."
  type        = number
  default     = 300
}

variable "dns_record_ipv4_addresses" {
  description = "IPv4 addresses used for the apex A record."
  type        = list(string)
  default     = []
}

variable "dns_create_www_record" {
  description = "Whether Terraform should create a www CNAME record pointing at the apex."
  type        = bool
  default     = true
}

variable "dns_create_admin_record" {
  description = "Whether Terraform should create an admin CNAME record pointing at the apex."
  type        = bool
  default     = true
}


variable "machine_type" {
  description = "GCE machine type for the node pool."
  type        = string
  default     = "e2-standard-4"
}

variable "disk_type" {
  description = "Node disk type."
  type        = string
  default     = "pd-balanced"
}

variable "disk_size_gb" {
  description = "Node disk size in GB."
  type        = number
  default     = 50
}

variable "create_node_service_account" {
  description = "Whether Terraform should create the node service account and its project IAM bindings."
  type        = bool
  default     = true
}

variable "existing_node_service_account_email" {
  description = "Existing node service account email to use when create_node_service_account is false."
  type        = string
  default     = null
}

variable "manage_node_service_account_iam" {
  description = "Whether Terraform should bind required project roles for the selected node service account."
  type        = bool
  default     = true
}

variable "node_count" {
  description = "Initial node count for the autoscaled pool."
  type        = number
  default     = 1
}

variable "node_min_count" {
  description = "Minimum number of nodes in the autoscaled pool."
  type        = number
  default     = 1
}

variable "node_max_count" {
  description = "Maximum number of nodes in the autoscaled pool."
  type        = number
  default     = 4
}

variable "node_locations" {
  description = "Optional zonal overrides for the regional node pool."
  type        = list(string)
  default     = []
}

variable "maintenance_window_start" {
  description = "Daily maintenance window start time in UTC, HH:MM format."
  type        = string
  default     = "03:00"
}

variable "enable_deletion_protection" {
  description = "Whether to enable deletion protection on the GKE cluster."
  type        = bool
  default     = true
}

variable "enable_private_endpoint" {
  description = "Whether the GKE control plane should use a private endpoint only."
  type        = bool
  default     = false
}

variable "enable_private_nodes" {
  description = "Whether nodes should be provisioned without public IPs."
  type        = bool
  default     = true
}

variable "master_authorized_networks" {
  description = "CIDR blocks allowed to reach the GKE control plane."
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "203.0.113.0/24"
      display_name = "replace-with-admin-network"
    }
  ]
}

variable "tags" {
  description = "Additional labels to apply to supported resources."
  type        = map(string)
  default     = {}
}

