import React from 'react';

export default function PlayerToken({ photoUrl, type = 'normal', color, angle }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = {
    ...(color ? { '--side-color': color, '--border-color': color } : {}),
    ...(angle !== undefined ? { '--board-angle': `${angle}deg` } : {}),
  };

  return (
    <div className={`token-cube ${colorClass}`} style={style}>
      <div className="token-cube-inner">
        <img src={photoUrl} alt="player" className="cube-face cube-top" />
        <div className="cube-face cube-bottom" />
        <div className="cube-face cube-front" />
        <div className="cube-face cube-back" />
        <div className="cube-face cube-right" />
        <div className="cube-face cube-left" />
      </div>
    </div>
  );
}
