import React, { useState } from 'react';
import './App.css';
import './styles/HomePage.css';
import './styles/GameView.css';
import HomePage from './components/HomePage';
import GameView from './components/GameView';

// Import our actual component implementations instead of using inline versions

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