import React from 'react';

export default function AvatarTimer({ photoUrl, active = false, timerPct = 1 }) {
  const angle = (1 - timerPct) * 360;
  const gradient = `conic-gradient(#facc15 ${angle}deg, #16a34a 0deg)`;
  return (
    <div className="relative w-12 h-12">
      {active && (
        <div className="avatar-timer-ring" style={{ '--timer-gradient': gradient }} />
      )}
      <img
        src={photoUrl}
        alt="player"
        className="w-12 h-12 rounded-full border border-yellow-400 object-cover"
      />
    </div>
  );
}
