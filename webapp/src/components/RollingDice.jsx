import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import './RollingDice.css';

const faces = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

function getRandomFace() {
  return Math.floor(Math.random() * 6);
}

function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

const RollingDice = forwardRef(function RollingDice({ onResult }, ref) {
  const [face, setFace] = useState(0);
  const [style, setStyle] = useState({});
  const rollingRef = useRef(false);
  const timerRef = useRef(null);

  const rollDice = (targetValue) => {
    if (rollingRef.current) return;
    rollingRef.current = true;
    const total = 800 + Math.random() * 700; // 800-1500ms
    const finalFace =
      typeof targetValue === 'number' && targetValue >= 1 && targetValue <= 6
        ? targetValue - 1
        : getRandomFace();
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / total, 1);
      if (progress < 1) {
        setFace(getRandomFace());
        const ease = easeOutQuad(progress);
        const rotation = (1 - ease) * 720; // spin more at start
        const scale = 1 + (1 - ease) * 0.4; // scale down towards end
        setStyle({
          transform: `rotate(${rotation}deg) scale(${scale})`,
          transition: 'transform 0.1s ease-out',
        });
        const delay = 50 + ease * 150 + Math.random() * 50;
        timerRef.current = setTimeout(() => requestAnimationFrame(animate), delay);
      } else {
        setFace(finalFace);
        setStyle({ transform: 'rotate(0deg) scale(1)', transition: 'transform 0.2s ease-out' });
        rollingRef.current = false;
        if (onResult) onResult(finalFace + 1);
      }
    };

    animate(performance.now());
  };

  useImperativeHandle(ref, () => ({ rollDice }), [rollDice]);

  useEffect(() => {
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="dice2d" style={style}>
      {faces[face]}
    </div>
  );
});

export default RollingDice;
