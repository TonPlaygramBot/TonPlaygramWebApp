import { useEffect, useRef, useState } from 'react';
import ArcadeMatchHeader from '../../components/ArcadeMatchHeader.jsx';
import useArcadeRace from '../../hooks/useArcadeRace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function UnderrunArena() {
  useTelegramBackButton();
  const canvasRef = useRef(null);
  const inputRef = useRef({ x: 0, y: 0, pointer: null, originX: 0, originY: 0 });
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const race = useArcadeRace('underrunarena', score);
  const raceRef = useRef(race);
  raceRef.current = race;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const state = { player: { x: 0.5, y: 0.62 }, enemies: [], bullets: [], particles: [], spawn: 0, shot: 0, score: 0, health: 100, running: true, last: performance.now() };
    gameRef.current = state;
    let frame;
    const resize = () => { const rect = canvas.getBoundingClientRect(); canvas.width = Math.floor(rect.width * devicePixelRatio); canvas.height = Math.floor(rect.height * devicePixelRatio); context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const loop = (time) => {
      const rect = canvas.getBoundingClientRect();
      const dt = Math.min(0.033, (time - state.last) / 1000); state.last = time;
      const raceState = raceRef.current;
      const active = state.running && (!raceState.startsAt || Date.now() >= raceState.startsAt) && (!raceState.endsAt || Date.now() < raceState.endsAt);
      if (active) {
        const input = inputRef.current;
        state.player.x = clamp(state.player.x + input.x * dt * 0.48, 0.07, 0.93);
        state.player.y = clamp(state.player.y + input.y * dt * 0.48, 0.08, 0.92);
        state.spawn -= dt;
        if (state.spawn <= 0) { const edge = Math.random(); state.enemies.push({ x: 0.08 + Math.random() * 0.84, y: edge < 0.72 ? -0.04 : 0.08 + Math.random() * 0.7, hp: 1, speed: 0.07 + Math.random() * 0.07 }); state.spawn = Math.max(0.25, 0.85 - state.score / 9000); }
        state.shot -= dt;
        if (state.shot <= 0 && state.enemies.length) { const target = state.enemies.reduce((best, enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < Math.hypot(best.x - state.player.x, best.y - state.player.y) ? enemy : best); const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x); state.bullets.push({ x: state.player.x, y: state.player.y, xV: Math.cos(angle) * 0.75, yV: Math.sin(angle) * 0.75 }); state.shot = 0.18; }
        state.bullets.forEach((bullet) => { bullet.x += bullet.xV * dt; bullet.y += bullet.yV * dt; });
        state.enemies.forEach((enemy) => { const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x); enemy.x += Math.cos(angle) * enemy.speed * dt; enemy.y += Math.sin(angle) * enemy.speed * dt; });
        for (const enemy of state.enemies) for (const bullet of state.bullets) if (!bullet.hit && !enemy.dead && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 0.035) { bullet.hit = true; enemy.dead = true; state.score += 100; setScore(state.score); for (let i = 0; i < 7; i += 1) state.particles.push({ x: enemy.x, y: enemy.y, life: 1, xV: (Math.random() - .5) * .3, yV: (Math.random() - .5) * .3 }); }
        for (const enemy of state.enemies) if (!enemy.dead && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 0.055) { enemy.dead = true; state.health = Math.max(0, state.health - 15); setHealth(state.health); if (!state.health) { state.running = false; raceState.finish(state.score); } }
        state.particles.forEach((particle) => { particle.x += particle.xV * dt; particle.y += particle.yV * dt; particle.life -= dt * 2; });
        state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.y < 1.1); state.bullets = state.bullets.filter((bullet) => !bullet.hit && bullet.x > -0.1 && bullet.x < 1.1 && bullet.y > -0.1 && bullet.y < 1.1); state.particles = state.particles.filter((particle) => particle.life > 0);
      } else if (raceState.endsAt && Date.now() >= raceState.endsAt && state.running) { state.running = false; raceState.finish(state.score); }
      context.clearRect(0, 0, rect.width, rect.height);
      const gradient = context.createRadialGradient(rect.width * state.player.x, rect.height * state.player.y, 0, rect.width / 2, rect.height / 2, rect.height); gradient.addColorStop(0, '#102d3b'); gradient.addColorStop(1, '#03060c'); context.fillStyle = gradient; context.fillRect(0, 0, rect.width, rect.height);
      context.strokeStyle = '#22d3ee14'; context.lineWidth = 1; for (let x = 0; x < rect.width; x += 28) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, rect.height); context.stroke(); } for (let y = 0; y < rect.height; y += 28) { context.beginPath(); context.moveTo(0, y); context.lineTo(rect.width, y); context.stroke(); }
      for (const bullet of state.bullets) { context.fillStyle = '#fef08a'; context.shadowBlur = 14; context.shadowColor = '#fde047'; context.beginPath(); context.arc(bullet.x * rect.width, bullet.y * rect.height, 3, 0, Math.PI * 2); context.fill(); }
      for (const enemy of state.enemies) { context.fillStyle = '#fb7185'; context.shadowBlur = 18; context.shadowColor = '#e11d48'; context.beginPath(); context.arc(enemy.x * rect.width, enemy.y * rect.height, 10, 0, Math.PI * 2); context.fill(); }
      for (const particle of state.particles) { context.globalAlpha = particle.life; context.fillStyle = '#67e8f9'; context.fillRect(particle.x * rect.width, particle.y * rect.height, 4, 4); } context.globalAlpha = 1;
      context.save(); context.translate(state.player.x * rect.width, state.player.y * rect.height); context.fillStyle = '#22d3ee'; context.shadowBlur = 22; context.shadowColor = '#22d3ee'; context.beginPath(); context.moveTo(0, -15); context.lineTo(12, 13); context.lineTo(0, 8); context.lineTo(-12, 13); context.closePath(); context.fill(); context.restore(); context.shadowBlur = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  const pointerDown = (event) => { const input = inputRef.current; input.pointer = event.pointerId; input.originX = event.clientX; input.originY = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event) => { const input = inputRef.current; if (input.pointer !== event.pointerId) return; input.x = clamp((event.clientX - input.originX) / 45, -1, 1); input.y = clamp((event.clientY - input.originY) / 45, -1, 1); };
  const pointerUp = () => { inputRef.current = { x: 0, y: 0, pointer: null, originX: 0, originY: 0 }; };
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#03060c] text-white">
      <ArcadeMatchHeader title="Underrun Arena" score={score} opponentScore={race.opponentScore} online={race.online} startsAt={race.startsAt} endsAt={race.endsAt} />
      <div className="mx-4 mb-2 flex items-center gap-3"><span className="text-xs font-bold text-white/60">SHIELD</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all" style={{ width: `${health}%` }} /></div><strong className="text-xs">{health}</strong></div>
      <div className="relative min-h-0 flex-1 mx-3 mb-[max(.75rem,env(safe-area-inset-bottom))] overflow-hidden rounded-3xl border border-cyan-300/15 shadow-[0_0_40px_rgba(34,211,238,.08)]">
        <canvas ref={canvasRef} className="h-full w-full touch-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
        <div className="pointer-events-none absolute bottom-5 left-5 grid h-24 w-24 place-items-center rounded-full border border-cyan-200/25 bg-cyan-200/5"><div className="h-10 w-10 rounded-full border border-cyan-100/40 bg-cyan-300/15" /><span className="absolute -bottom-5 text-[10px] text-cyan-100/45">DRAG TO MOVE · AUTO-FIRE</span></div>
      </div>
      {(!gameRef.current?.running || race.winner) && <div className="fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-cyan-300/30 bg-[#07131c]/95 p-7 text-center"><div className="text-4xl">🚀</div><strong className="mt-3 block text-2xl">{race.online ? String(race.winner) === String(race.accountId) ? 'You win!' : race.winner === 'draw' ? 'Draw!' : 'Opponent wins' : 'Run complete'}</strong><p className="mt-2 text-white/55">Score {score.toLocaleString()}</p></div>}
    </main>
  );
}
