import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { Environment, Float, Text } from '@react-three/drei';
import { ArrowLeft, Crosshair, RotateCcw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './airdropGame.css';

type Ammo = 'egg' | 'tomato' | 'orange';
type Target = { id: number; x: number; z: number; color: string; reward: number; name: string };
const TARGETS: Target[] = [
  { id: 0, x: -2.25, z: -1.4, color: '#536dfe', reward: 35, name: 'ROOKIE' },
  { id: 1, x: 0, z: -2.6, color: '#ef5350', reward: 55, name: 'RUNNER' },
  { id: 2, x: 2.25, z: -1.2, color: '#ffc107', reward: 80, name: 'BOSS' }
];
const AMMO: Record<Ammo, { icon: string; color: string; shots: number }> = {
  egg: { icon: '🥚', color: '#fff8d8', shots: 12 }, tomato: { icon: '🍅', color: '#e53935', shots: 8 }, orange: { icon: '🍊', color: '#ff9800', shots: 6 }
};

function Human({ target, active, onHit }: { target: Target; active: boolean; onHit: (head: boolean, target: Target) => void }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, active ? 0.15 : -1.35, 7, delta);
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 2 + target.id) * .1;
  });
  const hit = (head: boolean) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (active) onHit(head, target); };
  return <group ref={group} position={[target.x, -1.35, target.z]}>
    <mesh position={[0, 1.72, 0]} castShadow onPointerDown={hit(true)}><sphereGeometry args={[.31, 24, 18]} /><meshStandardMaterial color="#c78e68" roughness={.75} /></mesh>
    <mesh position={[0, 1.92, -.03]} castShadow><sphereGeometry args={[.32, 16, 10, 0, Math.PI * 2, 0, 1.4]} /><meshStandardMaterial color="#201813" roughness={1} /></mesh>
    <mesh position={[0, .95, 0]} castShadow onPointerDown={hit(false)}><capsuleGeometry args={[.43, .85, 8, 16]} /><meshStandardMaterial color={target.color} roughness={.55} /></mesh>
    <mesh position={[-.52, 1.05, 0]} rotation={[0, 0, -.18]} castShadow><capsuleGeometry args={[.12, .7, 6, 12]} /><meshStandardMaterial color={target.color} /></mesh>
    <mesh position={[.52, 1.05, 0]} rotation={[0, 0, .18]} castShadow><capsuleGeometry args={[.12, .7, 6, 12]} /><meshStandardMaterial color={target.color} /></mesh>
    <Text position={[0, 2.48, 0]} fontSize={.18} color="#ffe372" outlineWidth={.015} outlineColor="#000">{target.name} · {target.reward} TPG</Text>
  </group>;
}

function Cover({ x, kind }: { x: number; kind: 'car' | 'crate' }) {
  if (kind === 'crate') return <group position={[x, -.37, 0]}><mesh castShadow receiveShadow><boxGeometry args={[1.55, 1.18, .8]} /><meshStandardMaterial color="#7a4a25" roughness={.9} /></mesh><mesh position={[0, .02, .41]}><boxGeometry args={[1.25, .09, .03]} /><meshStandardMaterial color="#b7793c" /></mesh></group>;
  return <group position={[x, -.38, .1]}><mesh castShadow><boxGeometry args={[1.8, .72, .9]} /><meshStandardMaterial color="#23344c" metalness={.65} roughness={.26} /></mesh><mesh position={[0,.53,0]} castShadow><boxGeometry args={[1.05,.48,.76]} /><meshStandardMaterial color="#182537" metalness={.5} /></mesh>{[-.62,.62].map(v=><mesh key={v} position={[v,-.38,.45]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.25,.25,.16,20]} /><meshStandardMaterial color="#080a0d" /></mesh>)}</group>;
}

