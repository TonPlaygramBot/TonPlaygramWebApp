import { useRef, useEffect } from 'react';

export default function FuturisticBackground({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgb(255,200,0)');
      grad.addColorStop(1, 'rgb(10,15,30)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      for (let i = 0; i < 100; i++) {
        const x = width / 2 + (Math.random() - 0.5) * (2 * width / 3);
        const y = Math.random() * height;
        const len = 20 + Math.random() * 80;
        const dirs = [Math.PI / 2, -Math.PI / 2, 0, Math.PI];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(50,200,255,0.6)' : 'rgba(255,180,100,0.5)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,150,0.4)';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none -z-10 ${className}`} />;
}
