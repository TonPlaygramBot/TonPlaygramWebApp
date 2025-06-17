import React from 'react';

// Simple cube used as the player's token on the Snake & Ladder board
export default function PlayerToken() {
  return (
    <div className="player-dice">
      <div className="dice-face dice-front" />
      <div className="dice-face dice-back" />
      <div className="dice-face dice-right" />
      <div className="dice-face dice-left" />
      <div className="dice-face dice-top" />
      <div className="dice-face dice-bottom" />
    </div>
  );
}
