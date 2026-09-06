import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BowlingGame from './Game';
import BowlingLobby from './Lobby';
import type { Launch } from './types';

function Preview() {
  const [difficulty, setDifficulty] = useState(1),
    [launch, setLaunch] = useState<Launch | null>(null);
  return launch ? (
    <BowlingGame launch={launch} onLobby={() => setLaunch(null)} />
  ) : (
    <BowlingLobby
      preview
      mode="ai"
      onMode={() => {}}
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      onStart={() => setLaunch({ mode: 'ai', difficulty })}
    />
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);
