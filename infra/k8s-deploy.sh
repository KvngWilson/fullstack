#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$SCRIPT_DIR/kubernetes"
TERRAFORM_DIR="$SCRIPT_DIR/terraform"
NAMESPACE="fullstack-k8s"

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
KUBECTL_TOKEN=""

if [[ "$CURRENT_CONTEXT" == gke_* || "$CURRENT_CONTEXT" == *gke* ]]; then
    if command -v gcloud >/dev/null 2>&1; then
        KUBECTL_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
    fi
fi

kubectl_with_auth() {
    if [ -n "$KUBECTL_TOKEN" ]; then
        kubectl --token="$KUBECTL_TOKEN" "$@"
    else
        kubectl "$@"
    fi
}

echo "======================================"
echo "Fullstack - Kubernetes Deployment"
echo "======================================"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl_with_auth cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your configuration."
    if [ -n "$KUBECTL_TOKEN" ]; then
        echo "   The GKE context is configured, but kubectl could not authenticate using the generated access token."
        echo "   Run 'gcloud auth login' and 'gcloud container clusters get-credentials <cluster-name> --region <region>' and try again."
    else
        echo "   Install the GKE auth plugin or switch to a local cluster context (minikube/kind/docker-desktop)."
    fi
    exit 1
fi

echo "✓ kubectl is installed and cluster is accessible"
echo ""

# Build Docker images
echo "📦 Building Docker images..."
echo "-----------------------------------"

echo "Building gateway image..."
docker build -f "$REPO_ROOT/Dockerfile" -t "gcr.io/fullstack-ecom/fullstack-gateway:latest" "$REPO_ROOT"

echo "Building server image..."
docker build -f "$REPO_ROOT/server/Dockerfile" -t "gcr.io/fullstack-ecom/fullstack-server:latest" "$REPO_ROOT/server"

echo "Building client image..."
docker build -f "$REPO_ROOT/client/Dockerfile" -t "gcr.io/fullstack-ecom/fullstack-client:latest" "$REPO_ROOT/client"

echo "✓ Docker images built successfully"
echo ""

GATEWAY_STATIC_IP=""
if command -v terraform >/dev/null 2>&1 && [ -d "$TERRAFORM_DIR" ]; then
    GATEWAY_STATIC_IP="$(terraform -chdir="$TERRAFORM_DIR" output -raw gateway_static_ip_address 2>/dev/null || true)"
fi

# Load images into cluster (for local clusters like minikube/kind)
if kubectl_with_auth config current-context | grep -q "minikube\|kind"; then
    echo "📥 Loading images into local cluster..."

    if kubectl_with_auth config current-context | grep -q "minikube"; then
        minikube image load gcr.io/fullstack-ecom/fullstack-server:latest
        minikube image load gcr.io/fullstack-ecom/fullstack-client:latest
        minikube image load gcr.io/fullstack-ecom/fullstack-gateway:latest
    elif kubectl_with_auth config current-context | grep -q "kind"; then
        kind load docker-image gcr.io/fullstack-ecom/fullstack-server:latest
        kind load docker-image gcr.io/fullstack-ecom/fullstack-client:latest
        kind load docker-image gcr.io/fullstack-ecom/fullstack-gateway:latest
    fi

    echo "✓ Images loaded into cluster"
    echo ""
fi

# Apply Kubernetes manifests
echo "🚀 Deploying to Kubernetes..."
echo "-----------------------------------"

# Recreate immutable app secrets so repeated applies do not fail when the manifest changes.
# HTTPS certificates are managed separately and must not be deleted here.
kubectl_with_auth delete secret fullstack-secrets -n "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true
kubectl_with_auth apply -k "$K8S_DIR"

if [ -n "$GATEWAY_STATIC_IP" ]; then
    kubectl_with_auth patch service gateway -n "$NAMESPACE" --type merge -p "{\"spec\":{\"loadBalancerIP\":\"$GATEWAY_STATIC_IP\"}}"
fi

echo "✓ Kubernetes manifests applied"

for deployment in server client gateway; do
    if kubectl_with_auth get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
        echo "⏳ Waiting for $deployment rollout..."
        kubectl_with_auth rollout status "deployment/$deployment" -n "$NAMESPACE" --timeout=600s
    fi
done

echo ""
echo "======================================"
echo "✅ Deployment Complete!"
echo "======================================"
echo ""

# Get service information
echo "📊 Service Status:"
echo "-----------------------------------"
kubectl_with_auth get pods -n "$NAMESPACE"
echo ""
kubectl_with_auth get services -n "$NAMESPACE"
echo ""

# Show access information
echo "🌐 Access Information:"
echo "-----------------------------------"

CLIENT_TYPE=$(kubectl_with_auth get svc client -n "$NAMESPACE" -o jsonpath='{.spec.type}' 2>/dev/null || true)

if [ "$CLIENT_TYPE" = "LoadBalancer" ]; then
    echo "Waiting for LoadBalancer IP..."
    sleep 5
    EXTERNAL_IP=$(kubectl_with_auth get svc client -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

    if [ -n "$EXTERNAL_IP" ]; then
        echo "Frontend: http://$EXTERNAL_IP"
    else
        echo "LoadBalancer IP pending. Use port-forward:"
        echo "kubectl port-forward -n $NAMESPACE svc/client 8080:80"
        echo "Then access: http://localhost:8080"
    fi
elif [ "$CLIENT_TYPE" = "NodePort" ]; then
    NODE_PORT=$(kubectl_with_auth get svc client -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)
    echo "Frontend: http://<NODE-IP>:$NODE_PORT"
else
    echo "Use port-forward to access the application:"
    echo ""
    echo "  kubectl port-forward -n $NAMESPACE svc/client 8080:80"
    echo "  kubectl port-forward -n $NAMESPACE svc/server 5000:5000"
    echo ""
    echo "Then access:"
    echo "  Frontend: http://localhost:8080"
    echo "  API:      http://localhost:5000"
fi

echo ""
echo "📋 Useful Commands:"
echo "-----------------------------------"
echo "View logs:     kubectl logs -f -l app=server -n $NAMESPACE"
echo "View pods:     kubectl get pods -n $NAMESPACE"
echo "Describe pod:  kubectl describe pod <pod-name> -n $NAMESPACE"
echo "Scale server:  kubectl scale deployment server --replicas=3 -n $NAMESPACE"
echo "Delete all:    kubectl delete namespace $NAMESPACE"
echo ""
