import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { ArrowLeft, Clock3, Crosshair, Gift, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './airdropGame.css';

type AmmoKind = 'egg' | 'tomato' | 'orange' | 'potato' | 'pepper';
type Inventory = Record<AmmoKind, number>;
type Phase = 'briefing' | 'playing' | 'results';

const HOUR = 3_600_000;
const STORAGE_KEY = 'tpg-splat-squad-v2';
const FREE_PACK: Inventory = { egg: 12, tomato: 9, orange: 7, potato: 6, pepper: 5 };
const AMMO: Record<AmmoKind, { icon: string; label: string; color: string; damage: number }> = {
  egg: { icon: '🥚', label: 'Egg', color: '#fff4c4', damage: 1 },
  tomato: { icon: '🍅', label: 'Tomato', color: '#e53935', damage: 1.15 },
  orange: { icon: '🍊', label: 'Orange', color: '#ff9800', damage: 1.3 },
  potato: { icon: '🥔', label: 'Potato', color: '#b58a55', damage: 1.45 },
  pepper: { icon: '🌶️', label: 'Pepper', color: '#d71920', damage: 1.7 }
};
const TARGETS = [
  { id: 0, x: -2.25, z: -1.2, shirt: '#3158c9', reward: 20, title: 'SCOUT' },
  { id: 1, x: 0, z: -2.2, shirt: '#cb3434', reward: 35, title: 'RUNNER' },
  { id: 2, x: 2.25, z: -1.1, shirt: '#d59717', reward: 60, title: 'BOSS' }
];

function loadSupply() {
  const fallback = { inventory: { ...FREE_PACK }, nextClaim: Date.now() + HOUR };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved?.inventory || !saved?.nextClaim) return fallback;
    return saved as { inventory: Inventory; nextClaim: number };
  } catch { return fallback; }
}

function Target({ data, visible, onHit }: { data: typeof TARGETS[number]; visible: boolean; onHit: (head: boolean, id: number) => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, visible ? 0 : -1.6, 9, delta);
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 2.4 + data.id) * 0.08;
  });
  const shoot = (head: boolean) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (visible) onHit(head, data.id);
  };
  return <group ref={ref} position={[data.x, -1.6, data.z]}>
    <mesh position={[0, 1.78, 0]} castShadow onPointerDown={shoot(true)}>
      <sphereGeometry args={[0.32, 16, 12]} /><meshStandardMaterial color="#b97954" roughness={0.8} />
    </mesh>
    <mesh position={[0, 1.99, -0.04]} castShadow>
      <sphereGeometry args={[0.33, 12, 8, 0, Math.PI * 2, 0, 1.25]} /><meshStandardMaterial color="#17110e" />
    </mesh>
    <mesh position={[0, 1.02, 0]} castShadow onPointerDown={shoot(false)}>
      <capsuleGeometry args={[0.42, 0.85, 6, 12]} /><meshStandardMaterial color={data.shirt} roughness={0.62} />
    </mesh>
    {[-0.52, 0.52].map((x) => <mesh key={x} position={[x, 1.08, 0]} rotation={[0, 0, x > 0 ? 0.2 : -0.2]} castShadow>
      <capsuleGeometry args={[0.12, 0.7, 5, 10]} /><meshStandardMaterial color={data.shirt} />
    </mesh>)}
  </group>;
}

function Car({ x, color }: { x: number; color: string }) {
  return <group position={[x, -0.48, 0.1]}>
    <mesh castShadow><boxGeometry args={[1.8, 0.68, 0.9]} /><meshStandardMaterial color={color} metalness={0.55} roughness={0.3} /></mesh>
    <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[1.05, 0.45, 0.76]} /><meshStandardMaterial color="#172435" metalness={0.65} roughness={0.2} /></mesh>
    {[-0.62, 0.62].map((x2) => <mesh key={x2} position={[x2, -0.36, 0.47]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.24, 0.24, 0.16, 16]} /><meshStandardMaterial color="#08090b" />
    </mesh>)}
  </group>;
}

