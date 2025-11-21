import React from 'react';
import ArcadeRacketGame from './ArcadeRacketGame.jsx';

/**
 * Thin wrapper that reuses the shared arcade racket engine so the table tennis
 * experience stays in sync with the battle-royale tennis game for ball
 * physics, camera tracking and touch controls while keeping the themed
 * presentation handled by ArcadeRacketGame.
 */
export default function TableTennis3D({ title = 'Table Tennis', stakeLabel, trainingMode = false }) {
  return (
    <ArcadeRacketGame
      mode="table"
      title={title}
      stakeLabel={stakeLabel}
      trainingMode={trainingMode}
    />
  );
}