function Arena({ active, ammo, onHit }: { active: boolean[]; ammo: Ammo; onHit: (head: boolean, t: Target) => void }) {
  return <><color attach="background" args={['#7898ad']} /><fog attach="fog" args={['#7898ad', 7, 17]} /><ambientLight intensity={1.1} /><directionalLight position={[-4, 8, 5]} intensity={2.2} castShadow /><Environment preset="city" />
    <mesh position={[0,-1,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[30,30]} /><meshStandardMaterial color="#5a6162" roughness={.92} /></mesh><gridHelper position={[0,-.98,0]} args={[20,20,'#6d7475','#555b5c']} />
    <Cover x={-2.25} kind="car" /><Cover x={0} kind="crate" /><Cover x={2.25} kind="car" />{TARGETS.map((t,i)=><Human key={t.id} target={t} active={active[i]} onHit={onHit} />)}
    <Float speed={4} floatIntensity={.08}><mesh position={[3.5,2,-4]}><sphereGeometry args={[.12]} /><meshStandardMaterial color={AMMO[ammo].color} emissive={AMMO[ammo].color} emissiveIntensity={.3} /></mesh></Float></>;
}

export default function AirdropGame() {
  const [ammo, setAmmo] = useState<Ammo>('egg'); const [shots, setShots] = useState(AMMO.egg.shots); const [score, setScore] = useState(0); const [combo, setCombo] = useState(0); const [time, setTime] = useState(45); const [active, setActive] = useState([true, false, true]); const [started, setStarted] = useState(false); const [toast, setToast] = useState('');
  useEffect(() => { if (!started || time <= 0) return; const id = window.setInterval(() => setTime(v => v - 1), 1000); return () => clearInterval(id); }, [started, time]);
  useEffect(() => { if (!started || time <= 0) return; const id = window.setInterval(() => setActive(TARGETS.map(() => Math.random() > .45)), 1250); return () => clearInterval(id); }, [started, time]);
  const chooseAmmo = (next: Ammo) => { setAmmo(next); setShots(AMMO[next].shots); };
  const hit = useCallback((head: boolean, target: Target) => { if (!started || time <= 0 || shots <= 0) return; const gained = (head ? target.reward * 2 : target.reward) + combo * 5; setShots(v => v - 1); setScore(v => v + gained); setCombo(v => v + 1); setToast(`${head ? 'HEADSHOT! ' : 'SPLAT! '}+${gained} TPG`); setActive(v => v.map((x,i) => i === target.id ? false : x)); navigator.vibrate?.(head ? [30,25,50] : 25); window.setTimeout(() => setToast(''), 700); }, [combo, shots, started, time]);
  const reset = () => { setScore(0); setCombo(0); setTime(45); setShots(AMMO[ammo].shots); setActive([true,false,true]); setStarted(true); };
  return <main className="splat-page"><header className="splat-top"><Link to="/" aria-label="Back home"><ArrowLeft /></Link><div><small>TPG AIRDROP</small><strong>SPLAT SQUAD</strong></div><span><Trophy /> {score.toLocaleString()}</span></header>
    <section className="splat-stats"><div><small>TIME</small><b className={time < 10 ? 'danger' : ''}>00:{String(time).padStart(2,'0')}</b></div><div><small>COMBO</small><b>x{combo}</b></div><div><small>AMMO</small><b>{shots}</b></div></section>
    <section className="splat-arena"><Canvas shadows camera={{ position:[0,1.7,6.7], fov:48 }} dpr={[1,1.5]}><Arena active={active} ammo={ammo} onHit={hit} /></Canvas><div className="splat-reticle"><Crosshair /></div>{toast && <div className="splat-toast">{toast}</div>}{(!started || time <= 0) && <div className="splat-modal"><span>{time <= 0 ? 'ROUND COMPLETE' : 'TPG REWARD RANGE'}</span><h1>{time <= 0 ? `${score.toLocaleString()} TPG` : 'Ready to splat?'}</h1><p>Hit characters as they pop up. Headshots pay <b>2× rewards</b>. Don’t waste your food!</p><button onClick={reset}>{time <= 0 && <RotateCcw />} {time <= 0 ? 'PLAY AGAIN' : 'START ROUND'}</button></div>}</section>
    <section className="splat-armory"><div><span>CHOOSE YOUR THROW</span><small>Tap a target to fire</small></div><div className="splat-ammo">{(Object.keys(AMMO) as Ammo[]).map(a=><button key={a} className={ammo===a?'selected':''} onClick={()=>chooseAmmo(a)}><b>{AMMO[a].icon}</b><span>{a}</span><small>{AMMO[a].shots} shots</small></button>)}</div></section><footer><span><i /> LIVE AIRDROP</span><p>Rewards shown are in-game TPG points. Fair play checks apply.</p></footer></main>;
}
