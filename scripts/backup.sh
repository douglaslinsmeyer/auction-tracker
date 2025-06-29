#!/bin/bash
# Automated backup script for Nellis Auction Helper
# Backs up Redis data, application logs, and configuration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="${BACKUP_ROOT:-$PROJECT_ROOT/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
create_backup_dir() {
    log_info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/redis"
    mkdir -p "$BACKUP_DIR/logs"
    mkdir -p "$BACKUP_DIR/config"
}

# Backup Redis data
backup_redis() {
    log_info "Backing up Redis data..."
    
    # Check if Redis is running in Docker
    if docker ps --format '{{.Names}}' | grep -q 'auction-redis'; then
        # Save Redis dump
        docker exec auction-redis redis-cli BGSAVE
        
        # Wait for background save to complete
        log_info "Waiting for Redis background save..."
        while [ $(docker exec auction-redis redis-cli LASTSAVE) -eq $(docker exec auction-redis redis-cli LASTSAVE) ]; do
            sleep 1
        done
        
        # Copy dump file from container
        docker cp auction-redis:/data/dump.rdb "$BACKUP_DIR/redis/dump.rdb"
        
        # Also export as human-readable format
        docker exec auction-redis redis-cli --rdb /data/dump.rdb --pipe > "$BACKUP_DIR/redis/redis_backup.txt" 2>/dev/null || true
        
        # Save Redis configuration
        docker exec auction-redis redis-cli CONFIG GET '*' > "$BACKUP_DIR/redis/redis_config.txt"
        
        log_info "Redis backup completed"
    else
        log_warn "Redis container not found, skipping Redis backup"
    fi
}

# Backup application logs
backup_logs() {
    log_info "Backing up application logs..."
    
    # Backend logs
    if [ -d "$PROJECT_ROOT/logs/backend" ]; then
        cp -r "$PROJECT_ROOT/logs/backend" "$BACKUP_DIR/logs/"
        log_info "Backend logs backed up"
    fi
    
    # Dashboard logs
    if [ -d "$PROJECT_ROOT/logs/dashboard" ]; then
        cp -r "$PROJECT_ROOT/logs/dashboard" "$BACKUP_DIR/logs/"
        log_info "Dashboard logs backed up"
    fi
    
    # Compress logs to save space
    if command -v tar &> /dev/null; then
        cd "$BACKUP_DIR"
        tar -czf logs.tar.gz logs/
        rm -rf logs/
        log_info "Logs compressed"
    fi
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files..."
    
    # Environment files (without sensitive data)
    for env_file in "$PROJECT_ROOT"/.env* "$PROJECT_ROOT"/backend/.env* "$PROJECT_ROOT"/dashboard/.env*; do
        if [ -f "$env_file" ]; then
            filename=$(basename "$env_file")
            # Redact sensitive information
            sed -E 's/(AUTH_TOKEN|PASSWORD|SECRET|KEY)=.*/\1=***REDACTED***/g' "$env_file" > "$BACKUP_DIR/config/$filename"
        fi
    done
    
    # Docker Compose files
    cp "$PROJECT_ROOT"/docker-compose*.yml "$BACKUP_DIR/config/" 2>/dev/null || true
    
    # Feature flags from Redis
    if docker ps --format '{{.Names}}' | grep -q 'auction-redis'; then
        docker exec auction-redis redis-cli GET "features:config" > "$BACKUP_DIR/config/feature_flags.json" 2>/dev/null || true
    fi
    
    log_info "Configuration backup completed"
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata..."
    
    cat > "$BACKUP_DIR/backup_metadata.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(cd "$PROJECT_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "containers": [
$(docker ps --format '    {"name": "{{.Names}}", "image": "{{.Image}}", "status": "{{.Status}}"}' | paste -sd ',' -)
  ],
  "disk_usage": {
    "backup_size": "$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)",
    "redis_size": "$(docker exec auction-redis redis-cli INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo 'unknown')"
  }
}
EOF
}

