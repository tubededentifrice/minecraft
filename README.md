# Minecraft Clone Project

A high-performance, browser-based Minecraft clone using Three.js for the frontend and Rust for the backend server.

## Project Overview

This project aims to create a faithful Minecraft-like experience in the browser with the following key features:

- **Voxel-based 3D world** with procedural generation
- **Multiplayer support** for real-time collaboration and interaction
- **High-performance rendering** using Three.js and WebGL
- **Scalable backend** implemented in Rust for optimal performance
- **Modern networking** with WebSockets and binary protocols

The game supports core Minecraft gameplay elements including block manipulation, resource gathering, terrain generation, and daylight cycles.

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
- Full-screen immersive gameplay
- Dynamic chunk loading based on player position

## Getting Started

### Prerequisites

For development, you'll need:

- Node.js 18+ for frontend development
- Rust 1.67+ for backend development
- Docker and Docker Compose (optional) for containerized deployment
- Git for version control

### Setup and Installation

#### Frontend Setup (Recommended)

The frontend can run in standalone mode without requiring the backend:

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the frontend development server:
   ```bash
   npm run dev
   ```

3. Access the application at http://localhost:5173 (or the port shown in the console)

#### Backend Setup (Optional)

**Note:** The backend requires crates.io connectivity and may experience timeout issues in some network environments.

1. Change to the backend directory:
   ```bash
   cd backend
   ```

2. Build the Rust backend:
   ```bash
   cargo build
   ```

3. Run the server:
   ```bash
   cargo run --bin minecraft_server
   ```

#### Using Docker (Alternative)

For containerized deployment:

1. Build and start all services:
   ```bash
   docker-compose up -d
   ```

2. Access the frontend at http://localhost

## Development

### Frontend Development

The frontend is built with React, TypeScript, and Three.js:

```bash
cd frontend
npm run dev
```

Features implemented:
- Procedural terrain generation
- Block breaking and placement
- Player movement with physics
- Dynamic chunk loading
- Daylight cycle
- Inventory system
- Water and transparent blocks

### Backend Development

The backend is written in Rust and organized into crates for modular development. Currently, the server implements basic WebSocket communication and world state management.

**Known Issue:** The backend may experience crates.io timeout errors during dependency fetching. If this occurs, try using a different network or configure Cargo to use a proxy.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Minecraft by Mojang for the original game concept
- Three.js for the powerful WebGL rendering library
- The Rust community for excellent libraries and tools 