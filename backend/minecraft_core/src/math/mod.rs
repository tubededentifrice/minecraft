pub mod vector;

pub use nalgebra::{Matrix4, Point3, Vector3, Vector2};
pub use vector::{BlockVector, ChunkVector, WorldVector};

/// Converts block coordinates to chunk coordinates
#[inline]
pub fn block_to_chunk(block_x: i32, block_y: i32, block_z: i32) -> (i32, i32, i32) {
    // Use integer division to floor properly
    let chunk_x = if block_x < 0 && block_x % 16 != 0 {
        (block_x / 16) - 1
    } else {
        block_x / 16
    };
    
    let chunk_y = if block_y < 0 && block_y % 16 != 0 {
        (block_y / 16) - 1
    } else {
        block_y / 16
    };
    
    let chunk_z = if block_z < 0 && block_z % 16 != 0 {
        (block_z / 16) - 1
    } else {
        block_z / 16
    };
    
    (chunk_x, chunk_y, chunk_z)
}

/// Converts block coordinates to local chunk coordinates
#[inline]
pub fn block_to_local(block_x: i32, block_y: i32, block_z: i32) -> (usize, usize, usize) {
    // Apply modulo to get local coordinates
    let local_x = ((block_x % 16) + 16) % 16;
    let local_y = ((block_y % 16) + 16) % 16;
    let local_z = ((block_z % 16) + 16) % 16;
    
    (local_x as usize, local_y as usize, local_z as usize)
}

/// Converts chunk and local coordinates to block coordinates
#[inline]
pub fn chunk_to_block(chunk_x: i32, chunk_y: i32, chunk_z: i32, local_x: usize, local_y: usize, local_z: usize) -> (i32, i32, i32) {
    (
        chunk_x * 16 + local_x as i32,
        chunk_y * 16 + local_y as i32,
        chunk_z * 16 + local_z as i32,
    )
}

/// Calculates the flat index for a 3D position in a chunk
#[inline]
pub fn chunk_index(x: usize, y: usize, z: usize) -> usize {
    // Using y * width * depth + z * width + x formula for row-major order
    y * 16 * 16 + z * 16 + x
}

/// Calculates the Manhattan distance between two points
#[inline]
pub fn manhattan_distance(x1: i32, y1: i32, z1: i32, x2: i32, y2: i32, z2: i32) -> i32 {
    (x2 - x1).abs() + (y2 - y1).abs() + (z2 - z1).abs()
}

/// Calculates the squared Euclidean distance between two points
/// Useful when you just need to compare distances and can avoid the square root
#[inline]
pub fn squared_distance(x1: f32, y1: f32, z1: f32, x2: f32, y2: f32, z2: f32) -> f32 {
    (x2 - x1).powi(2) + (y2 - y1).powi(2) + (z2 - z1).powi(2)
}

/// Linear interpolation between two values
#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t.clamp(0.0, 1.0)
} 