#!/bin/bash
set -e

echo "Building VIBE image..."
docker build -t vibe:latest .

echo "Deploying VIBE stack..."
docker stack deploy -c docker-stack.yml vibe

echo "Deployed. Check status with: docker service ls | grep vibe"
