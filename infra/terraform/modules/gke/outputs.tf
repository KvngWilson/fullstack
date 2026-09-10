output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.primary.name
}

output "cluster_id" {
  description = "GKE cluster ID"
  value       = google_container_cluster.primary.id
}

output "endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}

output "node_pool_name" {
  description = "Node pool name"
  value       = var.enable_autopilot ? null : try(google_container_node_pool.primary_nodes[0].name, null)
}

output "service_account_email" {
  description = "Service account email for GKE nodes"
  value       = var.enable_autopilot ? null : try(google_service_account.gke_node[0].email, null)
}