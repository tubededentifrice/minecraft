import React, { useRef, useEffect, useState, FormEvent } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import '../styles/GameView.css';
import TextureManager from '../utils/TextureManager';
import ChunkManager from '../utils/ChunkManager';
import SkyboxManager from '../utils/SkyboxManager';

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
  SAND: { id: 8, name: 'Sand', color: '#F4A460', transparent: false, solid: true },
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
    SAND: 32,
  });
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState("Day");
  const [debugInfo, setDebugInfo] = useState({
    fps: 0,
    position: new THREE.Vector3(),
    blockLookingAt: null as null | { position: THREE.Vector3, type: string },
    chunkCount: 0,
  });

  // References
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const playerVelocity = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerOnGround = useRef<boolean>(false);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const skyboxManagerRef = useRef<SkyboxManager | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const fpsTime = useRef<number>(0);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup Three.js scene
  useEffect(() => {
    if (!gameContainerRef.current) return;

    // Show loading message
    setIsLoading(true);

    // Initialize texture manager
    const textureManager = TextureManager.getInstance();
    textureManager.loadTextures().then(() => {
      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.set(0, 20, 5); // Start higher up to see terrain
      cameraRef.current = camera;

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Check if gameContainerRef is still valid when appending the renderer
      if (gameContainerRef.current) {
        gameContainerRef.current.appendChild(renderer.domElement);
      }
      
      rendererRef.current = renderer;

      // Add ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      // Create skybox and sun
      skyboxManagerRef.current = new SkyboxManager(scene);

      // Controls
      const controls = new PointerLockControls(camera, renderer.domElement);
      controlsRef.current = controls;
      scene.add(controls.getObject());

      // Initialize chunk manager
      chunkManagerRef.current = new ChunkManager(scene);
      chunkManagerRef.current.initChunks(camera.position);

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
        if (controlsRef.current && !controlsRef.current.isLocked && !showChat) {
          controlsRef.current.lock();
        }
      };

      document.addEventListener('click', handleClick);

      // Connect to server
      connectToServer();

      // Hide loading message
      setIsLoading(false);

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
    }).catch(error => {
      console.error('Error loading textures:', error);
      setIsLoading(false);
    });
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
      if (!controlsRef.current?.isLocked || showChat || !chunkManagerRef.current) return;

      const camera = cameraRef.current;
      if (!camera) return;

      // Get camera direction
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      if (e.button === 0) { // Left click - break block
        const result = chunkManagerRef.current.castRay(
          controlsRef.current.getObject().position,
          direction,
          5
        );

        if (result) {
          const { block } = result;
          const removedType = chunkManagerRef.current.removeBlock(
            block.position.x,
            block.position.y,
            block.position.z
          );
          
          if (removedType) {
            // Add to inventory
            setInventory(prev => ({
              ...prev,
              [removedType]: (prev[removedType] || 0) + 1
            }));
            
            // Send block update to server
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: 'block_remove',
                position: { 
                  x: block.position.x, 
                  y: block.position.y, 
                  z: block.position.z 
                }
              }));
            }
          }
        }
      } else if (e.button === 2) { // Right click - place block
        const result = chunkManagerRef.current.castRay(
          controlsRef.current.getObject().position,
          direction,
          5
        );

        if (result) {
          const { block, face } = result;
          
          if (face) {
            // Calculate new block position based on face normal
            const normal = face.normal;
            const newPos = new THREE.Vector3(
              block.position.x + normal.x,
              block.position.y + normal.y,
              block.position.z + normal.z
            );
            
            // Get selected block type from inventory
            const blockTypes = Object.keys(inventory).filter(
              type => inventory[type] > 0
            );
            
            if (blockTypes.length > 0) {
              const selectedType = blockTypes[selectedSlot % blockTypes.length];
              
              // Check if new position is inside player's bounding box
              const playerPos = controlsRef.current.getObject().position;
              const playerBounds = {
                min: new THREE.Vector3(playerPos.x - 0.3, playerPos.y - 1.6, playerPos.z - 0.3),
                max: new THREE.Vector3(playerPos.x + 0.3, playerPos.y + 0.2, playerPos.z + 0.3)
              };
              
              const insidePlayer = (
                newPos.x >= playerBounds.min.x && newPos.x <= playerBounds.max.x &&
                newPos.y >= playerBounds.min.y && newPos.y <= playerBounds.max.y &&
                newPos.z >= playerBounds.min.z && newPos.z <= playerBounds.max.z
              );
              
              if (!insidePlayer) {
                const success = chunkManagerRef.current.placeBlock(
                  newPos.x, newPos.y, newPos.z, selectedType
                );
                
                if (success) {
                  // Update inventory
                  setInventory(prev => ({
                    ...prev,
                    [selectedType]: prev[selectedType] - 1
                  }));
                  
                  // Send block update to server
                  if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                      type: 'block_place',
                      position: { x: newPos.x, y: newPos.y, z: newPos.z },
                      blockType: selectedType
                    }));
                  }
                }
              }
            }
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

    // Update skybox and day/night cycle
    if (skyboxManagerRef.current) {
      skyboxManagerRef.current.update(delta);
      setTimeOfDay(skyboxManagerRef.current.getTimeOfDayName());
    }

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
        
        // Check collision with blocks
        if (chunkManagerRef.current) {
          const playerPos = controls.getObject().position;
          
          // Floor collision (simplified)
          if (playerPos.y < 1) {
            playerPos.y = 1;
            playerVelocity.current.y = 0;
            playerOnGround.current = true;
          } else {
            // Check for block below
            const blockBelow = chunkManagerRef.current.getBlock(
              Math.floor(playerPos.x),
              Math.floor(playerPos.y - 1.8), // Check below feet
              Math.floor(playerPos.z)
            );
            
            playerOnGround.current = !!blockBelow;
            
            if (playerOnGround.current && playerVelocity.current.y < 0) {
              playerVelocity.current.y = 0;
            }
          }
          
          // Update chunks based on player position
          chunkManagerRef.current.update(playerPos);
          
          // Update chunk count in debug info - use internal method instead of accessing private property
          setDebugInfo(prev => ({
            ...prev,
            chunkCount: Object.keys(chunkManagerRef.current || {}).length || 0
          }));
        }
        
        // Update player position on server
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          updatePlayerPosition();
        }
        
        // Update debug info
        setDebugInfo(prev => {
          const lookingAt = getLookingAtBlock();
            
          return {
            ...prev,
            position: controls.getObject().position.clone(),
            blockLookingAt: lookingAt
          };
        });
      }
    }
    
    // Render
    if (sceneRef.current && cameraRef.current && rendererRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  // Get the block player is looking at
  const getLookingAtBlock = () => {
    if (!cameraRef.current || !chunkManagerRef.current || !controlsRef.current) return null;
    
    const direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);
    
    const result = chunkManagerRef.current.castRay(
      controlsRef.current.getObject().position, 
      direction,
      5
    );
    
    if (result) {
      return {
        position: result.block.position,
        type: result.block.type
      };
    }
    
    return null;
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
              if (chunkManagerRef.current) {
                const pos = data.position;
                
                if (data.blockType === null) {
                  chunkManagerRef.current.removeBlock(pos.x, pos.y, pos.z);
                } else {
                  chunkManagerRef.current.placeBlock(pos.x, pos.y, pos.z, data.blockType);
                }
              }
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
      {isLoading ? (
        <div className="loading-screen">
          <div className="loading-container">
            <h2>Loading Minecraft Clone...</h2>
            <div className="loading-bar-container">
              <div className="loading-bar"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={gameContainerRef} className="game-container"></div>
          
          <div className="hud">
            {/* Connection status */}
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            {/* Time of day */}
            <div className="time-of-day">
              {timeOfDay}
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
              <div>Chunks: {debugInfo.chunkCount}</div>
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
        </>
      )}
    </div>
  );
};

export default GameView; 