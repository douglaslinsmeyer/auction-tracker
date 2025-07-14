#!/bin/bash
# deploy-production.sh - Simplified production deployment script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=false
SKIP_HEALTH_CHECK=false
IMAGE_TAG=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: deploy-production.sh [options]"
            echo "Options:"
            echo "  --dry-run           Show what would be deployed without applying"
            echo "  --skip-health-check Skip post-deployment health checks"
            echo "  --tag TAG           Image tag to deploy (default: latest commit)"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}🚀 Production Deployment Script${NC}"
echo "================================"

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command kubectl
check_command docker

# Check for kustomize
if ! command -v kustomize &> /dev/null; then
    if kubectl version --client --short 2>&1 | grep -q "Kustomize"; then
        KUSTOMIZE_CMD="kubectl kustomize"
    else
        echo -e "${RED}❌ kustomize is not installed. Please install it first.${NC}"
        exit 1
    fi
else
    KUSTOMIZE_CMD="kustomize"
fi

# Check kubectl connection
echo "🔌 Checking Kubernetes connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ kubectl is not connected to a cluster${NC}"
    echo "Please configure kubectl to connect to your Rackspace Spot cluster"
    exit 1
fi

echo -e "${GREEN}✅ Connected to cluster${NC}"
kubectl cluster-info | head -1

# Determine image tag
if [ -z "$IMAGE_TAG" ]; then
    # Use git commit SHA if no tag specified
    if [ -d .git ]; then
        IMAGE_TAG="commit-$(git rev-parse --short HEAD)"
    else
        IMAGE_TAG="latest"
    fi
fi

echo -e "\n${YELLOW}📦 Deployment Configuration:${NC}"
echo "   Image Tag: $IMAGE_TAG"
echo "   Dry Run: $DRY_RUN"
echo "   Skip Health Check: $SKIP_HEALTH_CHECK"
echo ""

# Confirm deployment
if [ "$DRY_RUN" = false ]; then
    read -p "Deploy to PRODUCTION? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 0
    fi
fi

# Navigate to Kubernetes directory
cd "$(dirname "$0")/../.."

# Update image tags
echo -e "\n${YELLOW}🏷️  Updating image tags...${NC}"
cd k8s/overlays/production

# Update kustomization with new image tags
$KUSTOMIZE_CMD edit set image \
    auction-tracker-backend="ghcr.io/douglaslinsmeyer/auction-tracker-backend:$IMAGE_TAG" \
    auction-tracker-dashboard="ghcr.io/douglaslinsmeyer/auction-tracker-dashboard:$IMAGE_TAG"

# Show what will be deployed
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}🔍 DRY RUN - Showing deployment preview:${NC}"
    $KUSTOMIZE_CMD build . | kubectl diff -f - || true
    echo -e "\n${GREEN}✅ Dry run completed. No changes were applied.${NC}"
    exit 0
fi

# Apply the deployment
echo -e "\n${YELLOW}🚀 Deploying to production...${NC}"
$KUSTOMIZE_CMD build . | kubectl apply -f -

# Wait for rollout to complete
echo -e "\n${YELLOW}⏳ Waiting for deployments to roll out...${NC}"
kubectl -n auction-tracker rollout status deployment/backend --timeout=10m
kubectl -n auction-tracker rollout status deployment/dashboard --timeout=10m

# Health check
if [ "$SKIP_HEALTH_CHECK" = false ]; then
    echo -e "\n${YELLOW}🏥 Running health checks...${NC}"
    
    # Wait for pods to be ready
    kubectl -n auction-tracker wait --for=condition=ready pod -l app=backend --timeout=300s
    kubectl -n auction-tracker wait --for=condition=ready pod -l app=dashboard --timeout=300s
    
    # Get a backend pod for health check
    BACKEND_POD=$(kubectl -n auction-tracker get pod -l app=backend -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$BACKEND_POD" ]; then
        # Check backend health endpoint
        if kubectl -n auction-tracker exec "$BACKEND_POD" -- wget -O- -q http://localhost:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend health check passed${NC}"
        else
            echo -e "${RED}❌ Backend health check failed${NC}"
            echo "Check pod logs: kubectl -n auction-tracker logs $BACKEND_POD"
        fi
    fi
fi

# Show deployment status
echo -e "\n${YELLOW}📊 Deployment Status:${NC}"
kubectl -n auction-tracker get deployments
echo ""
kubectl -n auction-tracker get pods
echo ""
kubectl -n auction-tracker get services

# Show access instructions
echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Access Instructions:${NC}"
echo "To access the application locally, use port forwarding:"
echo "  kubectl -n auction-tracker port-forward service/backend 3000:3000"
echo "  kubectl -n auction-tracker port-forward service/dashboard 3001:3001"
echo ""
echo "To view logs:"
echo "  kubectl -n auction-tracker logs -f deployment/backend"
echo "  kubectl -n auction-tracker logs -f deployment/dashboard"
echo ""
echo "To rollback if needed:"
echo "  kubectl -n auction-tracker rollout undo deployment/backend"
echo "  kubectl -n auction-tracker rollout undo deployment/dashboard"