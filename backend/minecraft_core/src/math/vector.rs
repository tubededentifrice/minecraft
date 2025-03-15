use nalgebra::{Point3, Vector3};
use serde::{Deserialize, Serialize};
use std::ops::{Add, Div, Mul, Neg, Sub};

/// A vector in world space (floating point coordinates)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct WorldVector {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

/// A vector in block space (integer coordinates)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BlockVector {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

/// A vector in chunk space (chunk coordinates)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChunkVector {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

impl WorldVector {
    /// Create a new world vector
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }
    
    /// Create a world vector from a block vector
    pub fn from_block(block: BlockVector) -> Self {
        Self {
            x: block.x as f32,
            y: block.y as f32,
            z: block.z as f32,
        }
    }
    
    /// Calculate the distance to another world vector
    pub fn distance(&self, other: &WorldVector) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Calculate the squared distance to another world vector
    pub fn distance_squared(&self, other: &WorldVector) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        dx * dx + dy * dy + dz * dz
    }
    
    /// Calculate the length of this vector
    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }
    
    /// Calculate the squared length of this vector
    pub fn length_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }
    
    /// Normalize this vector
    pub fn normalize(&self) -> Self {
        let length = self.length();
        if length > 0.0 {
            Self {
                x: self.x / length,
                y: self.y / length,
                z: self.z / length,
            }
        } else {
            *self
        }
    }
    
    /// Calculate the dot product with another vector
    pub fn dot(&self, other: &WorldVector) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
    
    /// Calculate the cross product with another vector
    pub fn cross(&self, other: &WorldVector) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
    
    /// Convert to a block vector
    pub fn to_block(&self) -> BlockVector {
        BlockVector {
            x: self.x.floor() as i32,
            y: self.y.floor() as i32,
            z: self.z.floor() as i32,
        }
    }
    
    /// Convert to a chunk vector
    pub fn to_chunk(&self) -> ChunkVector {
        self.to_block().to_chunk()
    }
    
    /// Converts to a nalgebra Point3
    pub fn to_point3(&self) -> Point3<f32> {
        Point3::new(self.x, self.y, self.z)
    }
    
    /// Converts to a nalgebra Vector3
    pub fn to_vector3(&self) -> Vector3<f32> {
        Vector3::new(self.x, self.y, self.z)
    }
}

impl BlockVector {
    /// Create a new block vector
    pub fn new(x: i32, y: i32, z: i32) -> Self {
        Self { x, y, z }
    }
    
    /// Create a block vector from a world vector
    pub fn from_world(world: WorldVector) -> Self {
        Self {
            x: world.x.floor() as i32,
            y: world.y.floor() as i32,
            z: world.z.floor() as i32,
        }
    }
    
    /// Calculate the distance to another block vector
    pub fn distance(&self, other: &BlockVector) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        ((dx * dx + dy * dy + dz * dz) as f32).sqrt()
    }
    
    /// Calculate the squared distance to another block vector
    pub fn distance_squared(&self, other: &BlockVector) -> i32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        dx * dx + dy * dy + dz * dz
    }
    
    /// Calculate the Manhattan distance to another block vector
    pub fn manhattan_distance(&self, other: &BlockVector) -> i32 {
        (self.x - other.x).abs() + (self.y - other.y).abs() + (self.z - other.z).abs()
    }
    
    /// Convert to a world vector
    pub fn to_world(&self) -> WorldVector {
        WorldVector {
            x: self.x as f32,
            y: self.y as f32,
            z: self.z as f32,
        }
    }
    
    /// Convert to a chunk vector
    pub fn to_chunk(&self) -> ChunkVector {
        ChunkVector {
            x: (self.x >> 4) as i32,
            y: (self.y >> 4) as i32,
            z: (self.z >> 4) as i32,
        }
    }
    
    /// Get the local coordinates within a chunk
    pub fn chunk_local(&self) -> (usize, usize, usize) {
        (
            (self.x & 15) as usize,
            (self.y & 15) as usize,
            (self.z & 15) as usize,
        )
    }
}

impl ChunkVector {
    /// Create a new chunk vector
    pub fn new(x: i32, y: i32, z: i32) -> Self {
        Self { x, y, z }
    }
    
    /// Create a chunk vector from a block vector
    pub fn from_block(block: BlockVector) -> Self {
        Self {
            x: block.x >> 4,
            y: block.y >> 4,
            z: block.z >> 4,
        }
    }
    
    /// Calculate the distance to another chunk vector
    pub fn distance(&self, other: &ChunkVector) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        ((dx * dx + dy * dy + dz * dz) as f32).sqrt()
    }
    
    /// Calculate the squared distance to another chunk vector
    pub fn distance_squared(&self, other: &ChunkVector) -> i32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        dx * dx + dy * dy + dz * dz
    }
    
    /// Calculate the Manhattan distance to another chunk vector
    pub fn manhattan_distance(&self, other: &ChunkVector) -> i32 {
        (self.x - other.x).abs() + (self.y - other.y).abs() + (self.z - other.z).abs()
    }
    
    /// Convert to a block vector (minimum corner of the chunk)
    pub fn to_block(&self) -> BlockVector {
        BlockVector {
            x: self.x << 4,
            y: self.y << 4,
            z: self.z << 4,
        }
    }
}

// Implement mathematical operators for WorldVector
impl Add for WorldVector {
    type Output = Self;
    
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

impl Sub for WorldVector {
    type Output = Self;
    
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }
}

impl Mul<f32> for WorldVector {
    type Output = Self;
    
    fn mul(self, scalar: f32) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
            z: self.z * scalar,
        }
    }
}

impl Div<f32> for WorldVector {
    type Output = Self;
    
    fn div(self, scalar: f32) -> Self {
        if scalar == 0.0 {
            return self;
        }
        
        Self {
            x: self.x / scalar,
            y: self.y / scalar,
            z: self.z / scalar,
        }
    }
}

impl Neg for WorldVector {
    type Output = Self;
    
    fn neg(self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}

// Implement mathematical operators for BlockVector
impl Add for BlockVector {
    type Output = Self;
    
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

impl Sub for BlockVector {
    type Output = Self;
    
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }
}

impl Neg for BlockVector {
    type Output = Self;
    
    fn neg(self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}

// Implement mathematical operators for ChunkVector
impl Add for ChunkVector {
    type Output = Self;
    
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

impl Sub for ChunkVector {
    type Output = Self;
    
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }
} 
} 