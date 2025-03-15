pub mod noise;
pub mod overworld;
pub mod flat;

use crate::chunk::Chunk;
use minecraft_core::math::ChunkVector;
use anyhow::Result;
use async_trait::async_trait;

/// Trait for terrain generators
#[async_trait]
pub trait TerrainGenerator {
    /// Generate a new chunk at the specified position
    async fn generate_chunk(&self, position: ChunkVector) -> Result<Chunk>;
    
    /// Returns the name of this generator
    fn name(&self) -> &str;
    
    /// Returns the seed used by this generator
    fn seed(&self) -> i64;
    
    /// Pre-generates chunks in a square area around the center
    async fn pre_generate_chunks(&self, center: ChunkVector, radius: i32) -> Result<Vec<Chunk>> {
        let mut chunks = Vec::new();
        
        for x in (center.x - radius)..=(center.x + radius) {
            for z in (center.z - radius)..=(center.z + radius) {
                // Skip chunks that are too far away (making it a circle instead of a square)
                let dx = x - center.x;
                let dz = z - center.z;
                let distance_squared = dx * dx + dz * dz;
                if distance_squared > radius * radius {
                    continue;
                }
                
                // Generate each y-level separately to avoid excessive height
                for y in (center.y - 1)..=(center.y + 1) {
                    let position = ChunkVector::new(x, y, z);
                    let chunk = self.generate_chunk(position).await?;
                    chunks.push(chunk);
                }
            }
        }
        
        Ok(chunks)
    }
    
    /// Creates the spawn area with a radius around 0,0
    async fn create_spawn_area(&self, radius: i32) -> Result<Vec<Chunk>> {
        self.pre_generate_chunks(ChunkVector::new(0, 0, 0), radius).await
    }
}

/// A simple flat world generator that creates a flat terrain with a single block type
pub struct FlatWorldGenerator {
    name: String,
    seed: i64,
    layers: Vec<(minecraft_core::block::BlockType, u32)>,
}

impl FlatWorldGenerator {
    /// Creates a new flat world generator with the specified seed
    pub fn new(name: &str, seed: i64) -> Self {
        Self {
            name: name.to_string(),
            seed,
            layers: vec![
                (minecraft_core::block::BlockType::Bedrock, 1),
                (minecraft_core::block::BlockType::Stone, 3),
                (minecraft_core::block::BlockType::Dirt, 3),
                (minecraft_core::block::BlockType::Grass, 1),
            ],
        }
    }
    
    /// Sets the layers for this flat world
    pub fn with_layers(mut self, layers: Vec<(minecraft_core::block::BlockType, u32)>) -> Self {
        self.layers = layers;
        self
    }
}

#[async_trait]
impl TerrainGenerator for FlatWorldGenerator {
    async fn generate_chunk(&self, position: ChunkVector) -> Result<Chunk> {
        // Create a new chunk
        let mut chunk = Chunk::new(position);
        
        // Only generate terrain for chunks at height 0 and below
        if position.y > 0 {
            return Ok(chunk);
        }
        
        // Fill the chunk with the layers
        let mut current_height = 0;
        
        for (block_type, thickness) in &self.layers {
            let start_y = current_height;
            let end_y = current_height + thickness;
            
            // Fill this layer
            for y in start_y..end_y {
                if y >= 16 {
                    break; // Beyond this chunk's height
                }
                
                // Create a new section if needed
                let section_y = position.y as i32;
                if !chunk.has_section(section_y) {
                    chunk.set_section(section_y, crate::chunk::section::ChunkSection::new());
                }
                
                // Fill the section at this height
                for x in 0..16 {
                    for z in 0..16 {
                        chunk.set_block(x, y as usize, z, minecraft_core::block::Block::new(*block_type));
                    }
                }
            }
            
            current_height += thickness;
        }
        
        Ok(chunk)
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    fn seed(&self) -> i64 {
        self.seed
    }
} 