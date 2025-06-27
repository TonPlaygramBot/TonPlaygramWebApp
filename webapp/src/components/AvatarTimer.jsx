import React from 'react';

export default function AvatarTimer({ photoUrl, active = false, timerPct = 1, rank, name, isTurn = false, color }) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  return (
    <div className="relative w-10 h-10">
      {active && (
        <div className="avatar-timer-ring" style={{ '--timer-gradient': gradient }} />
      )}
      <img
        src={photoUrl}
        alt="player"
        className="w-10 h-10 rounded-full border-2 object-cover"
        style={{ borderColor: color || '#fde047' }}
      />
      {isTurn && (
        <span className="turn-indicator">👈</span>
      )}
      {rank != null && (
        <span className="rank-number">{rank}</span>
      )}
      {name && (
        <span className="rank-name" style={{ color: active ? '#4ade80' : undefined }}>
          {name}
        </span>
      )}
    </div>
  );
}
