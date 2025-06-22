import React, { useMemo } from 'react';

export default function CosmicBackground({ full = false }) {
  const starCount = full ? 80 : 40;
  const cometCount = full ? 3 : 2;

  const stars = useMemo(() => {
    return Array.from({ length: starCount }).map(() => ({
      top: Math.random() * (full ? 100 : 40),
      left: Math.random() * 100,
      size: 1 + Math.random() * 2,
      dur: 1.5 + Math.random() * 2,
      delay: Math.random() * 5,
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, [starCount, full]);

  const comets = useMemo(() => {
    return Array.from({ length: cometCount }).map(() => ({
      top: Math.random() * (full ? 100 : 40),
      left: Math.random() * 100,
      dur: 6 + Math.random() * 4,
      delay: Math.random() * 10,
      dir: Math.random() > 0.5 ? 'right' : 'left',
    }));
  }, [cometCount, full]);

  return (
    <div className={`cosmic-bg ${full ? 'full' : 'top-only'}`}>
      {stars.map((s, i) => (
        <span
          key={`star-${i}`}
          className="star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
          }}
        />
      ))}
      {comets.map((c, i) => (
        <span
          key={`comet-${i}`}
          className={`comet move-${c.dir}`}
          style={{
            top: `${c.top}%`,
            left: `${c.left}%`,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
