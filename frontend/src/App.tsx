import React, { useState } from 'react';
import HomePage from './components/HomePage';
import GameView from './components/GameView';
import './App.css';

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