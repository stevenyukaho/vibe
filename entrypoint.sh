#!/bin/bash
set -e

# Start backend
cd /app
PORT=5000 HOST=0.0.0.0 node backend/dist/index.js &

# Wait for backend to be ready
sleep 3

# Start agent-service-api
PORT=5003 HOST=0.0.0.0 \
  BACKEND_URL=http://localhost:5000 \
  BACKEND_TIMEOUT=${BACKEND_TIMEOUT:-120000} \
  DEFAULT_TIMEOUT=${DEFAULT_TIMEOUT:-120000} \
  POLLER_BASE_INTERVAL_MS=${POLLER_BASE_INTERVAL_MS:-5000} \
  POLLER_MAX_INTERVAL_MS=${POLLER_MAX_INTERVAL_MS:-60000} \
  POLLER_MAX_CONCURRENT_JOBS=${POLLER_MAX_CONCURRENT_JOBS:-3} \
  node agent-service-api/dist/index.js &

# Start frontend (production)
cd /app/frontend
PORT=3001 npx next start -p 3001 &

wait
