terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone

  credentials = trimspace(var.gcp_svc_key) == "" ? null : (
    can(jsondecode(var.gcp_svc_key)) ? trimspace(var.gcp_svc_key) : file(var.gcp_svc_key)
  )
}
