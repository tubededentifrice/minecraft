pub mod loader;
pub mod query;

use crate::chunk::{Chunk, provider::ChunkProvider};
use crate::generator::TerrainGenerator;
use minecraft_core::block::Block;
use minecraft_core::math::{BlockVector, ChunkVector, block_to_chunk};
use minecraft_util::log;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use anyhow::Result;

/// Represents a Minecraft world
pub struct World {
    /// Unique identifier for this world
    pub id: Uuid,
    /// The name of the world
    pub name: String,
    /// The seed used for random generation
    pub seed: i64,
    /// The provider that supplies chunks for this world
    pub chunk_provider: Box<dyn ChunkProvider>,
    /// The generator used to create new terrain
    pub generator: Arc<dyn TerrainGenerator + Send + Sync>,
    /// The time of day in ticks (0-24000)
    pub time: AtomicU64,
    /// Whether it is currently raining
    pub is_raining: bool,
    /// Whether it is currently thundering
    pub is_thundering: bool,
    /// The spawn position for new players
    pub spawn_position: BlockVector,
    /// The creation time of the world
    pub created_at: u64,
    /// The last time the world was played
    pub last_played: AtomicU64,
}

impl World {
    /// Creates a new world with the specified name and seed
    pub fn new(
        name: &str,
        seed: i64,
        chunk_provider: Box<dyn ChunkProvider>,
        generator: Arc<dyn TerrainGenerator + Send + Sync>,
    ) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            seed,
            chunk_provider,
            generator,
            time: AtomicU64::new(0),
            is_raining: false,
            is_thundering: false,
            spawn_position: BlockVector::new(0, 64, 0), // Will be set during generation
            created_at: now,
            last_played: AtomicU64::new(now),
        }
    }
    
    /// Gets a chunk at the specified position, loading or generating it if necessary
    pub async fn get_chunk(&self, position: ChunkVector) -> Result<Arc<Chunk>> {
        self.chunk_provider.get_chunk(position).await
    }
    
    /// Checks if a chunk exists at the specified position
    pub fn chunk_exists(&self, position: ChunkVector) -> bool {
        self.chunk_provider.chunk_exists(position)
    }
    
    /// Gets a chunk if it's already loaded
    pub fn get_chunk_if_loaded(&self, position: ChunkVector) -> Option<Arc<Chunk>> {
        self.chunk_provider.get_chunk_if_loaded(position)
    }
    
    /// Gets the block at the specified position
    pub async fn get_block(&self, position: BlockVector) -> Result<Block> {
        let chunk_pos = position.to_chunk();
        let chunk = self.get_chunk(chunk_pos).await?;
        
        // Convert world coordinates to chunk-local coordinates
        let (local_x, local_y, local_z) = block_to_local(position.x, position.y, position.z);
        
        // Get the block from the chunk
        Ok(chunk.get_block(local_x, local_y, local_z).unwrap_or_default())
    }
    
    /// Sets the block at the specified position
    pub async fn set_block(&self, position: BlockVector, block: Block) -> Result<()> {
        let chunk_pos = position.to_chunk();
        let chunk = self.get_chunk(chunk_pos).await?;
        
        // Convert to a mutable reference if possible
        // This is a simplification - in a real implementation, we would need
        // a more complex system to handle concurrent chunk modifications
        let chunk_ptr = Arc::into_raw(chunk) as *mut Chunk;
        let chunk_mut = unsafe { &mut *chunk_ptr };
        
        // Convert world coordinates to chunk-local coordinates
        let (local_x, local_y, local_z) = block_to_local(position.x, position.y, position.z);
        
        // Set the block in the chunk
        chunk_mut.set_block(local_x, local_y, local_z, block);
        
        // Prevent the drop of the Arc
        let _ = unsafe { Arc::from_raw(chunk_ptr) };
        
        Ok(())
    }
    
    /// Sets the time of day
    pub fn set_time(&self, time: u64) {
        self.time.store(time % 24000, Ordering::Relaxed);
    }
    
    /// Gets the current time of day
    pub fn get_time(&self) -> u64 {
        self.time.load(Ordering::Relaxed)
    }
    
    /// Increments the time by the specified amount
    pub fn increment_time(&self, delta: u64) {
        let current = self.time.load(Ordering::Relaxed);
        let new_time = (current + delta) % 24000;
        self.time.store(new_time, Ordering::Relaxed);
    }
    
    /// Updates the last played time to now
    pub fn update_last_played(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        self.last_played.store(now, Ordering::Relaxed);
    }
    
    /// Sets the spawn position for new players
    pub fn set_spawn_position(&mut self, position: BlockVector) {
        self.spawn_position = position;
    }
    
    /// Saves all dirty chunks
    pub async fn save_dirty_chunks(&self) -> Result<usize> {
        // This is a simplified implementation - in a real game, we would track
        // dirty chunks and only save those
        let mut count = 0;
        
        if let Some(chunks) = self.chunk_provider.get_chunk_if_loaded(ChunkVector::new(0, 0, 0)) {
            for chunk_pos in chunks.position.to_block_min().to_chunk().manhattan_radius(10) {
                if let Some(chunk) = self.chunk_provider.get_chunk_if_loaded(chunk_pos) {
                    self.chunk_provider.save_chunk(&chunk).await?;
                    count += 1;
                }
            }
        }
        
        Ok(count)
    }
    
    /// Unloads chunks that are too far from any player
    pub fn unload_distant_chunks(&self, active_chunk_positions: &[ChunkVector], radius: i32) -> usize {
        let mut count = 0;
        
        // Get all loaded chunks
        if let Some(chunks) = self.chunk_provider.get_chunk_if_loaded(ChunkVector::new(0, 0, 0)) {
            for chunk_pos in chunks.position.to_block_min().to_chunk().manhattan_radius(50) {
                // Skip if the chunk is not loaded
                if !self.chunk_provider.chunk_exists(chunk_pos) {
                    continue;
                }
                
                // Check if any player is near this chunk
                let mut is_near_player = false;
                for &player_chunk in active_chunk_positions {
                    let distance = chunk_pos.manhattan_distance(&player_chunk);
                    if distance <= radius {
                        is_near_player = true;
                        break;
                    }
                }
                
                // Unload the chunk if it's too far from all players
                if !is_near_player {
                    if self.chunk_provider.unload_chunk(chunk_pos) {
                        count += 1;
                    }
                }
            }
        }
        
        count
    }
}

/// Extension trait for ChunkVector to get blocks in a radius
trait ManhattanRadius {
    fn manhattan_radius(&self, radius: i32) -> Vec<ChunkVector>;
}

impl ManhattanRadius for ChunkVector {
    fn manhattan_radius(&self, radius: i32) -> Vec<ChunkVector> {
        let mut result = Vec::new();
        
        for x in (self.x - radius)..=(self.x + radius) {
            for y in (self.y - radius)..=(self.y + radius) {
                for z in (self.z - radius)..=(self.z + radius) {
                    let pos = ChunkVector::new(x, y, z);
                    if pos.manhattan_distance(self) <= radius {
                        result.push(pos);
                    }
                }
            }
        }
        
        result
    }
} 