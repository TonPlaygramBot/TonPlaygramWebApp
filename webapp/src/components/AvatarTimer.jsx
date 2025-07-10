import React from 'react';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function AvatarTimer({
  photoUrl,
  active = false,
  timerPct = 1,
  rank,
  name,
  score,
  isTurn = false,
  color,
  onClick,
  index,
}) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  return (
    <div className="relative w-9 h-9" onClick={onClick} data-player-index={index}>
      {active && (
        <div className="avatar-timer-ring" style={{ '--timer-gradient': gradient }} />
      )}
      <img
        src={getAvatarUrl(photoUrl)}
        alt="player"
        className="w-9 h-9 rounded-full border-2 object-cover"
        style={{
          borderColor: color || '#fde047',
          boxShadow: isTurn ? `0 0 6px ${color || '#fde047'}` : undefined,
        }}
      />
      {rank != null && (
        <span className="rank-number">{rank}</span>
      )}
      {name && (
        <span className="rank-name" style={{ color: color || '#fde047' }}>
          {name}
        </span>
      )}
      {score != null && (
        <span className="player-score" style={{ color: color || '#fde047' }}>
          Score: {score}
        </span>
      )}
    </div>
  );
}
