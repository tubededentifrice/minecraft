import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import '../styles/GameView.css';

interface GameViewProps {
  onExit: () => void;
}

const GameView: React.FC<GameViewProps> = ({ onExit }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(5, 5, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Create a simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x228B22, // Forest green
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    scene.add(ground);

    // Create some sample blocks
    createBlock(scene, 0, 0, 0, 0x8B4513); // Brown (dirt)
    createBlock(scene, 1, 0, 0, 0x8B4513);
    createBlock(scene, 0, 0, 1, 0x8B4513);
    createBlock(scene, 1, 0, 1, 0x8B4513);
    
    createBlock(scene, 0, 1, 0, 0x228B22); // Green (grass)
    createBlock(scene, 1, 1, 0, 0x228B22);
    createBlock(scene, 0, 1, 1, 0x228B22);
    createBlock(scene, 1, 1, 1, 0x228B22);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Helper function to create a block
  const createBlock = (
    scene: THREE.Scene, 
    x: number, 
    y: number, 
    z: number, 
    color: number
  ) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    scene.add(cube);
    return cube;
  };

  return (
    <div className="game-view">
      <div className="game-container" ref={mountRef}></div>
      
      <div className="hud">
        <div className="crosshair">+</div>
        <div className="hotbar">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`hotbar-slot ${i === 0 ? 'selected' : ''}`}></div>
          ))}
        </div>
      </div>
      
      <button className="exit-button" onClick={onExit}>
        Exit Game
      </button>
    </div>
  );
};

export default GameView; 