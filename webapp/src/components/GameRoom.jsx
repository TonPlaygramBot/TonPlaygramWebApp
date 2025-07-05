import React from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';

export default function GameRoom({ roomId }) {
  useVoiceChat(roomId);

  return (
    <div className="game-room">
      {/* Your game UI: board, dice, etc. */}
      <button onClick={() => { /* other game logic */ }}>
        Start Game
      </button>
    </div>
  );
}
