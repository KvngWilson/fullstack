output "cluster_name" {
  description = "Created GKE cluster name."
  value       = google_container_cluster.app.name
}

output "cluster_location" {
  description = "Created GKE cluster region."
  value       = google_container_cluster.app.location
}

output "network_name" {
  description = "Effective VPC name used by the cluster."
  value       = google_compute_network.app[0].name
}

output "subnetwork_name" {
  description = "Effective subnetwork name used by the cluster."
  value       = google_compute_subnetwork.app[0].name
}

output "node_service_account_email" {
  description = "Effective node service account email."
  value       = local.node_service_account_email
}

output "node_pool_name" {
  description = "Managed node pool name."
  value       = google_container_node_pool.app.name
}

output "connect_command" {
  description = "Command to configure kubectl for the cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.app.name} --region ${google_container_cluster.app.location} --project ${var.project_id}"
}

output "gateway_static_ip_name" {
  description = "Reserved regional external IP name for the gateway."
  value       = google_compute_address.gateway.name
}

output "gateway_static_ip_address" {
  description = "Reserved regional external IP address for the gateway."
  value       = google_compute_address.gateway.address
}

output "dns_zone_name" {
  description = "Cloud DNS managed zone name, when enabled."
  value       = try(local.dns_managed_zone_name, null)
}

output "dns_zone_dns_name" {
  description = "Cloud DNS zone apex name, when enabled."
  value       = try(local.dns_managed_zone_dns_name, null)
}

output "dns_name_servers" {
  description = "Nameservers assigned to the Cloud DNS managed zone."
  value = var.enable_cloud_dns ? (
    var.dns_use_existing_managed_zone ? try(data.google_dns_managed_zone.app[0].name_servers, []) : try(google_dns_managed_zone.app[0].name_servers, [])
  ) : []
}
