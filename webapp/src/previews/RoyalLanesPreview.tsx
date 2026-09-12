import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoyalLanesGame } from '../games/royallanes/Game';
function Preview() {
  const [round, setRound] = React.useState(0);
  return (
    <RoyalLanesGame
      key={round}
      mode="ai"
      playerName="You"
      difficulty="club"
      onExit={() => setRound((n) => n + 1)}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
