import * as THREE from 'three';
import NoiseGenerator from './NoiseGenerator';
import TextureManager from './TextureManager';

// Constants for chunk size and management
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 4;

// Define block interface
interface Block {
  type: string;
  position: THREE.Vector3;
  mesh?: THREE.Mesh;
}

// Define chunk interface
interface Chunk {
  position: THREE.Vector2;
  blocks: Map<string, Block>;
  isGenerated: boolean;
  mesh?: THREE.Group;
}

// Class to manage chunks and blocks
class ChunkManager {
  private chunks: Map<string, Chunk>;
  private noiseGenerator: NoiseGenerator;
  private scene: THREE.Scene;
  private textureManager: TextureManager;
  private blockGeometry: THREE.BoxGeometry;
  
  constructor(scene: THREE.Scene) {
    console.log('ChunkManager: Initializing');
    this.chunks = new Map();
    this.noiseGenerator = new NoiseGenerator(Math.random() * 10000);
    this.scene = scene;
    this.textureManager = TextureManager.getInstance();
    
    // Create a shared geometry for all blocks
    this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    console.log('ChunkManager: Initialization complete');
  }
  
  // Get chunk key from position
  private getChunkKey(x: number, z: number): string {
    return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
  }
  
  // Get block key from position
  private getBlockKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
  
  // Get chunk count
  public getChunkCount(): number {
    return this.chunks.size;
  }
  
