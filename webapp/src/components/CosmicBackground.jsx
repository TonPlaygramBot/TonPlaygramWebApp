import { useRef, useEffect } from 'react';

export default function CosmicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    const stars = [];
    const comets = [];

    const initScene = () => {
      cnv.width = window.innerWidth;
      cnv.height = window.innerHeight;

      stars.length = 0;
      for (let i = 0; i < 200; i++) {
        stars.push({
          x: Math.random() * cnv.width,
          y: Math.random() * cnv.height,
          r: Math.random() * 1.5 + 0.5,
          hue: Math.random() * 360,
          colorChange: i < 2,
        });
      }
    };

    const resize = () => initScene();
    window.addEventListener('resize', resize);
    initScene();

    let frameId;
    const draw = () => {
      ctx.fillStyle = '#0c1020';
      ctx.fillRect(0, 0, cnv.width, cnv.height);

      stars.forEach((s) => {
        let color = '#fff';
        if (s.colorChange) {
          s.hue = (s.hue + 0.2) % 360;
          color = `hsl(${s.hue} 100% 80%)`;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
      });

      if (Math.random() < 0.01) {
        comets.push({
          x: Math.random() * cnv.width,
          y: -20,
          vx: Math.random() * 2 + 2,
          vy: Math.random() * 2 + 2,
          len: Math.random() * 40 + 30,
        });
      }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x - c.vx * c.len, c.y - c.vy * c.len);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        c.x += c.vx;
        c.y += c.vy;
        if (c.y > cnv.height || c.x > cnv.width) comets.splice(i, 1);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      id="space-bg"
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