# Compress entire backup
compress_backup() {
    log_info "Compressing backup..."
    
    cd "$BACKUP_ROOT"
    tar -czf "nellis_backup_${TIMESTAMP}.tar.gz" "$TIMESTAMP/"
    rm -rf "$TIMESTAMP/"
    
    FINAL_BACKUP="$BACKUP_ROOT/nellis_backup_${TIMESTAMP}.tar.gz"
    BACKUP_SIZE=$(du -h "$FINAL_BACKUP" | cut -f1)
    
    log_info "Backup compressed: $FINAL_BACKUP (Size: $BACKUP_SIZE)"
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $BACKUP_RETENTION_DAYS days)..."
    
    find "$BACKUP_ROOT" -name "nellis_backup_*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
    
    REMAINING_BACKUPS=$(ls -1 "$BACKUP_ROOT"/nellis_backup_*.tar.gz 2>/dev/null | wc -l)
    log_info "Remaining backups: $REMAINING_BACKUPS"
}

# Restore from backup
restore_backup() {
    BACKUP_FILE="$1"
    
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Please provide backup file path"
        echo "Usage: $0 restore <backup_file.tar.gz>"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_warn "This will restore data from backup. Current data will be overwritten!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    RESTORE_DIR="/tmp/nellis_restore_$$"
    mkdir -p "$RESTORE_DIR"
    
    log_info "Extracting backup..."
    tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"
    
    # Find the backup directory (should be single timestamped directory)
    BACKUP_CONTENT=$(ls -1 "$RESTORE_DIR" | head -1)
    EXTRACTED_DIR="$RESTORE_DIR/$BACKUP_CONTENT"
    
    # Restore Redis data
    if [ -f "$EXTRACTED_DIR/redis/dump.rdb" ] && docker ps --format '{{.Names}}' | grep -q 'auction-redis'; then
        log_info "Restoring Redis data..."
        
        # Stop Redis saves
        docker exec auction-redis redis-cli CONFIG SET save ""
        
        # Copy dump file
        docker cp "$EXTRACTED_DIR/redis/dump.rdb" auction-redis:/data/dump.rdb
        
        # Restart Redis to load the dump
        docker restart auction-redis
        
        log_info "Redis data restored"
    fi
    
    # Restore configuration (manual process)
    if [ -d "$EXTRACTED_DIR/config" ]; then
        log_info "Configuration files available at: $EXTRACTED_DIR/config"
        log_warn "Please manually review and restore configuration files as needed"
    fi
    
    # Show backup metadata
    if [ -f "$EXTRACTED_DIR/backup_metadata.json" ]; then
        log_info "Backup metadata:"
        cat "$EXTRACTED_DIR/backup_metadata.json"
    fi
    
    log_info "Restore process completed"
    log_warn "Remember to restart your services after restore"
}

# Verify backup integrity
verify_backup() {
    BACKUP_FILE="$1"
    
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Please provide backup file path"
        echo "Usage: $0 verify <backup_file.tar.gz>"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Verifying backup: $BACKUP_FILE"
    
    # Test archive integrity
    if tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
        log_info "Archive integrity: OK"
        
        # List contents
        log_info "Backup contents:"
        tar -tzf "$BACKUP_FILE" | head -20
        echo "..."
        
        # Show metadata if available
        tar -xzf "$BACKUP_FILE" -O "*/backup_metadata.json" 2>/dev/null | jq . 2>/dev/null || true
        
        return 0
    else
        log_error "Archive integrity: FAILED"
        return 1
    fi
}

# Main script logic
main() {
    case "${1:-backup}" in
        "backup")
            log_info "Starting Nellis Auction Helper backup..."
            create_backup_dir
            backup_redis
            backup_logs
            backup_config
            create_metadata
            compress_backup
            cleanup_old_backups
            log_info "Backup completed successfully!"
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "verify")
            verify_backup "$2"
            ;;
        "list")
            log_info "Available backups:"
            ls -lh "$BACKUP_ROOT"/nellis_backup_*.tar.gz 2>/dev/null || log_warn "No backups found"
            ;;
        "clean")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {backup|restore|verify|list|clean}"
            echo "  backup              - Create new backup (default)"
            echo "  restore <file>      - Restore from backup file"
            echo "  verify <file>       - Verify backup integrity"
            echo "  list                - List available backups"
            echo "  clean               - Remove old backups"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"