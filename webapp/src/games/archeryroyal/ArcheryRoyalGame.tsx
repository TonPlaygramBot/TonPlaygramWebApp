import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArcheryAudio } from './audio';
import { ArcheryRenderer } from './renderer';
import {
  ARROWS_PER_END,
  chooseAiShot,
  createMatch,
  publicMatch,
  submitShot,
  type ArcheryMatch,
  type ShotIntent
} from './shared/rules';
import { EVENTS, buyUpgrade, finishCareerMatch, loadCareer, type ArcheryCareer } from './career';
import { OnlineArcherySession } from './online';
import './archery-royal.css';

const safeDifficulty = (value: string | null) => value === 'club' || value === 'pro' ? value : 'tour';
const safeArena = (value: string | null) => ['royal-grounds', 'alpine-range', 'neon-arena'].includes(value || '') ? value! : 'royal-grounds';
const localMatch = (opponent = 'Tour Rival') => createMatch([
  { id: 'player', name: 'You' }, { id: 'ai', name: opponent }
], Math.floor(Math.random() * 0x7fffffff));

export default function ArcheryRoyalGame({ onLobby, preview = false }: { onLobby: () => void; preview?: boolean }) {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'online' ? 'online' : params.get('mode') === 'career' ? 'career' : 'ai';
  const arena = safeArena(params.get('arena'));
  const difficulty = safeDifficulty(params.get('difficulty'));
  const tableId = params.get('tableId') || '';
  const [match, setMatch] = useState<ArcheryMatch>(() => localMatch(mode === 'career' ? 'Circuit Challenger' : `${difficulty[0].toUpperCase()}${difficulty.slice(1)} AI`));
  const [career, setCareer] = useState<ArcheryCareer>(loadCareer);
  const [aim, setAim] = useState({ x: 0, y: .15 });
  const [drawing, setDrawing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connection, setConnection] = useState(mode === 'online' ? 'Joining the authoritative range…' : '');
  const [error, setError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ArcheryRenderer | null>(null);
  const audio = useRef(new ArcheryAudio());
  const session = useRef<OnlineArcherySession | null>(null);
  const drawStarted = useRef(0);
  const drawFrame = useRef(0);
  const drawActive = useRef(false);
  const drawPower = useRef(.35);
  const powerFill = useRef<HTMLElement>(null);
  const powerLabel = useRef<HTMLElement>(null);
  const seenArrow = useRef(0);
  const careerSettled = useRef(0);

  useEffect(() => () => {
    cancelAnimationFrame(drawFrame.current);
    audio.current.destroy();
  }, []);

  useEffect(() => {
    if (!host.current) return;
    try { renderer.current = new ArcheryRenderer(host.current, arena, preview); }
    catch (reason) { setError(`3D graphics unavailable: ${(reason as Error).message}`); }
    let frame = 0;
    const draw = (now: number) => { renderer.current?.draw(now); frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); renderer.current?.dispose(); renderer.current = null; };
  }, [arena, preview]);

  useEffect(() => {
    renderer.current?.aim(aim.x, aim.y, drawPower.current);
  }, [aim.x, aim.y]);

  useEffect(() => {
    if (mode !== 'online' || !tableId) return;
    const online = new OnlineArcherySession(tableId, setConnection);
    session.current = online;
    const unsubscribe = online.subscribe((state) => setMatch(state));
    return () => { unsubscribe(); online.dispose(); session.current = null; };
  }, [mode, tableId]);

  const localId = mode === 'online' ? session.current?.localId || '' : 'player';
  const canShoot = match.phase === 'aiming' && match.currentPlayerId === localId && !drawing;
  const latestArrow = useMemo(() => Object.values(match.arrows).flat().sort((a, b) => b.turnId - a.turnId)[0], [match.arrows]);

  useEffect(() => {
    if (!latestArrow || latestArrow.turnId <= seenArrow.current) return;
    seenArrow.current = latestArrow.turnId;
    renderer.current?.shoot(latestArrow);
    audio.current.shot(latestArrow.score);
  }, [latestArrow]);

  useEffect(() => {
    if (mode === 'online' || match.phase !== 'aiming' || match.currentPlayerId !== 'ai') return;
    const timer = window.setTimeout(() => {
      setMatch((current) => {
        if (current.phase !== 'aiming' || current.currentPlayerId !== 'ai') return current;
        const next = publicMatch(current);
        const careerDifficulty = career.tournament >= 4 ? 'pro' : career.tournament >= 2 ? 'tour' : difficulty;
        submitShot(next, 'ai', chooseAiShot(next, careerDifficulty));
        return next;
      });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [career.tournament, difficulty, match.currentPlayerId, match.phase, mode]);

  useEffect(() => {
    if (mode !== 'career' || match.phase !== 'finished' || careerSettled.current === match.seed) return;
    careerSettled.current = match.seed;
    const won = match.winnerId === 'player';
    setCareer((current) => finishCareerMatch(current, won, match.scores.player));
    if (won) audio.current.fanfare();
  }, [match.phase, match.seed, match.scores.player, match.winnerId, mode]);

  const fire = useCallback(async (shotPower: number) => {
    if (match.phase !== 'aiming' || match.currentPlayerId !== localId) return;
    const ideal = chooseAiShot(match, 'pro');
    const assist = mode === 'career' ? career.accuracy * .04 : 0;
    const shot: ShotIntent = {
      aimX: aim.x * (1 - assist) + ideal.aimX * assist,
      aimY: aim.y * (1 - assist) + ideal.aimY * assist,
      power: Math.min(1, shotPower + (mode === 'career' ? career.stability * .012 : 0))
    };
    setError('');
    try {
      if (mode === 'online') await session.current?.shoot(shot, match.turnId);
      else {
        const next = publicMatch(match);
        const result = submitShot(next, 'player', shot);
        if (!result.ok) throw new Error(result.error);
        setMatch(next);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Shot not accepted.'); }
  }, [aim.x, aim.y, career.accuracy, career.stability, localId, match, mode]);

  const beginDraw = useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    if (!canShoot || drawActive.current) return;
    event?.currentTarget.setPointerCapture(event.pointerId);
    audio.current.unlock();
    drawActive.current = true;
    setDrawing(true);
    drawStarted.current = performance.now();
    const charge = () => {
      const next = Math.min(1, .35 + (performance.now() - drawStarted.current) / 1500 * .65);
      drawPower.current = next;
      if (powerFill.current) powerFill.current.style.width = `${next * 100}%`;
      if (powerLabel.current) powerLabel.current.textContent = `${Math.round(next * 100)}%`;
      renderer.current?.aim(aim.x, aim.y, next);
      if (next < 1) drawFrame.current = requestAnimationFrame(charge);
    };
    drawFrame.current = requestAnimationFrame(charge);
  }, [aim.x, aim.y, canShoot]);

  const releaseDraw = useCallback(() => {
    if (!drawActive.current) return;
    drawActive.current = false;
    cancelAnimationFrame(drawFrame.current);
    const shotPower = Math.min(1, .35 + (performance.now() - drawStarted.current) / 1500 * .65);
    setDrawing(false);
    drawPower.current = .35;
    if (powerFill.current) powerFill.current.style.width = '35%';
    if (powerLabel.current) powerLabel.current.textContent = '35%';
    renderer.current?.aim(aim.x, aim.y, .35);
    void fire(shotPower);
  }, [aim.x, aim.y, fire]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft') setAim((value) => ({ ...value, x: Math.max(-1, value.x - .04) }));
      if (event.key === 'ArrowRight') setAim((value) => ({ ...value, x: Math.min(1, value.x + .04) }));
      if (event.key === 'ArrowUp') setAim((value) => ({ ...value, y: Math.min(1, value.y + .04) }));
      if (event.key === 'ArrowDown') setAim((value) => ({ ...value, y: Math.max(-1, value.y - .04) }));
      if (event.key === ' ' && !event.repeat) beginDraw();
    };
    const keyup = (event: KeyboardEvent) => { if (event.key === ' ') releaseDraw(); };
    addEventListener('keydown', keydown);
    addEventListener('keyup', keyup);
    return () => { removeEventListener('keydown', keydown); removeEventListener('keyup', keyup); };
  }, [beginDraw, releaseDraw]);

  const updateAim = (event: React.PointerEvent<HTMLDivElement>) => {
    if (match.phase !== 'aiming' || match.currentPlayerId !== localId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, (1 - (event.clientY - rect.top) / rect.height) * 2 - 1));
    setAim({ x, y });
  };

  const reset = () => {
    renderer.current?.clearArrows();
    seenArrow.current = 0;
    setAim({ x: 0, y: .15 });
    setMatch(localMatch(mode === 'career' ? `Seed ${career.tournament + 1} Challenger` : `${difficulty} AI`));
  };

  const myScore = localId ? match.scores[localId] || 0 : 0;
  const opponent = match.players.find((player) => player.id !== localId) || match.players[1];
  const opponentScore = match.scores[opponent?.id] || 0;
  const endArrows = match.arrows[localId]?.slice((match.end - 1) * ARROWS_PER_END, match.end * ARROWS_PER_END) || [];
  const windAngle = Math.atan2(match.wind.y, match.wind.x) * 180 / Math.PI;

  return (
    <main className={`ar-game ar-${arena}`}>
      <div ref={host} className="ar-scene" />
      <div className="ar-vignette" />
      <header className="ar-header">
        <button type="button" onClick={onLobby} className="ar-exit">← Lobby</button>
        <div className="ar-title"><b>ARCHERY</b><span>ROYAL</span></div>
        <button type="button" aria-label={muted ? 'Enable sound' : 'Mute sound'} onClick={() => { audio.current.unlock(); audio.current.setMuted(!muted); setMuted(!muted); }}>{muted ? 'MUTED' : 'SOUND'}</button>
      </header>

      <section className="ar-score" aria-label="Match score">
        <div className={match.currentPlayerId === localId ? 'active' : ''}><span>YOU</span><b>{myScore}</b><small>{endArrows.map((arrow) => arrow.score).join(' · ') || '—'}</small></div>
        <p><span>END</span><b>{match.end}/3</b></p>
        <div className={match.currentPlayerId === opponent?.id ? 'active' : ''}><span>{opponent?.name || 'RIVAL'}</span><b>{opponentScore}</b><small>{match.arrows[opponent?.id]?.slice(-3).map((arrow) => arrow.score).join(' · ') || '—'}</small></div>
      </section>

      <div className="ar-wind"><i style={{ transform: `rotate(${windAngle}deg)` }}>➜</i><span>WIND</span><b>{Math.hypot(match.wind.x, match.wind.y).toFixed(1)} m/s</b></div>

      <div className="ar-aimpad" role="application" aria-label="Drag to move the archery sight" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateAim(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateAim(event); }} />

      <section className="ar-controls">
        <div className="ar-power"><span>DRAW POWER</span><i><u ref={powerFill} style={{ width: '35%' }} /></i><b ref={powerLabel}>35%</b></div>
        <button type="button" className="ar-draw" disabled={!canShoot} onPointerDown={beginDraw} onPointerUp={releaseDraw} onPointerCancel={releaseDraw} onLostPointerCapture={releaseDraw}>
          <span>{drawing ? 'RELEASE' : match.currentPlayerId === localId ? 'HOLD TO DRAW' : `${opponent?.name || 'Rival'} AIMING`}</span>
          <small>Drag the range to aim · release at full power</small>
        </button>
      </section>

      {latestArrow && <div className={`ar-hit score-${latestArrow.score}`} role="status"><b>{latestArrow.score || 'MISS'}</b><span>{latestArrow.bullseye ? 'INNER TEN' : latestArrow.score >= 9 ? 'GREAT SHOT' : latestArrow.score ? 'ON TARGET' : 'WIDE'}</span></div>}
      {(connection || error) && <div className={`ar-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || connection}</div>}
      {mode === 'career' && <div className="ar-career"><span>{EVENTS[career.tournament]}</span><b>LV {career.level}</b><small>{career.coins.toLocaleString()} coins</small></div>}

      {match.phase === 'finished' && (
        <div className="ar-modal"><section>
          <p>FINAL SCORE · {myScore}–{opponentScore}</p>
          <h1>{match.winnerId === 'draw' ? 'Shoot-off draw' : match.winnerId === localId ? 'Royal victory' : 'Match lost'}</h1>
          {mode === 'career' && <div className="ar-upgrades">
            <button type="button" onClick={() => setCareer((value) => buyUpgrade(value, 'accuracy'))}>Accuracy {career.accuracy}/5</button>
            <button type="button" onClick={() => setCareer((value) => buyUpgrade(value, 'stability'))}>Stability {career.stability}/5</button>
          </div>}
          {mode !== 'online' && <button type="button" className="ar-primary" onClick={reset}>{mode === 'career' ? 'NEXT TOURNAMENT' : 'REMATCH'}</button>}
          <button type="button" className="ar-secondary" onClick={onLobby}>RETURN TO LOBBY</button>
        </section></div>
      )}
      <footer>Space: draw · Arrows: aim · {mode === 'online' ? 'Server-authoritative TPG duel' : 'Nine arrows per archer'}</footer>
    </main>
  );
}
