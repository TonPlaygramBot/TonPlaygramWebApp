import React, { useCallback, useMemo, useRef, useState } from 'react';
import PoolRoyalOrbitScene from '../../components/PoolRoyalOrbitScene';
import { clamp } from '../../lib/poolCamera';

const TABLE_W = 2.84; // meters (approx 9 ft table playfield width)
const TABLE_H = 1.42; // meters
const CUE_BALL_RADIUS = 0.05715; // meters (2.25 in)

const formatSpin = (value) => value.toFixed(2);

export default function PoolRoyaleCamera() {
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const spinPadRef = useRef(null);
  const spinPointerRef = useRef({ active: false, id: -1 });

  const updateSpin = useCallback((clientX, clientY) => {
    const pad = spinPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (clientX - (rect.left + rect.width * 0.5)) / (rect.width * 0.5);
    const ny = (clientY - (rect.top + rect.height * 0.5)) / (rect.height * 0.5);
    setSpin({
      x: clamp(nx, -1, 1),
      y: clamp(-ny, -1, 1),
    });
  }, []);

  const handleSpinPointerDown = useCallback((event) => {
    event.preventDefault();
    const pad = spinPadRef.current;
    if (!pad) return;
    spinPointerRef.current = { active: true, id: event.pointerId };
    pad.setPointerCapture?.(event.pointerId);
    updateSpin(event.clientX, event.clientY);
  }, [updateSpin]);

  const handleSpinPointerMove = useCallback((event) => {
    if (!spinPointerRef.current.active || spinPointerRef.current.id !== event.pointerId) return;
    updateSpin(event.clientX, event.clientY);
  }, [updateSpin]);

  const handleSpinPointerUp = useCallback((event) => {
    if (spinPointerRef.current.id === event.pointerId) {
      const pad = spinPadRef.current;
      pad?.releasePointerCapture?.(event.pointerId);
      spinPointerRef.current = { active: false, id: -1 };
    }
  }, []);

  const spinDotStyle = useMemo(() => ({
    left: `${(spin.x * 0.5 + 0.5) * 100}%`,
    top: `${(-spin.y * 0.5 + 0.5) * 100}%`,
  }), [spin.x, spin.y]);

  return (
    <div className="flex h-full w-full flex-col bg-[#050b13] text-white">
      <div className="relative flex-1 overflow-hidden">
        <PoolRoyalOrbitScene
          className="absolute inset-0"
          tableW={TABLE_W}
          tableH={TABLE_H}
          cueBallRadius={CUE_BALL_RADIUS}
          spin={spin}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
          <span>Pool Royale</span>
          <span>Orbit Camera</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 px-4 pb-6 pt-4 text-sm">
        <div className="text-center text-xs uppercase tracking-[0.3em] text-white/60">
          Cue spin
        </div>
        <div
          ref={spinPadRef}
          className="relative h-32 w-32 rounded-full border border-white/20 bg-white/5"
          style={{ touchAction: 'none' }}
          onPointerDown={handleSpinPointerDown}
          onPointerMove={handleSpinPointerMove}
          onPointerUp={handleSpinPointerUp}
          onPointerCancel={handleSpinPointerUp}
        >
          <div
            className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5"
            style={{ left: '50%', top: '50%' }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(255,0,64,0.65)]"
            style={spinDotStyle}
          />
        </div>
        <div className="flex gap-4 text-xs text-white/70">
          <span>sx: {formatSpin(spin.x)}</span>
          <span>sy: {formatSpin(spin.y)}</span>
        </div>
      </div>
    </div>
  );
}
