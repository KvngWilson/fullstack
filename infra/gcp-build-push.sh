#!/bin/bash

set -e

echo "======================================"
echo "Build & Push Docker Images to GCR"
echo "======================================"
echo ""

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK (gcloud) is not installed."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    exit 1
fi

# Get GCP project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No GCP project configured. Run: gcloud config set project PROJECT_ID"
    exit 1
fi

echo "📦 Building for project: $PROJECT_ID"
echo ""

# Configure Docker for GCR
echo "🔐 Configuring Docker for GCR..."
gcloud auth configure-docker gcr.io --quiet

GATEWAY_IMAGE="gcr.io/$PROJECT_ID/fullstack-gateway:latest"
SERVER_IMAGE="gcr.io/$PROJECT_ID/fullstack-server:latest"
CLIENT_IMAGE="gcr.io/$PROJECT_ID/fullstack-client:latest"

# Build images
echo "🏗️  Building gateway image..."
docker build -f ../Dockerfile -t "$GATEWAY_IMAGE" ..
echo "✅ Gateway image built"

echo "🏗️  Building server image..."
docker build -f ../server/Dockerfile -t "$SERVER_IMAGE" ../server
echo "✅ Server image built"

echo "🏗️  Building client image..."
docker build -f ../client/Dockerfile -t "$CLIENT_IMAGE" ../client
echo "✅ Client image built"

# Push images
echo "📤 Pushing gateway image to GCR..."
docker push "$GATEWAY_IMAGE"
echo "✅ Gateway image pushed"

echo "📤 Pushing server image to GCR..."
docker push "$SERVER_IMAGE"
echo "✅ Server image pushed"

echo "📤 Pushing client image to GCR..."
docker push "$CLIENT_IMAGE"
echo "✅ Client image pushed"

echo ""
echo "✅ All images pushed successfully!"
echo ""
echo "Image URLs:"
echo "  Gateway: $GATEWAY_IMAGE"
echo "  Server:  $SERVER_IMAGE"
echo "  Client:  $CLIENT_IMAGE"
echo ""
