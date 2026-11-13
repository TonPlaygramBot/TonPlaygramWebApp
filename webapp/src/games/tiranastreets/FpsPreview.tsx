'use client';
import { useState } from 'react';
import { Game } from '../blackwater/ui';
import type { Difficulty, WeaponId } from '../blackwater/core';
import './fps-preview.css';

/** The standalone preview uses the same FPS component as the Telegram app.
 * Paid online lobbies remain in TonPlaygram, where account authentication lives. */
export default function FpsPreview() {
  const [started, setStarted] = useState(false);
  const [weapon, setWeapon] = useState<WeaponId>('ar');
  const [difficulty, setDifficulty] = useState<Difficulty>('recruit');
  if (started) return <main className="tirana-fps-play"><Game mode="ai" initialWeapon={weapon} initialDifficulty={difficulty} onExit={() => setStarted(false)} /></main>;
  return <main className="tirana-fps-lobby">
    <div className="tirana-map-backdrop" aria-hidden="true" />
    <section className="tirana-operation-card">
      <span className="tirana-eyebrow">TONPLAYGRAM · FIRST-PERSON OPERATIONS</span>
      <h1>TIRANA<br /><em>STREETS</em></h1>
      <p className="tirana-lead">One city. One operation.</p>
      <p>Enter Skanderbeg Square, clear three waves and reach extraction. Tirana’s streets, city landmarks and river district are yours to navigate.</p>
      <div className="tirana-operation-meta"><span>3 waves</span><span>18 opponents</span><span>Touch + keyboard</span></div>
      <fieldset><legend>Choose your loadout</legend><div className="tirana-choices">
        <button aria-pressed={weapon === 'ar'} onClick={() => setWeapon('ar')}><strong>MK18</strong><small>Assault rifle · 30 rounds</small></button>
        <button aria-pressed={weapon === 'smg'} onClick={() => setWeapon('smg')}><strong>MP9</strong><small>Submachine gun · 36 rounds</small></button>
      </div></fieldset>
      <fieldset><legend>Operation difficulty</legend><div className="tirana-choices">
        <button aria-pressed={difficulty === 'recruit'} onClick={() => setDifficulty('recruit')}>Recruit</button>
        <button aria-pressed={difficulty === 'veteran'} onClick={() => setDifficulty('veteran')}>Veteran</button>
      </div></fieldset>
      <button className="tirana-deploy" onClick={() => setStarted(true)}>ENTER TIRANA <span aria-hidden="true">↗</span></button>
      <p className="tirana-control-note">Phone: move with your left thumb, look with your right. Desktop: WASD, mouse, R to reload, Esc to pause.</p>
      <footer>© OpenStreetMap contributors · Local city assets<br />Online TPG matches are available inside TonPlaygram.</footer>
    </section>
  </main>;
}
