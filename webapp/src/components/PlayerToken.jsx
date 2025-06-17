import React from 'react';

export default function PlayerToken({
  photoUrl,
  indicator,
  type = 'normal',
  color,
}) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = color ? { '--side-color': color, '--border-color': color } : undefined;
  return (
    <div className={`player-token ${colorClass}`} style={style}>
      <img src={photoUrl} alt="player" className="token-top" />
      <div className="tri-cylinder">
        <div className="tri-side side-1" />
        <div className="tri-side side-2" />
        <div className="tri-side side-3" />
      </div>
      <div className="token-base">{indicator}</div>
    </div>
  );
}
