use crate::math::WorldVector;
use crate::physics::{GRAVITY, MAX_FALL_SPEED, PhysicsState, TERMINAL_VELOCITY};
use crate::physics::collision::{CollisionDirection, CollisionResult, resolve_collision};
use nalgebra::Vector3;
use std::time::Duration;

/// Updates the physics state based on inputs and time delta
pub fn update_physics(
    state: &mut PhysicsState,
    delta_time: Duration,
    move_input: Vector3<f32>,
    jump_requested: bool,
    blocks_to_check: &[(i32, i32, i32, crate::block::Block)],
) {
    // Calculate delta time in seconds
    let dt = delta_time.as_secs_f32();

    // Apply jump if requested and allowed
    if jump_requested {
        state.jump();
    }

    // Apply movement based on input
    let movement_speed = state.movement_speed();
    let mut intended_velocity = Vector3::new(
        move_input.x * movement_speed,
        0.0, // Y is controlled by gravity and jumping
        move_input.z * movement_speed,
    );

    // If flying, allow vertical movement
    if state.is_flying {
        intended_velocity.y = move_input.y * movement_speed;
    }

    // Blend between current and intended velocity (for smooth control)
    let control_blend_factor = if state.on_ground { 0.9 } else { 0.2 };
    state.velocity.x = state.velocity.x * (1.0 - control_blend_factor) + intended_velocity.x * control_blend_factor;
    state.velocity.z = state.velocity.z * (1.0 - control_blend_factor) + intended_velocity.z * control_blend_factor;

    if state.is_flying {
        state.velocity.y = state.velocity.y * (1.0 - control_blend_factor) + intended_velocity.y * control_blend_factor;
    }

    // Apply gravity if not flying
    if !state.is_flying {
        // Apply gravity
        state.acceleration.y = GRAVITY.y;

        // Apply water/lava resistance to falling
        if state.in_water || state.in_lava {
            state.acceleration.y *= 0.3;
        }

        // Update velocity with acceleration
        state.velocity.y += state.acceleration.y * dt;

        // Limit fall speed
        if state.velocity.y < -MAX_FALL_SPEED {
            state.velocity.y = -MAX_FALL_SPEED;
        }
    }

    // Apply drag to velocity
    let drag_factor = if state.in_water || state.in_lava {
        0.8
    } else if state.on_ground {
        0.6
    } else {
        0.98
    };
    state.velocity.x *= drag_factor.powf(dt * 10.0);
    state.velocity.z *= drag_factor.powf(dt * 10.0);

    // Ensure velocity doesn't exceed terminal velocity
    let current_speed = (state.velocity.x.powi(2) + state.velocity.z.powi(2)).sqrt();
    if current_speed > TERMINAL_VELOCITY {
        let scale = TERMINAL_VELOCITY / current_speed;
        state.velocity.x *= scale;
        state.velocity.z *= scale;
    }

    // Save old position for collision resolution
    let old_position = state.position.clone();

    // Update position based on velocity
    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;

    // Handle collisions
    handle_collisions(state, blocks_to_check);

    // Reset on_ground flag
    state.on_ground = false;

    // Generate AABB for feet position (slightly below the player)
    let feet_position = WorldVector::new(
        state.position.x,
        state.position.y - 0.05,
        state.position.z,
    );
    let feet_size = (state.size.0 * 0.9, 0.1, state.size.2 * 0.9);
    let feet_aabb = create_aabb_for_position(&feet_position, &feet_size);

    // Check for ground collisions
    for (x, y, z, block) in blocks_to_check {
        if !block.is_solid() {
            continue;
        }

        let block_aabb = super::AABB::for_block(*x, *y, *z);
        if feet_aabb.intersects(&block_aabb) {
            state.on_ground = true;
            break;
        }
    }

    // Reset acceleration
    state.acceleration = WorldVector::new(0.0, 0.0, 0.0);
}

