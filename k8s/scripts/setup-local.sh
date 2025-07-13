#!/bin/bash
# setup-local.sh - Set up local Kubernetes environment for Auction Tracker

set -e

echo "🚀 Setting up Auction Tracker for local Kubernetes development..."

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command kubectl
check_command docker

# Check for kustomize (standalone or built into kubectl)
if ! command -v kustomize &> /dev/null; then
    echo "📝 Standalone kustomize not found, checking kubectl version..."
    if kubectl version --client 2>&1 | grep -qi "kustomize"; then
        echo "✅ Using kubectl's built-in kustomize"
        KUSTOMIZE_CMD="kubectl kustomize"
        KUSTOMIZE_APPLY="kubectl apply -k"
    else
        echo "❌ kustomize is not installed and kubectl doesn't have it built-in."
        echo "   Install kustomize from: https://kustomize.io/"
        exit 1
    fi
else
    KUSTOMIZE_CMD="kustomize"
    KUSTOMIZE_APPLY="kustomize build"
fi

# Check if kubectl is connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not connected to a cluster. Please configure kubectl."
    exit 1
fi

# Get current context
CURRENT_CONTEXT=$(kubectl config current-context)
echo "📍 Using Kubernetes context: $CURRENT_CONTEXT"

# Confirm with user for non-docker-desktop contexts
if [[ "$CURRENT_CONTEXT" != "docker-desktop" ]]; then
    read -p "⚠️  You're not using docker-desktop context. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Install Gateway API CRDs
echo "📥 Installing Gateway API CRDs..."
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml

# Wait for CRDs to be established
echo "⏳ Waiting for CRDs to be ready..."
kubectl wait --for condition=established --timeout=60s crd/gateways.gateway.networking.k8s.io
kubectl wait --for condition=established --timeout=60s crd/httproutes.gateway.networking.k8s.io

# NGINX Gateway controller is now included in the application namespace

# Namespace will be created by the manifests

# Build Docker images
echo "🔨 Building Docker images..."
echo "   Building backend image..."
docker build -f backend/Dockerfile -t auction-tracker-backend:latest . --target production

echo "   Building dashboard image..."
docker build -f dashboard/Dockerfile -t auction-tracker-dashboard:latest dashboard/ --target production

# Apply Kubernetes manifests
echo "🚀 Deploying to Kubernetes..."
cd k8s
if [ "$KUSTOMIZE_CMD" = "kubectl kustomize" ]; then
    kubectl apply -k overlays/development
else
    kustomize build overlays/development | kubectl apply -f -
fi

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl -n auction-tracker-dev wait --for=condition=available --timeout=300s deployment/dev-backend
kubectl -n auction-tracker-dev wait --for=condition=available --timeout=300s deployment/dev-dashboard
kubectl -n auction-tracker-dev wait --for=condition=ready --timeout=300s pod -l component=redis

# Get Gateway LoadBalancer IP/Port
echo "🔍 Getting Gateway information..."
GATEWAY_SERVICE=$(kubectl -n nginx-gateway get service -o name | head -1)
if [ -n "$GATEWAY_SERVICE" ]; then
    kubectl -n nginx-gateway get $GATEWAY_SERVICE
fi

# Port forwarding setup
echo ""
echo "✅ Setup complete! To access the application locally, run:"
echo ""
echo "   # Backend API:"
echo "   kubectl -n auction-tracker-dev port-forward service/dev-backend 3000:3000"
echo ""
echo "   # Dashboard:"
echo "   kubectl -n auction-tracker-dev port-forward service/dev-dashboard 3001:3001"
echo ""
echo "   # Or use the Gateway (if LoadBalancer is available):"
echo "   kubectl -n nginx-gateway port-forward service/nginx-gateway 8080:80"
echo ""
echo "📝 View logs:"
echo "   kubectl -n auction-tracker-dev logs -f deployment/dev-backend"
echo "   kubectl -n auction-tracker-dev logs -f deployment/dev-dashboard"
echo ""
echo "🧹 To clean up:"
echo "   ./k8s/scripts/cleanup-local.sh"