function Arena({ visible, selected, onHit, onMiss }: { visible: boolean[]; selected: AmmoKind; onHit: (head: boolean, id: number) => void; onMiss: () => void }) {
  return <>
    <color attach="background" args={['#7f9caf']} /><fog attach="fog" args={['#7f9caf', 8, 18]} />
    <hemisphereLight intensity={1.7} groundColor="#30373a" /><directionalLight position={[-4, 8, 5]} intensity={2.1} castShadow shadow-mapSize={[512, 512]} />
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={(event) => { event.stopPropagation(); onMiss(); }}>
      <planeGeometry args={[28, 28]} /><meshStandardMaterial color="#555d5f" roughness={0.95} />
    </mesh>
    <gridHelper position={[0, -0.98, 0]} args={[20, 20, '#777f80', '#4d5455']} />
    <Car x={-2.25} color="#203d63" /><Car x={2.25} color="#5b2630" />
    <group position={[0, -0.43, 0]}><mesh castShadow><boxGeometry args={[1.55, 1.05, 0.82]} /><meshStandardMaterial color="#74502d" roughness={0.9} /></mesh><mesh position={[0, 0, 0.42]}><boxGeometry args={[1.25, 0.08, 0.03]} /><meshStandardMaterial color="#b68449" /></mesh></group>
    {TARGETS.map((target, index) => <Target key={target.id} data={target} visible={visible[index]} onHit={onHit} />)}
    <mesh position={[3.5, 2.3, -4]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color={AMMO[selected].color} emissive={AMMO[selected].color} /></mesh>
  </>;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function AirdropGame() {
  const supply = useMemo(loadSupply, []);
  const [phase, setPhase] = useState<Phase>('briefing');
  const [inventory, setInventory] = useState<Inventory>(supply.inventory);
  const [nextClaim, setNextClaim] = useState(supply.nextClaim);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<AmmoKind>('egg');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [seconds, setSeconds] = useState(45);
  const [visible, setVisible] = useState([true, false, true]);
  const [message, setMessage] = useState('');
  const [muted, setMuted] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ inventory, nextClaim })), [inventory, nextClaim]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000);
    const popper = window.setInterval(() => setVisible(TARGETS.map(() => Math.random() > 0.48)), 1050);
    return () => { clearInterval(timer); clearInterval(popper); };
  }, [phase]);
  useEffect(() => { if (phase === 'playing' && seconds <= 0) setPhase('results'); }, [phase, seconds]);

  const claim = () => {
    if (now < nextClaim) return;
    setInventory((current) => Object.fromEntries(Object.keys(FREE_PACK).map((key) => [key, current[key as AmmoKind] + FREE_PACK[key as AmmoKind]])) as Inventory);
    setNextClaim(now + HOUR);
    setMessage('FREE SUPPLY DELIVERED!');
  };
  const spend = useCallback(() => {
    if (phase !== 'playing' || inventory[selected] <= 0) return false;
    setInventory((current) => ({ ...current, [selected]: current[selected] - 1 }));
    return true;
  }, [inventory, phase, selected]);
  const onHit = useCallback((head: boolean, id: number) => {
    if (!spend()) return;
    const target = TARGETS[id];
    const points = Math.round(target.reward * AMMO[selected].damage * (head ? 2 : 1) + combo * 3);
    setScore((value) => value + points); setCombo((value) => value + 1);
    setVisible((current) => current.map((value, index) => index === id ? false : value));
    setMessage(`${head ? 'HEADSHOT' : 'SPLAT'} +${points} TPG`);
    navigator.vibrate?.(head ? [30, 25, 45] : 25);
  }, [combo, selected, spend]);
  const onMiss = useCallback(() => { if (spend()) { setCombo(0); setMessage('MISS'); } }, [spend]);
  const start = () => { setScore(0); setCombo(0); setSeconds(45); setVisible([true, false, true]); setMessage(''); setPhase('playing'); };

  const remainingAmmo = Object.values(inventory).reduce((sum, count) => sum + count, 0);
  return <main className="splat-page">
    <header className="splat-top"><Link to="/" aria-label="Back to home"><ArrowLeft /></Link><div><small>TPG AIRDROP GAME</small><strong>SPLAT SQUAD</strong></div><button aria-label="Toggle sound" onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX /> : <Volume2 />}</button></header>
    <section className="splat-supply"><div><Gift /><span><strong>Hourly supply drop</strong><small>Free eggs, fruit & vegetables</small></span></div><button disabled={now < nextClaim} onClick={claim}>{now >= nextClaim ? 'CLAIM FREE' : <><Clock3 /> {formatCountdown(nextClaim - now)}</>}</button></section>
    <section className="splat-stats"><div><small>TIME</small><b>{seconds}s</b></div><div><small>SCORE</small><b>{score.toLocaleString()}</b></div><div><small>COMBO</small><b>x{combo}</b></div></section>
    <section className="splat-arena">
      <Suspense fallback={<div className="splat-loading">Building arena…</div>}><Canvas shadows camera={{ position: [0, 1.55, 6.8], fov: 48 }} dpr={[1, 1.35]} gl={{ antialias: true, powerPreference: 'high-performance' }}><Arena visible={visible} selected={selected} onHit={onHit} onMiss={onMiss} /></Canvas></Suspense>
      <Crosshair className="splat-reticle" />{message && phase === 'playing' && <div className="splat-toast" key={message + score}>{message}</div>}
      {phase !== 'playing' && <div className="splat-modal"><span>{phase === 'results' ? 'ROUND COMPLETE' : '45 SECOND AIRDROP RUN'}</span><h1>{phase === 'results' ? `${score.toLocaleString()} TPG` : 'Aim. Throw. Earn.'}</h1><p>Targets hide behind vehicles and boxes. Body hits earn TPG; visually higher headshots pay <b>2×</b>.</p><div className="splat-values">{TARGETS.map((target) => <small key={target.id}>{target.title} <b>{target.reward}</b></small>)}</div><button disabled={remainingAmmo === 0} onClick={start}>{phase === 'results' && <RotateCcw />}{remainingAmmo ? (phase === 'results' ? 'PLAY AGAIN' : 'START GAME') : 'CLAIM AMMO TO PLAY'}</button></div>}
    </section>
    <section className="splat-armory"><div><strong>THROWABLES</strong><small>{remainingAmmo} total shots</small></div><div className="splat-ammo">{(Object.keys(AMMO) as AmmoKind[]).map((kind) => <button key={kind} className={selected === kind ? 'selected' : ''} disabled={!inventory[kind]} onClick={() => setSelected(kind)}><b>{AMMO[kind].icon}</b><span>{AMMO[kind].label}</span><em>{inventory[kind]}</em></button>)}</div></section>
    <footer><Trophy /> Headshots and harder throwables multiply rewards. TPG is credited after fair-play verification.</footer>
  </main>;
}
