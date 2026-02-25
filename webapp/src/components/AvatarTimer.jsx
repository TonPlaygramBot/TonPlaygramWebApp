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
  size = 1,
  imageScale = 1,
  imageYOffset = 0,
  imageZoom = 1,
  scoreStyle = {},
  rollHistoryStyle = {},
  nameCurveRadius = 45,
}) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  const sizeRem = 3.25 * size;
  return (
    <div
      className="relative"
      style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem` }}
      onClick={onClick}
      data-player-index={index}
    >
      {isTurn && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center">
          <span
            className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-emerald-400 opacity-60"
            aria-hidden="true"
          />
          <span
            className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-emerald-300 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]"
            aria-hidden="true"
          />
          <span className="sr-only">Current turn</span>
        </span>
      )}
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
          transform: `translateY(${imageYOffset}%) scale(${imageScale * imageZoom})`,
        }}
      />
      {rank != null && (
        <span className="rank-number">{rank}</span>
      )}
      {name && (
        <svg
          className="rank-name curved-name"
          viewBox="0 0 100 50"
          style={{ color: color || '#fde047' }}
        >
          <defs>
            {(() => {
              const r = nameCurveRadius;
              const start = 50 - r;
              const end = 50 + r;
              const path = `M${start},50 A${r},${r} 0 0 1 ${end},50`;
              return <path id={`name-path-${index}`} d={path} />;
            })()}
          </defs>
          <text>
            <textPath href={`#name-path-${index}`} startOffset="50%" textAnchor="middle">
              {name}
            </textPath>
          </text>
        </svg>
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
