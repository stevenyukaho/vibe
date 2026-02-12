#!/bin/bash

# =============================================================================
# USAGE: ./status-instance.sh <instance-name>
# EXAMPLE: ./status-instance.sh instance1
# =============================================================================

# Check if instance name is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <instance-name>"
    echo "Example: $0 instance1"
    exit 1
fi

INSTANCE_NAME="$1"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[${INSTANCE_NAME}]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[${INSTANCE_NAME}]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[${INSTANCE_NAME}]${NC} $1"
}

print_error() {
    echo -e "${RED}[${INSTANCE_NAME}]${NC} $1"
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed."
    exit 1
fi

print_status "Status for instance: $INSTANCE_NAME"
echo ""

# Show detailed status for all processes in this instance
pm2 list | grep "${INSTANCE_NAME}" || {
    print_warning "No processes found for instance '$INSTANCE_NAME'"
    echo "Use './start-instance.sh env.${INSTANCE_NAME}' to start this instance"
}

echo ""
print_status "Process details:"
pm2 show "${INSTANCE_NAME}-backend" 2>/dev/null | grep -E "(name|status|pm2_env|pm_cwd)" || print_warning "Backend not running"
echo ""
# pm2 show "${INSTANCE_NAME}-agent-service" 2>/dev/null | grep -E "(name|status|pm2_env|pm_cwd)" || print_warning "Agent Service not running"
# echo ""
pm2 show "${INSTANCE_NAME}-agent-service-api" 2>/dev/null | grep -E "(name|status|pm2_env|pm_cwd)" || print_warning "Agent Service API not running"
echo ""
pm2 show "${INSTANCE_NAME}-frontend" 2>/dev/null | grep -E "(name|status|pm2_env|pm_cwd)" || print_warning "Frontend not running"



