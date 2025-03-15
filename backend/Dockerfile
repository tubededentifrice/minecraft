# Use the debian slim image directly
FROM debian:bullseye-slim

# Install Rust and build dependencies
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /usr/src/minecraft

# Copy the Cargo.toml files first to cache dependencies
COPY minecraft_util/Cargo.toml minecraft_util/
COPY minecraft_core/Cargo.toml minecraft_core/
COPY minecraft_world/Cargo.toml minecraft_world/
COPY minecraft_server/Cargo.toml minecraft_server/
COPY Cargo.toml .

# Create dummy source files to build dependencies
RUN mkdir -p minecraft_util/src && \
    mkdir -p minecraft_core/src && \
    mkdir -p minecraft_world/src && \
    mkdir -p minecraft_server/src && \
    echo "fn main() {}" > minecraft_server/src/main.rs && \
    echo "pub fn dummy() {}" > minecraft_util/src/lib.rs && \
    echo "pub fn dummy() {}" > minecraft_core/src/lib.rs && \
    echo "pub fn dummy() {}" > minecraft_world/src/lib.rs

# Build dependencies only (this will be cached if dependencies don't change)
RUN cargo build --release

# Remove the dummy source files
RUN rm -rf minecraft_util/src minecraft_core/src minecraft_world/src minecraft_server/src

# Copy the actual source code
COPY minecraft_util/src/ minecraft_util/src/
COPY minecraft_core/src/ minecraft_core/src/
COPY minecraft_world/src/ minecraft_world/src/
COPY minecraft_server/src/ minecraft_server/src/

# Build the actual binary
RUN cargo build --release

# Create necessary directories
RUN mkdir -p /app/config /data/worlds /data/logs

# Copy the build artifacts to the app directory
RUN cp target/release/minecraft_server /app/

# Set the working directory to the app
WORKDIR /app

# Set environment variables
ENV SERVER_CONFIG_PATH=/app/config/server.json
ENV SERVER_DATA_PATH=/data
ENV LOG_LEVEL=info

# Expose necessary ports
EXPOSE 8080 8081

# Set the entrypoint to the server binary
ENTRYPOINT ["/app/minecraft_server"] 