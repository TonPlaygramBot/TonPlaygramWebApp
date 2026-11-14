import React, {
  useEffect,
  useRef,
  useState,
  type MutableRefObject
} from 'react';
import { JetskiRenderer, type Quality, type CameraMode } from './renderer';
import { type Racer, type Track } from './simulation.mjs';
import { type GhostPose } from './ghost';

export interface World {
  racers: Racer[];
  playerId: string;
  elapsed: number;
  camera: CameraMode;
  preview: boolean;
  paused: boolean;
  ghost?: GhostPose | null;
}
export default function Scene({
  track,
  quality,
  day,
  world,
  onReady,
  onFrame
}: {
  track: Track;
  quality: Quality;
  day: 'day' | 'sunset';
  world: MutableRefObject<World>;
  onReady?: () => void;
  onFrame?: (dt: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onReady, onFrame });
  callbacks.current = { onReady, onFrame };
  const [loading, setLoading] = useState('Preparing the course…'),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false,
      frame = 0,
      view: JetskiRenderer | undefined,
      previous = 0,
      visualTime = 0;
    setLoading('Preparing the course…');
    setError('');
    const lost = (e: Event) => {
      e.preventDefault();
      if (!stopped)
        setError(
          'Graphics paused by your device. Tap Reload graphics to continue.'
        );
    };
    const run = async () => {
      try {
        view = new JetskiRenderer(host.current!, track, quality, day);
        view.renderer.domElement.addEventListener('webglcontextlost', lost);
        await view.load((s) => {
          if (!stopped) setLoading(s);
        });
        if (stopped) return;
        setLoading('');
        callbacks.current.onReady?.();
        const tick = (now: number) => {
          if (stopped) return;
          const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 1 / 60;
          previous = now;
          if (!document.hidden) {
            callbacks.current.onFrame?.(dt);
            const w = world.current;
            if (!w.paused) visualTime += dt;
            view!.update(
              w.racers,
              w.playerId,
              w.preview ? visualTime : w.elapsed,
              dt,
              w.camera,
              w.preview,
              w.ghost
            );
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : 'WebGL could not start on this device.'
          );
      }
    };
    void run();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      view?.renderer.domElement.removeEventListener('webglcontextlost', lost);
      view?.dispose();
    };
  }, [track, quality, day, retry, world]);
  return (
    <div className="jsr-world" ref={host}>
      {loading && !error && (
        <div className="jsr-loading">
          <span className="jsr-spinner" />
          <strong>{loading}</strong>
        </div>
      )}
      {error && (
        <div className="jsr-loading" role="alert">
          <strong>Let’s get back on the water</strong>
          <p>{error}</p>
          <button
            className="jsr-primary"
            onClick={() => setRetry((v) => v + 1)}
          >
            Reload graphics
          </button>
        </div>
      )}
    </div>
  );
}
