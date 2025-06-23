import { useRef, useEffect } from 'react';

export default function CosmicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    const resize = () => {
      cnv.width = window.innerWidth;
      cnv.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * cnv.width,
      y: Math.random() * cnv.height,
      r: Math.random() * 1.5 + 0.5,
      hue: Math.random() * 360,
    }));
    const planets = [
      { x: 150, y: 300, r: 30, c: 'rgba(0,200,255,0.15)' },
      { x: cnv.width - 120, y: 200, r: 40, c: 'rgba(255,200,0,0.12)' },
    ];
    const comets = [];

    let frameId;
    const draw = () => {
      ctx.clearRect(0, 0, cnv.width, cnv.height);

      stars.forEach((s) => {
        s.hue = (s.hue + 0.3) % 360;
        const color = `hsl(${s.hue} 100% 80%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fill();
      });

      planets.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 50;
        ctx.fill();
      });

      if (Math.random() < 0.01) {
        comets.push({
          x: Math.random() * cnv.width,
          y: -10,
          vx: Math.random() * 1 + 1,
          vy: Math.random() * 1 + 2,
          len: Math.random() * 30 + 20,
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
        if (c.y > cnv.height) comets.splice(i, 1);
      }

      frameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      id="space-bg"
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none -z-10"
    />
  );
}
