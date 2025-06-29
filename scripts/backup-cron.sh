#!/bin/bash
# Setup automated backups for Nellis Auction Helper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to add cron job
add_cron_job() {
    local schedule="$1"
    local cron_cmd="$PROJECT_ROOT/scripts/backup.sh backup >> $PROJECT_ROOT/logs/backup.log 2>&1"
    local cron_entry="$schedule $cron_cmd"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$PROJECT_ROOT/scripts/backup.sh"; then
        echo "Backup cron job already exists"
        return 0
    fi
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    echo "Added backup cron job: $schedule"
}

# Main menu
echo "Nellis Auction Helper - Automated Backup Setup"
echo "=============================================="
echo
echo "Select backup schedule:"
echo "1) Every 6 hours"
echo "2) Daily at 3 AM"
echo "3) Weekly on Sunday at 3 AM"
echo "4) Custom schedule"
echo "5) Remove automated backups"
echo

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        add_cron_job "0 */6 * * *"
        ;;
    2)
        add_cron_job "0 3 * * *"
        ;;
    3)
        add_cron_job "0 3 * * 0"
        ;;
    4)
        echo "Enter custom cron schedule (e.g., '0 2 * * *' for daily at 2 AM):"
        read -p "Schedule: " custom_schedule
        add_cron_job "$custom_schedule"
        ;;
    5)
        # Remove cron job
        crontab -l 2>/dev/null | grep -v "$PROJECT_ROOT/scripts/backup.sh" | crontab -
        echo "Automated backups removed"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

# Create log directory
mkdir -p "$PROJECT_ROOT/logs"

echo
echo "Current cron jobs:"
crontab -l 2>/dev/null | grep "backup.sh" || echo "No backup jobs configured"