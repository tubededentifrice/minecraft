import React from 'react';
import '../styles/HomePage.css';

interface HomePageProps {
  onStartGame: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStartGame }) => {
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

export default HomePage; 