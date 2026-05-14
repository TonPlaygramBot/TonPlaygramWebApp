import { useEffect, useRef, useState } from 'react';
import { GameHudState, GameManager } from './GameManager';
import './tableTennis.css';

const initialHud: GameHudState = {
  playerScore: 0,
  aiScore: 0,
  server: 'YOU',
  lastShot: '',
  lastReason: 'Serve',
  replaying: false,
  debug: { ballState: 'idle', bounces: 'P:0 AI:0', hitValidity: 'waiting', predictedLanding: 'none' },
};

export function UIOverlay() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<GameManager | null>(null);
  const [hud, setHud] = useState(initialHud);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const manager = new GameManager(mountRef.current);
    managerRef.current = manager;
    manager.start(setHud);

    const onResize = () => {
      const mount = mountRef.current;
      if (!mount || !managerRef.current) return;
      managerRef.current.camera.aspect = mount.clientWidth / mount.clientHeight;
      managerRef.current.camera.updateProjectionMatrix();
      managerRef.current.renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mountRef.current?.getBoundingClientRect();
      if (!bounds) return;
      manager.setPointer(((event.clientX - bounds.left) / bounds.width) * 2 - 1);
    };

    window.addEventListener('resize', onResize);
    manager.renderer.domElement.addEventListener('pointermove', onPointerMove);
    manager.renderer.domElement.addEventListener('pointerdown', onPointerMove);
    return () => {
      window.removeEventListener('resize', onResize);
      manager.renderer.domElement.removeEventListener('pointermove', onPointerMove);
      manager.renderer.domElement.removeEventListener('pointerdown', onPointerMove);
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  return (
    <main className="tt-shell">
      <div className="tt-phone-frame">
        <div ref={mountRef} className="tt-canvas" />
        <section className="tt-score-panel" aria-label="Score">
          <div>
            <span className="tt-name">YOU</span>
            <strong>{hud.playerScore}</strong>
          </div>
          <div className="tt-serve">SERVE: {hud.server}</div>
          <div>
            <span className="tt-name">AI</span>
            <strong>{hud.aiScore}</strong>
          </div>
        </section>

        {hud.lastShot && !hud.replaying ? <div className="tt-shot-label">{hud.lastShot}</div> : null}
        {hud.replaying ? <div className="tt-replay-banner">VAR Replay: slow motion review</div> : null}

        <section className="tt-controls">
          <button type="button" onClick={() => managerRef.current?.replayLastRally()}>Replay</button>
          <button type="button" onClick={() => managerRef.current?.resetMatch()}>Reset</button>
          <button type="button" onClick={() => setDebug((value) => !value)}>{debug ? 'Hide debug' : 'Debug'}</button>
        </section>

        {debug ? (
          <aside className="tt-debug">
            <span>state: {hud.debug.ballState}</span>
            <span>bounces: {hud.debug.bounces}</span>
            <span>hit: {hud.debug.hitValidity}</span>
            <span>landing: {hud.debug.predictedLanding}</span>
            <span>last point: {hud.lastReason}</span>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
