#!/bin/bash

set -euo pipefail

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
echo "Cleaning up Fullstack Deployment"
echo "======================================"
echo ""

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed."
    exit 1
fi

echo "🗑️  Deleting all resources..."
echo ""

# Delete namespace (this will delete all resources in it)
kubectl_with_auth delete namespace "$NAMESPACE" --ignore-not-found=true

echo ""
echo "✅ Cleanup complete!"
echo ""

echo "All resources have been removed from the cluster."
echo ""
