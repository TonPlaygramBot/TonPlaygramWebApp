import { useEffect, useRef, useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getPoolRoyaleCalibration,
  savePoolRoyaleCalibration
} from '../../utils/api.js';

export default function PoolRoyaleCalibration() {
  useTelegramBackButton();
  const [dims, setDims] = useState({ width: 1000, height: 2000, bgWidth: 0, bgHeight: 0, bgX: 0, bgY: 0 });
  const [pockets, setPockets] = useState([
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.05, y: 0.5 },
    { x: 0.95, y: 0.5 },
    { x: 0.05, y: 0.95 },
    { x: 0.95, y: 0.95 }
  ]);
  const containerRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPoolRoyaleCalibration();
        if (!res.error) {
          if (res.width) {
            setDims({
              width: res.width,
              height: res.height,
              bgWidth: res.bgWidth,
              bgHeight: res.bgHeight,
              bgX: res.bgX,
              bgY: res.bgY
            });
          }
          if (Array.isArray(res.pockets)) {
            const np = res.pockets.map(p => ({
              x: p.x / res.width,
              y: p.y / res.height
            }));
            if (np.length === 6) setPockets(np);
          }
        }
      } catch {}
    }
    load();
  }, []);

  function updatePocket(i, clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setPockets(prev => prev.map((p, idx) => (idx === i ? { x, y } : p)));
  }

  function handlePointerDown(i, e) {
    e.preventDefault();
    const move = ev => updatePocket(i, ev.clientX, ev.clientY);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  async function save() {
    const numeric = pockets.map(p => ({ x: Math.round(p.x * dims.width), y: Math.round(p.y * dims.height) }));
    try {
      await savePoolRoyaleCalibration(
        dims.width,
        dims.height,
        dims.bgWidth,
        dims.bgHeight,
        dims.bgX,
        dims.bgY,
        numeric
      );
      alert('Calibration saved');
    } catch {}
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black">
      <img
        src="/assets/icons/64e79228-35e3-4fdc-b914-fca635a40220.webp"
        className="w-full h-full object-cover pointer-events-none"
        alt="table"
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
        <polygon
          points={pockets.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="lime"
          strokeWidth="0.005"
        />
      </svg>
      {pockets.map((p, i) => (
        <div
          key={i}
          className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transform: 'translate(-50%, -50%)'
          }}
          onPointerDown={e => handlePointerDown(i, e)}
        />
      ))}
      <button
        onClick={save}
        className="absolute bottom-4 right-4 bg-primary text-background px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}

