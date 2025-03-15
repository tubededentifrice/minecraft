use minecraft_core::block::Block;
use minecraft_core::block::types::BlockType;
use minecraft_core::constants::{CHUNK_SIZE, CHUNK_VOLUME};
use minecraft_core::math::chunk_index;

/// Represents a section of a chunk (16x16x16 blocks)
#[derive(Clone, Debug)]
pub struct ChunkSection {
    /// Blocks in this section, stored as packed u16 values
    pub blocks: Vec<u16>,
    /// Number of non-air blocks in this section
    pub non_air_count: u16,
}

impl ChunkSection {
    /// Creates a new empty chunk section filled with air
    pub fn new() -> Self {
        Self {
            blocks: vec![0; CHUNK_VOLUME], // 0 = Air block type id
            non_air_count: 0,
        }
    }
    
    /// Gets the block at the specified local position
    pub fn get_block(&self, x: usize, y: usize, z: usize) -> Block {
        let index = chunk_index(x, y, z);
        
        if index < self.blocks.len() {
            let packed = self.blocks[index];
            Block::unpack(packed)
        } else {
            Block::default() // Return air if out of bounds
        }
    }
    
    /// Sets the block at the specified local position
    pub fn set_block(&mut self, x: usize, y: usize, z: usize, block: Block) {
        let index = chunk_index(x, y, z);
        
        if index < self.blocks.len() {
            let old_block = Block::unpack(self.blocks[index]);
            let packed = block.pack();
            
            // Update non-air count
            if old_block.is_air() && !block.is_air() {
                self.non_air_count += 1;
            } else if !old_block.is_air() && block.is_air() {
                self.non_air_count = self.non_air_count.saturating_sub(1);
            }
            
            self.blocks[index] = packed;
        }
    }
    
    /// Fills the entire section with the specified block
    pub fn fill(&mut self, block: Block) {
        let packed = block.pack();
        self.blocks.fill(packed);
        
        if block.is_air() {
            self.non_air_count = 0;
        } else {
            self.non_air_count = CHUNK_VOLUME as u16;
        }
    }
    
    /// Fills the section with the specified block type, using default metadata
    pub fn fill_with(&mut self, block_type: BlockType) {
        self.fill(Block::new(block_type));
    }
    
    /// Returns the number of non-air blocks in this section
    pub fn count_non_air_blocks(&self) -> usize {
        self.non_air_count as usize
    }
    
    /// Returns whether this section is completely filled with air
    pub fn is_empty(&self) -> bool {
        self.non_air_count == 0
    }
    
    /// Returns whether this section is completely filled with non-air blocks
    pub fn is_full(&self) -> bool {
        self.non_air_count as usize == CHUNK_VOLUME
    }
    
    /// Creates a deep copy of this section
    pub fn clone_section(&self) -> Self {
        Self {
            blocks: self.blocks.clone(),
            non_air_count: self.non_air_count,
        }
    }
} 