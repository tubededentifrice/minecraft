use serde::{Serialize, Deserialize};
use super::types::BlockType;

/// Properties of a block type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockProperties {
    /// The name of the block
    pub name: &'static str,
    /// Whether the block is solid (can be collided with)
    pub solid: bool,
    /// Whether the block is transparent (light passes through)
    pub transparent: bool,
    /// Whether the block is a fluid
    pub fluid: bool,
    /// Whether the block is affected by gravity
    pub gravity_affected: bool,
    /// The amount of light emitted by the block (0-15)
    pub light_emission: u8,
    /// The resistance to explosions
    pub blast_resistance: f32,
    /// The hardness of the block (time to break)
    pub hardness: f32,
    /// The preferred tool type for breaking this block
    pub tool_type: Option<&'static str>,
    /// Whether the block can catch fire
    pub flammable: bool,
    /// The items dropped when the block is broken
    /// Each tuple contains (block_type_id, count)
    pub drops: Vec<(u16, u8)>,
} 