#!/bin/bash
set -e

# Default values
DEFAULT_PORT=8080
DEFAULT_API_PORT=8081
DEFAULT_MAX_PLAYERS=50
DEFAULT_SIMULATION_DISTANCE=10
DEFAULT_VIEW_DISTANCE=8
DEFAULT_WORLD_SEED=12345
DEFAULT_LOG_LEVEL="info"
DEFAULT_CONFIG_PATH="./config/server.json"
DEFAULT_DATA_PATH="./data"

# Function to display help
function show_help {
    echo "Minecraft Clone Server Startup Script"
    echo "-------------------------------------"
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --port <port>                 Game server port (default: $DEFAULT_PORT)"
    echo "  --api-port <port>             API server port (default: $DEFAULT_API_PORT)"
    echo "  --max-players <number>        Maximum number of players (default: $DEFAULT_MAX_PLAYERS)"
    echo "  --simulation-distance <dist>  Simulation distance in chunks (default: $DEFAULT_SIMULATION_DISTANCE)"
    echo "  --view-distance <dist>        View distance in chunks (default: $DEFAULT_VIEW_DISTANCE)"
    echo "  --world-seed <seed>           World seed for generation (default: $DEFAULT_WORLD_SEED)"
    echo "  --log-level <level>           Log level (trace, debug, info, warn, error) (default: $DEFAULT_LOG_LEVEL)"
    echo "  --config-path <path>          Path to config file (default: $DEFAULT_CONFIG_PATH)"
    echo "  --data-path <path>            Path to data directory (default: $DEFAULT_DATA_PATH)"
    echo "  --help                        Display this help and exit"
    echo ""
}

# Parse command line arguments
PORT=$DEFAULT_PORT
API_PORT=$DEFAULT_API_PORT
MAX_PLAYERS=$DEFAULT_MAX_PLAYERS
SIMULATION_DISTANCE=$DEFAULT_SIMULATION_DISTANCE
VIEW_DISTANCE=$DEFAULT_VIEW_DISTANCE
WORLD_SEED=$DEFAULT_WORLD_SEED
LOG_LEVEL=$DEFAULT_LOG_LEVEL
CONFIG_PATH=$DEFAULT_CONFIG_PATH
DATA_PATH=$DEFAULT_DATA_PATH

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --api-port)
            API_PORT="$2"
            shift 2
            ;;
        --max-players)
            MAX_PLAYERS="$2"
            shift 2
            ;;
        --simulation-distance)
            SIMULATION_DISTANCE="$2"
            shift 2
            ;;
        --view-distance)
            VIEW_DISTANCE="$2"
            shift 2
            ;;
        --world-seed)
            WORLD_SEED="$2"
            shift 2
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --config-path)
            CONFIG_PATH="$2"
            shift 2
            ;;
        --data-path)
            DATA_PATH="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set environment variables
export SERVER_PORT=$PORT
export API_PORT=$API_PORT
export MAX_PLAYERS=$MAX_PLAYERS
export SIMULATION_DISTANCE=$SIMULATION_DISTANCE
export VIEW_DISTANCE=$VIEW_DISTANCE
export WORLD_SEED=$WORLD_SEED
export LOG_LEVEL=$LOG_LEVEL
export SERVER_CONFIG_PATH=$CONFIG_PATH
export SERVER_DATA_PATH=$DATA_PATH

# Create necessary directories
mkdir -p "$DATA_PATH/worlds"
mkdir -p "$DATA_PATH/players"
mkdir -p "$DATA_PATH/logs"

# Display the server configuration
echo "Starting Minecraft Clone Server with configuration:"
echo "  Server Port: $PORT"
echo "  API Port: $API_PORT"
echo "  Max Players: $MAX_PLAYERS"
echo "  Simulation Distance: $SIMULATION_DISTANCE"
echo "  View Distance: $VIEW_DISTANCE"
echo "  World Seed: $WORLD_SEED"
echo "  Log Level: $LOG_LEVEL"
echo "  Config Path: $CONFIG_PATH"
echo "  Data Path: $DATA_PATH"
echo ""

# Start the server
exec ./minecraft_server 