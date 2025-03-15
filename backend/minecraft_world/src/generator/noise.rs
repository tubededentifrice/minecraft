use noise::{NoiseFn, Perlin, Fbm, Seedable, MultiFractal};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;

/// Utility functions for generating noise
pub struct NoiseGenerator {
    /// The Perlin noise generator
    perlin: Perlin,
    /// The fractal Brownian motion noise generator
    fbm: Fbm,
    /// The random number generator
    rng: StdRng,
}

impl NoiseGenerator {
    /// Creates a new noise generator with the specified seed
    pub fn new(seed: i64) -> Self {
        // Use the seed to initialize our noise functions
        let perlin = Perlin::new().set_seed(seed as u32);
        
        let mut fbm = Fbm::new();
        fbm.set_seed(seed as u32);
        fbm.set_octaves(6);
        fbm.set_frequency(1.0);
        fbm.set_lacunarity(2.0);
        fbm.set_persistence(0.5);
        
        // Create a random number generator from the seed
        let rng_seed = u64::from_ne_bytes([
            (seed & 0xff) as u8,
            ((seed >> 8) & 0xff) as u8,
            ((seed >> 16) & 0xff) as u8,
            ((seed >> 24) & 0xff) as u8,
            ((seed >> 32) & 0xff) as u8,
            ((seed >> 40) & 0xff) as u8,
            ((seed >> 48) & 0xff) as u8,
            ((seed >> 56) & 0xff) as u8,
        ]);
        
        let rng = StdRng::seed_from_u64(rng_seed);
        
        Self {
            perlin,
            fbm,
            rng,
        }
    }
    
    /// Gets a random integer in the specified range
    pub fn random_int(&mut self, min: i32, max: i32) -> i32 {
        self.rng.gen_range(min..=max)
    }
    
    /// Gets a random float in the specified range
    pub fn random_float(&mut self, min: f64, max: f64) -> f64 {
        self.rng.gen_range(min..=max)
    }
    
    /// Gets a random bool with the specified probability of being true
    pub fn random_bool(&mut self, probability: f64) -> bool {
        self.rng.gen_bool(probability)
    }
    
    /// Gets a 2D Perlin noise value at the specified coordinates
    pub fn perlin_2d(&self, x: f64, z: f64) -> f64 {
        self.perlin.get([x, z])
    }
    
    /// Gets a 3D Perlin noise value at the specified coordinates
    pub fn perlin_3d(&self, x: f64, y: f64, z: f64) -> f64 {
        self.perlin.get([x, y, z])
    }
    
    /// Gets a 2D FBM (fractal Brownian motion) noise value at the specified coordinates
    pub fn fbm_2d(&self, x: f64, z: f64) -> f64 {
        self.fbm.get([x, z])
    }
    
    /// Gets a 3D FBM (fractal Brownian motion) noise value at the specified coordinates
    pub fn fbm_3d(&self, x: f64, y: f64, z: f64) -> f64 {
        self.fbm.get([x, y, z])
    }
    
    /// Generates a heightmap for a chunk
    pub fn generate_heightmap(&self, chunk_x: i32, chunk_z: i32, scale: f64) -> [[i32; 16]; 16] {
        let mut heightmap = [[0; 16]; 16];
        
        for x in 0..16 {
            for z in 0..16 {
                let world_x = (chunk_x * 16 + x as i32) as f64;
                let world_z = (chunk_z * 16 + z as i32) as f64;
                
                // Use FBM noise for the base terrain
                let noise = self.fbm_2d(world_x * scale * 0.01, world_z * scale * 0.01);
                
                // Convert the noise value to a height value
                // Noise is typically in the range [-1, 1], so we scale and offset it
                let height = ((noise + 1.0) * 30.0) as i32 + 64;
                
                heightmap[x][z] = height;
            }
        }
        
        heightmap
    }
    
    /// Generates a 3D noise array for cave generation
    pub fn generate_3d_noise(&self, chunk_x: i32, chunk_y: i32, chunk_z: i32, scale: f64) -> [[[f64; 16]; 16]; 16] {
        let mut noise_array = [[[0.0; 16]; 16]; 16];
        
        for x in 0..16 {
            for y in 0..16 {
                for z in 0..16 {
                    let world_x = (chunk_x * 16 + x as i32) as f64;
                    let world_y = (chunk_y * 16 + y as i32) as f64;
                    let world_z = (chunk_z * 16 + z as i32) as f64;
                    
                    // Use 3D Perlin noise for caves
                    let noise = self.perlin_3d(
                        world_x * scale * 0.05,
                        world_y * scale * 0.05,
                        world_z * scale * 0.05,
                    );
                    
                    noise_array[x][y][z] = noise;
                }
            }
        }
        
        noise_array
    }
} 