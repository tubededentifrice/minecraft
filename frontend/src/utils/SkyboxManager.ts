import * as THREE from 'three';

class SkyboxManager {
  private scene: THREE.Scene;
  private skyMesh: THREE.Mesh | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private timeOfDay: number = 0.5; // 0-1, 0 = midnight, 0.5 = noon - start at noon
  private dayLength: number = 600; // seconds for a full day cycle
  
  constructor(scene: THREE.Scene) {
    console.log('SkyboxManager: Initializing');
    this.scene = scene;
    
    try {
      this.createSkybox();
      this.createSunLight();
      console.log('SkyboxManager: Initialization complete');
    } catch (error) {
      console.error('SkyboxManager: Error during initialization:', error);
      // Create fallback lighting
      this.createFallbackLighting();
    }
  }
  
  private createSkybox(): void {
    try {
      // Create a large sphere for the sky
      const skyGeometry = new THREE.SphereGeometry(500, 24, 24);
      
      // Create a gradient texture for the sky
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Create gradient
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1e90ff'); // Sky blue at top
        gradient.addColorStop(0.5, '#87ceeb'); // Light blue in middle
        gradient.addColorStop(1, '#e0f7fa'); // Very light blue near horizon
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some clouds - simplified for better performance
        context.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * canvas.width;
          const y = (Math.random() * canvas.height / 2) + canvas.height * 0.2;
          const size = Math.random() * 40 + 20;
          
          context.beginPath();
          context.arc(x, y, size, 0, Math.PI * 2);
          context.fill();
        }
      }
      
      const skyTexture = new THREE.CanvasTexture(canvas);
      const skyMaterial = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
      });
      
      this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
      this.scene.add(this.skyMesh);
    } catch (error) {
      console.error('SkyboxManager: Error creating skybox:', error);
      // Use a simple colored background instead
      this.scene.background = new THREE.Color(0x87CEEB);
    }
  }
  
  private createSunLight(): void {
    try {
      // Create a directional light to represent the sun
      this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
      this.sunLight.position.set(50, 100, 50);
      this.sunLight.castShadow = true;
      
      // Configure shadow properties
      if (this.sunLight.shadow.camera) {
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
      }
      
      this.scene.add(this.sunLight);
    } catch (error) {
      console.error('SkyboxManager: Error creating sun light:', error);
    }
  }
  
  private createFallbackLighting(): void {
    try {
      // Add basic directional light
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
      sunLight.position.set(10, 100, 10);
      this.scene.add(sunLight);
      
      // Add ambient light to ensure scene is visible
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(ambientLight);
      
      // Set sky background color
      this.scene.background = new THREE.Color(0x87CEEB);
    } catch (error) {
      console.error('SkyboxManager: Error creating fallback lighting:', error);
    }
  }
  
  // Update skybox and sun position based on time
  public update(deltaTime: number): void {
    try {
      // Update time of day
      this.timeOfDay += deltaTime / this.dayLength;
      this.timeOfDay %= 1; // Keep within 0-1 range
      
      // Update sun position based on time of day
      if (this.sunLight) {
        const angle = this.timeOfDay * Math.PI * 2;
        const radius = 100;
        const height = Math.sin(angle) * radius;
        const horizontal = Math.cos(angle) * radius;
        
        this.sunLight.position.set(horizontal, height, 0);
        
        // Adjust light intensity based on time of day
        const isDay = this.timeOfDay > 0.25 && this.timeOfDay < 0.75;
        this.sunLight.intensity = isDay ? 0.8 : 0.1;
        
        // Change light color based on time
        if (this.timeOfDay < 0.25 || this.timeOfDay > 0.75) {
          // Night - more blue light
          this.sunLight.color.setHex(0xb0c4de);
        } else if (this.timeOfDay < 0.3 || this.timeOfDay > 0.7) {
          // Dawn/Dusk - orange light
          this.sunLight.color.setHex(0xffa500);
        } else {
          // Day - white light
          this.sunLight.color.setHex(0xffffff);
        }
      }
      
      // Rotate skybox for subtle cloud movement - if skybox exists
      if (this.skyMesh) {
        this.skyMesh.rotation.y += 0.0001;
      }
    } catch (error) {
      console.error('SkyboxManager: Error updating:', error);
    }
  }
  
  // Get the current time of day as a string
  public getTimeOfDayName(): string {
    try {
      if (this.timeOfDay < 0.25) {
        return 'Night';
      } else if (this.timeOfDay < 0.3) {
        return 'Dawn';
      } else if (this.timeOfDay < 0.7) {
        return 'Day';
      } else if (this.timeOfDay < 0.75) {
        return 'Dusk';
      } else {
        return 'Night';
      }
    } catch (error) {
      console.error('SkyboxManager: Error getting time of day:', error);
      return 'Day';
    }
  }
  
  // Reset the skybox to a specific time of day
  public setTimeOfDay(time: number): void {
    try {
      this.timeOfDay = time;
    } catch (error) {
      console.error('SkyboxManager: Error setting time of day:', error);
    }
  }
}

export default SkyboxManager; 