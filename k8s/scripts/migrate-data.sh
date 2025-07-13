#!/bin/bash
# migrate-data.sh - Migrate Redis data from Docker to Kubernetes

set -e

echo "🔄 Redis Data Migration Tool"
echo "This script migrates Redis data from Docker Compose to Kubernetes"
echo ""

# Default values
SOURCE="docker"
TARGET="kubernetes"
NAMESPACE="auction-tracker-dev"
BACKUP_FILE="/tmp/redis-backup-$(date +%Y%m%d-%H%M%S).rdb"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: migrate-data.sh [options]"
            echo "Options:"
            echo "  -n, --namespace    Kubernetes namespace (default: auction-tracker-dev)"
            echo "  -f, --file         Backup file path (default: auto-generated)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command docker
check_command kubectl

# Step 1: Export data from Docker Redis
echo "📤 Exporting data from Docker Redis..."

# Check if Docker Compose stack is running
if ! docker ps | grep -q auction-redis; then
    echo "❌ Docker Redis container is not running. Please start it first:"
    echo "   docker-compose up -d redis"
    exit 1
fi

# Create backup in Docker Redis
docker exec auction-redis redis-cli BGSAVE
echo "   Waiting for backup to complete..."
sleep 2

# Copy backup file from Docker container
docker cp auction-redis:/data/dump.rdb "$BACKUP_FILE"
echo "   ✅ Backup saved to: $BACKUP_FILE"

# Get backup file size
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "   📊 Backup size: $BACKUP_SIZE"

# Step 2: Import data to Kubernetes Redis
echo ""
echo "📥 Importing data to Kubernetes Redis..."

# Check if Kubernetes Redis is running
REDIS_POD=$(kubectl -n $NAMESPACE get pod -l component=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -z "$REDIS_POD" ]; then
    echo "❌ Redis pod not found in namespace: $NAMESPACE"
    echo "   Please deploy Redis first using: ./k8s/scripts/setup-local.sh"
    exit 1
fi

echo "   Found Redis pod: $REDIS_POD"

# Stop Redis to import data
echo "   Stopping Redis for data import..."
kubectl -n $NAMESPACE exec $REDIS_POD -- redis-cli SHUTDOWN NOSAVE || true
sleep 2

# Copy backup file to pod
echo "   Copying backup file to pod..."
kubectl -n $NAMESPACE cp "$BACKUP_FILE" $REDIS_POD:/data/dump.rdb

# Restart Redis pod
echo "   Restarting Redis pod..."
kubectl -n $NAMESPACE delete pod $REDIS_POD
echo "   Waiting for new pod to be ready..."
kubectl -n $NAMESPACE wait --for=condition=ready --timeout=60s pod -l component=redis

# Verify data
NEW_REDIS_POD=$(kubectl -n $NAMESPACE get pod -l component=redis -o jsonpath='{.items[0].metadata.name}')
echo ""
echo "📊 Verifying migration..."

# Get key count from source
SOURCE_KEYS=$(docker exec auction-redis redis-cli DBSIZE | awk '{print $2}')
echo "   Source Redis keys: $SOURCE_KEYS"

# Get key count from target
TARGET_KEYS=$(kubectl -n $NAMESPACE exec $NEW_REDIS_POD -- redis-cli DBSIZE | awk '{print $2}')
echo "   Target Redis keys: $TARGET_KEYS"

if [ "$SOURCE_KEYS" = "$TARGET_KEYS" ]; then
    echo "   ✅ Migration successful! All keys transferred."
else
    echo "   ⚠️  Key count mismatch. Please verify the migration."
fi

# Cleanup
echo ""
read -p "🧹 Delete local backup file? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$BACKUP_FILE"
    echo "   ✅ Backup file deleted"
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Test the application with migrated data"
echo "   2. Verify all auction data is present"
echo "   3. Stop Docker Compose stack if migration is successful"