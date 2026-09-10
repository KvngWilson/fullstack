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

# Quick access script for port forwarding

echo "Starting port forwarding..."
echo "Frontend will be available at: http://localhost:8080"
echo "API will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run port forwards in parallel
kubectl_with_auth port-forward -n "$NAMESPACE" svc/client 8080:80 &
PF1=$!

kubectl_with_auth port-forward -n "$NAMESPACE" svc/server 5000:5000 &
PF2=$!

# Trap Ctrl+C to kill both port forwards
trap "kill $PF1 $PF2 2>/dev/null; exit" INT TERM

# Wait for both processes
wait "$PF1" "$PF2"
