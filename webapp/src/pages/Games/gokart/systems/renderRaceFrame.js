export function renderRaceFrame({ ctx, canvas, kart, trackColor, frameCount }) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = trackColor;
  ctx.fillRect(20, 32, canvas.width - 40, canvas.height - 64);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(40, canvas.height / 2);
  ctx.lineTo(canvas.width - 40, canvas.height / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(kart.x - 12, kart.y - 8, kart.width, kart.height);
  ctx.fillStyle = '#111827';
  ctx.fillRect(kart.x - 8, kart.y - 14, 16, 6);

  const pulse = 2 + Math.sin(frameCount / 6) * 1.5;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(kart.x - 16, kart.y, pulse, 0, Math.PI * 2);
  ctx.fill();
}
