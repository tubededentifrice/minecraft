pub mod collision;
pub mod movement;

use crate::math::WorldVector;
use nalgebra::Vector3;

/// Gravity constant (downward acceleration)
pub const GRAVITY: Vector3<f32> = Vector3::new(0.0, -9.81, 0.0);

/// The maximum fall speed
pub const MAX_FALL_SPEED: f32 = 20.0;

/// Terminal velocity in blocks per second
pub const TERMINAL_VELOCITY: f32 = 40.0;

/// The base jump force
pub const JUMP_FORCE: f32 = 8.0;

/// The default walk speed in blocks per second
pub const WALK_SPEED: f32 = 4.3;

/// The default sprint speed in blocks per second
pub const SPRINT_SPEED: f32 = 5.6;

/// The default sneak speed in blocks per second
pub const SNEAK_SPEED: f32 = 1.3;

/// Represents the physics state of an entity
#[derive(Debug, Clone)]
pub struct PhysicsState {
    /// The position in the world
    pub position: WorldVector,
    /// The velocity in blocks per second
    pub velocity: WorldVector,
    /// The acceleration in blocks per second squared
    pub acceleration: WorldVector,
    /// The entity's size (width, height, width)
    pub size: (f32, f32, f32),
    /// Whether the entity is on the ground
    pub on_ground: bool,
    /// Whether the entity is in water
    pub in_water: bool,
    /// Whether the entity is in lava
    pub in_lava: bool,
    /// Whether the entity is sneaking
    pub is_sneaking: bool,
    /// Whether the entity is sprinting
    pub is_sprinting: bool,
    /// Whether the entity is flying
    pub is_flying: bool,
}

impl PhysicsState {
    /// Creates a new physics state
    pub fn new(position: WorldVector, size: (f32, f32, f32)) -> Self {
        Self {
            position,
            velocity: WorldVector::new(0.0, 0.0, 0.0),
            acceleration: WorldVector::new(0.0, 0.0, 0.0),
            size,
            on_ground: false,
            in_water: false,
            in_lava: false,
            is_sneaking: false,
            is_sprinting: false,
            is_flying: false,
        }
    }
    
    /// Returns the bounding box for the entity
    pub fn bounding_box(&self) -> AABB {
        let half_width = self.size.0 / 2.0;
        let half_depth = self.size.2 / 2.0;
        let height = self.size.1;
        
        AABB {
            min: WorldVector::new(
                self.position.x - half_width,
                self.position.y,
                self.position.z - half_depth,
            ),
            max: WorldVector::new(
                self.position.x + half_width,
                self.position.y + height,
                self.position.z + half_depth,
            ),
        }
    }
    
    /// Returns the current movement speed based on state
    pub fn movement_speed(&self) -> f32 {
        if self.is_flying {
            // Flying is faster
            if self.is_sprinting {
                SPRINT_SPEED * 1.5
            } else {
                WALK_SPEED * 1.5
            }
        } else if self.in_water || self.in_lava {
            // Water and lava slow down movement
            if self.is_sprinting {
                SPRINT_SPEED * 0.3
            } else if self.is_sneaking {
                SNEAK_SPEED * 0.3
            } else {
                WALK_SPEED * 0.3
            }
        } else {
            // Normal movement on ground
            if self.is_sprinting {
                SPRINT_SPEED
            } else if self.is_sneaking {
                SNEAK_SPEED
            } else {
                WALK_SPEED
            }
        }
    }
    
    /// Apply a jump force
    pub fn jump(&mut self) {
        // Only allow jumping when on the ground
        if self.on_ground {
            self.velocity.y = JUMP_FORCE;
            self.on_ground = false;
        } else if self.is_flying {
            // In flying mode, can always jump
            self.velocity.y = JUMP_FORCE * 0.5;
        } else if self.in_water || self.in_lava {
            // In water, can swim up a bit
            self.velocity.y = JUMP_FORCE * 0.4;
        }
    }
}

/// An axis-aligned bounding box
#[derive(Debug, Clone, Copy)]
pub struct AABB {
    /// The minimum point of the box
    pub min: WorldVector,
    /// The maximum point of the box
    pub max: WorldVector,
}

impl AABB {
    /// Creates a new AABB from min and max points
    pub fn new(min: WorldVector, max: WorldVector) -> Self {
        Self { min, max }
    }
    
    /// Returns whether this AABB intersects another AABB
    pub fn intersects(&self, other: &Self) -> bool {
        self.min.x <= other.max.x &&
        self.max.x >= other.min.x &&
        self.min.y <= other.max.y &&
        self.max.y >= other.min.y &&
        self.min.z <= other.max.z &&
        self.max.z >= other.min.z
    }
    
    /// Returns whether this AABB contains a point
    pub fn contains_point(&self, point: &WorldVector) -> bool {
        point.x >= self.min.x &&
        point.x <= self.max.x &&
        point.y >= self.min.y &&
        point.y <= self.max.y &&
        point.z >= self.min.z &&
        point.z <= self.max.z
    }
    
    /// Returns the width of the AABB
    pub fn width(&self) -> f32 {
        self.max.x - self.min.x
    }
    
    /// Returns the height of the AABB
    pub fn height(&self) -> f32 {
        self.max.y - self.min.y
    }
    
    /// Returns the depth of the AABB
    pub fn depth(&self) -> f32 {
        self.max.z - self.min.z
    }
    
    /// Returns the center of the AABB
    pub fn center(&self) -> WorldVector {
        WorldVector::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
            (self.min.z + self.max.z) / 2.0,
        )
    }
    
    /// Returns the volume of the AABB
    pub fn volume(&self) -> f32 {
        self.width() * self.height() * self.depth()
    }
    
    /// Expands the AABB by a certain amount in all directions
    pub fn expand(&self, amount: f32) -> Self {
        Self {
            min: WorldVector::new(
                self.min.x - amount,
                self.min.y - amount,
                self.min.z - amount,
            ),
            max: WorldVector::new(
                self.max.x + amount,
                self.max.y + amount,
                self.max.z + amount,
            ),
        }
    }
    
    /// Creates an AABB for a block
    pub fn for_block(x: i32, y: i32, z: i32) -> Self {
        Self {
            min: WorldVector::new(x as f32, y as f32, z as f32),
            max: WorldVector::new((x + 1) as f32, (y + 1) as f32, (z + 1) as f32),
        }
    }
    
    /// Calculates the intersection with another AABB
    pub fn intersection(&self, other: &Self) -> Option<Self> {
        let min_x = self.min.x.max(other.min.x);
        let min_y = self.min.y.max(other.min.y);
        let min_z = self.min.z.max(other.min.z);
        
        let max_x = self.max.x.min(other.max.x);
        let max_y = self.max.y.min(other.max.y);
        let max_z = self.max.z.min(other.max.z);
        
        if min_x <= max_x && min_y <= max_y && min_z <= max_z {
            Some(Self {
                min: WorldVector::new(min_x, min_y, min_z),
                max: WorldVector::new(max_x, max_y, max_z),
            })
        } else {
            None
        }
    }
} 