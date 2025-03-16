#!/bin/bash

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}       Minecraft Clone Project Launcher           ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Function to show usage
show_usage() {
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ./start.sh [options]"
  echo
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  --frontend-only    Start only the frontend development server (default)"
  echo -e "  --with-backend     Start frontend and backend services"
  echo -e "  --production       Start production configuration"
  echo -e "  --stop             Stop all running containers"
  echo -e "  --help             Show this help message"
  echo
  echo -e "${YELLOW}Examples:${NC}"
  echo -e "  ./start.sh                   # Start frontend development server"
  echo -e "  ./start.sh --with-backend    # Start frontend and backend services"
  echo -e "  ./start.sh --stop            # Stop all running containers"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: Docker is not installed. Please install Docker to continue.${NC}"
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Error: Docker Compose is not installed. Please install Docker Compose to continue.${NC}"
  exit 1
fi

# Default configuration
mode="frontend-only"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --frontend-only)
      mode="frontend-only"
      shift
      ;;
    --with-backend)
      mode="with-backend"
      shift
      ;;
    --production)
      mode="production"
      shift
      ;;
    --stop)
      mode="stop"
      shift
      ;;
    --help)
      show_usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      show_usage
      exit 1
      ;;
  esac
done

# Stop all containers if requested
if [ "$mode" == "stop" ]; then
  echo -e "${YELLOW}Stopping all containers...${NC}"
  docker-compose down
  echo -e "${GREEN}All containers stopped.${NC}"
  exit 0
fi

# Start services based on the selected mode
case $mode in
  frontend-only)
    echo -e "${YELLOW}Starting frontend development server...${NC}"
    docker-compose up -d minecraft-frontend
    
    # Wait for the container to start
    echo -e "${YELLOW}Waiting for the frontend to start...${NC}"
    sleep 5
    
    # Get the container status
    container_status=$(docker ps --filter "name=minecraft-frontend" --format "{{.Status}}")
    
    if [[ $container_status == *"Up"* ]]; then
      echo -e "${GREEN}Frontend is running!${NC}"
      echo -e "${GREEN}Access the frontend at: http://localhost:5173${NC}"
    else
      echo -e "${RED}Error: Frontend container failed to start.${NC}"
      echo -e "${YELLOW}Check logs with: docker-compose logs minecraft-frontend${NC}"
      exit 1
    fi
    ;;
    
  with-backend)
    echo -e "${YELLOW}Warning: Backend might experience connectivity issues with crates.io${NC}"
    echo -e "${YELLOW}Starting frontend and backend services...${NC}"
    docker-compose --profile with-backend up -d
    
    # Wait for containers to start
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    sleep 10
    
    # Get container statuses
    frontend_status=$(docker ps --filter "name=minecraft-frontend" --format "{{.Status}}")
    backend_status=$(docker ps --filter "name=minecraft-backend" --format "{{.Status}}")
    
    if [[ $frontend_status == *"Up"* ]]; then
      echo -e "${GREEN}Frontend is running!${NC}"
      echo -e "${GREEN}Access the frontend at: http://localhost:5173${NC}"
    else
      echo -e "${RED}Warning: Frontend container may not be running correctly.${NC}"
      echo -e "${YELLOW}Check logs with: docker-compose logs minecraft-frontend${NC}"
    fi
    
    if [[ $backend_status == *"Up"* ]]; then
      echo -e "${GREEN}Backend is running!${NC}"
      echo -e "${GREEN}WebSocket endpoint: ws://localhost:8080/ws${NC}"
    else
      echo -e "${RED}Warning: Backend container may not be running correctly.${NC}"
      echo -e "${YELLOW}Backend might be failing due to crates.io connectivity issues${NC}"
      echo -e "${YELLOW}Check logs with: docker-compose logs minecraft-backend${NC}"
    fi
    ;;
    
  production)
    echo -e "${YELLOW}Starting production services...${NC}"
    docker-compose --profile production up -d
    
    # Wait for containers to start
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    sleep 5
    
    # Get container status
    prod_status=$(docker ps --filter "name=minecraft-frontend-prod" --format "{{.Status}}")
    
    if [[ $prod_status == *"Up"* ]]; then
      echo -e "${GREEN}Production frontend is running!${NC}"
      echo -e "${GREEN}Access the website at: http://localhost${NC}"
    else
      echo -e "${RED}Error: Production frontend container failed to start.${NC}"
      echo -e "${YELLOW}Check logs with: docker-compose logs minecraft-frontend-prod${NC}"
      exit 1
    fi
    ;;
esac

echo -e "${BLUE}==================================================${NC}"
echo -e "${YELLOW}To view logs:${NC} docker-compose logs -f"
echo -e "${YELLOW}To stop services:${NC} ./start.sh --stop"
echo -e "${BLUE}==================================================${NC}" 