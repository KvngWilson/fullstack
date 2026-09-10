project_id  = "YOUR_GCP_PROJECT_ID" # Replace with your GCP project ID
region      = "us-central1"
zone        = "us-central1-a"
environment = "prod"

name_prefix  = "fullstack"
cluster_name = "fullstack-prod-gke"

network_cidr     = "10.80.0.0/20"
pods_cidr        = "10.90.0.0/16"
services_cidr    = "10.100.0.0/20"
master_ipv4_cidr = "172.16.16.0/28"

machine_type   = "e2-standard-4"
disk_type      = "pd-balanced"
disk_size_gb   = 100
node_count     = 3
node_min_count = 2
node_max_count = 10

enable_private_endpoint    = false
enable_private_nodes       = true
maintenance_window_start   = "03:00"
enable_deletion_protection = true

create_network_resources            = true
create_node_service_account         = true
manage_node_service_account_iam     = true
existing_network_name               = null
existing_subnetwork_name            = null
existing_pods_range_name            = null
existing_services_range_name        = null
existing_node_service_account_email = null

master_authorized_networks = [
  {
    cidr_block   = "203.0.113.0/24"
    display_name = "replace-with-prod-admin-network"
  }
]

tags = {
  app         = "fullstack"
  team        = "devops"
  managed_by  = "terraform"
  cost_center = "engineering"
}


