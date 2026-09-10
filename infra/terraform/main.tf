locals {
  cluster_name           = var.cluster_name != null && trimspace(var.cluster_name) != "" ? var.cluster_name : "${var.name_prefix}-${var.environment}-gke"
  network_name           = "${var.name_prefix}-${var.environment}-gke-network"
  subnet_name            = "${var.name_prefix}-${var.environment}-gke-subnet"
  router_name            = "${var.name_prefix}-${var.environment}-gke-router"
  gateway_static_ip_name = "${var.name_prefix}-${var.environment}-gateway-ip"
  nat_name               = "${var.name_prefix}-${var.environment}-gke-nat"
  node_service_name      = "${var.name_prefix}-${var.environment}-nodes"
  pods_range_name        = "${var.name_prefix}-${var.environment}-pods"
  services_range_name    = "${var.name_prefix}-${var.environment}-services"
  node_locations         = length(var.node_locations) > 0 ? var.node_locations : null

  dns_zone_name_input = var.dns_zone_name != null ? trimspace(var.dns_zone_name) : ""
  dns_zone_default    = "${var.name_prefix}-${var.environment}-dns"
  dns_zone_name       = local.dns_zone_name_input != "" ? local.dns_zone_name_input : local.dns_zone_default
  dns_domain_input    = var.dns_domain_name != null ? trimspace(var.dns_domain_name) : ""

  network_ref = google_compute_network.app[0].id
  subnet_ref  = google_compute_subnetwork.app[0].id

  effective_pods_range_name     = local.pods_range_name
  effective_services_range_name = local.services_range_name

  node_service_account_email = var.create_node_service_account ? google_service_account.gke_nodes[0].email : (
    try(trimspace(var.existing_node_service_account_email) != "", false) ? trimspace(var.existing_node_service_account_email) : null
  )
  use_private_cluster = var.enable_private_nodes || var.enable_private_endpoint
}

resource "google_compute_network" "app" {
  count                   = var.create_network_resources ? 1 : 0
  name                    = local.network_name
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "app" {
  count                    = var.create_network_resources ? 1 : 0
  name                     = local.subnet_name
  region                   = var.region
  network                  = google_compute_network.app[0].id
  ip_cidr_range            = var.network_cidr
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }

  secondary_ip_range {
    range_name    = local.pods_range_name
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = local.services_range_name
    ip_cidr_range = var.services_cidr
  }
}

resource "google_compute_router" "app" {
  count   = var.create_network_resources ? 1 : 0
  name    = local.router_name
  region  = var.region
  network = google_compute_network.app[0].id
}

resource "google_compute_address" "gateway" {
  name    = local.gateway_static_ip_name
  region  = var.region
  project = var.project_id
}

resource "google_compute_router_nat" "app" {
  count                              = var.create_network_resources && var.enable_private_nodes ? 1 : 0
  name                               = local.nat_name
  router                             = google_compute_router.app[0].name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.app[0].id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_dns_managed_zone" "app" {
  count = var.enable_cloud_dns && !var.dns_use_existing_managed_zone ? 1 : 0

  name        = local.dns_zone_name
  dns_name    = "${trimsuffix(local.dns_domain_input, ".")}."
  description = var.dns_description
  project     = var.project_id

  visibility = "public"

  lifecycle {
    precondition {
      condition     = try(trimspace(local.dns_domain_input) != "", false)
      error_message = "When enable_cloud_dns is true and dns_use_existing_managed_zone is false, dns_domain_name must be provided."
    }
  }
}

data "google_dns_managed_zone" "app" {
  count = var.enable_cloud_dns && var.dns_use_existing_managed_zone ? 1 : 0
  name  = var.dns_existing_zone_name
}

locals {
  dns_managed_zone_name = var.enable_cloud_dns ? (
    var.dns_use_existing_managed_zone ? data.google_dns_managed_zone.app[0].name : google_dns_managed_zone.app[0].name
  ) : null
  dns_managed_zone_dns_name = var.enable_cloud_dns ? (
    var.dns_use_existing_managed_zone ? data.google_dns_managed_zone.app[0].dns_name : google_dns_managed_zone.app[0].dns_name
  ) : null
}

resource "google_dns_record_set" "apex_a" {
  count = var.enable_cloud_dns ? 1 : 0

  managed_zone = local.dns_managed_zone_name
  name         = local.dns_managed_zone_dns_name
  type         = "A"
  ttl          = var.dns_record_ttl
  rrdatas      = length(var.dns_record_ipv4_addresses) > 0 ? var.dns_record_ipv4_addresses : [google_compute_address.gateway.address]
  project      = var.project_id
}

