import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

// These are the real game components and renderers. The iframe supplies the phone
// viewport without rebuilding the tables, physics or cameras in a separate demo.
function RoyalCameraReview() {
  const [game, setGame] = useState('poolroyale');
  const [width, setWidth] = useState(390);
  const [version, setVersion] = useState(0);
  const url = game === 'poolroyale'
    ? '/royal-camera-game.html?game=pool&variant=uk&tableSize=7ft&tableModel=showood-seven-foot&type=training&mode=ai'
    : '/royal-camera-game.html?game=snooker&type=training&mode=ai';
  return <main>
    <style>{`*{box-sizing:border-box}body{margin:0;background:#080e17;color:#edf6fa;font:14px system-ui}header{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;align-items:center;padding:14px}button,select{font:inherit;border:1px solid #3d5664;border-radius:8px;background:#142733;color:inherit;padding:9px 12px}button[aria-pressed=true]{background:#126a62}p{text-align:center;color:#b5c8d0;margin:0 12px 12px}iframe{display:block;border:1px solid #3d5664;margin:0 auto;background:#111;max-width:100%;height:844px}`}</style>
    <header>
      <button aria-pressed={game === 'poolroyale'} onClick={() => setGame('poolroyale')}>Pool Royal</button>
      <button aria-pressed={game === 'snookerroyal'} onClick={() => setGame('snookerroyal')}>Snooker Royal</button>
      <select aria-label="Phone width" value={width} onChange={event => setWidth(Number(event.target.value))}>
        {[320, 390, 430].map(value => <option key={value} value={value}>{value}px portrait</option>)}
      </select>
      <button onClick={() => setVersion(value => value + 1)}>Restart practice</button>
    </header>
    <p>Free practice · Drag down for the cue view; drag up to stand. Place the cue ball, set spin, and release the power slider to shoot.</p>
    <iframe key={`${game}-${version}`} title={`${game === 'poolroyale' ? 'Pool' : 'Snooker'} Royal portrait practice`} src={url} style={{width}} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<RoyalCameraReview />);
