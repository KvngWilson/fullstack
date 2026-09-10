#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_BASE_DIR="$SCRIPT_DIR/kubernetes"
K8S_HTTPS_DIR="$SCRIPT_DIR/kubernetes/https"
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

require_env() {
    local var_name="$1"
    if [ -z "${!var_name:-}" ]; then
        echo "❌ Missing required environment variable: $var_name"
        exit 1
    fi
}

echo "======================================"
echo "Fullstack - Enable HTTPS"
echo "======================================"
echo ""

require_env "ACME_EMAIL"
require_env "GCP_PROJECT_ID"
require_env "CLOUD_DNS_ZONE"
require_env "GCP_DNS_SOLVER_KEY_FILE"
require_env "DOMAIN_NAME"
require_env "WWW_DOMAIN_NAME"
require_env "ADMIN_DOMAIN"

if [ ! -f "$GCP_DNS_SOLVER_KEY_FILE" ]; then
    echo "❌ GCP_DNS_SOLVER_KEY_FILE does not exist: $GCP_DNS_SOLVER_KEY_FILE"
    exit 1
fi

if ! kubectl_with_auth get crd certificates.cert-manager.io >/dev/null 2>&1; then
    echo "❌ cert-manager CRDs are not installed."
    echo "   Install cert-manager first, then rerun this script."
    exit 1
fi

if ! kubectl_with_auth get namespace cert-manager >/dev/null 2>&1; then
    echo "❌ The cert-manager namespace was not found."
    echo "   Install cert-manager first, then rerun this script."
    exit 1
fi

echo "📦 Creating Cloud DNS solver secret in cert-manager namespace..."
kubectl_with_auth create secret generic cert-manager-cloud-dns \
    -n cert-manager \
    --from-file=key.json="$GCP_DNS_SOLVER_KEY_FILE" \
    --dry-run=client -o yaml | kubectl_with_auth apply -f -

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/kubernetes"
cp -R "$K8S_BASE_DIR/." "$tmp_dir/kubernetes/"
cp -R "$K8S_HTTPS_DIR/." "$tmp_dir/kubernetes/https/"

sed -i \
    -e "s/__ACME_EMAIL__/${ACME_EMAIL//\//\\/}/g" \
    -e "s/__GCP_PROJECT_ID__/${GCP_PROJECT_ID//\//\\/}/g" \
    -e "s/__CLOUD_DNS_ZONE__/${CLOUD_DNS_ZONE//\//\\/}/g" \
    -e "s/__DOMAIN_NAME__/${DOMAIN_NAME//\//\\/}/g" \
    -e "s/__WWW_DOMAIN_NAME__/${WWW_DOMAIN_NAME//\//\\/}/g" \
    -e "s/__ADMIN_DOMAIN__/${ADMIN_DOMAIN//\//\\/}/g" \
    "$tmp_dir/kubernetes/https/letsencrypt-clusterissuer.yaml"

sed -i \
    -e "s/__DOMAIN_NAME__/${DOMAIN_NAME//\//\\/}/g" \
    -e "s/__WWW_DOMAIN_NAME__/${WWW_DOMAIN_NAME//\//\\/}/g" \
    -e "s/__ADMIN_DOMAIN__/${ADMIN_DOMAIN//\//\\/}/g" \
    "$tmp_dir/kubernetes/https/gateway-certificate.yaml"

echo "🚀 Applying HTTPS overlay..."
kubectl_with_auth apply -k "$tmp_dir/kubernetes/https"

echo "⏳ Waiting for certificate to become ready..."
kubectl_with_auth wait \
    --for=condition=Ready \
    certificate/gateway-tls \
    -n "$NAMESPACE" \
    --timeout=20m

echo "⏳ Restarting gateway to pick up the managed TLS secret..."
kubectl_with_auth rollout restart deployment/gateway -n "$NAMESPACE"
kubectl_with_auth rollout status deployment/gateway -n "$NAMESPACE" --timeout=10m

echo ""
echo "✅ HTTPS overlay applied."
echo "   Verify with: kubectl get certificate gateway-tls -n $NAMESPACE"
echo "   Verify with: curl -I https://${DOMAIN_NAME}/health/live"
