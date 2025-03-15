import * as THREE from 'three';

class SkyboxManager {
  private scene: THREE.Scene;
  private skyMesh: THREE.Mesh | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private timeOfDay: number = 0; // 0-1, 0 = midnight, 0.5 = noon
  private dayLength: number = 600; // seconds for a full day cycle
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createSkybox();
    this.createSunLight();
  }
  
  private createSkybox(): void {
    // Create a large sphere for the sky
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    
    // Create a gradient texture for the sky
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    if (context) {
      // Create gradient
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1e90ff'); // Sky blue at top
      gradient.addColorStop(0.5, '#87ceeb'); // Light blue in middle
      gradient.addColorStop(1, '#e0f7fa'); // Very light blue near horizon
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add some clouds
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = (Math.random() * canvas.height / 2) + canvas.height * 0.2;
        const size = Math.random() * 60 + 40;
        
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.arc(x + size * 0.4, y - size * 0.1, size * 0.8, 0, Math.PI * 2);
        context.arc(x - size * 0.4, y - size * 0.1, size * 0.6, 0, Math.PI * 2);
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
  }
  
  private createSunLight(): void {
    // Create a directional light to represent the sun
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    
    // Configure shadow properties
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    
    this.scene.add(this.sunLight);
  }
  
  // Update skybox and sun position based on time
  public update(deltaTime: number): void {
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
    
    // Rotate skybox for subtle cloud movement
    if (this.skyMesh) {
      this.skyMesh.rotation.y += 0.0001;
    }
  }
  
  // Get the current time of day as a string
  public getTimeOfDayName(): string {
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
  }
  
  // Reset the skybox to a specific time of day
  public setTimeOfDay(time: number): void {
    this.timeOfDay = time;
  }
}

export default SkyboxManager; 