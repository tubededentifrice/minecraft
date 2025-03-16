import * as THREE from 'three';
import NoiseGenerator from './NoiseGenerator';
import TextureManager from './TextureManager';

// Constants for chunk size and management
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2; // Keep small render distance for performance
const MAX_VISIBLE_CHUNKS = 25; // Limit maximum number of visible chunks
const MAX_BLOCKS_PER_FRAME = 100; // Increased to allow more blocks per frame
const MAX_HEIGHT = 30; // Increased max height to avoid seeing through the ground

// Terrain generation parameters
const STEP_SIZE = 1; // Smaller step size to create more blocks
const FILL_GROUND = true; // Flag to create solid ground blocks

// Cache for block geometries and materials
const geometryCache = new THREE.BoxGeometry(1, 1, 1);
const materialCache = new Map<string, THREE.Material>();

// Instance mesh for common blocks
const INSTANCED_BLOCK_TYPES = ['DIRT', 'STONE', 'GRASS'];
const instanceMeshes = new Map<string, THREE.InstancedMesh>();

// Define block interface
interface Block {
  type: string;
  position: THREE.Vector3;
  mesh?: THREE.Mesh | number; // Mesh or index in instanced mesh
  isInstanced?: boolean;
}

// Define chunk interface
interface Chunk {
  position: THREE.Vector2;
  blocks: Map<string, Block>;
  isGenerated: boolean;
  isVisible: boolean;
  mesh?: THREE.Group;
  blockCount: number;
  highestBlock: number;
  priority: number; // For prioritizing chunks near player
}

// Class to manage chunks and blocks
class ChunkManager {
  private chunks: Map<string, Chunk>;
  private noiseGenerator: NoiseGenerator;
  private scene: THREE.Scene;
  private textureManager: TextureManager;
  private visibleChunks: Set<string> = new Set();
  private updateQueue: Array<{key: string, priority: number}> = [];
  private isUpdating: boolean = false;
  private lastPlayerChunk: {x: number, z: number} | null = null;
  private blockCreationTracker = { count: 0, lastReset: 0 };
  private raycaster: THREE.Raycaster;
  private blockMatrix = new THREE.Matrix4();
  private instanceCount = new Map<string, number>();
  
  constructor(scene: THREE.Scene) {
    console.log('ChunkManager: Initializing with performance optimizations');
    this.chunks = new Map();
    this.noiseGenerator = new NoiseGenerator(Math.random() * 10000);
    this.scene = scene;
    this.textureManager = TextureManager.getInstance();
    this.raycaster = new THREE.Raycaster();
    
    // Initialize instance meshes for common block types
    this.initInstanceMeshes();
    
    console.log('ChunkManager: Initialization complete');
  }
  
  // Initialize instance meshes for common block types
  private initInstanceMeshes(): void {
    for (const type of INSTANCED_BLOCK_TYPES) {
      const material = this.textureManager.getMaterialForBlock(type);
      const instancedMesh = new THREE.InstancedMesh(
        geometryCache,
        material,
        1000 // Maximum instances per mesh
      );
      instancedMesh.count = 0;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      instanceMeshes.set(type, instancedMesh);
      this.instanceCount.set(type, 0);
      this.scene.add(instancedMesh);
    }
  }
  
  // Get chunk key from position
  private getChunkKey(x: number, z: number): string {
    return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
  }
  
