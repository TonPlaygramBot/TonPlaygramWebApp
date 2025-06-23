import { useRef, useEffect, useState } from 'react';

export default function CosmicBackground() {
  const canvasRef = useRef(null);
  const [globe, setGlobe] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? '🌏' : '🌎';
  });

  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    const stars = [];
    const comets = [];

    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const initScene = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      cnv.width = width * dpr;
      cnv.height = height * dpr;
      cnv.style.width = `${width}px`;
      cnv.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars.length = 0;
      for (let i = 0; i < 200; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
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

      if (Math.random() < 0.004) {
        comets.push({
          x: Math.random() * width,
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
        if (c.y > height || c.x > width) comets.splice(i, 1);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const hour = new Date().getHours();
      setGlobe(hour < 12 ? '🌏' : '🌎');
    };
    const id = setInterval(update, 60 * 60 * 1000);
    update();
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10">
      <canvas id="space-bg" ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 flex space-x-4 text-xs">🌙 🪐</div>
      <div className="absolute bottom-4 left-4 text-xs">{globe}</div>
    </div>
  );
}
