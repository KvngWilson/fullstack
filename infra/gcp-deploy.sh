#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/terraform"


echo "======================================"
echo "Fullstack - GCP Terraform Deploy"
echo "======================================"
echo ""

# Check prerequisites
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install Terraform first."
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK (gcloud) is not installed. Please install it first."
    exit 1
fi

# Set environment (default to dev)
ENVIRONMENT="${1:-dev}"

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo "❌ Invalid environment. Use 'dev' or 'prod'"
    exit 1
fi

echo "🚀 Deploying to: $ENVIRONMENT"
echo ""

# Get current GCP project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
echo "Current GCP Project: $CURRENT_PROJECT"
echo ""

# Confirm deployment
read -p "Do you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

cd "$TERRAFORM_DIR"

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init -upgrade

# Validate configuration
echo "✅ Validating Terraform configuration..."
terraform validate

# Plan deployment
echo "📋 Planning deployment..."
terraform plan -var-file="environments/$ENVIRONMENT/terraform.tfvars" -out=tfplan

echo ""
echo "Review the plan above."
read -p "Apply this plan? (yes/no): " APPLY
if [ "$APPLY" != "yes" ]; then
    echo "Deployment cancelled."
    rm -f tfplan
    exit 0
fi

# Apply deployment
echo "🚀 Applying Terraform configuration..."
terraform apply tfplan

rm -f tfplan

echo ""
echo "✅ Infrastructure deployment complete!"
echo ""

# Get cluster credentials
echo "📥 Configuring kubectl..."
CONNECT_COMMAND=$(terraform output -raw connect_command)

if [ -z "$CONNECT_COMMAND" ]; then
    echo "❌ Terraform output 'connect_command' is empty. Please run terraform apply successfully first."
    exit 1
fi

bash -lc "$CONNECT_COMMAND"

echo ""
echo "🎉 GCP Infrastructure is ready!"
echo ""

if terraform output -raw dns_zone_dns_name >/dev/null 2>&1; then
    echo "🌐 Cloud DNS zone:"
    terraform output dns_zone_dns_name
    echo ""
    echo "🛰️  Gateway static IP:"
    terraform output gateway_static_ip_address
    echo ""
    echo "🧭 Name servers:"
    terraform output dns_name_servers
    echo ""
fi

echo "Next steps:"
echo "1. Build and push Docker images:"
echo "   ./gcp-build-push.sh"
echo ""
echo "2. Deploy the application:"
echo "   kubectl apply -k ../kubernetes/"
echo ""
echo "3. Check status:"
echo "   kubectl get all -n fullstack-k8s"
echo ""