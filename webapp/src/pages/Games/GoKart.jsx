import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { TRACKS_BY_ID } from './gokart/trackConfig.js';
import { createInputController } from './gokart/systems/createInputController.js';
import { createRaceSimulation } from './gokart/systems/createRaceSimulation.js';
import { renderRaceFrame } from './gokart/systems/renderRaceFrame.js';

export default function GoKart() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const laps = Number(params.get('laps') || 3);
  const trackId = params.get('track') || 'lighthouse';
  const mode = params.get('mode') || 'solo';

  const boardRef = useRef(null);
  const [lapCount, setLapCount] = useState(1);
  const [finished, setFinished] = useState(false);

  const track = TRACKS_BY_ID[trackId] || TRACKS_BY_ID.lighthouse;


  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas || finished) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const input = createInputController();
    const simulation = createRaceSimulation({
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      laps
    });

    let frameCount = 0;
    let raf;

    const tick = () => {
      frameCount += 1;
      const action = input.snapshot();
      const update = simulation.update(action);
      const { kart, currentLap } = simulation.getState();

      if (update.lapChanged) {
        setLapCount(currentLap);
      }

      if (update.finished) {
        setFinished(true);
        input.dispose();
        return;
      }

      renderRaceFrame({
        ctx,
        canvas,
        kart,
        trackColor: track.color,
        frameCount
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      input.dispose();
    };
  }, [laps, track.color, finished]);

  return (
    <div className="space-y-4 text-text">
      <header className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <h1 className="text-lg font-bold text-white">GoKart · {mode === 'time-attack' ? 'Time Attack' : 'Solo Race'}</h1>
        <p className="mt-1 text-xs text-slate-300">Track: {track.label} · Complete {laps} laps with steady steering.</p>
        <p className="mt-1 text-[11px] text-slate-400">Systems: input → simulation → render loop (modularized).</p>
      </header>

      <section className="rounded-2xl border border-cyan-400/30 bg-slate-950/80 p-3">
        <canvas ref={boardRef} width={680} height={320} className="w-full rounded-xl border border-white/10 bg-black" />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>Lap {Math.min(lapCount, laps)} / {laps}</span>
          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-1 text-xs"
            onClick={() => navigate('/games/gokart/lobby')}
          >
            Back to lobby
          </button>
        </div>
        {finished && (
          <div className="mt-3 rounded-xl bg-emerald-500/20 p-3 text-sm text-emerald-100">
            Race complete! Great driving.
          </div>
        )}
      </section>
    </div>
  );
}
