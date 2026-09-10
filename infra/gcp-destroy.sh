#!/bin/bash

set -e

echo "======================================"
echo "Destroy GCP Infrastructure"
echo "======================================"
echo ""

# Set environment (default to dev)
ENVIRONMENT="${1:-dev}"

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo "❌ Invalid environment. Use 'dev' or 'prod'"
    exit 1
fi

echo "🗑️  Destroying: $ENVIRONMENT environment"
echo ""

# Warning
echo "⚠️  WARNING: This will destroy all infrastructure including:"
echo "   - GKE Cluster"
echo "   - VPC Network"
echo "   - All resources in the cluster"
echo "   - Load balancers"
echo "   - Persistent disks"
echo ""

read -p "Are you absolutely sure? Type 'destroy' to confirm: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
    echo "Destruction cancelled."
    exit 0
fi

cd terraform

# Destroy infrastructure
echo "💥 Destroying Terraform-managed infrastructure..."
terraform destroy -var-file="environments/$ENVIRONMENT/terraform.tfvars" -auto-approve

echo ""
echo "✅ Infrastructure destroyed!"
echo ""
