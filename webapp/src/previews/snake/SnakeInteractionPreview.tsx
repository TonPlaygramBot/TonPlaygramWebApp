import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { SNAKE_DICE_PRESENTATION_MS, SNAKE_DICE_READ_MS } from '../../utils/snakeDiceInteraction';
import { createSnakeInteractionScene, REVIEW_WEAPONS } from './interactionScene';
declare const SNAKE_PREVIEW_ASSETS: string;

async function decodeAssets() {
  const bytes = Uint8Array.from(atob(SNAKE_PREVIEW_ASSETS), char => char.charCodeAt(0));
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
function App() {
  const host = useRef<HTMLDivElement>(null), actions = useRef<any>(null);
  const [seat, setSeat] = useState(0), [gun, setGun] = useState(REVIEW_WEAPONS[0]);
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [loop, setLoop] = useState(false);
  const [status, setStatus] = useState('Loading…'), [progress, setProgress] = useState(0);
  const loopRef = useRef(loop); loopRef.current = loop;
  useEffect(() => {
    let dead = false, raf = 0, cleanup = () => {};
    setReady(false); setPlaying(false);
    decodeAssets().then(assets => {
      if (dead) return;
      const review = createSnakeInteractionScene(assets, seat, gun), element = host.current!;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMappingExposure = 1.3;
      element.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', 'Snake and Ladder seated character: dice pickup and two-handed firearm grip');
      let startTime = 0, elapsed = 0, total = 0, running = false, kind = 'dice', pauseTime = 0;
      const resize = () => { const w = element.clientWidth, h = Math.min(480, Math.max(390, w * 1.22)); renderer.setSize(w, h); review.camera.aspect = w / h; review.camera.updateProjectionMatrix(); };
      const observer = new ResizeObserver(resize); observer.observe(element); resize();
      const start = (next: string) => { kind = next; total = review.start(kind); elapsed = 0; startTime = performance.now(); running = true; setPlaying(true); setProgress(0); };
      actions.current = { start, result() {
          kind = 'dice'; total = review.start(kind); running = false; setPlaying(false); elapsed = SNAKE_DICE_PRESENTATION_MS;
          review.update(elapsed); setProgress(elapsed / total * 100); setStatus('Rolled 6 — result between board and player');
        }, pause() { running = !running; if (running) startTime = performance.now() - elapsed; setPlaying(running); },
        seek(percent: number) { if (!total) total = review.start(kind); running = false; setPlaying(false); review.start(kind); elapsed = percent * total / 100;
          // Replay deterministic checkpoints so reverse scrubbing also restores visibility and contacts.
          for (let t = 0; t < elapsed; t += 1000 / 60) review.update(t);
          review.update(elapsed); setProgress(percent); setStatus(kind === 'dice' ? 'Dice pickup & throw' : 'Grip, aim & fire'); }
      };
      const frame = (now: number) => {
        if (dead) return;
        if (running) {
          elapsed = Math.min(total, now - startTime); review.update(elapsed); setProgress(elapsed / total * 100);
          setStatus(kind === 'dice' ? elapsed >= SNAKE_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS ? 'Next player picks up & throws' : elapsed < 480 ? 'Reach the resting die' : elapsed < 640 ? 'Close the fingers' : elapsed < 1120 ? 'Lift & throw' : 'Land within the next player’s reach'
            : elapsed < 420 ? 'Reach the parked grip' : elapsed < 1020 ? 'Lift & aim' : elapsed < total - 720 ? 'Fire at the token' : 'Return to the same place');
          if (elapsed >= total) { running = false; setPlaying(false); pauseTime = now; }
        } else if (loopRef.current && total && elapsed >= total && now - pauseTime > 700) start(kind);
        renderer.render(review.scene, review.camera); raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame); setReady(true); setStatus('Choose dice or firearm');
      cleanup = () => { observer.disconnect(); review.dispose(); renderer.dispose(); renderer.domElement.remove(); };
    }).catch(() => { if (!dead) setStatus('The 3D preview could not load on this device.'); });
    return () => { dead = true; cancelAnimationFrame(raf); actions.current = null; cleanup(); };
  }, [seat, gun]);
  return <div>
    <div ref={host} />
    <div className="viz-controls">
      <label className="form-label">Seat<select className="form-select" value={seat} onChange={e => setSeat(Number(e.target.value))}>
        {['Bottom', 'Right', 'Top', 'Left'].map((label, i) => <option value={i} key={i}>{label}</option>)}
      </select></label>
      <label className="form-label">Firearm<select className="form-select" value={gun} onChange={e => setGun(e.target.value)}>
        {REVIEW_WEAPONS.map((id, i) => <option value={id} key={id}>{['Rifle', 'Pistol', 'Shotgun'][i]}</option>)}
      </select></label>
    </div>
    <div className="viz-row">
      <button className="btn btn-primary" disabled={!ready} onClick={() => actions.current?.start('dice')}>Two turns</button>
      <button className="btn" disabled={!ready} onClick={() => actions.current?.result()}>Show result</button>
      <button className="btn" disabled={!ready} onClick={() => actions.current?.start('fire')}>Aim & fire</button>
      <button className="btn" disabled={!ready} onClick={() => actions.current?.pause()}>{playing ? 'Pause' : 'Play'}</button>
      <label className="form-check"><input className="form-check-input" type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /><span className="form-check-label">Repeat</span></label>
    </div>
    <label className="form-label">Animation<input className="form-range" aria-label="Animation progress" type="range" min="0" max="100" step="0.1" value={progress} onChange={e => actions.current?.seek(Number(e.target.value))} /></label>
    <div className="text-small" aria-live="polite">{status}</div>
  </div>;
}
createRoot(document.getElementById('snake-interaction-preview')!).render(<App />);
