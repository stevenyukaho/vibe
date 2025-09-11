#!/bin/bash

# =============================================================================
# USAGE: ./stop-instance.sh <instance-name>
# EXAMPLE: ./stop-instance.sh instance1
# =============================================================================

# Check if instance name is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <instance-name>"
    echo "Example: $0 instance1"
    exit 1
fi

INSTANCE_NAME="$1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[${INSTANCE_NAME}]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[${INSTANCE_NAME}]${NC} $1"
}

print_error() {
    echo -e "${RED}[${INSTANCE_NAME}]${NC} $1"
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed."
    exit 1
fi

print_status "Stopping and removing all services for instance: $INSTANCE_NAME"

# Stop individual processes for this instance
pm2 stop "${INSTANCE_NAME}-backend" 2>/dev/null || true
# pm2 stop "${INSTANCE_NAME}-agent-service" 2>/dev/null || true
pm2 stop "${INSTANCE_NAME}-agent-service-api" 2>/dev/null || true
pm2 stop "${INSTANCE_NAME}-frontend" 2>/dev/null || true

# Delete individual processes for this instance
pm2 delete "${INSTANCE_NAME}-backend" 2>/dev/null || true
# pm2 delete "${INSTANCE_NAME}-agent-service" 2>/dev/null || true
pm2 delete "${INSTANCE_NAME}-agent-service-api" 2>/dev/null || true
pm2 delete "${INSTANCE_NAME}-frontend" 2>/dev/null || true

print_success "All services for instance '$INSTANCE_NAME' have been stopped and removed"
print_status "Use 'pm2 list' to verify all processes are gone"



