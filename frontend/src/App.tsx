import React, { useState } from 'react';
import './App.css';
import './styles/HomePage.css';
import './styles/GameView.css';

// Instead of importing from components, let's define them directly
// to troubleshoot the 404 issue
const HomePage: React.FC<{ onStartGame: () => void }> = ({ onStartGame }) => {
  return (
    <div className="home-page">
      <div className="home-content">
        <h1 className="title">Minecraft Clone</h1>
        <div className="description">
          <p>A browser-based Minecraft clone built with Three.js and Rust</p>
          <p>Explore a procedurally generated world, build structures, and survive!</p>
        </div>
        
        <div className="buttons">
          <button className="start-button" onClick={onStartGame}>
            Start Game
          </button>
          <button className="settings-button">
            Settings
          </button>
        </div>
        
        <div className="features">
          <div className="feature">
            <h3>Voxel World</h3>
            <p>Explore a fully interactive 3D voxel world</p>
          </div>
          <div className="feature">
            <h3>Build & Craft</h3>
            <p>Gather resources and build amazing structures</p>
          </div>
          <div className="feature">
            <h3>Multiplayer</h3>
            <p>Play with friends in a shared world</p>
          </div>
        </div>
      </div>
      
      <footer className="footer">
        <p>© 2025 Minecraft Clone Project</p>
        <p>Not affiliated with Mojang or Microsoft</p>
      </footer>
    </div>
  );
};

const GameView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  return (
    <div className="game-view">
      <div className="game-container"></div>
      
      <div className="hud">
        <div className="crosshair">+</div>
        <div className="hotbar">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="hotbar-slot"></div>
          ))}
        </div>
      </div>
      
      <button className="exit-button" onClick={onExit}>
        Exit Game
      </button>
    </div>
  );
};

function App() {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="app">
      {!gameStarted ? (
        <HomePage onStartGame={() => setGameStarted(true)} />
      ) : (
        <GameView onExit={() => setGameStarted(false)} />
      )}
    </div>
  );
}

export default App; 