  // Initialize chunks around player
  public initChunks(playerPosition: THREE.Vector3): void {
    try {
      console.log('ChunkManager: Initializing chunks around player position', playerPosition);
      const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
      const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
      
      // Generate chunks in render distance
      // Start with just a few chunks first for faster initial loading
      const initialDistance = 2; // Smaller initial render distance
      console.log(`ChunkManager: Generating initial ${initialDistance}x${initialDistance} chunks`);
      
      for (let x = playerChunkX - initialDistance; x <= playerChunkX + initialDistance; x++) {
        for (let z = playerChunkZ - initialDistance; z <= playerChunkZ + initialDistance; z++) {
          this.getOrCreateChunk(x, z);
        }
      }
      
      // Schedule the rest of the chunks to be loaded asynchronously
      setTimeout(() => {
        console.log('ChunkManager: Loading remaining chunks in render distance');
        for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
          for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
            // Skip already loaded chunks
            if (Math.abs(x - playerChunkX) <= initialDistance && Math.abs(z - playerChunkZ) <= initialDistance) {
              continue;
            }
            this.getOrCreateChunk(x, z);
          }
        }
        
        // Unload chunks outside render distance
        this.unloadDistantChunks(playerPosition);
        console.log('ChunkManager: All chunks loaded, count:', this.chunks.size);
      }, 1000); // Delay loading of additional chunks
    } catch (error) {
      console.error('ChunkManager: Error initializing chunks:', error);
      // Create at least one chunk to ensure something is visible
      this.getOrCreateChunk(0, 0);
    }
  }
  
  // Get or create a chunk at specified coordinates
  private getOrCreateChunk(chunkX: number, chunkZ: number): Chunk {
    try {
      const chunkKey = `${chunkX},${chunkZ}`;
      
      if (!this.chunks.has(chunkKey)) {
        // Create new chunk
        const chunk: Chunk = {
          position: new THREE.Vector2(chunkX, chunkZ),
          blocks: new Map(),
          isGenerated: false,
          mesh: new THREE.Group()
        };
        
        this.chunks.set(chunkKey, chunk);
        
        // Generate terrain for this chunk
        this.generateTerrain(chunk);
        
        // Add chunk mesh to scene
        if (chunk.mesh) {
          this.scene.add(chunk.mesh);
        }
      }
      
      return this.chunks.get(chunkKey)!;
    } catch (error) {
      console.error('ChunkManager: Error creating chunk:', error);
      // Return a default empty chunk
      const defaultChunk: Chunk = {
        position: new THREE.Vector2(chunkX, chunkZ),
        blocks: new Map(),
        isGenerated: true,
        mesh: new THREE.Group()
      };
      
      // Add a ground plane for the default chunk
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x567D46 });
      const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
        groundMaterial
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.set(
        chunkX * CHUNK_SIZE + CHUNK_SIZE / 2, 
        0, 
        chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      
      if (defaultChunk.mesh) {
        defaultChunk.mesh.add(groundMesh);
        this.scene.add(defaultChunk.mesh);
      }
      
      this.chunks.set(`${chunkX},${chunkZ}`, defaultChunk);
      return defaultChunk;
    }
  }
  
  // Remove chunks that are too far from player
  private unloadDistantChunks(playerPosition: THREE.Vector3): void {
    const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
    
    for (const [key, chunk] of this.chunks.entries()) {
      const distX = Math.abs(chunk.position.x - playerChunkX);
      const distZ = Math.abs(chunk.position.y - playerChunkZ);
      
      if (distX > RENDER_DISTANCE + 1 || distZ > RENDER_DISTANCE + 1) {
        // Remove chunk from scene
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
        }
        
        // Remove chunk from map
        this.chunks.delete(key);
      }
    }
  }
  
  // Generate terrain for a chunk
  private generateTerrain(chunk: Chunk): void {
    if (chunk.isGenerated) return;
    
    const chunkX = chunk.position.x * CHUNK_SIZE;
    const chunkZ = chunk.position.y * CHUNK_SIZE;
    
    // Generate blocks for terrain
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX + x;
        const worldZ = chunkZ + z;
        
        // Get height at this position
        const height = this.noiseGenerator.getTerrainHeight(worldX, worldZ);
        
        // Generate blocks from bedrock to surface
        for (let y = 0; y <= height; y++) {
          let blockType = 'STONE';
          
          // Determine block type based on height
          if (y === height && y > 0) {
            if (height > 12) {
              blockType = 'STONE'; // Mountain tops
            } else if (height > 5) {
              blockType = 'GRASS'; // Normal terrain
            } else if (height > 3) {
              blockType = 'DIRT'; // Low areas
            } else {
              blockType = 'SAND'; // Beach areas
            }
          } else if (y >= height - 3 && y < height && height > 1) {
            blockType = 'DIRT'; // Dirt under grass
          }
          
          // Water in very low areas
          if (y <= 3 && height <= 3) {
            blockType = 'WATER';
          }
          
          // Create block and add to chunk
          this.createBlock(worldX, y, worldZ, blockType, chunk);
        }
      }
    }
    
    // Add some trees
    if (Math.random() < 0.2) { // 20% chance for a tree in this chunk
      const treeX = chunkX + Math.floor(Math.random() * CHUNK_SIZE);
      const treeZ = chunkZ + Math.floor(Math.random() * CHUNK_SIZE);
      const groundHeight = this.noiseGenerator.getTerrainHeight(treeX, treeZ);
      
      // Only place trees on grass
      const surfaceBlockKey = this.getBlockKey(treeX, groundHeight, treeZ);
      const surfaceBlock = chunk.blocks.get(surfaceBlockKey);
      
      if (surfaceBlock && surfaceBlock.type === 'GRASS' && groundHeight > 3) {
        this.createTree(treeX, groundHeight + 1, treeZ, chunk);
      }
    }
    
    chunk.isGenerated = true;
  }
  
  // Create a tree
  private createTree(x: number, baseY: number, z: number, chunk: Chunk): void {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);
    
    // Create trunk
    for (let y = 0; y < trunkHeight; y++) {
      this.createBlock(x, baseY + y, z, 'WOOD', chunk);
    }
    
    // Create leaves
    const leavesHeight = 3;
    const leavesRadius = 2;
    
    for (let y = 0; y < leavesHeight; y++) {
      for (let lx = -leavesRadius; lx <= leavesRadius; lx++) {
        for (let lz = -leavesRadius; lz <= leavesRadius; lz++) {
          if (lx === 0 && lz === 0 && y < leavesHeight - 1) continue; // Skip trunk position
          
          if (lx * lx + lz * lz + y * y <= leavesRadius * leavesRadius + 1) {
            this.createBlock(
              x + lx, 
              baseY + trunkHeight - 1 + y, 
              z + lz, 
              'LEAVES', 
              chunk
            );
          }
        }
      }
    }
  }
  
  // Create a block and add it to the chunk
  private createBlock(x: number, y: number, z: number, type: string, chunk: Chunk): void {
    // Skip air blocks
    if (type === 'AIR') return;
    
    const chunkX = chunk.position.x * CHUNK_SIZE;
    const chunkZ = chunk.position.y * CHUNK_SIZE;
    
    // Check if coordinates are within this chunk
    if (x < chunkX || x >= chunkX + CHUNK_SIZE || z < chunkZ || z >= chunkZ + CHUNK_SIZE) {
      return;
    }
    
    const blockKey = this.getBlockKey(x, y, z);
    
    // Check if block already exists
    if (chunk.blocks.has(blockKey)) {
      return;
    }
    
    // Create material for block
    const material = this.textureManager.getMaterialForBlock(type);
    
    // Create mesh
    const mesh = new THREE.Mesh(this.blockGeometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add to chunk mesh
    if (chunk.mesh) {
      chunk.mesh.add(mesh);
    }
    
    // Store block data
    const block: Block = {
      type,
      position: new THREE.Vector3(x, y, z),
      mesh
    };
    
    // Add to chunk
    chunk.blocks.set(blockKey, block);
  }
  
  // Place a block at the specified position
  public placeBlock(x: number, y: number, z: number, type: string): boolean {
    const chunkKey = this.getChunkKey(x, z);
    const chunk = this.chunks.get(chunkKey);
    
    if (!chunk) return false;
    
    const blockKey = this.getBlockKey(x, y, z);
    
    // Check if a block already exists at this position
    if (chunk.blocks.has(blockKey)) {
      return false;
    }
    
    // Create the block
    this.createBlock(x, y, z, type, chunk);
    return true;
  }
  
  // Remove a block at the specified position
  public removeBlock(x: number, y: number, z: number): string | null {
    const chunkKey = this.getChunkKey(x, z);
    const chunk = this.chunks.get(chunkKey);
    
    if (!chunk) return null;
    
    const blockKey = this.getBlockKey(x, y, z);
    const block = chunk.blocks.get(blockKey);
    
    if (!block) return null;
    
    // Remove from scene
    if (block.mesh && chunk.mesh) {
      chunk.mesh.remove(block.mesh);
    }
    
    // Remove from chunk
    const blockType = block.type;
    chunk.blocks.delete(blockKey);
    
    return blockType;
  }
  
  // Get the block at the specified position
  public getBlock(x: number, y: number, z: number): Block | null {
    const chunkKey = this.getChunkKey(x, z);
    const chunk = this.chunks.get(chunkKey);
    
    if (!chunk) return null;
    
    const blockKey = this.getBlockKey(x, y, z);
    return chunk.blocks.get(blockKey) || null;
  }
  
  // Cast ray and return the block that was hit
  public castRay(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 5): { block: Block, face: THREE.Face | null } | null {
    try {
      const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, maxDistance);
      const meshes: THREE.Mesh[] = [];
      
      // Collect all block meshes in all chunks
      for (const chunk of this.chunks.values()) {
        for (const block of chunk.blocks.values()) {
          if (block.mesh) {
            meshes.push(block.mesh);
          }
        }
      }
      
      // Cast ray
      const intersects = raycaster.intersectObjects(meshes, false);
      
      if (intersects.length > 0) {
        const intersect = intersects[0];
        const mesh = intersect.object as THREE.Mesh;
        
        // Find the block that owns this mesh
        for (const chunk of this.chunks.values()) {
          for (const [key, block] of chunk.blocks.entries()) {
            if (block.mesh === mesh) {
              return { 
                block, 
                face: intersect.face || null 
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('ChunkManager: Error in castRay:', error);
      return null;
    }
  }
  
  // Update chunks based on player position
  public update(playerPosition: THREE.Vector3): void {
    try {
      // Only update chunks every few frames to improve performance
      if (Math.random() < 0.1) { // 10% chance to update each frame
        this.initChunks(playerPosition);
      }
    } catch (error) {
      console.error('ChunkManager: Error updating chunks:', error);
    }
  }
}

export default ChunkManager; 