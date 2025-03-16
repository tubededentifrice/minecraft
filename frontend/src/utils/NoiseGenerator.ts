// Simplified Perlin noise implementation for terrain generation
class NoiseGenerator {
  private seed: number;
  private permutation: number[] = [];
  private secondaryPermutation: number[] = []; // For biomes
  
  constructor(seed: number = Math.random()) {
    this.seed = seed;
    this.initialize();
  }
  
  private initialize(): void {
    // Create permutation table
    const p: number[] = [];
    const p2: number[] = []; // Secondary permutation
    for (let i = 0; i < 256; i++) {
      p[i] = Math.floor(this.seededRandom() * 256);
      p2[i] = Math.floor(this.seededRandom() * 256); // Different permutation for biomes
    }
    
    // Extend array to avoid overflow
    this.permutation = [...p, ...p];
    this.secondaryPermutation = [...p2, ...p2];
  }
  
  // Basic pseudo-random number generator with seed
  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  // Linear interpolation
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  // Improved fade function for smoother transitions
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  // Gradient function
  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  // Get noise value at a specific coordinate
  public noise(x: number, y: number, z: number = 0, useSecondary: boolean = false): number {
    // Scale inputs for different effects
    const scaleX = x * 0.01;
    const scaleY = y * 0.01;
    const scaleZ = z * 0.01;
    
    // Find unit cube that contains point
    const X = Math.floor(scaleX) & 255;
    const Y = Math.floor(scaleY) & 255;
    const Z = Math.floor(scaleZ) & 255;
    
    // Find relative x, y, z of point in cube
    const xf = scaleX - Math.floor(scaleX);
    const yf = scaleY - Math.floor(scaleY);
    const zf = scaleZ - Math.floor(scaleZ);
    
    // Compute fade curves
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);
    
    // Select permutation table
    const perm = useSecondary ? this.secondaryPermutation : this.permutation;
    
    // Hash coordinates of the 8 cube corners
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    
    // Add blended results from 8 corners of cube
    const result = this.lerp(
      this.lerp(
        this.lerp(
          this.grad(perm[AA], xf, yf, zf),
          this.grad(perm[BA], xf - 1, yf, zf),
          u
        ),
        this.lerp(
          this.grad(perm[AB], xf, yf - 1, zf),
          this.grad(perm[BB], xf - 1, yf - 1, zf),
          u
        ),
        v
      ),
      this.lerp(
        this.lerp(
          this.grad(perm[AA + 1], xf, yf, zf - 1),
          this.grad(perm[BA + 1], xf - 1, yf, zf - 1),
          u
        ),
        this.lerp(
          this.grad(perm[AB + 1], xf, yf - 1, zf - 1),
          this.grad(perm[BB + 1], xf - 1, yf - 1, zf - 1),
          u
        ),
        v
      ),
      w
    );
    
    // Convert from -1..1 to 0..1
    return (result + 1) / 2;
  }
  
  // Get fractal noise (multiple octaves) with improved parameters
  public fractalNoise(x: number, y: number, z: number = 0, octaves: number = 6, persistence: number = 0.5, useSecondary: boolean = false): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency, z * frequency, useSecondary) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
  
  // Get biome value for a coordinate (0-1)
  public getBiomeValue(x: number, z: number): number {
    // Use secondary noise with large scale for biomes
    return this.fractalNoise(x * 0.005, z * 0.005, 0, 3, 0.5, true);
  }
  
  // Generate terrain height at a specific x,z coordinate with enhanced features
  public getTerrainHeight(x: number, z: number): number {
    // Get biome value for this location
    const biomeValue = this.getBiomeValue(x, z);
    
    // Base terrain height varies by biome
    let baseHeight = 4;
    if (biomeValue < 0.3) {
      // Plains biome
      baseHeight = 5;
    } else if (biomeValue < 0.6) {
      // Hills biome
      baseHeight = 8;
    } else if (biomeValue < 0.8) {
      // Mountains biome
      baseHeight = 12;
    } else {
      // Extreme mountains biome
      baseHeight = 15;
    }
    
    // Use fractal noise for terrain details, with parameters based on biome
    let persistence = 0.5;
    let octaves = 6;
    let scale = 1.0;
    
    if (biomeValue < 0.3) {
      // Plains - smoother
      persistence = 0.4;
      octaves = 4;
      scale = 0.8;
    } else if (biomeValue < 0.6) {
      // Hills - moderately rough
      persistence = 0.5;
      octaves = 6;
      scale = 1.0;
    } else if (biomeValue < 0.8) {
      // Mountains - rougher
      persistence = 0.55;
      octaves = 7;
      scale = 1.3;
    } else {
      // Extreme mountains - very rough
      persistence = 0.6;
      octaves = 8;
      scale = 1.6;
    }
    
    // Get main terrain shape
    const mainNoise = this.fractalNoise(x * 0.01 * scale, z * 0.01 * scale, 0, octaves, persistence);
    
    // Add some variation to create valleys and ridges
    const ridgeNoise = 1.0 - Math.abs(0.5 - this.fractalNoise(x * 0.02, z * 0.02, 0, 4, 0.5)) * 2;
    const valleyNoise = this.fractalNoise(x * 0.005, z * 0.005, 0, 2, 0.5);
    
    // Scale noise to desired height range based on biome
    let mountainHeight = 15;
    if (biomeValue < 0.3) {
      mountainHeight = 8;
    } else if (biomeValue < 0.6) {
      mountainHeight = 12;
    } else if (biomeValue < 0.8) {
      mountainHeight = 18;
    } else {
      mountainHeight = 25;
    }
    
    // Combine different noise patterns for more interesting terrain
    let height = baseHeight;
    
    // Add main terrain shape
    height += mainNoise * mountainHeight;
    
    // Add ridges in mountainous areas
    if (biomeValue > 0.5) {
      height += ridgeNoise * ridgeNoise * (biomeValue - 0.5) * 10;
    }
    
    // Create valleys in some areas
    if (valleyNoise < 0.2) {
      const valleyDepth = (0.2 - valleyNoise) * 5;
      height -= valleyDepth * valleyDepth * 15;
    }
    
    // Round to integer for block placement
    return Math.max(1, Math.floor(height));
  }
}

export default NoiseGenerator; 