resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  # Use regional cluster for high availability
  # For autopilot, node configurations are managed automatically
  enable_autopilot = var.enable_autopilot

  # Network configuration
  network    = var.network
  subnetwork = var.subnetwork

  # IP allocation for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_endpoint = var.enable_private_endpoint
    enable_private_nodes    = var.enable_private_nodes
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
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

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Addons
  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    network_policy_config {
      disabled = false
    }

    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "PROVIDER_UNSPECIFIED"
  }

  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Resource labels
  resource_labels = merge(
    var.tags,
    {
      environment = var.environment
    }
  )

  # Logging and monitoring
  logging_service    = var.enable_monitoring ? "logging.googleapis.com/kubernetes" : "none"
  monitoring_service = var.enable_monitoring ? "monitoring.googleapis.com/kubernetes" : "none"

  # Remove default node pool
  remove_default_node_pool = !var.enable_autopilot
  initial_node_count       = var.enable_autopilot ? null : 1

  # Lifecycle
  lifecycle {
    ignore_changes = [
      node_pool,
      initial_node_count,
    ]
  }
}

# Node pool (only created if not using autopilot)
resource "google_container_node_pool" "primary_nodes" {
  count = var.enable_autopilot ? 0 : 1

  name     = "${var.cluster_name}-node-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name
  project  = var.project_id

  initial_node_count = var.node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    preemptible  = false
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = "pd-standard"

    # Google recommends custom service accounts with minimal permissions
    service_account = google_service_account.gke_node[0].email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = merge(
      var.tags,
      {
        environment = var.environment
      }
    )

    tags = ["gke-node", "${var.cluster_name}-node"]

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
    ]
  }
}

# Service account for GKE nodes
resource "google_service_account" "gke_node" {
  count = var.enable_autopilot ? 0 : 1

  account_id   = "${var.cluster_name}-node-sa"
  display_name = "Service Account for ${var.cluster_name} GKE nodes"
  project      = var.project_id
}

# IAM bindings for node service account
resource "google_project_iam_member" "gke_node_logging" {
  count = var.enable_autopilot ? 0 : 1

  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_node[0].email}"
}

resource "google_project_iam_member" "gke_node_monitoring" {
  count = var.enable_autopilot ? 0 : 1

  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_node[0].email}"
}

resource "google_project_iam_member" "gke_node_registry" {
  count = var.enable_autopilot ? 0 : 1

  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_node[0].email}"
}
