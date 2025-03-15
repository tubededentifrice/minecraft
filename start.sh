#!/bin/bash

# Minecraft Clone Server Startup Script
# This script sets up and starts the database and cache services using Docker Compose

set -e

# Display header
echo "=========================================="
echo "  Minecraft Clone Server - Setup Script   "
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    echo "Please install Docker and try again"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed or not in PATH"
    echo "Please install Docker Compose and try again"
    exit 1
fi

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p backend/config
mkdir -p frontend/public
mkdir -p frontend/nginx
mkdir -p data/worlds
mkdir -p data/logs
mkdir -p data/players

# Check if config file exists, create it if not
if [ ! -f backend/config/server.json ]; then
    echo "Config file already exists, using existing configuration."
fi

# Start database and cache services
echo "Starting database and cache services..."
docker-compose up -d minecraft-db minecraft-redis

# Check if services started successfully
if [ $? -eq 0 ]; then
    echo ""
    echo "Database and cache services started successfully!"
    echo ""
    echo "Services:"
    echo "- PostgreSQL: localhost:5432"
    echo "- Redis: localhost:6379"
    echo ""
    echo "To view logs, use: docker-compose logs -f"
    echo "To stop the services, use: docker-compose down"
    echo ""
else
    echo "Failed to start services. Check the logs for more information."
    exit 1
fi

# Start the server manually
echo "You can start the backend server manually using:"
echo "cd backend && ./scripts/start-server.sh"
echo ""
echo "You can start the frontend using:"
echo "cd frontend && npm start" 