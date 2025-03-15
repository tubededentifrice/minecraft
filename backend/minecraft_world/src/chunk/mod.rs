pub mod collection;
pub mod section;
pub mod provider;

use minecraft_core::block::Block;
use minecraft_core::math::{ChunkVector, BlockVector, block_to_local, chunk_index};
use minecraft_core::constants::{CHUNK_SIZE, CHUNK_VOLUME};
use section::ChunkSection;
use serde::{Serialize, Deserialize};
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// Represents a chunk in the world
#[derive(Clone, Debug)]
pub struct Chunk {
    /// The position of the chunk
    pub position: ChunkVector,
    /// The sections of the chunk, divided by height
    /// Each section represents a 16x16x16 cube of blocks
    pub sections: HashMap<i32, Arc<RwLock<ChunkSection>>>,
    /// The timestamp when this chunk was last modified
    pub last_modified: u64,
    /// Whether the chunk has been modified since it was last saved
    pub is_dirty: bool,
    /// The timestamp when this chunk was generated or loaded
    pub created_at: u64,
}

impl Chunk {
    /// Creates a new empty chunk at the specified position
    pub fn new(position: ChunkVector) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        Self {
            position,
            sections: HashMap::new(),
            last_modified: now,
            is_dirty: true,
            created_at: now,
        }
    }
    
    /// Gets the block at the specified position in the chunk
    pub fn get_block(&self, x: usize, y: usize, z: usize) -> Option<Block> {
        let section_y = (y / CHUNK_SIZE.1) as i32;
        let local_y = y % CHUNK_SIZE.1;
        
        self.sections
            .get(&section_y)
            .and_then(|section| {
                let section = section.read().unwrap();
                Some(section.get_block(x, local_y, z))
            })
    }
    
    /// Gets the block at the specified world position
    pub fn get_block_at(&self, position: &BlockVector) -> Option<Block> {
        let (local_x, local_y, local_z) = self.world_to_local(position);
        
        if self.is_position_valid(local_x, local_y, local_z) {
            self.get_block(local_x, local_y, local_z)
        } else {
            None
        }
    }
    
    /// Sets the block at the specified position in the chunk
    pub fn set_block(&mut self, x: usize, y: usize, z: usize, block: Block) -> bool {
        let section_y = (y / CHUNK_SIZE.1) as i32;
        let local_y = y % CHUNK_SIZE.1;
        
        // Create the section if it doesn't exist
        if !self.sections.contains_key(&section_y) {
            self.sections.insert(section_y, Arc::new(RwLock::new(ChunkSection::new())));
        }
        
        // Update the block
        if let Some(section) = self.sections.get(&section_y) {
            let mut section = section.write().unwrap();
            section.set_block(x, local_y, z, block);
            
            // Update chunk metadata
            self.is_dirty = true;
            self.last_modified = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
                
            return true;
        }
        
        false
    }
    
    /// Sets the block at the specified world position
    pub fn set_block_at(&mut self, position: &BlockVector, block: Block) -> bool {
        let (local_x, local_y, local_z) = self.world_to_local(position);
        
        if self.is_position_valid(local_x, local_y, local_z) {
            self.set_block(local_x, local_y, local_z, block)
        } else {
            false
        }
    }
    
    /// Checks if the chunk contains the specified section
    pub fn has_section(&self, section_y: i32) -> bool {
        self.sections.contains_key(&section_y)
    }
    
    /// Gets a section of the chunk
    pub fn get_section(&self, section_y: i32) -> Option<Arc<RwLock<ChunkSection>>> {
        self.sections.get(&section_y).cloned()
    }
    
    /// Sets a section of the chunk
    pub fn set_section(&mut self, section_y: i32, section: ChunkSection) {
        self.sections.insert(section_y, Arc::new(RwLock::new(section)));
        self.is_dirty = true;
        self.last_modified = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
    }
    
    /// Counts the number of non-air blocks in the chunk
    pub fn count_non_air_blocks(&self) -> usize {
        self.sections.values().map(|section| {
            let section = section.read().unwrap();
            section.count_non_air_blocks()
        }).sum()
    }
    
    /// Marks the chunk as clean (saved)
    pub fn mark_clean(&mut self) {
        self.is_dirty = false;
    }
    
    /// Converts a world position to local chunk coordinates
    fn world_to_local(&self, position: &BlockVector) -> (usize, usize, usize) {
        let local_x = ((position.x % CHUNK_SIZE.0 as i32) + CHUNK_SIZE.0 as i32) % CHUNK_SIZE.0 as i32;
        let local_y = ((position.y % CHUNK_SIZE.1 as i32) + CHUNK_SIZE.1 as i32) % CHUNK_SIZE.1 as i32;
        let local_z = ((position.z % CHUNK_SIZE.2 as i32) + CHUNK_SIZE.2 as i32) % CHUNK_SIZE.2 as i32;
        
        (local_x as usize, local_y as usize, local_z as usize)
    }
    
    /// Checks if a local position is valid for this chunk
    fn is_position_valid(&self, x: usize, y: usize, z: usize) -> bool {
        x < CHUNK_SIZE.0 && y < 256 && z < CHUNK_SIZE.2
    }
    
    /// Serializes this chunk to bytes for network transmission or storage
    pub fn serialize(&self) -> anyhow::Result<Vec<u8>> {
        let serializable = SerializableChunk::from(self);
        bincode::serialize(&serializable).map_err(|e| anyhow::anyhow!("Failed to serialize chunk: {}", e))
    }
    
    /// Deserializes a chunk from bytes
    pub fn deserialize(data: &[u8]) -> anyhow::Result<Self> {
        let serializable: SerializableChunk = bincode::deserialize(data)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize chunk: {}", e))?;
            
        Ok(serializable.into())
    }
}

/// A serializable representation of a chunk
#[derive(Serialize, Deserialize)]
struct SerializableChunk {
    position: ChunkVector,
    sections: HashMap<i32, SerializableChunkSection>,
    last_modified: u64,
    created_at: u64,
}

/// A serializable representation of a chunk section
#[derive(Serialize, Deserialize)]
struct SerializableChunkSection {
    blocks: Vec<u16>,
}

impl From<&Chunk> for SerializableChunk {
    fn from(chunk: &Chunk) -> Self {
        let mut sections = HashMap::new();
        
        for (section_y, section) in &chunk.sections {
            let section = section.read().unwrap();
            sections.insert(*section_y, SerializableChunkSection {
                blocks: section.blocks.clone(),
            });
        }
        
        Self {
            position: chunk.position,
            sections,
            last_modified: chunk.last_modified,
            created_at: chunk.created_at,
        }
    }
}

impl From<SerializableChunk> for Chunk {
    fn from(serializable: SerializableChunk) -> Self {
        let mut chunk = Chunk::new(serializable.position);
        chunk.last_modified = serializable.last_modified;
        chunk.created_at = serializable.created_at;
        
        for (section_y, serializable_section) in serializable.sections {
            let mut section = ChunkSection::new();
            section.blocks = serializable_section.blocks;
            chunk.sections.insert(section_y, Arc::new(RwLock::new(section)));
        }
        
        chunk.is_dirty = false;
        chunk
    }
} 