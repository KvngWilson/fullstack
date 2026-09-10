project_id             = "fullstack-ecom" # Replace with your GCP project ID
region                 = "us-east1"
zone                   = "us-east1-b"
environment            = "dev"
dns_domain_name        = "sovereign-ives.com"
dns_existing_zone_name = "fullstack-dns-zone"
gcp_svc_key            = "../fullstack-ecom-02507020a671.json" # Set absolute/valid relative key path or leave empty to use ADC

name_prefix  = "fullstack"
cluster_name = "fullstack-dev-gke"

network_cidr     = "10.50.0.0/20"
pods_cidr        = "10.60.0.0/16"
services_cidr    = "10.70.0.0/20"
master_ipv4_cidr = "172.16.0.0/28"

machine_type   = "e2-standard-2"
disk_type      = "pd-standard"
disk_size_gb   = 50
node_count     = 2
node_min_count = 1
node_max_count = 3

enable_cloud_dns              = true
enable_private_endpoint       = false
enable_private_nodes          = false
maintenance_window_start      = "03:00"
enable_deletion_protection    = false
dns_use_existing_managed_zone = true


# Flip these to false and fill the existing_* values when your IAM principal
# cannot create shared networking or service accounts.
create_node_service_account         = false
manage_node_service_account_iam     = true
existing_node_service_account_email = "fullstack@fullstack-ecom.iam.gserviceaccount.com"

master_authorized_networks = [
  {
    cidr_block   = "99.224.116.72/32"
    display_name = "fullstack-admin-network"
  }
]

tags = {
  app        = "fullstack"
  team       = "devops"
  managed_by = "terraform"
}
