import React, { useRef, useEffect, useState, FormEvent } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import '../styles/GameView.css';

// Block types definition
interface BlockType {
  id: number;
  name: string;
  color: string;
  transparent: boolean;
  solid: boolean;
  texture?: string;
}

const BLOCK_TYPES: { [key: string]: BlockType } = {
  AIR: { id: 0, name: 'Air', color: '#FFFFFF', transparent: true, solid: false },
  DIRT: { id: 1, name: 'Dirt', color: '#8B5A2B', transparent: false, solid: true },
  GRASS: { id: 2, name: 'Grass', color: '#567D46', transparent: false, solid: true },
  STONE: { id: 3, name: 'Stone', color: '#808080', transparent: false, solid: true },
  WOOD: { id: 4, name: 'Wood', color: '#8B4513', transparent: false, solid: true },
  LEAVES: { id: 5, name: 'Leaves', color: '#2E8B57', transparent: true, solid: true },
  WATER: { id: 6, name: 'Water', color: '#4169E1', transparent: true, solid: false },
  GLASS: { id: 7, name: 'Glass', color: '#87CEEB', transparent: true, solid: true },
};

// Movement constants
const MOVEMENT_SPEED = 0.15;
const GRAVITY = 0.01;
const JUMP_FORCE = 0.3;

// Player interface
interface Player {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  health: number;
  name: string;
}

// Chat message interface
interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface GameViewProps {
  onExit: () => void;
}

