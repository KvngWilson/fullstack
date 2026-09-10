variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "network" {
  description = "VPC network name"
  type        = string
}

variable "subnetwork" {
  description = "Subnet name"
  type        = string
}

variable "node_count" {
  description = "Number of nodes"
  type        = number
  default     = 2
}

variable "machine_type" {
  description = "Machine type for nodes"
  type        = string
  default     = "e2-medium"
}

variable "min_node_count" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes"
  type        = number
  default     = 5
}

variable "disk_size_gb" {
  description = "Disk size in GB"
  type        = number
  default     = 50
}

variable "enable_autopilot" {
  description = "Enable Autopilot mode"
  type        = bool
  default     = false
}

variable "enable_private_endpoint" {
  description = "Enable private endpoint"
  type        = bool
  default     = false
}

variable "enable_private_nodes" {
  description = "Enable private nodes"
  type        = bool
  default     = true
}

variable "master_ipv4_cidr_block" {
  description = "Master IPv4 CIDR block"
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_monitoring" {
  description = "Enable monitoring"
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
  description = "Tags"
  type        = map(string)
  default     = {}
}
