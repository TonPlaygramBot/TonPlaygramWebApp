import React from 'react';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function AvatarTimer({
  photoUrl,
  active = false,
  timerPct = 1,
  rank,
  name,
  score,
  rollHistory = null,
  maxRolls = 0,
  isTurn = false,
  color,
  onClick,
  index,
}) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  return (
    <div className="relative w-[3.25rem] h-[3.25rem]" onClick={onClick} data-player-index={index}>
      {/* turn indicator removed */}
      {active && (
        <div className="avatar-timer-ring" style={{ '--timer-gradient': gradient }} />
      )}
      <img
        src={getAvatarUrl(photoUrl)}
        alt="player"
        className="w-[3.25rem] h-[3.25rem] rounded-full border-2 object-cover"
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
      {rollHistory && maxRolls > 0 && (
        <div className="roll-history" style={{ color: color || '#fde047' }}>
          {Array.from({ length: maxRolls }).map((_, i) => (
            <div key={i} className="roll-box">
              {rollHistory[i] != null ? rollHistory[i] : ''}
            </div>
          ))}
        </div>
      )}
      {score != null && (
        <span className="player-score" style={{ color: color || '#fde047' }}>
          Score: {score}
        </span>
      )}
    </div>
  );
}
