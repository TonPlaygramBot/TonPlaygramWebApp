import { useRef, useEffect } from "react";

export default function FuturisticBackground({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#facc15";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 200; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const length = 20 + Math.random() * 80;
        const directions = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        const direction = directions[Math.floor(Math.random() * directions.length)];

        const t = Math.random() * 0.6 + 0.2;
        const r = Math.round((1 - t) * 14 + t * 250);
        const g = Math.round((1 - t) * 165 + t * 204);
        const b = Math.round((1 - t) * 233 + t * 21);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(direction) * length, y + Math.sin(direction) * length);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return <canvas ref={canvasRef} className={`absolute inset-0 -z-10 w-full h-full pointer-events-none ${className}`} />;
}
