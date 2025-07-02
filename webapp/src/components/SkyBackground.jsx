import { useEffect, useRef } from 'react';

export default function SkyBackground() {
  const planes = useRef([]);

  useEffect(() => {
    const elems = planes.current;
    elems.forEach((plane, i) => {
      const startY = i % 2 === 0 ? '30vh' : '60vh';
      plane.style.top = startY;
      plane.style.left = '-50px';
      plane.style.animation = `fly-${i} 20s linear infinite`;
    });
  }, []);

  return (
    <div className="sky-container fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div className="sky-background absolute inset-0" />
      {[0, 1].map((n) => (
        <div
          key={n}
          ref={(el) => (planes.current[n] = el)}
          className="plane absolute text-3xl"
          aria-label="airplane"
        >
          ✈
          <div className="trail left"></div>
          <div className="trail right"></div>
        </div>
      ))}
    </div>
  );
}
