#!/bin/bash
# deploy.sh - Deploy Auction Tracker to Kubernetes

set -e

# Default values
DRY_RUN=false
BUILD_IMAGES=true
APPLY_SECRETS=true
NAMESPACE="auction-tracker"
ENVIRONMENT="production"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-build)
            BUILD_IMAGES=false
            shift
            ;;
        --no-secrets)
            APPLY_SECRETS=false
            shift
            ;;
        -h|--help)
            echo "Usage: deploy.sh [options]"
            echo "Options:"
            echo "  -n, --namespace      Kubernetes namespace (default: auction-tracker)"
            echo "  --dry-run           Show what would be deployed without applying"
            echo "  --no-build          Skip building Docker images"
            echo "  --no-secrets        Skip applying secrets"
            echo "  -h, --help          Show this help message"
            echo ""
            echo "Note: This script deploys to production. For local development, use docker-compose."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🚀 Deploying Auction Tracker"
echo "   Environment: $ENVIRONMENT"
echo "   Namespace: $NAMESPACE"
echo "   Dry run: $DRY_RUN"
echo ""

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
    if kubectl version --client --short 2>&1 | grep -q "Kustomize"; then
        KUSTOMIZE_CMD="kubectl kustomize"
    else
        echo "❌ kustomize is not installed. Please install it first."
        exit 1
    fi
else
    KUSTOMIZE_CMD="kustomize"
fi

# Check kubectl connection
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not connected to a cluster"
    exit 1
fi

# Build images if requested
if [ "$BUILD_IMAGES" = true ]; then
    echo "🔨 Building Docker images..."
    
    # Get git commit SHA for tagging
    GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
    TAG="${ENVIRONMENT}-${GIT_SHA}"
    
    echo "   Building backend image with tag: $TAG"
    docker build -f backend/Dockerfile -t auction-tracker-backend:$TAG -t auction-tracker-backend:latest . --target production
    
    echo "   Building dashboard image with tag: $TAG"
    docker build -f dashboard/Dockerfile -t auction-tracker-dashboard:$TAG -t auction-tracker-dashboard:latest dashboard/ --target production
    
    # Push to GitHub Container Registry
    if [ "$DRY_RUN" = false ]; then
        echo "📤 Pushing images to GitHub Container Registry..."
        
        # Tag for GHCR
        docker tag auction-tracker-backend:$TAG ghcr.io/douglaslinsmeyer/auction-tracker-backend:$TAG
        docker tag auction-tracker-dashboard:$TAG ghcr.io/douglaslinsmeyer/auction-tracker-dashboard:$TAG
        
        # Push images
        echo "   Note: You may need to login first with: docker login ghcr.io -u YOUR_GITHUB_USERNAME"
        docker push ghcr.io/douglaslinsmeyer/auction-tracker-backend:$TAG || echo "   ⚠️  Push failed. Please login to ghcr.io"
        docker push ghcr.io/douglaslinsmeyer/auction-tracker-dashboard:$TAG || echo "   ⚠️  Push failed. Please login to ghcr.io"
    fi
fi

# Namespace will be created by the manifests

# Apply secrets
if [ "$APPLY_SECRETS" = true ]; then
    echo "🔐 Applying secrets..."
    
    # Check if secrets directory exists
    if [ ! -d "k8s/overlays/production/secrets" ]; then
        echo "   ⚠️  Secrets directory not found. Creating template..."
        mkdir -p k8s/overlays/production/secrets
        
        # Create template files
        echo "your-auth-token-here" > k8s/overlays/production/secrets/auth-token
        echo "your-encryption-secret-here" > k8s/overlays/production/secrets/encryption-secret
        echo "your-redis-password-here" > k8s/overlays/production/secrets/redis-password
        echo "your-tls-cert-here" > k8s/overlays/production/secrets/tls.crt
        echo "your-tls-key-here" > k8s/overlays/production/secrets/tls.key
        
        echo "   ⚠️  Template secret files created. Please update them with real values."
        exit 1
    fi
fi

# Apply Kubernetes manifests
echo "🚀 Applying Kubernetes manifests..."
cd k8s

if [ "$DRY_RUN" = true ]; then
    echo "   Running in dry-run mode..."
    $KUSTOMIZE_CMD build overlays/$ENVIRONMENT | kubectl apply --dry-run=client -f -
else
    $KUSTOMIZE_CMD build overlays/$ENVIRONMENT | kubectl apply -f -
    
    # Wait for deployments
    echo "⏳ Waiting for deployments to be ready..."
    
    kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/backend || true
    kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/dashboard || true
    
    # Show deployment status
    echo ""
    echo "📊 Deployment status:"
    kubectl -n $NAMESPACE get deployments
    kubectl -n $NAMESPACE get pods
    kubectl -n $NAMESPACE get services
    
    echo ""
    echo "✅ Deployment complete!"
    
    # Show access instructions
    echo ""
    echo "📝 To access the production application:"
    echo "   kubectl -n $NAMESPACE port-forward service/backend 3000:3000"
    echo "   kubectl -n $NAMESPACE port-forward service/dashboard 3001:3001"
    echo ""
    echo "Or via your configured ingress/load balancer if available."
fi