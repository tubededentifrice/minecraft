pub mod block;
pub mod constants;
pub mod math;

/// Initialize the core components
pub fn init() {
    // Initialize components as needed
}

/// Module for core game constants
pub mod constants {
    /// The version of the core game engine
    pub const VERSION: &str = env!("CARGO_PKG_VERSION");
    
    /// Gravity acceleration (blocks per second squared)
    pub const GRAVITY: f32 = 9.81;
    
    /// Maximum fall speed (blocks per second)
    pub const MAX_FALL_SPEED: f32 = 78.4;
    
    /// Terminal velocity (blocks per second)
    pub const TERMINAL_VELOCITY: f32 = 78.4;
    
    /// Jump force (blocks per second)
    pub const JUMP_FORCE: f32 = 8.0;
    
    /// Walking speed (blocks per second)
    pub const WALK_SPEED: f32 = 4.3;
    
    /// Sprinting speed (blocks per second)
    pub const SPRINT_SPEED: f32 = 5.6;
    
    /// Sneaking speed (blocks per second)
    pub const SNEAK_SPEED: f32 = 1.3;
}

/// Module for math utilities
pub mod math {
    pub mod vector;
    
    /// A utility function to clamp a value between a minimum and maximum
    pub fn clamp<T: PartialOrd>(value: T, min: T, max: T) -> T {
        if value < min {
            min
        } else if value > max {
            max
        } else {
            value
        }
    }
    
    /// A utility function to linearly interpolate between two values
    pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
        a + (b - a) * t
    }
}

/// Module for block-related functionality
pub mod block {
    pub mod types;
    pub mod properties;
    
    use serde::{Serialize, Deserialize};
    
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
} 