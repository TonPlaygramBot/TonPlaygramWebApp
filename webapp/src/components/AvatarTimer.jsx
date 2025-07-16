import React, { forwardRef } from 'react';
import { getAvatarUrl } from '../utils/avatarUtils.js';

function AvatarTimer({
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
  size = 1,
  scoreStyle = {},
  rollHistoryStyle = {},
}, ref) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  const sizeRem = 3.25 * size;
  return (
    <div
      className="relative"
      style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem` }}
      onClick={onClick}
      data-player-index={index}
      ref={ref}
    >
      {/* turn indicator removed */}
      {active && (
        <div className="avatar-timer-ring" style={{ '--timer-gradient': gradient }} />
      )}
      <img
        src={getAvatarUrl(photoUrl)}
        alt="player"
        className="rounded-full border-2 object-cover w-full h-full"
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
        <span
          className="player-score"
          style={{ color: color || '#fde047', ...scoreStyle }}
        >
          Score: {score}
        </span>
      )}
      {rollHistory && maxRolls > 0 && (
        <div
          className="roll-history"
          style={{ color: color || '#fde047', ...rollHistoryStyle }}
        >
          {Array.from({ length: maxRolls }).map((_, i) => (
            <div key={i} className="roll-box">
              {rollHistory[i] != null ? rollHistory[i] : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default forwardRef(AvatarTimer);
