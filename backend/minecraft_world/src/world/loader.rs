use crate::world::World;
use crate::generator::{TerrainGenerator, flat::FlatWorldGenerator, overworld::OverworldGenerator};
use crate::chunk::provider::{ChunkProvider, MemoryChunkProvider};
use minecraft_core::block::BlockType;
use minecraft_util::config::{load_config, save_config};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use std::path::{Path, PathBuf};
use anyhow::Result;
use uuid::Uuid;

/// Configuration for a world
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldConfig {
    /// The unique ID of the world
    pub id: Uuid,
    /// The name of the world
    pub name: String,
    /// The seed for terrain generation
    pub seed: i64,
    /// The type of generator to use
    pub generator_type: String,
    /// The spawn position (x, y, z)
    pub spawn_position: (i32, i32, i32),
    /// The game mode (0 = survival, 1 = creative)
    pub game_mode: u8,
    /// Whether structures should be generated
    pub generate_structures: bool,
    /// Whether the world is in hardcore mode
    pub hardcore: bool,
    /// The time of day in ticks (0-24000)
    pub time: u64,
    /// Whether it is currently raining
    pub is_raining: bool,
    /// Whether it is currently thundering
    pub is_thundering: bool,
}

impl Default for WorldConfig {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            name: "New World".to_string(),
            seed: rand::random(),
            generator_type: "overworld".to_string(),
            spawn_position: (0, 64, 0),
            game_mode: 0,
            generate_structures: true,
            hardcore: false,
            time: 0,
            is_raining: false,
            is_thundering: false,
        }
    }
}

/// Manages loading and creating worlds
pub struct WorldLoader {
    /// The base directory for world data
    worlds_dir: PathBuf,
}

impl WorldLoader {
    /// Creates a new world loader with the specified worlds directory
    pub fn new(worlds_dir: impl AsRef<Path>) -> Self {
        let worlds_dir = worlds_dir.as_ref().to_path_buf();
        
        // Create the worlds directory if it doesn't exist
        if !worlds_dir.exists() {
            std::fs::create_dir_all(&worlds_dir).expect("Failed to create worlds directory");
        }
        
        Self { worlds_dir }
    }
    
    /// Lists all available worlds
    pub fn list_worlds(&self) -> Result<Vec<WorldConfig>> {
        let mut worlds = Vec::new();
        
        // Iterate through directories in the worlds dir
        for entry in std::fs::read_dir(&self.worlds_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            // Check if it's a directory and has a config file
            if path.is_dir() {
                let config_path = path.join("world.json");
                if config_path.exists() {
                    match load_config::<WorldConfig>(&config_path) {
                        Ok(config) => worlds.push(config),
                        Err(err) => {
                            log::warn!("Failed to load world config from {}: {}", config_path.display(), err);
                        }
                    }
                }
            }
        }
        
        Ok(worlds)
    }
    
    /// Creates a new world with the specified configuration
    pub async fn create_world(&self, config: WorldConfig) -> Result<World> {
        // Create the world directory
        let world_dir = self.worlds_dir.join(config.id.to_string());
        if !world_dir.exists() {
            std::fs::create_dir_all(&world_dir)?;
        }
        
        // Save the world configuration
        let config_path = world_dir.join("world.json");
        save_config(&config, &config_path)?;
        
        // Create the appropriate generator
        let generator: Arc<dyn TerrainGenerator + Send + Sync> = match config.generator_type.as_str() {
            "flat" => {
                let generator = FlatWorldGenerator::new("Flat", config.seed)
                    .with_layers(vec![
                        (BlockType::Bedrock, 1),
                        (BlockType::Stone, 3),
                        (BlockType::Dirt, 1),
                        (BlockType::Grass, 1),
                    ]);
                Arc::new(generator)
            },
            _ => {
                // Default to overworld
                let generator = OverworldGenerator::new("Overworld", config.seed)
                    .with_sea_level(64)
                    .with_scale(1.0);
                Arc::new(generator)
            },
        };
        
        // Create the chunk provider
        let chunk_provider = MemoryChunkProvider::new(generator.as_ref().clone());
        
        // Create the world
        let mut world = World::new(
            &config.name,
            config.seed,
            Box::new(chunk_provider),
            generator.clone(),
        );
        
        // Set the world's properties from the config
        world.id = config.id;
        world.time.store(config.time, std::sync::atomic::Ordering::Relaxed);
        world.is_raining = config.is_raining;
        world.is_thundering = config.is_thundering;
        world.spawn_position = minecraft_core::math::BlockVector::new(
            config.spawn_position.0,
            config.spawn_position.1,
            config.spawn_position.2,
        );
        
        // Generate the spawn area
        let spawn_chunks = generator.create_spawn_area(8).await?;
        
        // Find a suitable spawn position if not specified
        if config.spawn_position == (0, 64, 0) {
            // Set a default spawn position at the highest point near the center
            // (In a real implementation, this would search for a safe position)
            world.spawn_position = minecraft_core::math::BlockVector::new(0, 70, 0);
        }
        
        Ok(world)
    }
    
    /// Loads an existing world by ID
    pub async fn load_world(&self, id: Uuid) -> Result<World> {
        // Find the world directory
        let world_dir = self.worlds_dir.join(id.to_string());
        if !world_dir.exists() {
            return Err(anyhow::anyhow!("World not found: {}", id));
        }
        
        // Load the world configuration
        let config_path = world_dir.join("world.json");
        let config = load_config::<WorldConfig>(&config_path)?;
        
        // Create the world from the config
        self.create_world(config).await
    }
    
    /// Saves a world
    pub async fn save_world(&self, world: &World) -> Result<()> {
        // Save the world configuration
        let world_dir = self.worlds_dir.join(world.id.to_string());
        if !world_dir.exists() {
            std::fs::create_dir_all(&world_dir)?;
        }
        
        // Create the world configuration
        let config = WorldConfig {
            id: world.id,
            name: world.name.clone(),
            seed: world.seed,
            generator_type: world.generator.name().to_string(),
            spawn_position: (
                world.spawn_position.x,
                world.spawn_position.y,
                world.spawn_position.z,
            ),
            game_mode: 0, // Default to survival
            generate_structures: true,
            hardcore: false,
            time: world.time.load(std::sync::atomic::Ordering::Relaxed),
            is_raining: world.is_raining,
            is_thundering: world.is_thundering,
        };
        
        // Save the configuration
        let config_path = world_dir.join("world.json");
        save_config(&config, &config_path)?;
        
        // Save all dirty chunks
        world.save_dirty_chunks().await?;
        
        Ok(())
    }
    
    /// Deletes a world by ID
    pub fn delete_world(&self, id: Uuid) -> Result<()> {
        let world_dir = self.worlds_dir.join(id.to_string());
        if world_dir.exists() {
            std::fs::remove_dir_all(world_dir)?;
        }
        
        Ok(())
    }
} 