import React from 'react';

export default function PlayerToken({ photoUrl, type = 'normal' }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  return (
    <div className={`player-token ${colorClass}`}>
      <img src={photoUrl} alt="player" className="token-top" />
      <div className="hex-cylinder">
        <div className="hex-side side-1" />
        <div className="hex-side side-2" />
        <div className="hex-side side-3" />
        <div className="hex-side side-4" />
        <div className="hex-side side-5" />
        <div className="hex-side side-6" />
      </div>
    </div>
  );
}
