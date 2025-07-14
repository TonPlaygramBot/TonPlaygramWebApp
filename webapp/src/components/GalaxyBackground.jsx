import { useEffect, useRef } from 'react';

export default function GalaxyBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    let width, height;
    let stars = [];

    function randNorm() {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function init() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const bandHeight = height * 0.4;
      stars = [];
      for (let i = 0; i < 500; i++) {
        const inBand = Math.random() < 0.7;
        const x = Math.random() * width;
        const y = inBand
          ? height / 2 + randNorm() * (bandHeight / 4)
          : Math.random() * height;
        const r = Math.random() * 1.5 + 0.3;
        stars.push({ x, y, r });
      }

      draw();
    }

    function draw() {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#01020a');
      grad.addColorStop(1, '#040c1e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ffffff';
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10 pointer-events-none"
    />
  );
}
