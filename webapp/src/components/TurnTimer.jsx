import { useEffect, useRef } from 'react';
import { tickSound } from '../assets/soundData.js';

export default function TurnTimer({ photoUrl, timeLeft, total = 15 }) {
  const tickRef = useRef(null);

  useEffect(() => {
    if (!tickRef.current) {
      tickRef.current = new Audio(tickSound);
      tickRef.current.preload = 'auto';
    }
    if (timeLeft <= 5 && timeLeft > 0) {
      tickRef.current.currentTime = 0;
      tickRef.current.play().catch(() => {});
    }
  }, [timeLeft]);

  const pct = Math.max(timeLeft / total, 0);
  const deg = pct * 360;
  const style = {
    background: `conic-gradient(#16a34a ${deg}deg, #facc15 0)`
  };

  return (
    <div className="timer-ring" style={style}>
      <img src={photoUrl} alt="avatar" className="timer-avatar" />
    </div>
  );
}
