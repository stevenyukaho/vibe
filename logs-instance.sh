#!/bin/bash

# =============================================================================
# USAGE: ./logs-instance.sh <instance-name>
# EXAMPLE: ./logs-instance.sh instance1
# =============================================================================

if [ $# -eq 0 ]; then
    echo "Usage: $0 <instance-name>"
    echo "Example: $0 instance1"
    exit 1
fi

INSTANCE_NAME="$1"

if ! command -v pm2 &> /dev/null; then
    echo "PM2 is not installed."
    exit 1
fi

echo "Showing logs for instance: $INSTANCE_NAME"
echo "Press Ctrl+C to exit."
echo ""

pm2 logs "${INSTANCE_NAME}-backend" "${INSTANCE_NAME}-agent-service-api" "${INSTANCE_NAME}-frontend"