  // Get block key from position
  private getBlockKey(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
  
  // Get chunk count
  public getChunkCount(): number {
    return this.visibleChunks.size;
  }
  
  // Initialize chunks around player
  public initChunks(playerPosition: THREE.Vector3): void {
    try {
      const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
      const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
      
      // Skip if player hasn't moved to a new chunk to reduce needless updates
      if (this.lastPlayerChunk && 
          this.lastPlayerChunk.x === playerChunkX && 
          this.lastPlayerChunk.z === playerChunkZ) {
        return;
      }
      
      this.lastPlayerChunk = { x: playerChunkX, z: playerChunkZ };
      
      // Clear update queue and prioritize new chunks
      this.updateQueue = [];
      
      const newVisibleChunks = new Set<string>();
      const chunkDistances: Array<{key: string, distance: number, priority: number}> = [];
      
      // Calculate distances for all chunks in render distance
      for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
          const chunkKey = `${x},${z}`;
          const dx = x - playerChunkX;
          const dz = z - playerChunkZ;
          const distance = Math.sqrt(dx * dx + dz * dz);
          
          // Calculate priority - closer chunks get higher priority
          const priority = 1000 - Math.floor(distance * 100);
          
          chunkDistances.push({ key: chunkKey, distance, priority });
        }
      }
      
      // Sort by distance
      chunkDistances.sort((a, b) => a.distance - b.distance);
      
      // Take only the closest chunks up to MAX_VISIBLE_CHUNKS
      const visibleChunkData = chunkDistances.slice(0, MAX_VISIBLE_CHUNKS);
      
      // Add closest chunks to visible set and process them immediately
      for (let i = 0; i < Math.min(5, visibleChunkData.length); i++) {
        const { key } = visibleChunkData[i];
        newVisibleChunks.add(key);
        
        const [x, z] = key.split(',').map(Number);
        
        if (!this.chunks.has(key)) {
          this.getOrCreateChunk(x, z, visibleChunkData[i].priority);
        } else {
          const chunk = this.chunks.get(key);
          if (chunk) {
            chunk.priority = visibleChunkData[i].priority;
            chunk.isVisible = true;
          }
        }
      }
      
      // Queue the remaining chunks
      for (let i = 5; i < visibleChunkData.length; i++) {
        const { key, priority } = visibleChunkData[i];
        newVisibleChunks.add(key);
        
        const chunk = this.chunks.get(key);
        if (chunk) {
          chunk.priority = priority;
          chunk.isVisible = true;
        } else {
          this.updateQueue.push({ key, priority });
        }
      }
      
      // Update visibility of chunks
      this.updateChunkVisibility(newVisibleChunks);
      
      // Process chunks in the update queue
      if (!this.isUpdating) {
        this.processUpdateQueue();
      }
      
      // Unload distant chunks every 5 seconds
      if (Math.random() < 0.02) {
        this.unloadDistantChunks(playerPosition);
      }
    } catch (error) {
      console.error('ChunkManager: Error initializing chunks:', error);
      // Create at least one chunk to ensure something is visible
      if (this.chunks.size === 0) {
        this.getOrCreateChunk(0, 0, 1000);
      }
    }
  }
  
  // Process chunks in the update queue with strict batching
  private processUpdateQueue(): void {
    if (this.updateQueue.length === 0) {
      this.isUpdating = false;
      return;
    }
    
    this.isUpdating = true;
    
    // Sort the queue by priority
    this.updateQueue.sort((a, b) => b.priority - a.priority);
    
    const processBatch = () => {
      // Reset block creation counter if needed
      const now = performance.now();
      if (now - this.blockCreationTracker.lastReset > 16) { // Reset every frame (~16ms)
        this.blockCreationTracker.count = 0;
        this.blockCreationTracker.lastReset = now;
      }
      
      // Process one chunk
      if (this.updateQueue.length > 0) {
        const { key } = this.updateQueue.shift()!;
        const [x, z] = key.split(',').map(Number);
        
        if (!this.chunks.has(key) && this.visibleChunks.has(key)) {
          this.getOrCreateChunk(x, z, 0);
        }
      }
      
      // Continue processing if queue not empty and we're still well under budget
      if (this.updateQueue.length > 0 && this.blockCreationTracker.count < MAX_BLOCKS_PER_FRAME) {
        setTimeout(processBatch, 0);
      } else if (this.updateQueue.length > 0) {
        // Schedule next batch for next frame
        requestAnimationFrame(processBatch);
      } else {
        this.isUpdating = false;
      }
    };
    
    processBatch();
  }
  
  // Update chunk visibility with occlusion culling
  private updateChunkVisibility(newVisibleChunks: Set<string>): void {
    // Hide chunks that are no longer visible
    for (const chunkKey of this.visibleChunks) {
      if (!newVisibleChunks.has(chunkKey)) {
        const chunk = this.chunks.get(chunkKey);
        if (chunk) {
          chunk.isVisible = false;
          if (chunk.mesh) {
            chunk.mesh.visible = false;
          }
        }
      }
    }
    
    // Show chunks that are now visible
    for (const chunkKey of newVisibleChunks) {
      const chunk = this.chunks.get(chunkKey);
      if (chunk) {
        chunk.isVisible = true;
        if (chunk.mesh) {
          chunk.mesh.visible = true;
        }
      }
    }
    
    this.visibleChunks = newVisibleChunks;
  }
  
  // Get or create a chunk at specified coordinates
  private getOrCreateChunk(chunkX: number, chunkZ: number, priority: number): Chunk {
    try {
      const chunkKey = `${chunkX},${chunkZ}`;
      
      if (!this.chunks.has(chunkKey)) {
        // Create new chunk
        const chunk: Chunk = {
          position: new THREE.Vector2(chunkX, chunkZ),
          blocks: new Map(),
          isGenerated: false,
          isVisible: true,
          mesh: new THREE.Group(),
          blockCount: 0,
          highestBlock: 0,
          priority
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
        isVisible: true,
        mesh: new THREE.Group(),
        blockCount: 0,
        highestBlock: 0,
        priority
      };
      
      // Add a simple ground plane for the default chunk
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
      
      if (distX > RENDER_DISTANCE + 1 || distZ > RENDER_DISTANCE + 1 || !chunk.isVisible) {
        // Remove chunk from scene
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
        }
        
        // Remove blocks from instanced meshes
        for (const block of chunk.blocks.values()) {
          if (block.isInstanced && typeof block.mesh === 'number') {
            // Set matrix to zero to effectively hide it
            this.blockMatrix.makeScale(0, 0, 0);
            const mesh = instanceMeshes.get(block.type);
            if (mesh) {
              mesh.setMatrixAt(block.mesh, this.blockMatrix);
              mesh.instanceMatrix.needsUpdate = true;
            }
          }
        }
        
        // Remove chunk from map
        this.chunks.delete(key);
        this.visibleChunks.delete(key);
      }
    }
  }
  
  // Generate terrain for a chunk with optimized mesh creation
  private generateTerrain(chunk: Chunk): void {
    if (chunk.isGenerated) return;
    
    const chunkX = chunk.position.x * CHUNK_SIZE;
    const chunkZ = chunk.position.y * CHUNK_SIZE;
    
    // Use a less aggressive step size for terrain, but still optimized
    const stepSize = STEP_SIZE;
    
    // First pass: generate heightmap for the entire chunk
    const heightMap: number[][] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      heightMap[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX + x;
        const worldZ = chunkZ + z;
        
        // Get height at this position - clamp at MAX_HEIGHT
        const rawHeight = this.noiseGenerator.getTerrainHeight(worldX, worldZ);
        const height = Math.min(rawHeight, MAX_HEIGHT);
        
        heightMap[x][z] = height;
        
        // Update chunk's highest point
        chunk.highestBlock = Math.max(chunk.highestBlock, height);
      }
    }
    
    // Generate terrain using the heightmap
    for (let x = 0; x < CHUNK_SIZE; x += stepSize) {
      for (let z = 0; z < CHUNK_SIZE; z += stepSize) {
        const worldX = chunkX + x;
        const worldZ = chunkZ + z;
        
        // Get the height for this position
        const height = heightMap[x][z];
        
        // Minimum depth to generate blocks below surface
        const minDepth = FILL_GROUND ? height : Math.max(0, height - 3);
        
        // Create blocks from minDepth to the surface
        for (let y = minDepth; y <= height; y++) {
          // Skip if we've created too many blocks this frame
          if (this.blockCreationTracker.count >= MAX_BLOCKS_PER_FRAME) {
            continue;
          }
          
          let blockType = 'STONE';
          
          // Determine block type based on height and depth
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
          } else if (y >= height - 2 && y < height && height > 1) {
            blockType = 'DIRT'; // Dirt under grass
          }
          
          // Water in very low areas
          if (y <= 3 && height <= 3 && y === height) {
            blockType = 'WATER';
          }
          
          // Fill in blocks for this step size
          for (let fillX = 0; fillX < stepSize && x + fillX < CHUNK_SIZE; fillX++) {
            for (let fillZ = 0; fillZ < stepSize && z + fillZ < CHUNK_SIZE; fillZ++) {
              // Always create the top block, but be selective about blocks below
              const isTopBlock = y === height;
              const isEdgeBlock = fillX === 0 || fillZ === 0 || 
                                 fillX === stepSize - 1 || fillZ === stepSize - 1;
              
              if (isTopBlock || (FILL_GROUND && (y % 3 === 0 || isEdgeBlock))) {
                this.createBlock(chunkX + x + fillX, y, chunkZ + z + fillZ, blockType, chunk);
                this.blockCreationTracker.count++;
              }
            }
          }
        }
        
        // Floor at y=0 to prevent falling through the world
        if (height < 1) {
          this.createBlock(worldX, 0, worldZ, 'STONE', chunk);
          this.blockCreationTracker.count++;
        }
      }
    }
    
    // Only add trees in medium density chunks
    if (Math.random() < 0.1 && chunk.blockCount < 150) { // Slightly higher tree chance
      const treeX = chunkX + Math.floor(Math.random() * CHUNK_SIZE);
      const treeZ = chunkZ + Math.floor(Math.random() * CHUNK_SIZE);
      const treePos = Math.floor(treeX - chunkX);
      const treePosZ = Math.floor(treeZ - chunkZ);
      
      // Use heightmap if available
      const groundHeight = treePos >= 0 && treePos < CHUNK_SIZE && 
                          treePosZ >= 0 && treePosZ < CHUNK_SIZE ?
                          heightMap[treePos][treePosZ] :
                          Math.min(this.noiseGenerator.getTerrainHeight(treeX, treeZ), MAX_HEIGHT);
      
      // Only place trees on grass
      const surfaceBlockKey = this.getBlockKey(treeX, groundHeight, treeZ);
      const surfaceBlock = chunk.blocks.get(surfaceBlockKey);
      
      if (surfaceBlock && surfaceBlock.type === 'GRASS' && groundHeight > 3) {
        this.createSimpleTree(treeX, groundHeight + 1, treeZ, chunk);
      }
    }
    
    chunk.isGenerated = true;
  }
  
  // Create a simplified tree
  private createSimpleTree(x: number, baseY: number, z: number, chunk: Chunk): void {
    const trunkHeight = 3; // Shorter trees
    
    // Create trunk
    for (let y = 0; y < trunkHeight; y++) {
      if (this.blockCreationTracker.count < MAX_BLOCKS_PER_FRAME) {
        this.createBlock(x, baseY + y, z, 'WOOD', chunk);
        this.blockCreationTracker.count++;
      }
    }
    
    // Create a single layer of leaves
    const leavesRadius = 1; // Smaller leaves
    
    for (let lx = -leavesRadius; lx <= leavesRadius; lx++) {
      for (let lz = -leavesRadius; lz <= leavesRadius; lz++) {
        if (this.blockCreationTracker.count >= MAX_BLOCKS_PER_FRAME) continue;
        
        // Skip trunk position
        if (lx === 0 && lz === 0) continue;
        
        // Only place leaves at corners
        if (Math.abs(lx) + Math.abs(lz) <= leavesRadius + 1) {
          this.createBlock(
            x + lx, 
            baseY + trunkHeight, 
            z + lz, 
            'LEAVES', 
            chunk
          );
          this.blockCreationTracker.count++;
        }
      }
    }
    
    // Add a top leaf
    this.createBlock(x, baseY + trunkHeight + 1, z, 'LEAVES', chunk);
    this.blockCreationTracker.count++;
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
    
    let mesh: THREE.Mesh | number;
    let isInstanced = false;
    
    // Use instanced meshes for common block types
    if (INSTANCED_BLOCK_TYPES.includes(type)) {
      const instancedMesh = instanceMeshes.get(type);
      if (instancedMesh) {
        const instanceId = this.instanceCount.get(type) || 0;
        
        if (instanceId < instancedMesh.count) {
          this.blockMatrix.makeTranslation(x, y, z);
          instancedMesh.setMatrixAt(instanceId, this.blockMatrix);
          instancedMesh.instanceMatrix.needsUpdate = true;
          
          this.instanceCount.set(type, instanceId + 1);
          mesh = instanceId;
          isInstanced = true;
        } else {
          // Fallback to regular mesh if we exceed instance count
          const material = this.textureManager.getMaterialForBlock(type);
          mesh = new THREE.Mesh(geometryCache, material);
          mesh.position.set(x, y, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // Add to chunk mesh
          if (chunk.mesh) {
            chunk.mesh.add(mesh);
          }
        }
      } else {
        // Fallback if instance mesh not found
        const material = this.textureManager.getMaterialForBlock(type);
        mesh = new THREE.Mesh(geometryCache, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add to chunk mesh
        if (chunk.mesh) {
          chunk.mesh.add(mesh);
        }
      }
    } else {
      // Use cached materials when possible
      let material: THREE.Material;
      if (materialCache.has(type)) {
        material = materialCache.get(type)!;
      } else {
        material = this.textureManager.getMaterialForBlock(type);
        materialCache.set(type, material);
      }
      
      // Create regular mesh
      mesh = new THREE.Mesh(geometryCache, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Add to chunk mesh
      if (chunk.mesh) {
        chunk.mesh.add(mesh);
      }
    }
    
    // Store block data
    const block: Block = {
      type,
      position: new THREE.Vector3(x, y, z),
      mesh,
      isInstanced
    };
    
    // Add to chunk
    chunk.blocks.set(blockKey, block);
    chunk.blockCount++;
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
    
    // Remove the block
    if (block.isInstanced && typeof block.mesh === 'number') {
      // For instanced blocks, set scale to 0 to hide it
      const instancedMesh = instanceMeshes.get(block.type);
      if (instancedMesh) {
        this.blockMatrix.makeScale(0, 0, 0);
        instancedMesh.setMatrixAt(block.mesh, this.blockMatrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
      }
    } else if (block.mesh instanceof THREE.Mesh && chunk.mesh) {
      // For regular meshes, remove from scene
      chunk.mesh.remove(block.mesh);
    }
    
    // Remove from chunk
    const blockType = block.type;
    chunk.blocks.delete(blockKey);
    chunk.blockCount--;
    
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
  
  // Optimized ray casting that only checks visible chunks
  public castRay(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 5): { block: Block, face: THREE.Face | null } | null {
    try {
      this.raycaster.set(origin, direction.normalize());
      this.raycaster.far = maxDistance;
      
      // Collect visible meshes from regular blocks
      const meshes: THREE.Mesh[] = [];
      const blockLookup = new Map<THREE.Mesh, Block>();
      
      // Only check chunks that are close to the ray
      const originChunkKey = this.getChunkKey(origin.x, origin.z);
      const originChunk = this.chunks.get(originChunkKey);
      
      if (!originChunk) return null;
      
      // Collect regular meshes and create lookup
      for (const chunkKey of this.visibleChunks) {
        const chunk = this.chunks.get(chunkKey);
        if (chunk && chunk.isVisible) {
          for (const block of chunk.blocks.values()) {
            if (!block.isInstanced && block.mesh instanceof THREE.Mesh) {
              meshes.push(block.mesh);
              blockLookup.set(block.mesh, block);
            }
          }
        }
      }
      
      // Cast ray against regular meshes
      const intersects = this.raycaster.intersectObjects(meshes, false);
      
      if (intersects.length > 0) {
        const intersect = intersects[0];
        const mesh = intersect.object as THREE.Mesh;
        const block = blockLookup.get(mesh);
        
        if (block) {
          return { 
            block, 
            face: intersect.face || null 
          };
        }
      }
      
      // Check instanced meshes
      for (const [type, instancedMesh] of instanceMeshes) {
        const instanceIntersects = this.raycaster.intersectObject(instancedMesh, false);
        
        if (instanceIntersects.length > 0) {
          const intersect = instanceIntersects[0];
          const instanceId = intersect.instanceId;
          
          if (instanceId !== undefined) {
            // Find the block with this instance ID
            for (const chunk of this.chunks.values()) {
              if (!chunk.isVisible) continue;
              
              for (const [key, block] of chunk.blocks.entries()) {
                if (block.isInstanced && block.mesh === instanceId && block.type === type) {
                  return {
                    block,
                    face: intersect.face || null
                  };
                }
              }
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
  
  // Super optimized update method
  public update(playerPosition: THREE.Vector3): void {
    try {
      // Only update chunks every few frames to improve performance
      if (Math.random() < 0.03) { // Further reduced chance of updates for better performance
        this.initChunks(playerPosition);
      }
    } catch (error) {
      console.error('ChunkManager: Error updating chunks:', error);
    }
  }
}

export default ChunkManager; 