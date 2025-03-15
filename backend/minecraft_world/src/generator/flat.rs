use crate::chunk::{Chunk, section::ChunkSection};
use crate::generator::TerrainGenerator;
use minecraft_core::math::ChunkVector;
use minecraft_core::block::{Block, BlockType};
use anyhow::Result;
use async_trait::async_trait;

/// A simple flat world generator
pub struct FlatWorldGenerator {
    /// The name of this generator
    name: String,
    /// The seed for terrain generation
    seed: i64,
    /// The layers of blocks to generate (block type, thickness)
    layers: Vec<(BlockType, u32)>,
}

impl FlatWorldGenerator {
    /// Creates a new flat world generator
    pub fn new(name: &str, seed: i64) -> Self {
        Self {
            name: name.to_string(),
            seed,
            layers: vec![
                (BlockType::Bedrock, 1),
                (BlockType::Stone, 3),
                (BlockType::Dirt, 1),
                (BlockType::Grass, 1),
            ],
        }
    }
    
    /// Sets the layers for this generator
    pub fn with_layers(mut self, layers: Vec<(BlockType, u32)>) -> Self {
        self.layers = layers;
        self
    }
}

#[async_trait]
impl TerrainGenerator for FlatWorldGenerator {
    async fn generate_chunk(&self, position: ChunkVector) -> Result<Chunk> {
        // Create a new chunk
        let mut chunk = Chunk::new(position);
        
        // Only generate terrain for chunks at y=0
        if position.y != 0 {
            return Ok(chunk);
        }
        
        // Create a section for this chunk
        let section_y = 0;
        let mut section = ChunkSection::new();
        
        // Calculate total height
        let total_height: u32 = self.layers.iter().map(|(_, thickness)| thickness).sum();
        
        // Fill the chunk with the layers
        let mut current_height = 0;
        
        for (block_type, thickness) in &self.layers {
            for y in current_height..(current_height + thickness) {
                if y >= 16 {
                    break; // Beyond this chunk's height
                }
                
                // Fill this layer
                for x in 0..16 {
                    for z in 0..16 {
                        section.set_block(x, y as usize, z, Block::new(*block_type));
                    }
                }
            }
            
            current_height += thickness;
        }
        
        // Add the section to the chunk
        chunk.set_section(section_y, section);
        
        Ok(chunk)
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    fn seed(&self) -> i64 {
        self.seed
    }
} 