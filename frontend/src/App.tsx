import React, { useState } from 'react';
import './App.css';
import './styles/HomePage.css';
import './styles/GameView.css';
import GameView from './components/GameView';
import HomePage from './components/HomePage';

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