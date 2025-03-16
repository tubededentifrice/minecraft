import React, { useRef, useEffect, useState, FormEvent, useCallback } from 'react';
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

// Performance constants
const MOVEMENT_SPEED = 0.15;
const GRAVITY = 0.01;
const JUMP_FORCE = 0.3;
const DEBUG_UPDATE_INTERVAL = 250; // ms between debug info updates
const POSITION_UPDATE_INTERVAL = 500; // ms between position updates to server

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
  
  // References for optimization
  const debugUpdateTimeRef = useRef<number>(0);
  const positionUpdateTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number>(0);
  const fpsUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized functions for better performance
  const updateDebugInfo = useCallback((
    fps: number, 
    position: THREE.Vector3, 
    blockLookingAt: { position: THREE.Vector3, type: string } | null,
    chunkCount: number
  ) => {
    setDebugInfo({
      fps,
      position,
      blockLookingAt,
      chunkCount
    });
  }, []);

  // Setup Three.js scene
  useEffect(() => {
    console.log('GameView: Initializing game scene');
    
    // Show loading message
    setIsLoading(true);
    
    // Set a maximum loading time - force hide loading screen after 5 seconds 
    const maxLoadingTimeout = setTimeout(() => {
      setIsLoading(false);
      console.log('GameView: Forced loading to complete due to timeout');
    }, 5000);

    // Ensure that we don't attempt to initialize until the DOM is ready
    const initializeGame = () => {
      if (!gameContainerRef.current) {
        console.log('GameView: Game container ref not ready, waiting...');
        // Wait a short time and check again
        setTimeout(initializeGame, 100);
        return;
      }

      try {
        console.log('GameView: Game container ref is ready, proceeding with initialization');
        // Initialize texture manager
        console.log('GameView: Initializing TextureManager');
        const textureManager = TextureManager.getInstance();
        textureManager.loadTextures()
          .then(() => {
            try {
              console.log('GameView: Textures loaded, creating 3D scene');
              // Create scene
              const scene = new THREE.Scene();
              sceneRef.current = scene;
              scene.background = new THREE.Color(0x87CEEB); // Set a sky blue background

              // Create camera
              console.log('GameView: Creating camera');
              const camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
              );
              camera.position.set(0, 20, 5); // Start higher up to see terrain
              cameraRef.current = camera;

              // Create renderer with optimized settings
              console.log('GameView: Creating renderer');
              const renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                powerPreference: 'high-performance',
                precision: 'mediump' // medium precision for better performance
              });
              renderer.setSize(window.innerWidth, window.innerHeight);
              renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for better performance
              renderer.shadowMap.enabled = true;
              renderer.shadowMap.type = THREE.PCFSoftShadowMap;
              
              // Enable performance optimizations
              THREE.Cache.enabled = true;
              
              // Double-check gameContainerRef is still valid before appending
              if (!gameContainerRef.current) {
                throw new Error('GameView: Game container is no longer available');
              }
              
              console.log('GameView: Appending renderer to DOM');
              gameContainerRef.current.innerHTML = ''; // Clear any previous contents
              gameContainerRef.current.appendChild(renderer.domElement);
              
              rendererRef.current = renderer;

              // Add ambient light
              console.log('GameView: Adding ambient light');
              const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
              scene.add(ambientLight);

              // Create skybox and sun
              console.log('GameView: Creating skybox');
              skyboxManagerRef.current = new SkyboxManager(scene);

              // Controls
              console.log('GameView: Setting up controls');
              const controls = new PointerLockControls(camera, renderer.domElement);
              controlsRef.current = controls;
              scene.add(controls.getObject());

              // Initialize chunk manager
              console.log('GameView: Initializing chunk manager');
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
              // Ensure initial sizing is correct
              handleResize();

              // Start animation loop
              console.log('GameView: Starting animation loop');
              animate();

              // Lock controls on click
              const handleClick = () => {
                if (controlsRef.current && !controlsRef.current.isLocked && !showChat) {
                  controlsRef.current.lock();
                }
              };

              document.addEventListener('click', handleClick);

              // Connect to server
              console.log('GameView: Connecting to server');
              connectToServer();

              // Hide loading message
              console.log('GameView: Initialization complete, hiding loading screen');
              setIsLoading(false);
              clearTimeout(maxLoadingTimeout);

              // Cleanup
              return () => {
                console.log('GameView: Cleaning up');
                window.removeEventListener('resize', handleResize);
                document.removeEventListener('click', handleClick);
                
                // Cancel animation frame
                if (animationFrameIdRef.current) {
                  cancelAnimationFrame(animationFrameIdRef.current);
                }
                
                // Clear all timeouts
                if (chatTimeoutRef.current) {
                  clearTimeout(chatTimeoutRef.current);
                }
                if (fpsUpdateTimeoutRef.current) {
                  clearTimeout(fpsUpdateTimeoutRef.current);
                }
                
                // Dispose of Three.js resources
                if (rendererRef.current) {
                  rendererRef.current.dispose();
                  
                  if (gameContainerRef.current) {
                    try {
                      gameContainerRef.current.removeChild(rendererRef.current.domElement);
                    } catch (e) {
                      console.warn('GameView: Could not remove renderer from DOM:', e);
                    }
                  }
                }
                
                // Dispose of Three.js scene
                if (sceneRef.current) {
                  disposeScene(sceneRef.current);
                }
                
                // Close WebSocket
                if (socketRef.current) {
                  socketRef.current.close();
                }
                
                clearTimeout(maxLoadingTimeout);
              };
            } catch (error) {
              console.error('GameView: Error during scene setup:', error);
              setIsLoading(false);
              clearTimeout(maxLoadingTimeout);
              return () => {
                clearTimeout(maxLoadingTimeout);
              };
            }
          })
          .catch(error => {
            console.error('GameView: Error loading textures:', error);
            setIsLoading(false);
            clearTimeout(maxLoadingTimeout);
          });
      } catch (error) {
        console.error('GameView: Critical initialization error:', error);
        setIsLoading(false);
        clearTimeout(maxLoadingTimeout);
      }
    };

    // Start the initialization process
    initializeGame();
    
    return () => {
      console.log('GameView: Component unmounting, cleaning up loadingTimeout');
      clearTimeout(maxLoadingTimeout);
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

  // Animation loop with optimizations
  const animate = () => {
    animationFrameIdRef.current = requestAnimationFrame(animate);
    
    // Calculate FPS
    const now = performance.now();
    frameCount.current++;
    
    if (now - fpsTime.current >= 1000) {
      const fps = Math.round(frameCount.current / ((now - fpsTime.current) / 1000));
      frameCount.current = 0;
      fpsTime.current = now;
      
      // Update FPS display less frequently to reduce React state updates
      if (fpsUpdateTimeoutRef.current) {
        clearTimeout(fpsUpdateTimeoutRef.current);
      }
      
      fpsUpdateTimeoutRef.current = setTimeout(() => {
        setDebugInfo(prev => ({
          ...prev,
          fps
        }));
      }, 250);
    }

    // Get delta time
    const delta = (now - lastTime.current) / 1000;
    lastTime.current = now;

    // Update skybox and day/night cycle
    if (skyboxManagerRef.current) {
      skyboxManagerRef.current.update(delta);
      
      // Update time of day display less frequently
      if (now - debugUpdateTimeRef.current > DEBUG_UPDATE_INTERVAL) {
        setTimeOfDay(skyboxManagerRef.current.getTimeOfDayName());
      }
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
          
          // Update player position on server at a reduced rate
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN &&
              now - positionUpdateTimeRef.current > POSITION_UPDATE_INTERVAL) {
            updatePlayerPosition();
            positionUpdateTimeRef.current = now;
          }
          
          // Update debug info at a reduced rate
          if (now - debugUpdateTimeRef.current > DEBUG_UPDATE_INTERVAL) {
            debugUpdateTimeRef.current = now;
            
            const lookingAt = getLookingAtBlock();
            const chunkCount = chunkManagerRef.current.getChunkCount();
            
            updateDebugInfo(
              debugInfo.fps, 
              controls.getObject().position.clone(),
              lookingAt,
              chunkCount
            );
          }
        }
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
      // Create a mock WebSocket for offline play
      const mockWebSocket = () => {
        // Create a mock WebSocket instance
        const mockWs = {
          readyState: WebSocket.OPEN,
          send: (message: string) => {
            console.log('Mock WebSocket message sent:', message);
            
            // For chat messages, echo them back
            try {
              const data = JSON.parse(message);
              if (data.type === 'chat') {
                // Simulate receiving the message back
                setTimeout(() => {
                  addChatMessage('You', data.message);
                }, 100);
              }
            } catch (e) {
              console.error('Error parsing message:', e);
            }
          },
          close: () => {
            console.log('Mock WebSocket closed');
          },
        };
        
        // Simulate connection success
        setTimeout(() => {
          setIsConnected(true);
          addChatMessage('System', 'Playing in offline mode. Server not available.');
        }, 500);
        
        return mockWs;
      };
      
      // Try to connect to real server first
      console.log('Attempting to connect to game server...');
      
      // First try with real WebSocket
      const socket = new WebSocket('ws://localhost:8000/ws');
      let connectionTimeout: NodeJS.Timeout;
      
      socket.onopen = () => {
        console.log('Connected to game server');
        clearTimeout(connectionTimeout);
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
      
      // Set a timeout to switch to mock socket if real connection fails
      connectionTimeout = setTimeout(() => {
        console.log('Connection timed out, switching to offline mode');
        socket.close();
        socketRef.current = mockWebSocket() as any;
      }, 3000);
      
      socketRef.current = socket;
    } catch (error) {
      console.error('Error connecting to server:', error);
      setIsConnected(false);
      
      // Use mock WebSocket for offline mode
      console.log('Switching to offline mode');
      socketRef.current = {
        readyState: WebSocket.OPEN,
        send: (message: string) => {
          console.log('Mock message:', message);
        },
        close: () => {}
      } as any;
      
      // Set connected after a delay to simulate connection
      setTimeout(() => {
        setIsConnected(true);
        addChatMessage('System', 'Playing in offline mode. Server not available.');
      }, 500);
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

  // Helper function to dispose Three.js objects
  const disposeScene = (scene: THREE.Scene) => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => disposeMaterial(material));
          } else {
            disposeMaterial(object.material);
          }
        }
      }
    });
  };
  
  // Helper to dispose materials
  const disposeMaterial = (material: THREE.Material) => {
    // Use appropriate casting for materials with textures
    if (material instanceof THREE.MeshStandardMaterial || 
        material instanceof THREE.MeshBasicMaterial || 
        material instanceof THREE.MeshPhongMaterial) {
      if (material.map) material.map.dispose();
    }
    
    // Cast for other material properties
    const mat = material as any;
    if (mat.lightMap) mat.lightMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.specularMap) mat.specularMap.dispose();
    if (mat.envMap) mat.envMap.dispose();
    
    material.dispose();
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
          <div 
            ref={gameContainerRef} 
            className="game-container"
            style={{ width: '100%', height: '100%' }}
          ></div>
          
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