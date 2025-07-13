#!/bin/bash
# cleanup-local.sh - Clean up local Kubernetes deployment

set -e

NAMESPACE="${1:-auction-tracker-dev}"

echo "🧹 Cleaning up Auction Tracker from namespace: $NAMESPACE"
echo ""

read -p "⚠️  This will delete all resources. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled."
    exit 1
fi

echo "🗑️  Deleting Kubernetes resources..."

# Check for kustomize
if ! command -v kustomize &> /dev/null; then
    KUSTOMIZE_CMD="kubectl kustomize"
else
    KUSTOMIZE_CMD="kustomize"
fi

cd k8s
$KUSTOMIZE_CMD build overlays/development | kubectl delete -f - --ignore-not-found=true

echo "🗑️  Deleting namespace..."
kubectl delete namespace $NAMESPACE --ignore-not-found=true

echo ""
echo "✅ Cleanup complete!"