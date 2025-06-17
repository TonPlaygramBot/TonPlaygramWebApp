import React from 'react';

export default function PlayerToken({ photoUrl, type = 'normal', color }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = color ? { '--side-color': color, '--border-color': color } : undefined;
  return (
    <div className={`player-token ${colorClass}`} style={style}>
      <div className="dice-token">
        <div className="dice-face dice-face--front" />
        <div className="dice-face dice-face--back" />
        <div className="dice-face dice-face--right" />
        <div className="dice-face dice-face--left" />
        <img src={photoUrl} alt="player" className="dice-face dice-face--top token-photo" />
        <div className="dice-face dice-face--bottom" />
      </div>
    </div>
  );
}
