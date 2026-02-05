#!/bin/bash

# =============================================================================
# USAGE: ./start-instance.sh <env-file>
# EXAMPLE: ./start-instance.sh .env.instance1
# =============================================================================

# Check if environment file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <env-file>"
    echo "Example: $0 .env.instance1"
    exit 1
fi

ENV_FILE="$1"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file '$ENV_FILE' not found"
    exit 1
fi

# Load environment variables
export $(cat "$ENV_FILE" | xargs)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if PM2 process exists
pm2_exists() {
    local process_name="$1"
    pm2 list | grep -q "$process_name"
    return $?
}

# Function to restart PM2 process
restart_pm2_process() {
    local process_name="$1"
    local command="$2"
    local cwd="$3"

    if pm2_exists "$process_name"; then
        print_status "Restarting $process_name..."
        pm2 restart "$process_name"
        if [ $? -eq 0 ]; then
            print_success "$process_name restarted successfully"
        else
            print_error "Failed to restart $process_name"
            return 1
        fi
    else
        print_status "Starting $process_name..."
        pm2 start "$command" --name "$process_name" --cwd "$cwd"
        if [ $? -eq 0 ]; then
            print_success "$process_name started successfully"
        else
            print_error "Failed to start $process_name"
            return 1
        fi
    fi
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Please install it first:"
    echo "npm install -g pm2"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

print_status "Starting instance: $INSTANCE_NAME"
print_status "Environment file: $ENV_FILE"
print_status "Project root: $PROJECT_ROOT"
print_status "Ports: Backend=$BACKEND_PORT, Agent=$AGENT_SERVICE_PORT, API=$AGENT_SERVICE_API_PORT, Frontend=$FRONTEND_PORT"

# Install dependencies at root to link workspaces
print_status "Installing root dependencies (linking workspaces)..."
cd "$PROJECT_ROOT" && npm install


# Resolve API base URL for the frontend (default to localhost and backend port)
if [ -z "$API_BASE_URL" ]; then
    API_BASE_URL="http://localhost:$BACKEND_PORT"
fi
print_status "Frontend API base URL: $API_BASE_URL"

# Create database directory if it doesn't exist (respect backend cwd for relative paths)
if [[ "$DB_PATH" = /* ]]; then
    DB_ABS_PATH="$DB_PATH"
else
    DB_ABS_PATH="$PROJECT_ROOT/backend/$DB_PATH"
fi
DB_DIR="$(dirname "$DB_ABS_PATH")"
if [ ! -d "$DB_DIR" ]; then
    print_status "Creating database directory: $DB_DIR"
    mkdir -p "$DB_DIR"
fi

# Start/restart Backend
print_status "Managing Backend service..."
restart_pm2_process \
    "${INSTANCE_NAME}-backend" \
    "PORT=$BACKEND_PORT DB_PATH=$DB_PATH AGENT_SERVICE_URL=http://localhost:$AGENT_SERVICE_PORT npm run dev" \
    "$PROJECT_ROOT/backend"

# Start/restart Agent Service
# print_status "Managing Agent Service..."
# restart_pm2_process \
#     "${INSTANCE_NAME}-agent-service" \
#     "python -m uvicorn src.main:app --host 0.0.0.0 --port $AGENT_SERVICE_PORT" \
#     "$PROJECT_ROOT/agent-service"

# Start/restart Agent Service API
print_status "Managing Agent Service API..."
restart_pm2_process \
    "${INSTANCE_NAME}-agent-service-api" \
    "PORT=$AGENT_SERVICE_API_PORT BACKEND_URL=http://localhost:$BACKEND_PORT npm run dev" \
    "$PROJECT_ROOT/agent-service-api"

# Start/restart Frontend
print_status "Managing Frontend service..."
restart_pm2_process \
    "${INSTANCE_NAME}-frontend" \
    "PORT=$FRONTEND_PORT INSTANCE_NAME=$INSTANCE_NAME NEXT_PUBLIC_INSTANCE_NAME=$INSTANCE_NAME NEXT_DIST_DIR=.next-$INSTANCE_NAME NEXT_PUBLIC_BACKEND_URL=$API_BASE_URL NEXT_PUBLIC_API_URL=$API_BASE_URL npm run dev -- -p $FRONTEND_PORT" \
    "$PROJECT_ROOT/frontend"

# Set environment variables for the processes
print_status "Environment applied at process start for all services"

print_success "Instance $INSTANCE_NAME setup complete!"
print_status "Services are running with PM2 names:"
echo "  - ${INSTANCE_NAME}-backend (Port: $BACKEND_PORT)"
# echo "  - ${INSTANCE_NAME}-agent-service (Port: $AGENT_SERVICE_PORT)"
echo "  - ${INSTANCE_NAME}-agent-service-api (Port: $AGENT_SERVICE_API_PORT)"
echo "  - ${INSTANCE_NAME}-frontend (Port: $FRONTEND_PORT)"
echo ""
print_status "Use 'pm2 list' to see all running processes"