const GameView: React.FC<GameViewProps> = ({ onExit }) => {
  // Game state
  const [health, setHealth] = useState(100);
  const [inventory, setInventory] = useState<{ [key: string]: number }>({
    DIRT: 64,
    GRASS: 64,
    STONE: 64,
    WOOD: 64,
    LEAVES: 64,
    GLASS: 32,
  });
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    fps: 0,
    position: new THREE.Vector3(),
    blockLookingAt: null as null | { position: THREE.Vector3, type: string },
  });

  // References
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const playerVelocity = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerOnGround = useRef<boolean>(false);
  const blocksRef = useRef<THREE.Object3D[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const fpsTime = useRef<number>(0);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup Three.js scene
  useEffect(() => {
    if (!gameContainerRef.current) return;

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
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    gameContainerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Controls
    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;
    scene.add(controls.getObject());

    // Generate initial terrain
    generateTerrain();

    // Handle resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // Start animation loop
    animate();

    // Lock controls on click
    const handleClick = () => {
      if (controlsRef.current && !controlsRef.current.isLocked) {
        controlsRef.current.lock();
      }
    };

    document.addEventListener('click', handleClick);

    // Connect to server
    connectToServer();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleClick);
      if (rendererRef.current && gameContainerRef.current) {
        gameContainerRef.current.removeChild(rendererRef.current.domElement);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }
    };
  }, []);

  // Handle keyboard and mouse events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;

      // Toggle chat
      if (e.code === 'KeyT' && !showChat) {
        setShowChat(true);
        if (controlsRef.current) {
          controlsRef.current.unlock();
        }
        e.preventDefault();
      }

      // Close chat on Escape
      if (e.code === 'Escape' && showChat) {
        setShowChat(false);
        if (controlsRef.current) {
          controlsRef.current.lock();
        }
      }

      // Number keys for hotbar
      if (e.code.startsWith('Digit')) {
        const digit = parseInt(e.code.replace('Digit', ''), 10);
        if (digit >= 1 && digit <= 9) {
          setSelectedSlot(digit - 1);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!controlsRef.current?.isLocked || showChat) return;

      if (e.button === 0) { // Left click - break block
        const blockInfo = castRay();
        if (blockInfo) {
          removeBlock(blockInfo.position);
        }
      } else if (e.button === 2) { // Right click - place block
        const blockInfo = castRay();
        if (blockInfo) {
          // Calculate position for new block
          const normal = blockInfo.normal;
          const newPosition = blockInfo.position.clone().add(normal);
          
          // Get selected block type
          const blockTypes = Object.keys(inventory).filter(
            type => inventory[type] > 0
          );
          if (blockTypes.length > 0) {
            const selectedType = blockTypes[selectedSlot % blockTypes.length];
            placeBlock(newPosition, selectedType);
            
            // Update inventory
            setInventory(prev => ({
              ...prev,
              [selectedType]: prev[selectedType] - 1
            }));
          }
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Register events
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [showChat, selectedSlot, inventory]);

  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);
    
    // Calculate FPS
    const now = performance.now();
    frameCount.current++;
    
    if (now - fpsTime.current >= 1000) {
      setDebugInfo(prev => ({
        ...prev,
        fps: Math.round(frameCount.current / ((now - fpsTime.current) / 1000))
      }));
      frameCount.current = 0;
      fpsTime.current = now;
    }

    // Get delta time
    const delta = (now - lastTime.current) / 1000;
    lastTime.current = now;

    if (controlsRef.current && controlsRef.current.isLocked) {
      // Handle movement
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      
      if (camera) {
        // Apply gravity
        if (!playerOnGround.current) {
          playerVelocity.current.y -= GRAVITY;
        }
        
        // Handle jump
        if (keysPressed.current['Space'] && playerOnGround.current) {
          playerVelocity.current.y = JUMP_FORCE;
          playerOnGround.current = false;
        }
        
        // Move player
        const moveSpeed = MOVEMENT_SPEED * delta * 60;
        
        if (keysPressed.current['KeyW']) {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          controls.getObject().position.addScaledVector(dir, moveSpeed);
        }
        
        if (keysPressed.current['KeyS']) {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          controls.getObject().position.addScaledVector(dir, -moveSpeed);
        }
        
        if (keysPressed.current['KeyA']) {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          dir.cross(new THREE.Vector3(0, 1, 0));
          controls.getObject().position.addScaledVector(dir, moveSpeed);
        }
        
        if (keysPressed.current['KeyD']) {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          dir.cross(new THREE.Vector3(0, 1, 0));
          controls.getObject().position.addScaledVector(dir, -moveSpeed);
        }
        
        // Apply vertical movement
        controls.getObject().position.y += playerVelocity.current.y;
        
        // Floor collision
        if (controls.getObject().position.y < 1) {
          controls.getObject().position.y = 1;
          playerVelocity.current.y = 0;
          playerOnGround.current = true;
        }
        
        // Update player position on server
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          updatePlayerPosition();
        }
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          position: controls.getObject().position.clone(),
          blockLookingAt: castRay()
        }));
      }
    }
    
    // Render
    if (sceneRef.current && cameraRef.current && rendererRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  // Connect to WebSocket server
  const connectToServer = () => {
    try {
      const socket = new WebSocket('ws://localhost:8000/ws');
      
      socket.onopen = () => {
        console.log('Connected to game server');
        setIsConnected(true);
        socket.send(JSON.stringify({
          type: 'join',
          name: `Player${Math.floor(Math.random() * 1000)}`
        }));
        addChatMessage('System', 'Connected to server');
      };
      
      socket.onclose = () => {
        console.log('Disconnected from game server');
        setIsConnected(false);
        addChatMessage('System', 'Disconnected from server');
        
        // Try to reconnect after 5 seconds
        setTimeout(connectToServer, 5000);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'players':
              setPlayers(data.players);
              break;
            case 'chat':
              addChatMessage(data.sender, data.message);
              break;
            case 'block_update':
              updateBlock(data.position, data.blockType);
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      socketRef.current = socket;
    } catch (error) {
      console.error('Error connecting to server:', error);
      setIsConnected(false);
      
      // Try to reconnect after 5 seconds
      setTimeout(connectToServer, 5000);
    }
  };

  // Update player position on server
  const updatePlayerPosition = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && controlsRef.current) {
      const position = controlsRef.current.getObject().position;
      const rotation = new THREE.Euler().setFromQuaternion(cameraRef.current?.quaternion || new THREE.Quaternion());
      
      socketRef.current.send(JSON.stringify({
        type: 'position',
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
      }));
    }
  };

  // Generate terrain with sample blocks
  const generateTerrain = () => {
    if (!sceneRef.current) return;
    
    // Clear existing blocks
    blocksRef.current.forEach(block => {
      sceneRef.current?.remove(block);
    });
    blocksRef.current = [];
    
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x567D46,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    sceneRef.current.add(ground);
    
    // Add some random blocks
    const blockSize = 1;
    const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    
    // Create a small landscape
    for (let x = -10; x <= 10; x += 2) {
      for (let z = -10; z <= 10; z += 2) {
        const height = Math.floor(Math.random() * 3) + 1;
        
        for (let y = 0; y < height; y++) {
          let material;
          let blockType;
          
          if (y === height - 1) {
            // Top layer is grass
            material = new THREE.MeshStandardMaterial({ color: BLOCK_TYPES.GRASS.color });
            blockType = 'GRASS';
          } else {
            // Lower layers are dirt
            material = new THREE.MeshStandardMaterial({ color: BLOCK_TYPES.DIRT.color });
            blockType = 'DIRT';
          }
          
          const block = new THREE.Mesh(blockGeometry, material);
          block.position.set(x, y + 0.5, z);
          block.castShadow = true;
          block.receiveShadow = true;
          block.userData = { type: blockType };
          
          sceneRef.current.add(block);
          blocksRef.current.push(block);
        }
      }
    }
    
    // Add some trees
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 16) - 8;
      const z = Math.floor(Math.random() * 16) - 8;
      
      // Tree trunk
      for (let y = 0; y < 4; y++) {
        const material = new THREE.MeshStandardMaterial({ color: BLOCK_TYPES.WOOD.color });
        const block = new THREE.Mesh(blockGeometry, material);
        block.position.set(x, y + 0.5, z);
        block.castShadow = true;
        block.receiveShadow = true;
        block.userData = { type: 'WOOD' };
        
        sceneRef.current.add(block);
        blocksRef.current.push(block);
      }
      
      // Tree leaves
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = 0; dy <= 2; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) {
              const material = new THREE.MeshStandardMaterial({
                color: BLOCK_TYPES.LEAVES.color,
                transparent: BLOCK_TYPES.LEAVES.transparent,
                opacity: 0.8
              });
              const block = new THREE.Mesh(blockGeometry, material);
              block.position.set(x + dx, 4 + dy + 0.5, z + dz);
              block.castShadow = true;
              block.receiveShadow = true;
              block.userData = { type: 'LEAVES' };
              
              sceneRef.current.add(block);
              blocksRef.current.push(block);
            }
          }
        }
      }
    }
  };

  // Cast ray from camera to find block we're looking at
  const castRay = () => {
    if (!cameraRef.current || !sceneRef.current) return null;
    
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    
    raycaster.setFromCamera(center, cameraRef.current);
    
    const intersects = raycaster.intersectObjects(blocksRef.current);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      return {
        position: intersect.object.position.clone(),
        normal: intersect.face?.normal.clone() || new THREE.Vector3(),
        type: intersect.object.userData.type
      };
    }
    
    return null;
  };

  // Place a block at the given position
  const placeBlock = (position: THREE.Vector3, blockType: string) => {
    if (!sceneRef.current) return;
    
    // Check if there's already a block at this position
    const existingBlock = blocksRef.current.find(block => 
      block.position.distanceTo(position) < 0.1
    );
    
    if (existingBlock) return;
    
    // Check block type
    const type = BLOCK_TYPES[blockType];
    if (!type) return;
    
    // Create block
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: type.color,
      transparent: type.transparent,
      opacity: type.transparent ? 0.8 : 1
    });
    
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    block.position.copy(position);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData = { type: blockType };
    
    sceneRef.current.add(block);
    blocksRef.current.push(block);
    
    // Send block update to server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'block_place',
        position: { x: position.x, y: position.y, z: position.z },
        blockType
      }));
    }
  };

  // Remove a block at the given position
  const removeBlock = (position: THREE.Vector3) => {
    if (!sceneRef.current) return;
    
    // Find the block at this position
    const blockIndex = blocksRef.current.findIndex(block => 
      block.position.distanceTo(position) < 0.1
    );
    
    if (blockIndex === -1) return;
    
    // Get block type before removing
    const blockType = blocksRef.current[blockIndex].userData.type;
    
    // Remove the block
    sceneRef.current.remove(blocksRef.current[blockIndex]);
    blocksRef.current.splice(blockIndex, 1);
    
    // Add block to inventory
    setInventory(prev => ({
      ...prev,
      [blockType]: (prev[blockType] || 0) + 1
    }));
    
    // Send block update to server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'block_remove',
        position: { x: position.x, y: position.y, z: position.z }
      }));
    }
  };

  // Update a block based on server data
  const updateBlock = (position: { x: number, y: number, z: number }, blockType: string | null) => {
    const pos = new THREE.Vector3(position.x, position.y, position.z);
    
    if (blockType === null) {
      // Remove block
      removeBlock(pos);
    } else {
      // Place block
      placeBlock(pos, blockType);
    }
  };

  // Add chat message
  const addChatMessage = (sender: string, message: string) => {
    const newMessage = {
      sender,
      message,
      timestamp: Date.now()
    };
    
    setChat(prev => [...prev, newMessage]);
    
    // Auto-hide chat after 5 seconds of inactivity
    if (chatTimeoutRef.current) {
      clearTimeout(chatTimeoutRef.current);
    }
    
    chatTimeoutRef.current = setTimeout(() => {
      if (!chatInput) {
        setShowChat(false);
        if (controlsRef.current && !controlsRef.current.isLocked) {
          controlsRef.current.lock();
        }
      }
    }, 5000);
  };

  // Send chat message
  const sendChatMessage = (e: FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim()) return;
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        message: chatInput
      }));
      
      // Clear input
      setChatInput('');
    }
  };

  // Get hotbar items from inventory
  const getHotbarItems = () => {
    return Object.entries(inventory)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({ type, count }))
      .slice(0, 9);
  };

  return (
    <div className="game-view">
      <div ref={gameContainerRef} className="game-container"></div>
      
      <div className="hud">
        {/* Connection status */}
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        
        {/* Crosshair */}
        <div className="crosshair">+</div>
        
        {/* Health bar */}
        <div className="health-bar">
          <div className="health-fill" style={{ width: `${health}%` }}></div>
        </div>
        
        {/* Hotbar */}
        <div className="hotbar">
          {getHotbarItems().map((item, index) => (
            <div 
              key={index} 
              className={`hotbar-slot ${selectedSlot === index ? 'selected' : ''}`}
              onClick={() => setSelectedSlot(index)}
            >
              <div 
                className="hotbar-item" 
                style={{ backgroundColor: BLOCK_TYPES[item.type]?.color || '#CCC' }}
              ></div>
              <div className="hotbar-count">{item.count}</div>
            </div>
          ))}
        </div>
        
        {/* Debug info */}
        <div className="debug-info">
          <div>FPS: {debugInfo.fps}</div>
          <div>X: {debugInfo.position.x.toFixed(2)}</div>
          <div>Y: {debugInfo.position.y.toFixed(2)}</div>
          <div>Z: {debugInfo.position.z.toFixed(2)}</div>
          {debugInfo.blockLookingAt && (
            <div>Looking at: {debugInfo.blockLookingAt.type}</div>
          )}
        </div>
        
        {/* Chat window */}
        {showChat && (
          <div className="chat-window">
            <div className="chat-messages">
              {chat.slice(-10).map((msg, index) => (
                <div key={index} className="chat-message">
                  <span className="chat-sender">{msg.sender}: </span>
                  {msg.message}
                </div>
              ))}
            </div>
            <form className="chat-input-form" onSubmit={sendChatMessage}>
              <input
                type="text"
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                autoFocus
                placeholder="Type a message..."
              />
            </form>
          </div>
        )}
        
        {/* Controls help */}
        <div className="controls-help">
          <div>WASD: Move</div>
          <div>SPACE: Jump</div>
          <div>Left Click: Break block</div>
          <div>Right Click: Place block</div>
          <div>1-9: Select block</div>
          <div>T: Chat</div>
        </div>
      </div>
      
      <button className="exit-button" onClick={onExit}>
        Exit Game
      </button>
    </div>
  );
};

export default GameView; 