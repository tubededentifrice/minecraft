use crate::block::Block;
use crate::math::WorldVector;
use crate::physics::AABB;
use nalgebra::Vector3;

/// Direction of collision
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CollisionDirection {
    /// Collision from above (y+)
    Top,
    /// Collision from below (y-)
    Bottom,
    /// Collision from north (z-)
    North,
    /// Collision from south (z+)
    South,
    /// Collision from east (x+)
    East,
    /// Collision from west (x-)
    West,
}

impl CollisionDirection {
    /// Get the unit vector for this direction
    pub fn unit_vector(&self) -> Vector3<f32> {
        match self {
            CollisionDirection::Top => Vector3::new(0.0, 1.0, 0.0),
            CollisionDirection::Bottom => Vector3::new(0.0, -1.0, 0.0),
            CollisionDirection::North => Vector3::new(0.0, 0.0, -1.0),
            CollisionDirection::South => Vector3::new(0.0, 0.0, 1.0),
            CollisionDirection::East => Vector3::new(1.0, 0.0, 0.0),
            CollisionDirection::West => Vector3::new(-1.0, 0.0, 0.0),
        }
    }
}

/// Result of a collision detection
#[derive(Debug, Clone)]
pub struct CollisionResult {
    /// The collision happened
    pub collision: bool,
    /// The block that was collided with
    pub block: Option<Block>,
    /// The direction of the collision
    pub direction: Option<CollisionDirection>,
    /// The depth of the collision
    pub depth: f32,
    /// The point of the collision
    pub point: Option<WorldVector>,
}

impl CollisionResult {
    /// Creates a new collision result with no collision
    pub fn none() -> Self {
        Self {
            collision: false,
            block: None,
            direction: None,
            depth: 0.0,
            point: None,
        }
    }
    
    /// Creates a new collision result
    pub fn new(
        block: Block,
        direction: CollisionDirection,
        depth: f32,
        point: WorldVector,
    ) -> Self {
        Self {
            collision: true,
            block: Some(block),
            direction: Some(direction),
            depth,
            point: Some(point),
        }
    }
}

/// Detects a collision between an AABB and a block
pub fn detect_block_collision(entity_aabb: &AABB, block_x: i32, block_y: i32, block_z: i32, block: &Block) -> CollisionResult {
    // Skip non-solid blocks
    if !block.is_solid() {
        return CollisionResult::none();
    }
    
    let block_aabb = AABB::for_block(block_x, block_y, block_z);
    
    // Check if they intersect
    if !entity_aabb.intersects(&block_aabb) {
        return CollisionResult::none();
    }
    
    // Find the intersection
    let intersection = match entity_aabb.intersection(&block_aabb) {
        Some(intersection) => intersection,
        None => return CollisionResult::none(),
    };
    
    // Determine the collision direction based on the smallest penetration
    let width = intersection.width();
    let height = intersection.height();
    let depth = intersection.depth();
    
    // Find the smallest penetration
    let (dir, min_depth) = if width <= height && width <= depth {
        // X-axis collision
        if entity_aabb.center().x < block_aabb.center().x {
            (CollisionDirection::East, width)
        } else {
            (CollisionDirection::West, width)
        }
    } else if height <= width && height <= depth {
        // Y-axis collision
        if entity_aabb.center().y < block_aabb.center().y {
            (CollisionDirection::Top, height)
        } else {
            (CollisionDirection::Bottom, height)
        }
    } else {
        // Z-axis collision
        if entity_aabb.center().z < block_aabb.center().z {
            (CollisionDirection::South, depth)
        } else {
            (CollisionDirection::North, depth)
        }
    };
    
    // Calculate the collision point (center of the intersection face)
    let point = match dir {
        CollisionDirection::East => WorldVector::new(
            block_aabb.min.x,
            intersection.center().y,
            intersection.center().z,
        ),
        CollisionDirection::West => WorldVector::new(
            block_aabb.max.x,
            intersection.center().y,
            intersection.center().z,
        ),
        CollisionDirection::Top => WorldVector::new(
            intersection.center().x,
            block_aabb.min.y,
            intersection.center().z,
        ),
        CollisionDirection::Bottom => WorldVector::new(
            intersection.center().x,
            block_aabb.max.y,
            intersection.center().z,
        ),
        CollisionDirection::South => WorldVector::new(
            intersection.center().x,
            intersection.center().y,
            block_aabb.min.z,
        ),
        CollisionDirection::North => WorldVector::new(
            intersection.center().x,
            intersection.center().y,
            block_aabb.max.z,
        ),
    };
    
    CollisionResult::new(block.clone(), dir, min_depth, point)
}

/// Detects collisions between an entity and a set of blocks
pub fn detect_world_collisions(
    entity_aabb: &AABB,
    blocks: &[(i32, i32, i32, Block)],
) -> Vec<CollisionResult> {
    blocks
        .iter()
        .filter_map(|(x, y, z, block)| {
            let result = detect_block_collision(entity_aabb, *x, *y, *z, block);
            if result.collision {
                Some(result)
            } else {
                None
            }
        })
        .collect()
}

/// Resolves a collision by adjusting the position
pub fn resolve_collision(
    position: &mut WorldVector,
    velocity: &mut WorldVector,
    result: &CollisionResult,
) {
    if !result.collision {
        return;
    }
    
    let direction = result.direction.unwrap();
    let normal = direction.unit_vector();
    
    // Calculate the reflection vector for the velocity
    let dot_product = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
    
    // Move the position out of the collision
    position.x += normal.x * result.depth;
    position.y += normal.y * result.depth;
    position.z += normal.z * result.depth;
    
    // Set the velocity component to zero in the collision direction
    match direction {
        CollisionDirection::Top | CollisionDirection::Bottom => {
            velocity.y = 0.0;
        }
        CollisionDirection::North | CollisionDirection::South => {
            velocity.z = 0.0;
        }
        CollisionDirection::East | CollisionDirection::West => {
            velocity.x = 0.0;
        }
    }
}

/// Creates a list of blocks around a position to check for collisions
pub fn get_blocks_to_check(position: &WorldVector, radius: i32) -> Vec<(i32, i32, i32)> {
    let center_x = position.x.floor() as i32;
    let center_y = position.y.floor() as i32;
    let center_z = position.z.floor() as i32;
    
    let mut blocks = Vec::new();
    
    for x in (center_x - radius)..=(center_x + radius) {
        for y in (center_y - radius)..=(center_y + radius) {
            for z in (center_z - radius)..=(center_z + radius) {
                blocks.push((x, y, z));
            }
        }
    }
    
    blocks
} 