/// Constants for the Minecraft clone

/// The size of a chunk in blocks (x, y, z)
pub const CHUNK_SIZE: (usize, usize, usize) = (16, 16, 16);

/// The volume of a chunk in blocks
pub const CHUNK_VOLUME: usize = CHUNK_SIZE.0 * CHUNK_SIZE.1 * CHUNK_SIZE.2;

/// The size of a block in meters
pub const BLOCK_SIZE: f32 = 1.0;

/// The height of a player in blocks
pub const PLAYER_HEIGHT: f32 = 1.8;

/// The width of a player in blocks
pub const PLAYER_WIDTH: f32 = 0.6;

/// Maximum build height
pub const MAX_BUILD_HEIGHT: i32 = 256;

/// Minimum build height
pub const MIN_BUILD_HEIGHT: i32 = 0;

/// Gravity acceleration in blocks per second squared
pub const GRAVITY: f32 = 9.81;

/// Default world seed
pub const DEFAULT_SEED: u32 = 12345;

/// Maximum interaction distance for players
pub const MAX_INTERACTION_DISTANCE: f32 = 5.0;

/// The tick rate of the server in hz
pub const TICK_RATE: u32 = 20;

/// The length of a tick in seconds
pub const TICK_LENGTH_SECONDS: f32 = 1.0 / TICK_RATE as f32;

/// The length of a tick in milliseconds
pub const TICK_LENGTH_MS: u64 = 1000 / TICK_RATE as u64;

/// The maximum number of players allowed on the server by default
pub const DEFAULT_MAX_PLAYERS: usize = 50;

/// The default render distance in chunks
pub const DEFAULT_RENDER_DISTANCE: u32 = 8;

/// The default simulation distance in chunks
pub const DEFAULT_SIMULATION_DISTANCE: u32 = 10; 