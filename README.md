# Minecraft Clone Project

A high-performance, browser-based Minecraft clone using Three.js for the frontend and Rust for the backend server.

## Project Overview

This project aims to create a faithful Minecraft-like experience in the browser with the following key features:

- **Voxel-based 3D world** with procedural generation
- **Multiplayer support** for real-time collaboration and interaction
- **High-performance rendering** using Three.js and WebGL
- **Scalable backend** implemented in Rust for optimal performance
- **Modern networking** with WebSockets and binary protocols

The game supports core Minecraft gameplay elements including block manipulation, crafting, survival mechanics, and more, while being optimized for browser environments.

## Project Structure

The project is organized into several key components:

### Backend
- `minecraft_core`: Core game mechanics and data structures
- `minecraft_util`: Utility functions and helpers
- `minecraft_world`: World generation and management
- `minecraft_server`: Game server implementation

### Frontend
- React-based UI with Three.js for 3D rendering
- WebSocket communication with the backend
- State management using Zustand

## Getting Started

### Prerequisites

For development, you'll need:

- Node.js 18+ for frontend development
- Rust 1.67+ for backend development
- Docker and Docker Compose for local environment
- Git for version control

### Setup and Installation

#### Using Docker (Recommended)

1. Start the supporting services (PostgreSQL and Redis):
   ```bash
   ./start.sh
   ```

2. Start the backend server:
   ```bash
   cd backend && ./scripts/start-server.sh
   ```

3. Start the frontend development server:
   ```bash
   cd frontend && npm start
   ```

#### Manual Setup

1. Backend Setup:
   ```bash
   cd backend
   cargo build
   cargo run --bin minecraft_server
   ```

2. Frontend Setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Access the application at http://localhost:3000

## Development

### Backend Development

The backend is written in Rust and organized into several crates:

- `minecraft_core`: Contains block types, physics, and other core game mechanics
- `minecraft_world`: Implements world generation, chunk management, and terrain features
- `minecraft_server`: Provides the WebSocket server and API endpoints

To run the backend in development mode:

```bash
cd backend
cargo run --bin minecraft_server
```

### Frontend Development

The frontend is built with React, TypeScript, and Three.js:

```bash
cd frontend
npm run dev
```

## Docker Configuration

The project includes Docker configuration for easy deployment:

- `backend/Dockerfile`: Builds the Rust backend services
- `frontend/Dockerfile`: Sets up an Nginx server for the frontend
- `docker-compose.yml`: Orchestrates all services including PostgreSQL and Redis

## Production Deployment

For production deployment:

1. Build the Docker images:
   ```bash
   docker-compose build
   ```

2. Start the services:
   ```bash
   docker-compose up -d
   ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Minecraft by Mojang for the original game concept
- Three.js for the powerful WebGL rendering library
- The Rust community for excellent libraries and tools 