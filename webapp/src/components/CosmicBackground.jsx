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
    const storms = [
      { rx: 0.35, ry: 0.4, r: 160, angle: 0, color: 'rgba(20,40,80,0.5)', x: 0, y: 0 },
      { rx: 0.75, ry: 0.6, r: 120, angle: 0, color: 'rgba(180,60,20,0.4)', x: 0, y: 0 },
      { rx: Math.random(), ry: Math.random(), r: 140, angle: 0, color: 'rgba(80,20,120,0.4)', x: 0, y: 0 },
      { rx: Math.random(), ry: Math.random(), r: 130, angle: 0, color: 'rgba(30,120,200,0.35)', x: 0, y: 0 },
      { rx: Math.random(), ry: Math.random(), r: 150, angle: 0, color: 'rgba(200,200,50,0.3)', x: 0, y: 0 },
    ];

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
      storms.forEach((s) => {
        s.x = width * s.rx;
        s.y = height * s.ry;
      });
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

      storms.forEach((s) => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r);
        grad.addColorStop(0, s.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        s.angle += 0.0015;
      });

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
      <div className="absolute top-24 right-4 text-xs">🌒</div>
      <div className="absolute top-28 right-20 text-xs">🪐</div>
      <div className="absolute bottom-4 left-4 text-xs">{globe}</div>
      <div className="absolute top-32 left-1/2 -translate-x-1/2 text-xs">🌍</div>
    </div>
  );
}
