import React from 'react';

export default function PlayerToken({ photoUrl, type = 'normal', color }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = color ? { '--side-color': color, '--border-color': color } : undefined;
  return (
    <div className={`player-token ${colorClass}`} style={style}>
      <img src={photoUrl} alt="player" className="token-top" />
      <div className="token-base" />
    </div>
  );
}
