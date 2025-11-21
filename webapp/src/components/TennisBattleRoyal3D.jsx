import React from 'react';
import ArcadeRacketGame from './ArcadeRacketGame.jsx';

/**
 * Thin wrapper to ensure the battle royal tennis experience uses the same
 * core ball physics, camera tracking, and touch controls as the table tennis
 * variant by delegating to the shared ArcadeRacketGame engine.
 */
export default function TennisBattleRoyal3D({
  playerName,
  stakeLabel,
  trainingMode = false,
  title = 'Tennis Battle Royal',
}) {
  return (
    <ArcadeRacketGame
      mode="tennis"
      title={playerName ? `${playerName} vs AI` : title}
      stakeLabel={stakeLabel}
      trainingMode={trainingMode}
    />
  );
}
