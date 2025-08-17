import { useEffect, useRef } from 'react';
import { AimGuide } from '../utils/aimGuides';

/**
 * React canvas overlay that renders aim guides for the Pool Royale 🎱 table.
 * Expects cueBall and targetBall objects with {x, y}, a power value 0..1 and
 * optional spin object {side, top}. Table should define width, height and
 * ballRadius in canvas pixels.
 */
export default function AimGuideOverlay({ cueBall, targetBall, power, spin, table }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cueBall || !targetBall) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const guide = new AimGuide(ctx, table);
    guide.update({ cueBall, targetBall, power, spin });
    guide.draw();
  }, [cueBall, targetBall, power, spin, table]);

  return (
    <canvas
      ref={canvasRef}
      width={table.width}
      height={table.height}
      className="pointer-events-none absolute top-0 left-0"
    />
  );
}
