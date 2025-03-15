pub mod types;
pub mod properties;

use serde::{Serialize, Deserialize};
use crate::math::vector::WorldVector;

/// A block in the game world
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Block {
    /// The type of the block
    pub block_type: u16,
    /// Additional metadata for the block
    pub metadata: u16,
}

impl Block {
    /// Create a new block
    pub fn new(block_type: u16) -> Self {
        Self {
            block_type,
            metadata: 0,
        }
    }
    
    /// Create a new block with metadata
    pub fn with_metadata(block_type: u16, metadata: u16) -> Self {
        Self {
            block_type,
            metadata,
        }
    }
    
    /// Check if this block is air
    pub fn is_air(&self) -> bool {
        self.block_type == 0
    }
    
    /// Check if this block is solid
    pub fn is_solid(&self) -> bool {
        if self.is_air() {
            return false;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.solid
    }
    
    /// Check if this block is transparent
    pub fn is_transparent(&self) -> bool {
        if self.is_air() {
            return true;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.transparent
    }
    
    /// Check if this block is a fluid
    pub fn is_fluid(&self) -> bool {
        if self.is_air() {
            return false;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.fluid
    }
    
    /// Get the light emission level of this block (0-15)
    pub fn light_emission(&self) -> u8 {
        if self.is_air() {
            return 0;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.light_emission
    }
    
    /// Get the blast resistance of this block
    pub fn blast_resistance(&self) -> f32 {
        if self.is_air() {
            return 0.0;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.blast_resistance
    }
    
    /// Get the hardness of this block
    pub fn hardness(&self) -> f32 {
        if self.is_air() {
            return 0.0;
        }
        let props = types::BlockType::from_id(self.block_type).properties();
        props.hardness
    }
    
    /// Pack the block into a single u32
    pub fn pack(&self) -> u32 {
        ((self.block_type as u32) << 16) | (self.metadata as u32)
    }
    
    /// Unpack a block from a u32
    pub fn unpack(packed: u32) -> Self {
        Self {
            block_type: ((packed >> 16) & 0xFFFF) as u16,
            metadata: (packed & 0xFFFF) as u16,
        }
    }
}

/// The six faces of a block
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BlockFace {
    Top,
    Bottom,
    North,
    South,
    East,
    West,
}

impl BlockFace {
    /// Get the unit vector pointing in the direction of this face
    pub fn direction(&self) -> WorldVector {
        match self {
            BlockFace::Top => WorldVector::new(0.0, 1.0, 0.0),
            BlockFace::Bottom => WorldVector::new(0.0, -1.0, 0.0),
            BlockFace::North => WorldVector::new(0.0, 0.0, -1.0),
            BlockFace::South => WorldVector::new(0.0, 0.0, 1.0),
            BlockFace::East => WorldVector::new(1.0, 0.0, 0.0),
            BlockFace::West => WorldVector::new(-1.0, 0.0, 0.0),
        }
    }
    
    /// Get the opposite face
    pub fn opposite(&self) -> Self {
        match self {
            BlockFace::Top => BlockFace::Bottom,
            BlockFace::Bottom => BlockFace::Top,
            BlockFace::North => BlockFace::South,
            BlockFace::South => BlockFace::North,
            BlockFace::East => BlockFace::West,
            BlockFace::West => BlockFace::East,
        }
    }
    
    /// Get the face from an ID (0-5)
    pub fn from_id(id: u8) -> Self {
        match id % 6 {
            0 => BlockFace::Top,
            1 => BlockFace::Bottom,
            2 => BlockFace::North,
            3 => BlockFace::South,
            4 => BlockFace::East,
            5 => BlockFace::West,
            _ => unreachable!(),
        }
    }
    
    /// Get the ID of this face (0-5)
    pub fn to_id(&self) -> u8 {
        match self {
            BlockFace::Top => 0,
            BlockFace::Bottom => 1,
            BlockFace::North => 2,
            BlockFace::South => 3,
            BlockFace::East => 4,
            BlockFace::West => 5,
        }
    }
    
    /// Get all block faces
    pub fn all() -> [Self; 6] {
        [
            BlockFace::Top,
            BlockFace::Bottom,
            BlockFace::North,
            BlockFace::South,
            BlockFace::East,
            BlockFace::West,
        ]
    }
} 
} 