/// Helper method to create an AABB for a given position and size
fn create_aabb_for_position(position: &WorldVector, size: &(f32, f32, f32)) -> super::AABB {
    let half_width = size.0 / 2.0;
    let half_depth = size.2 / 2.0;
    let height = size.1;

    super::AABB {
        min: WorldVector::new(
            position.x - half_width,
            position.y,
            position.z - half_depth,
        ),
        max: WorldVector::new(
            position.x + half_width,
            position.y + height,
            position.z + half_depth,
        ),
    }
}

/// Handles collisions for the physics state
fn handle_collisions(
    state: &mut PhysicsState,
    blocks_to_check: &[(i32, i32, i32, crate::block::Block)],
) {
    // Get the bounding box for the entity
    let mut entity_aabb = state.bounding_box();

    // Check for collisions with blocks
    let mut collisions = Vec::new();

    for (x, y, z, block) in blocks_to_check {
        // Skip non-solid blocks
        if !block.is_solid() {
            // Check if in water or lava
            if block.block_type.id() == 8 || block.block_type.id() == 9 {
                state.in_water = true;
                state.in_lava = false;
            } else if block.block_type.id() == 10 || block.block_type.id() == 11 {
                state.in_water = false;
                state.in_lava = true;
            }
            continue;
        }

        let block_aabb = super::AABB::for_block(*x, *y, *z);

        // Check if they intersect
        if !entity_aabb.intersects(&block_aabb) {
            continue;
        }

        // Find the intersection
        let intersection = match entity_aabb.intersection(&block_aabb) {
            Some(intersection) => intersection,
            None => continue,
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

        let result = CollisionResult {
            collision: true,
            block: Some(block.clone()),
            direction: Some(dir),
            depth: min_depth,
            point: Some(point),
        };

        collisions.push(result);
    }

    // Sort collisions by penetration depth (resolve smallest first)
    collisions.sort_by(|a, b| a.depth.partial_cmp(&b.depth).unwrap());

    // Resolve collisions
    for collision in collisions {
        resolve_collision(&mut state.position, &mut state.velocity, &collision);

        // Update the entity AABB for subsequent collision checks
        entity_aabb = state.bounding_box();

        // Update on_ground flag
        if let Some(direction) = collision.direction {
            if direction == CollisionDirection::Bottom {
                state.on_ground = true;
            }
        }
    }
}

/// Applies a force to the physics state
pub fn apply_force(state: &mut PhysicsState, force: Vector3<f32>, delta_time: Duration) {
    let dt = delta_time.as_secs_f32();
    
    // F = ma, so a = F/m (assuming mass of 1 for simplicity)
    state.acceleration.x += force.x;
    state.acceleration.y += force.y;
    state.acceleration.z += force.z;
    
    // Update velocity based on acceleration
    state.velocity.x += state.acceleration.x * dt;
    state.velocity.y += state.acceleration.y * dt;
    state.velocity.z += state.acceleration.z * dt;
}

/// Calculates the movement input vector from keyboard/controller input
pub fn calculate_movement_input(
    forward: bool,
    backward: bool,
    left: bool,
    right: bool,
    up: bool,
    down: bool,
    yaw: f32,
) -> Vector3<f32> {
    // Calculate forward/backward and left/right components
    let mut z = 0.0;
    let mut x = 0.0;
    let mut y = 0.0;
    
    if forward {
        z -= 1.0;
    }
    if backward {
        z += 1.0;
    }
    if left {
        x -= 1.0;
    }
    if right {
        x += 1.0;
    }
    if up {
        y += 1.0;
    }
    if down {
        y -= 1.0;
    }
    
    // Rotate input based on player's yaw (horizontal rotation)
    let sin_yaw = yaw.sin();
    let cos_yaw = yaw.cos();
    
    let rotated_x = x * cos_yaw - z * sin_yaw;
    let rotated_z = x * sin_yaw + z * cos_yaw;
    
    // Normalize the vector if it's not zero
    let mut input = Vector3::new(rotated_x, y, rotated_z);
    let length_squared = input.x * input.x + input.y * input.y + input.z * input.z;
    
    if length_squared > 0.0 {
        let length = length_squared.sqrt();
        input.x /= length;
        input.y /= length;
        input.z /= length;
    }
    
    input
} 