resource "google_dns_record_set" "www_cname" {
  count = var.enable_cloud_dns && var.dns_create_www_record ? 1 : 0

  managed_zone = local.dns_managed_zone_name
  name         = "www.${trimsuffix(local.dns_managed_zone_dns_name, ".")}."
  type         = "CNAME"
  ttl          = var.dns_record_ttl
  rrdatas      = [local.dns_managed_zone_dns_name]
  project      = var.project_id
}

resource "google_dns_record_set" "admin_cname" {
  count = var.enable_cloud_dns && var.dns_create_admin_record ? 1 : 0

  managed_zone = local.dns_managed_zone_name
  name         = "admin.${trimsuffix(local.dns_managed_zone_dns_name, ".")}."
  type         = "CNAME"
  ttl          = var.dns_record_ttl
  rrdatas      = [local.dns_managed_zone_dns_name]
  project      = var.project_id
}

resource "google_service_account" "gke_nodes" {
  count        = var.create_node_service_account ? 1 : 0
  account_id   = local.node_service_name
  display_name = "GKE node service account for ${local.cluster_name}"
}

resource "google_project_iam_member" "gke_nodes_logging" {
  count   = var.manage_node_service_account_iam && local.node_service_account_email != null ? 1 : 0
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${local.node_service_account_email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring" {
  count   = var.manage_node_service_account_iam && local.node_service_account_email != null ? 1 : 0
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${local.node_service_account_email}"
}

resource "google_project_iam_member" "gke_nodes_resource_metadata" {
  count   = var.manage_node_service_account_iam && local.node_service_account_email != null ? 1 : 0
  project = var.project_id
  role    = "roles/stackdriver.resourceMetadata.writer"
  member  = "serviceAccount:${local.node_service_account_email}"
}

resource "google_project_iam_member" "gke_nodes_artifact_registry" {
  count   = var.manage_node_service_account_iam && local.node_service_account_email != null ? 1 : 0
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${local.node_service_account_email}"
}

resource "google_project_iam_member" "gke_nodes_container_default" {
  count   = var.manage_node_service_account_iam && local.node_service_account_email != null ? 1 : 0
  project = var.project_id
  role    = "roles/container.defaultNodeServiceAccount"
  member  = "serviceAccount:${local.node_service_account_email}"
}

resource "google_container_cluster" "app" {
  name     = local.cluster_name
  location = var.zone

  network    = local.network_ref
  subnetwork = local.subnet_ref

  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = var.enable_deletion_protection

  ip_allocation_policy {
    cluster_secondary_range_name  = local.effective_pods_range_name
    services_secondary_range_name = local.effective_services_range_name
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  dynamic "private_cluster_config" {
    for_each = local.use_private_cluster ? [1] : []
    content {
      enable_private_nodes    = var.enable_private_nodes
      enable_private_endpoint = var.enable_private_endpoint
      master_ipv4_cidr_block  = var.master_ipv4_cidr
    }
  }


  resource_labels = merge(
    var.tags,
    {
      environment = var.environment
      managed-by  = "terraform"
      workload    = var.name_prefix
    }
  )

  lifecycle {
    precondition {
      condition     = var.create_node_service_account || local.node_service_account_email != null || !var.manage_node_service_account_iam
      error_message = "When create_node_service_account is false and manage_node_service_account_iam is true, existing_node_service_account_email must be provided."
    }

    precondition {
      condition     = !var.enable_private_endpoint || var.enable_private_nodes
      error_message = "enable_private_endpoint requires enable_private_nodes=true."
    }
  }
}

resource "google_container_node_pool" "app" {
  name       = "${var.name_prefix}-${var.environment}-default-pool"
  location   = var.zone
  cluster    = google_container_cluster.app.name
  node_count = var.node_count

  node_locations = [var.zone]

  autoscaling {
    min_node_count = var.node_min_count
    max_node_count = var.node_max_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  node_config {
    machine_type    = var.machine_type
    disk_type       = var.disk_type
    disk_size_gb    = var.disk_size_gb
    service_account = local.node_service_account_email

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = {
      workload    = var.name_prefix
      environment = var.environment
    }

    tags = ["${var.name_prefix}-${var.environment}-gke-node"]

    workload_metadata_config {
      mode = "GCE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  depends_on = [
    google_project_iam_member.gke_nodes_logging,
    google_project_iam_member.gke_nodes_monitoring,
    google_project_iam_member.gke_nodes_resource_metadata,
    google_project_iam_member.gke_nodes_artifact_registry,
    google_project_iam_member.gke_nodes_container_default,
  ]
}
