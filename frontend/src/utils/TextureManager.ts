import * as THREE from 'three';

// Singleton class to manage all textures
class TextureManager {
  private static instance: TextureManager;
  private textureLoader: THREE.TextureLoader;
  private textures: Map<string, THREE.Texture>;
  private textureAtlas: THREE.Texture | null = null;
  private loading: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  
  private constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.textures = new Map();
  }
  
  public static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    
    return TextureManager.instance;
  }
  
  public async loadTextures(): Promise<void> {
    if (this.loading && this.loadingPromise) {
      return this.loadingPromise;
    }
    
    this.loading = true;
    
    this.loadingPromise = new Promise<void>((resolve) => {
      // Define placeholder textures with colors
      const placeholderColors = {
        'dirt': '#8B5A2B',
        'grass_top': '#567D46', 
        'grass_side': '#8B7355',
        'stone': '#808080',
        'wood': '#8B4513',
        'leaves': '#2E8B57', 
        'water': '#4169E1',
        'glass': '#87CEEB',
        'sand': '#F4A460',
      };
      
      // Create placeholder colored textures
      Object.entries(placeholderColors).forEach(([name, color]) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 64, 64);
          
          // Add some texture/noise
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          for (let i = 0; i < 100; i++) {
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const size = Math.random() * 3 + 1;
            ctx.fillRect(x, y, size, size);
          }
          
          // For transparent textures
          if (name === 'glass' || name === 'leaves' || name === 'water') {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 64, 64);
          }
          
          const texture = new THREE.CanvasTexture(canvas);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          this.textures.set(name, texture);
        }
      });
      
      // Resolve immediately since we're using placeholders
      this.loading = false;
      resolve();
    });
    
    return this.loadingPromise;
  }
  
  public getTexture(name: string): THREE.Texture {
    const texture = this.textures.get(name);
    if (!texture) {
      console.warn(`Texture not found: ${name}, using fallback`);
      // Return a default texture as fallback
      return this.textures.get('dirt') || this.createFallbackTexture();
    }
    return texture;
  }
  
  public getMaterialForBlock(blockType: string): THREE.Material {
    // Handle special cases like grass which uses different textures for sides/top/bottom
    if (blockType === 'GRASS') {
      return new THREE.MeshStandardMaterial({
        map: this.getTexture('grass_side'),
        roughness: 1.0,
        metalness: 0.0,
      });
    } else if (blockType === 'LEAVES') {
      return new THREE.MeshStandardMaterial({
        map: this.getTexture('leaves'),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        alphaTest: 0.1
      });
    } else if (blockType === 'GLASS') {
      return new THREE.MeshStandardMaterial({
        map: this.getTexture('glass'),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
    } else if (blockType === 'WATER') {
      return new THREE.MeshStandardMaterial({
        map: this.getTexture('water'),
        transparent: true,
        opacity: 0.7,
        color: 0x4169E1
      });
    }
  
    // Map other block types to textures
    const textureMap: { [key: string]: string } = {
      'DIRT': 'dirt',
      'STONE': 'stone',
      'WOOD': 'wood',
      'SAND': 'sand'
    };
  
    const textureName = textureMap[blockType] || 'dirt';
    return new THREE.MeshStandardMaterial({
      map: this.getTexture(textureName),
      roughness: 1.0,
      metalness: 0.0
    });
  }
  
  private createFallbackTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create a checkerboard pattern
      ctx.fillStyle = '#FF00FF'; // Magenta
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#000000'; // Black
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillRect(32, 32, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
}

export default TextureManager; 