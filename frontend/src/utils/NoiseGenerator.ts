// Simplified Perlin noise implementation for terrain generation
class NoiseGenerator {
  private seed: number;
  private permutation: number[] = [];
  
  constructor(seed: number = Math.random()) {
    this.seed = seed;
    this.initialize();
  }
  
  private initialize(): void {
    // Create permutation table
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = Math.floor(this.seededRandom() * 256);
    }
    
    // Extend array to avoid overflow
    this.permutation = [...p, ...p];
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
  
  // Fade function to smooth interpolation
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
  public noise(x: number, y: number, z: number = 0): number {
    // Scale inputs
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
    
    // Hash coordinates of the 8 cube corners
    const A = this.permutation[X] + Y;
    const AA = this.permutation[A] + Z;
    const AB = this.permutation[A + 1] + Z;
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B] + Z;
    const BB = this.permutation[B + 1] + Z;
    
    // Add blended results from 8 corners of cube
    const result = this.lerp(
      this.lerp(
        this.lerp(
          this.grad(this.permutation[AA], xf, yf, zf),
          this.grad(this.permutation[BA], xf - 1, yf, zf),
          u
        ),
        this.lerp(
          this.grad(this.permutation[AB], xf, yf - 1, zf),
          this.grad(this.permutation[BB], xf - 1, yf - 1, zf),
          u
        ),
        v
      ),
      this.lerp(
        this.lerp(
          this.grad(this.permutation[AA + 1], xf, yf, zf - 1),
          this.grad(this.permutation[BA + 1], xf - 1, yf, zf - 1),
          u
        ),
        this.lerp(
          this.grad(this.permutation[AB + 1], xf, yf - 1, zf - 1),
          this.grad(this.permutation[BB + 1], xf - 1, yf - 1, zf - 1),
          u
        ),
        v
      ),
      w
    );
    
    // Convert from -1..1 to 0..1
    return (result + 1) / 2;
  }
  
  // Get fractal noise (multiple octaves)
  public fractalNoise(x: number, y: number, z: number = 0, octaves: number = 6, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
  
  // Generate terrain height at a specific x,z coordinate
  public getTerrainHeight(x: number, z: number): number {
    // Base terrain height
    const baseHeight = 4;
    
    // Use fractal noise for more natural terrain
    const noiseValue = this.fractalNoise(x, z, 0, 6, 0.5);
    
    // Scale noise to desired height range
    const mountainHeight = 15;
    const height = baseHeight + noiseValue * mountainHeight;
    
    // Round to integer for block placement
    return Math.floor(height);
  }
}

export default NoiseGenerator; 