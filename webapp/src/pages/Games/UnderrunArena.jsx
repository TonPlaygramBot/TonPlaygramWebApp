import { useEffect, useRef, useState } from 'react';
import ArcadeMatchHeader from '../../components/ArcadeMatchHeader.jsx';
import useArcadeRace from '../../hooks/useArcadeRace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const WEAPONS = {
  egg: { label: 'Egg Blaster', icon: '🥚', cooldown: 0.17, speed: 0.92, damage: 1, color: '#fff7cc' },
  tomato: { label: 'Tomato Cannon', icon: '🍅', cooldown: 0.34, speed: 0.72, damage: 2, color: '#ff4d4d' }
};

export default function UnderrunArena() {
  useTelegramBackButton();
  const canvasRef = useRef(null);
  const inputRef = useRef({ x: 0, y: 0, pointer: null, originX: 0, originY: 0, dash: false });
  const weaponRef = useRef('egg');
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [wave, setWave] = useState(1);
  const [combo, setCombo] = useState(0);
  const [weapon, setWeapon] = useState('egg');
  const [dashReady, setDashReady] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const race = useArcadeRace('underrunarena', score);
  const raceRef = useRef(race);
  raceRef.current = race;

  const selectWeapon = (nextWeapon) => {
    weaponRef.current = nextWeapon;
    setWeapon(nextWeapon);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const state = {
      player: { x: 0.5, y: 0.72, angle: 0 }, enemies: [], bullets: [], particles: [], pickups: [],
      spawn: 0, shot: 0, score: 0, health: 100, combo: 0, comboTime: 0, elapsed: 0,
      wave: 1, dashCooldown: 0, invulnerable: 0, rapidFire: 0, running: true, last: performance.now()
    };
    gameRef.current = state;
    let frame;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * ratio); canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize(); window.addEventListener('resize', resize);

    const burst = (x, y, color, count = 10) => {
      for (let i = 0; i < count; i += 1) state.particles.push({ x, y, life: 1, size: random(2, 6), color, xV: random(-0.35, 0.35), yV: random(-0.35, 0.35) });
    };
    const spawnEnemy = () => {
      const roll = Math.random();
      const kind = roll > 0.88 ? 'tank' : roll > 0.67 ? 'zigzag' : 'runner';
      const config = kind === 'tank' ? { hp: 4, speed: 0.045, radius: 0.036, points: 350 } : kind === 'zigzag' ? { hp: 2, speed: 0.085, radius: 0.027, points: 220 } : { hp: 1, speed: 0.1, radius: 0.023, points: 120 };
      state.enemies.push({ x: random(0.08, 0.92), y: -0.05, kind, phase: random(0, 7), ...config });
    };
    const loop = (time) => {
      const rect = canvas.getBoundingClientRect();
      const dt = Math.min(0.033, (time - state.last) / 1000); state.last = time;
      const raceState = raceRef.current;
      const active = state.running && (!raceState.startsAt || Date.now() >= raceState.startsAt) && (!raceState.endsAt || Date.now() < raceState.endsAt);
      if (active) {
        state.elapsed += dt;
        const nextWave = Math.floor(state.elapsed / 18) + 1;
        if (nextWave !== state.wave) { state.wave = nextWave; setWave(nextWave); burst(0.5, 0.35, '#facc15', 35); }
        state.dashCooldown = Math.max(0, state.dashCooldown - dt);
        state.invulnerable = Math.max(0, state.invulnerable - dt);
        state.rapidFire = Math.max(0, state.rapidFire - dt);
        const input = inputRef.current;
        const boost = input.dash && state.dashCooldown <= 0 ? 2.8 : 1;
        if (boost > 1) { state.dashCooldown = 4; state.invulnerable = 0.55; input.dash = false; setDashReady(false); setTimeout(() => setDashReady(true), 4000); burst(state.player.x, state.player.y, '#67e8f9', 16); }
        state.player.x = clamp(state.player.x + input.x * dt * 0.55 * boost, 0.06, 0.94);
        state.player.y = clamp(state.player.y + input.y * dt * 0.55 * boost, 0.1, 0.94);
        state.spawn -= dt;
        if (state.spawn <= 0) { spawnEnemy(); state.spawn = Math.max(0.18, 0.72 - state.wave * 0.055); }
        state.shot -= dt;
        if (state.shot <= 0 && state.enemies.length) {
          const target = state.enemies.reduce((best, enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < Math.hypot(best.x - state.player.x, best.y - state.player.y) ? enemy : best);
          const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
          const selected = WEAPONS[weaponRef.current];
          state.player.angle = angle + Math.PI / 2;
          state.bullets.push({ x: state.player.x, y: state.player.y, xV: Math.cos(angle) * selected.speed, yV: Math.sin(angle) * selected.speed, type: weaponRef.current, damage: selected.damage, spin: 0 });
          state.shot = selected.cooldown * (state.rapidFire > 0 ? 0.52 : 1);
        }
        state.bullets.forEach((bullet) => { bullet.x += bullet.xV * dt; bullet.y += bullet.yV * dt; bullet.spin += dt * 10; });
        state.enemies.forEach((enemy) => {
          const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
          enemy.x += (Math.cos(angle) * enemy.speed + (enemy.kind === 'zigzag' ? Math.sin(state.elapsed * 7 + enemy.phase) * 0.075 : 0)) * dt;
          enemy.y += Math.sin(angle) * enemy.speed * dt;
        });
        for (const enemy of state.enemies) for (const bullet of state.bullets) if (!bullet.hit && !enemy.dead && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + 0.018) {
          bullet.hit = true; enemy.hp -= bullet.damage; burst(bullet.x, bullet.y, bullet.type === 'tomato' ? '#ef4444' : '#fff7cc', bullet.type === 'tomato' ? 15 : 7);
          if (enemy.hp <= 0) { enemy.dead = true; state.combo += 1; state.comboTime = 2.3; const earned = enemy.points * Math.min(5, 1 + Math.floor(state.combo / 5)); state.score += earned; setScore(state.score); setCombo(state.combo); if (Math.random() < 0.09) state.pickups.push({ x: enemy.x, y: enemy.y, type: Math.random() < 0.5 ? 'heal' : 'rapid', life: 8 }); }
        }
        state.comboTime -= dt;
        if (state.comboTime <= 0 && state.combo) { state.combo = 0; setCombo(0); }
        for (const enemy of state.enemies) if (!enemy.dead && state.invulnerable <= 0 && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < enemy.radius + 0.035) {
          enemy.dead = true; state.health = Math.max(0, state.health - (enemy.kind === 'tank' ? 25 : 14)); setHealth(state.health); burst(state.player.x, state.player.y, '#fb7185', 24); state.invulnerable = 0.8;
          if (!state.health) { state.running = false; setGameOver(true); raceState.finish(state.score); }
        }
        state.pickups.forEach((pickup) => { pickup.life -= dt; if (!pickup.used && Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) < 0.06) { pickup.used = true; if (pickup.type === 'heal') { state.health = Math.min(100, state.health + 25); setHealth(state.health); } else state.rapidFire = 7; burst(pickup.x, pickup.y, '#4ade80', 22); } });
        state.particles.forEach((particle) => { particle.x += particle.xV * dt; particle.y += particle.yV * dt; particle.life -= dt * 1.7; });
        state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.y < 1.12); state.bullets = state.bullets.filter((bullet) => !bullet.hit && bullet.x > -0.1 && bullet.x < 1.1 && bullet.y > -0.1 && bullet.y < 1.1); state.particles = state.particles.filter((particle) => particle.life > 0); state.pickups = state.pickups.filter((pickup) => !pickup.used && pickup.life > 0);
      } else if (raceState.endsAt && Date.now() >= raceState.endsAt && state.running) { state.running = false; setGameOver(true); raceState.finish(state.score); }

      const w = rect.width, h = rect.height;
      context.clearRect(0, 0, w, h);
      const bg = context.createRadialGradient(w * state.player.x, h * state.player.y, 10, w / 2, h / 2, h); bg.addColorStop(0, '#113643'); bg.addColorStop(0.5, '#081525'); bg.addColorStop(1, '#02040b'); context.fillStyle = bg; context.fillRect(0, 0, w, h);
      context.strokeStyle = '#22d3ee18'; context.lineWidth = 1; const offset = (state.elapsed * 20) % 32;
      for (let x = -32; x < w + 32; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, h); context.stroke(); }
      for (let y = offset - 32; y < h; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(w, y); context.stroke(); }
      context.strokeStyle = '#a855f722'; context.lineWidth = 3; context.strokeRect(8, 8, w - 16, h - 16);
      for (const pickup of state.pickups) { context.font = '24px sans-serif'; context.textAlign = 'center'; context.shadowBlur = 16; context.shadowColor = '#4ade80'; context.fillText(pickup.type === 'heal' ? '💚' : '⚡', pickup.x * w, pickup.y * h); }
      for (const bullet of state.bullets) { context.save(); context.translate(bullet.x * w, bullet.y * h); context.rotate(bullet.spin); context.font = bullet.type === 'tomato' ? '20px sans-serif' : '17px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.shadowBlur = 12; context.shadowColor = WEAPONS[bullet.type].color; context.fillText(WEAPONS[bullet.type].icon, 0, 0); context.restore(); }
      for (const enemy of state.enemies) { const x = enemy.x * w, y = enemy.y * h, r = enemy.radius * Math.min(w, h); context.fillStyle = enemy.kind === 'tank' ? '#a855f7' : enemy.kind === 'zigzag' ? '#fb7185' : '#f43f5e'; context.shadowBlur = 18; context.shadowColor = context.fillStyle; context.beginPath(); for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3 + state.elapsed; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? context.lineTo(px, py) : context.moveTo(px, py); } context.closePath(); context.fill(); context.fillStyle = '#fff'; context.fillRect(x - r * 0.45, y - 2, r * 0.25, 3); context.fillRect(x + r * 0.2, y - 2, r * 0.25, 3); }
      for (const particle of state.particles) { context.globalAlpha = particle.life; context.fillStyle = particle.color; context.fillRect(particle.x * w, particle.y * h, particle.size, particle.size); } context.globalAlpha = 1;
      context.save(); context.translate(state.player.x * w, state.player.y * h); context.rotate(state.player.angle); context.globalAlpha = state.invulnerable > 0 && Math.floor(state.elapsed * 15) % 2 ? 0.4 : 1; context.fillStyle = '#22d3ee'; context.shadowBlur = 25; context.shadowColor = '#22d3ee'; context.beginPath(); context.moveTo(0, -18); context.lineTo(14, 14); context.lineTo(0, 9); context.lineTo(-14, 14); context.closePath(); context.fill(); context.fillStyle = '#facc15'; context.beginPath(); context.moveTo(-5, 12); context.lineTo(0, 25 + Math.random() * 7); context.lineTo(5, 12); context.fill(); context.restore(); context.shadowBlur = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  const pointerDown = (event) => { const input = inputRef.current; input.pointer = event.pointerId; input.originX = event.clientX; input.originY = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event) => { const input = inputRef.current; if (input.pointer !== event.pointerId) return; input.x = clamp((event.clientX - input.originX) / 42, -1, 1); input.y = clamp((event.clientY - input.originY) / 42, -1, 1); };
  const pointerUp = () => { inputRef.current = { ...inputRef.current, x: 0, y: 0, pointer: null }; };
  const dash = () => { if (dashReady) inputRef.current.dash = true; };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#02040b] text-white">
      <ArcadeMatchHeader title="Underrun Arena" score={score} opponentScore={race.opponentScore} online={race.online} startsAt={race.startsAt} endsAt={race.endsAt} />
      <section className="mx-3 mb-2 rounded-2xl border border-cyan-300/15 bg-slate-950/80 px-3 py-2 shadow-[0_0_30px_rgba(34,211,238,.08)]">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.18em]"><span className="text-cyan-300">Wave {wave}</span><span className={combo >= 5 ? 'text-amber-300 animate-pulse' : 'text-white/45'}>{combo ? `${combo} hit combo · x${Math.min(5, 1 + Math.floor(combo / 5))}` : 'Build your combo'}</span></div>
        <div className="mt-2 flex items-center gap-2"><span className="text-[9px] font-bold text-white/50">SHIELD</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${health < 35 ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-300'}`} style={{ width: `${health}%` }} /></div><strong className="text-xs">{health}</strong></div>
      </section>
      <div className="relative mx-3 mb-[max(.75rem,env(safe-area-inset-bottom))] min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-cyan-300/20 shadow-[0_0_45px_rgba(34,211,238,.12)]">
        <canvas ref={canvasRef} className="h-full w-full touch-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur"><p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-200">Neon Sector {wave}</p><p className="mt-0.5 text-[9px] text-white/45">Drag anywhere to fly</p></div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
          <div className="pointer-events-none grid h-20 w-20 place-items-center rounded-full border border-cyan-200/25 bg-cyan-200/5 backdrop-blur-sm"><div className="h-8 w-8 rounded-full border border-cyan-100/40 bg-cyan-300/15" /></div>
          <div className="flex gap-2">
            {Object.entries(WEAPONS).map(([key, item]) => <button key={key} type="button" onClick={() => selectWeapon(key)} className={`grid h-14 min-w-14 place-items-center rounded-2xl border backdrop-blur transition active:scale-90 ${weapon === key ? 'border-amber-300 bg-amber-300/20 shadow-[0_0_18px_rgba(251,191,36,.3)]' : 'border-white/15 bg-black/45'}`} aria-label={item.label}><span className="text-2xl">{item.icon}</span><span className="text-[7px] font-bold uppercase tracking-wider">{key}</span></button>)}
            <button type="button" onClick={dash} disabled={!dashReady} className={`h-14 min-w-14 rounded-2xl border text-xl backdrop-blur active:scale-90 ${dashReady ? 'border-cyan-300/50 bg-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,.25)]' : 'border-white/10 bg-black/45 opacity-40'}`} aria-label="Dash"><span>⚡</span><span className="block text-[7px] font-bold uppercase">Dash</span></button>
          </div>
        </div>
      </div>
      {(gameOver || race.winner) && <div className="fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-cyan-300/30 bg-[#07131c]/95 p-7 text-center shadow-[0_0_70px_rgba(34,211,238,.25)] backdrop-blur"><div className="text-5xl">🏆</div><strong className="mt-3 block text-2xl">{race.online ? String(race.winner) === String(race.accountId) ? 'You win!' : race.winner === 'draw' ? 'Draw!' : 'Opponent wins' : 'Run complete'}</strong><p className="mt-2 text-white/55">Score {score.toLocaleString()} · Wave {wave}</p></div>}
    </main>
  );
}
