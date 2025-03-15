use crate::chunk::{Chunk, section::ChunkSection};
use crate::generator::{TerrainGenerator, noise::NoiseGenerator};
use minecraft_core::block::{Block, BlockType};
use minecraft_core::math::ChunkVector;
use anyhow::Result;
use async_trait::async_trait;
use std::sync::{Arc, Mutex};

/// A realistic terrain generator for the overworld
pub struct OverworldGenerator {
    /// The name of this generator
    name: String,
    /// The seed for terrain generation
    seed: i64,
    /// The noise generator
    noise: Arc<Mutex<NoiseGenerator>>,
    /// Sea level (blocks above this are air by default)
    sea_level: i32,
    /// World scale factor (higher = more varied terrain)
    scale: f64,
}

impl OverworldGenerator {
    /// Creates a new overworld generator with the specified seed
    pub fn new(name: &str, seed: i64) -> Self {
        Self {
            name: name.to_string(),
            seed,
            noise: Arc::new(Mutex::new(NoiseGenerator::new(seed))),
            sea_level: 64,
            scale: 1.0,
        }
    }
    
    /// Sets the sea level for this generator
    pub fn with_sea_level(mut self, sea_level: i32) -> Self {
        self.sea_level = sea_level;
        self
    }
    
    /// Sets the scale factor for this generator
    pub fn with_scale(mut self, scale: f64) -> Self {
        self.scale = scale;
        self
    }
}

#[async_trait]
impl TerrainGenerator for OverworldGenerator {
    async fn generate_chunk(&self, position: ChunkVector) -> Result<Chunk> {
        // Create a new chunk
        let mut chunk = Chunk::new(position);
        
        // Generate heightmap for this chunk
        let heightmap = {
            let noise = self.noise.lock().unwrap();
            noise.generate_heightmap(position.x, position.z, self.scale)
        };
        
        // Calculate the range of sections that need to be filled in this chunk
        let min_height = *heightmap.iter()
            .flat_map(|row| row.iter())
            .min()
            .unwrap_or(&0);
            
        let max_height = *heightmap.iter()
            .flat_map(|row| row.iter())
            .max()
            .unwrap_or(&0);
            
        let min_section = (min_height / 16).max(0);
        let max_section = (max_height / 16 + 1).min(15);
        
        // Skip if this chunk is outside the height range
        if position.y < min_section || position.y > max_section {
            return Ok(chunk);
        }
        
        // Generate 3D noise for caves and other features
        let cave_noise = {
            let noise = self.noise.lock().unwrap();
            noise.generate_3d_noise(position.x, position.y, position.z, self.scale)
        };
        
        // Get the y-offset within the chunk
        let chunk_y_offset = position.y * 16;
        
        // Create a section for this chunk
        let section_y = position.y;
        if !chunk.has_section(section_y) {
            chunk.set_section(section_y, ChunkSection::new());
        }
        
        // Generate the terrain in this chunk section
        for x in 0..16 {
            for z in 0..16 {
                let height = heightmap[x][z];
                
                for y in 0..16 {
                    let world_y = chunk_y_offset + y;
                    
                    // Determine the block type
                    let block_type = if world_y > height {
                        // Above the surface
                        if world_y <= self.sea_level {
                            // Under water
                            BlockType::Water
                        } else {
                            // Air
                            BlockType::Air
                        }
                    } else if world_y == height {
                        // Surface block
                        if world_y <= self.sea_level - 2 {
                            // Underwater, use sand
                            BlockType::Sand
                        } else if world_y <= self.sea_level + 2 {
                            // Beach
                            BlockType::Sand
                        } else {
                            // Regular surface, use grass
                            BlockType::Grass
                        }
                    } else if world_y >= height - 3 {
                        // Just below surface, use dirt
                        BlockType::Dirt
                    } else if world_y <= 20 {
                        // Deep underground
                        if world_y <= 5 {
                            // Bedrock layer
                            let noise_value = self.noise.lock().unwrap().random_float(0.0, 1.0);
                            if world_y == 0 || (world_y <= 4 && noise_value < 0.5) {
                                BlockType::Bedrock
                            } else {
                                BlockType::Stone
                            }
                        } else {
                            // Stone with occasional ores
                            let noise_value = cave_noise[x][y as usize][z];
                            if noise_value > 0.7 {
                                let ore_type = {
                                    let mut noise = self.noise.lock().unwrap();
                                    let random = noise.random_float(0.0, 1.0);
                                    if random < 0.4 {
                                        BlockType::CoalOre
                                    } else if random < 0.7 {
                                        BlockType::IronOre
                                    } else if random < 0.85 {
                                        BlockType::GoldOre
                                    } else if random < 0.95 {
                                        BlockType::RedstoneOre
                                    } else {
                                        BlockType::DiamondOre
                                    }
                                };
                                ore_type
                            } else {
                                BlockType::Stone
                            }
                        }
                    } else {
                        // Regular underground
                        BlockType::Stone
                    };
                    
                    // Check for caves (if not bedrock)
                    let place_block = if block_type != BlockType::Bedrock && block_type != BlockType::Air {
                        let noise_value = cave_noise[x][y as usize][z];
                        noise_value > -0.3 // Cave threshold
                    } else {
                        true
                    };
                    
                    // Set the block
                    if place_block {
                        chunk.set_block(x, y as usize, z, Block::new(block_type));
                    }
                }
            }
        }
        
        // Plant some trees on grass blocks
        if position.y == 0 {
            let mut noise = self.noise.lock().unwrap();
            for x in 2..14 {
                for z in 2..14 {
                    let height = heightmap[x][z];
                    
                    // Only place trees on grass
                    if height > self.sea_level + 2 && height < 100 {
                        // Random chance for a tree
                        if noise.random_bool(0.02) {
                            self.generate_tree(&mut chunk, x, height as usize + 1, z);
                        }
                    }
                }
            }
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

impl OverworldGenerator {
    /// Generates a tree at the specified position
    fn generate_tree(&self, chunk: &mut Chunk, x: usize, y: usize, z: usize) {
        // Tree trunk (3-5 blocks tall)
        let tree_height = {
            let mut noise = self.noise.lock().unwrap();
            noise.random_int(4, 6) as usize
        };
        
        for i in 0..tree_height {
            if y + i >= 256 {
                break;
            }
            
            chunk.set_block(x, y + i, z, Block::new(BlockType::OakLog));
        }
        
        // Tree leaves
        let leaf_radius = 2;
        let leaf_start = y + tree_height - 3;
        let leaf_end = y + tree_height + 1;
        
        for leaf_y in leaf_start..leaf_end {
            if leaf_y >= 256 {
                break;
            }
            
            let radius = if leaf_y == leaf_end - 1 { 1 } else { leaf_radius };
            
            for dx in -radius..=radius {
                for dz in -radius..=radius {
                    // Skip corners for a more natural shape
                    if dx.abs() == radius && dz.abs() == radius {
                        continue;
                    }
                    
                    let leaf_x = x as i32 + dx;
                    let leaf_z = z as i32 + dz;
                    
                    // Make sure the leaf position is valid
                    if leaf_x >= 0 && leaf_x < 16 && leaf_z >= 0 && leaf_z < 16 {
                        // Random chance to skip leaf placement for irregular shape
                        let mut noise = self.noise.lock().unwrap();
                        if noise.random_bool(0.9) {
                            chunk.set_block(leaf_x as usize, leaf_y, leaf_z as usize, Block::new(BlockType::OakLeaves));
                        }
                    }
                }
            }
        }
    }
} 