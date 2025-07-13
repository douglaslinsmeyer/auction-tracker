#!/bin/bash
# deploy.sh - Deploy Auction Tracker to Kubernetes

set -e

# Default values
ENVIRONMENT=""
NAMESPACE=""
DRY_RUN=false
BUILD_IMAGES=true
APPLY_SECRETS=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
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
            echo "Usage: deploy.sh -e <environment> [options]"
            echo "Options:"
            echo "  -e, --environment    Environment to deploy (development|production)"
            echo "  -n, --namespace      Kubernetes namespace (optional)"
            echo "  --dry-run           Show what would be deployed without applying"
            echo "  --no-build          Skip building Docker images"
            echo "  --no-secrets        Skip applying secrets"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate environment
if [ -z "$ENVIRONMENT" ]; then
    echo "❌ Error: Environment is required. Use -e development or -e production"
    exit 1
fi

if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Error: Invalid environment. Use 'development' or 'production'"
    exit 1
fi

# Set namespace based on environment if not provided
if [ -z "$NAMESPACE" ]; then
    if [ "$ENVIRONMENT" = "development" ]; then
        NAMESPACE="auction-tracker-dev"
    else
        NAMESPACE="auction-tracker"
    fi
fi

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
    
    # For production, push to registry
    if [ "$ENVIRONMENT" = "production" ] && [ "$DRY_RUN" = false ]; then
        echo "📤 Pushing images to registry..."
        # Add your registry URL here
        # docker tag auction-tracker-backend:$TAG registry.example.com/auction-tracker-backend:$TAG
        # docker push registry.example.com/auction-tracker-backend:$TAG
        echo "   ⚠️  Registry push not configured. Update deploy.sh with your registry."
    fi
fi

# Namespace will be created by the manifests

# Apply secrets for production
if [ "$ENVIRONMENT" = "production" ] && [ "$APPLY_SECRETS" = true ]; then
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
    
    if [ "$ENVIRONMENT" = "development" ]; then
        kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/dev-backend || true
        kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/dev-dashboard || true
    else
        kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/backend || true
        kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s deployment/dashboard || true
    fi
    
    # Show deployment status
    echo ""
    echo "📊 Deployment status:"
    kubectl -n $NAMESPACE get deployments
    kubectl -n $NAMESPACE get pods
    kubectl -n $NAMESPACE get services
    
    echo ""
    echo "✅ Deployment complete!"
    
    # Show access instructions
    if [ "$ENVIRONMENT" = "development" ]; then
        echo ""
        echo "📝 To access the application locally:"
        echo "   kubectl -n $NAMESPACE port-forward service/dev-backend 3000:3000"
        echo "   kubectl -n $NAMESPACE port-forward service/dev-dashboard 3001:3001"
    else
        echo ""
        echo "📝 Application should be accessible via your configured ingress/gateway."
    fi
fi