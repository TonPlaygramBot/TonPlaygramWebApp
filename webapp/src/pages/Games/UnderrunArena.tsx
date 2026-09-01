import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import ArcadeMatchHeader from '../../components/ArcadeMatchHeader.jsx';
import useArcadeRace from '../../hooks/useArcadeRace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

// This is the same Ready Player Me sample used by Chess Battle Royal. The loader
// keeps a procedural officer visible when the remote model is unavailable.
const CHESS_AVATAR_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';
const WORLD_LIMIT = 16;

type Hud = { score: number; integrity: number; wave: number; detained: number; dash: boolean };
type Input = { x: number; y: number; dash: boolean };

function Parliament() {
  const windows = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    x: -8.5 + (index % 9) * 2.12,
    y: index < 9 ? 2.2 : 4.15
  })), []);
  return (
    <group position={[0, 0, -15]}>
      <mesh castShadow receiveShadow position={[0, 3.1, 0]}><boxGeometry args={[22, 6.2, 4.2]} /><meshStandardMaterial color="#e7dfd1" roughness={0.82} /></mesh>
      <mesh castShadow position={[-7.1, 4.3, 2.25]} rotation={[0, 0, -0.1]}><boxGeometry args={[7.5, 3.4, 0.55]} /><meshStandardMaterial color="#d9d0c0" /></mesh>
      <mesh castShadow position={[6.7, 4.1, 2.25]}><boxGeometry args={[7.5, 3.8, 0.55]} /><meshStandardMaterial color="#efe8dc" /></mesh>
      {windows.map((window, index) => <mesh key={index} position={[window.x, window.y, 2.36]}><boxGeometry args={[1.15, 1.05, 0.08]} /><meshStandardMaterial color="#1c3542" metalness={0.15} roughness={0.25} /></mesh>)}
      <mesh position={[0, 1.55, 2.4]}><boxGeometry args={[2.7, 3.1, 0.16]} /><meshStandardMaterial color="#56483e" /></mesh>
      <mesh position={[0, 6.55, 0]}><boxGeometry args={[22.6, 0.35, 4.7]} /><meshStandardMaterial color="#c8beb0" /></mesh>
      <group position={[0, 7.1, 0]}>
        <mesh><cylinderGeometry args={[0.06, 0.06, 2.5]} /><meshStandardMaterial color="#a6a6a6" metalness={0.7} /></mesh>
        <mesh position={[0.55, 0.65, 0]}><planeGeometry args={[1.1, 0.72]} /><meshStandardMaterial color="#d91e36" side={THREE.DoubleSide} /></mesh>
      </group>
      <mesh receiveShadow position={[0, 0.14, 4.7]}><boxGeometry args={[13, 0.28, 5.2]} /><meshStandardMaterial color="#d6d0c5" /></mesh>
      {[2.8, 3.45, 4.1].map((z) => <mesh key={z} receiveShadow position={[0, 0.08 + (z - 2.8) * 0.1, z]}><boxGeometry args={[8, 0.2, 0.7]} /><meshStandardMaterial color="#bcb5aa" /></mesh>)}
      <mesh position={[-8.1, 4.9, 2.72]}><boxGeometry args={[4.5, 0.65, 0.08]} /><meshStandardMaterial color="#d7d0c5" /></mesh>
      <TextSign />
    </group>
  );
}

function TextSign() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
    const context = canvas.getContext('2d')!; context.fillStyle = '#d7d0c5'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#4c4540'; context.font = '700 31px Georgia'; context.textAlign = 'center'; context.fillText('KUVENDI I SHQIPËRISË', 384, 59);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }, []);
  return <mesh position={[-8.1, 4.9, 2.78]}><planeGeometry args={[4.5, 0.56]} /><meshBasicMaterial map={texture} /></mesh>;
}

function canvasTexture(size: number, paint: (context: CanvasRenderingContext2D, size: number) => void, repeat = 1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; paint(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
  return texture;
}

/** Typed R3F port of the road, pavement and façade generator in examples/tirana-2040.html. */
function Tirana2040City() {
  const textures = useMemo(() => ({
    asphalt: canvasTexture(512, (context, size) => {
      context.fillStyle = '#2c323a'; context.fillRect(0, 0, size, size);
      for (let i = 0; i < 2100; i += 1) { context.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; context.fillRect(Math.random() * size, Math.random() * size, 1, 1); }
      for (let i = 0; i < 100; i += 1) { context.strokeStyle = 'rgba(0,0,0,.25)'; context.beginPath(); context.moveTo(Math.random() * size, Math.random() * size); context.lineTo(Math.random() * size, Math.random() * size); context.stroke(); }
    }, 12),
    sidewalk: canvasTexture(512, (context, size) => {
      context.fillStyle = '#c9ced6'; context.fillRect(0, 0, size, size); context.strokeStyle = '#9aa0a8'; context.lineWidth = 5;
      for (let step = 0; step < size; step += 64) { context.beginPath(); context.moveTo(step, 0); context.lineTo(step, size); context.stroke(); context.beginPath(); context.moveTo(0, step); context.lineTo(size, step); context.stroke(); }
    }, 10)
  }), []);
  useEffect(() => () => { textures.asphalt.dispose(); textures.sidewalk.dispose(); }, [textures]);
  const facadeTextures = useMemo(() => [205, 225, 190, 245, 215, 178, 260, 198].map(hue => canvasTexture(256, (context, size) => {
    context.fillStyle = `hsl(${hue},16%,74%)`; context.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row += 1) for (let column = 0; column < 5; column += 1) {
      const x = 13 + column * 49; const y = 12 + row * 31; const gradient = context.createLinearGradient(0, y, 0, y + 20);
      gradient.addColorStop(0, '#edf5ff'); gradient.addColorStop(0.5, '#96b4dc'); gradient.addColorStop(1, '#3c5078');
      context.fillStyle = gradient; context.fillRect(x, y, 29, 19); context.strokeStyle = '#181c26'; context.strokeRect(x, y, 29, 19);
    }
  })), []);
  useEffect(() => () => facadeTextures.forEach(texture => texture.dispose()), [facadeTextures]);
  const towers = [[-24, -14, 9, 14, 8], [24, -15, 11, 19, 9], [-27, 5, 12, 24, 10], [28, 7, 13, 28, 11], [-25, 24, 10, 20, 9], [25, 25, 12, 23, 10], [-8, 30, 10, 18, 9], [9, 32, 11, 22, 10]];
  const roads = [-18, 0, 18];
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[76, 86]} /><meshStandardMaterial color="#888f83" roughness={1} /></mesh>
    {roads.map(x => <group key={`vertical-${x}`}>
      <mesh receiveShadow position={[x, 0.015, 7]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[8, 78]} /><meshStandardMaterial map={textures.asphalt} roughness={0.92} /></mesh>
      {[-4.7, 4.7].map(offset => <mesh key={offset} position={[x + offset, 0.022, 7]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.4, 78]} /><meshStandardMaterial map={textures.sidewalk} roughness={0.9} /></mesh>)}
      {Array.from({ length: 13 }, (_, index) => <mesh key={index} position={[x, 0.035, -27 + index * 6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.18, 3]} /><meshBasicMaterial color="#f8f4df" /></mesh>)}
    </group>)}
    {[-2, 22].map(z => <group key={`horizontal-${z}`}>
      <mesh receiveShadow position={[0, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[72, 8]} /><meshStandardMaterial map={textures.asphalt} roughness={0.92} /></mesh>
      {[-4.7, 4.7].map(offset => <mesh key={offset} position={[0, 0.025, z + offset]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[72, 1.4]} /><meshStandardMaterial map={textures.sidewalk} roughness={0.9} /></mesh>)}
      {Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-33 + index * 6, 0.038, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3, 0.18]} /><meshBasicMaterial color="#f8f4df" /></mesh>)}
    </group>)}
    {[-18, 0, 18].flatMap(x => [-2, 22].flatMap(z => Array.from({ length: 6 }, (_, stripe) => <mesh key={`${x}-${z}-${stripe}`} position={[x - 2.8 + stripe * 1.1, 0.045, z - 3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.55, 3.5]} /><meshBasicMaterial color="#fff" /></mesh>)))}
    {towers.map(([x, z, width, height, depth], index) => <mesh key={index} castShadow receiveShadow position={[x, height / 2, z]}><boxGeometry args={[width, height, depth]} /><meshStandardMaterial map={facadeTextures[index]} roughness={0.78} metalness={0.05} /></mesh>)}
    {[-12, 12].flatMap(x => [10, 17, 27].map(z => <Tree key={`${x}-${z}`} position={[x, 0, z]} />))}
  </group>;
}

function Tree({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow position={[0, 1.1, 0]}><cylinderGeometry args={[0.16, 0.24, 2.2, 7]} /><meshStandardMaterial color="#66503c" /></mesh><mesh castShadow position={[0, 2.7, 0]}><icosahedronGeometry args={[1.25, 1]} /><meshStandardMaterial color="#3f6f49" roughness={1} /></mesh></group>;
}

function PoliceCar({ position, rotation = 0 }: { position: [number, number, number], rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh castShadow position={[0, 0.55, 0]}><boxGeometry args={[2.7, 0.7, 1.35]} /><meshStandardMaterial color="#e8edf0" metalness={0.2} /></mesh>
    <mesh castShadow position={[0.15, 1.05, 0]}><boxGeometry args={[1.35, 0.55, 1.15]} /><meshStandardMaterial color="#263d49" metalness={0.4} /></mesh>
    <mesh position={[0, 0.6, 0.7]}><boxGeometry args={[1.5, 0.28, 0.04]} /><meshStandardMaterial color="#1b4f8a" /></mesh>
    {[-0.82, 0.82].flatMap((x) => [-0.62, 0.62].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.35, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 0.18, 12]} /><meshStandardMaterial color="#151719" /></mesh>))}
    <mesh position={[0.15, 1.4, 0]}><boxGeometry args={[0.65, 0.13, 0.18]} /><meshStandardMaterial color="#2476da" emissive="#1d5fd0" emissiveIntensity={1.4} /></mesh>
  </group>;
}

function Human({ position, uniform = false, scale = 1 }: { position: [number, number, number], uniform?: boolean, scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, 1.72, 0]}><sphereGeometry args={[0.23, 12, 10]} /><meshStandardMaterial color="#c58f6c" /></mesh>
    <mesh castShadow position={[0, 1.05, 0]}><capsuleGeometry args={[0.3, 0.75, 5, 10]} /><meshStandardMaterial color={uniform ? '#172d49' : '#7c2634'} /></mesh>
    {[-0.17, 0.17].map(x => <mesh key={x} castShadow position={[x, 0.35, 0]}><capsuleGeometry args={[0.105, 0.55, 4, 8]} /><meshStandardMaterial color={uniform ? '#172331' : '#24272d'} /></mesh>)}
    {uniform && <mesh position={[0, 1.98, 0]}><cylinderGeometry args={[0.27, 0.3, 0.16, 12]} /><meshStandardMaterial color="#14243b" /></mesh>}
  </group>;
}

function ChessAvatar() {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let active = true;
    new GLTFLoader().load(CHESS_AVATAR_URL, gltf => { if (active) setScene(cloneSkinned(gltf.scene)); }, undefined, () => {});
    return () => { active = false; };
  }, []);
  if (!scene) return <Human position={[0, 0, 0]} uniform />;
  return <primitive object={scene} scale={0.95} rotation={[0, Math.PI, 0]} />;
}

function CameraFollow({ target }: { target: React.MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const desired = new THREE.Vector3(target.current.x, 11, target.current.z + 13);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
    camera.lookAt(target.current.x, 0.7, target.current.z - 4);
  });
  return null;
}

function CityGame({ input, onHud }: { input: React.MutableRefObject<Input>, onHud: (hud: Hud) => void }) {
  const player = useRef(new THREE.Vector3(0, 0, 7));
  const playerGroup = useRef<THREE.Group>(null);
  const enemyRefs = useRef<THREE.Group[]>([]);
  const enemies = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ angle: (i / 12) * Math.PI * 2, speed: 0.65 + (i % 4) * 0.1 })), []);
  const elapsed = useRef(0); const score = useRef(0); const integrity = useRef(100); const lastHud = useRef(0); const dashCooldown = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt; dashCooldown.current = Math.max(0, dashCooldown.current - dt);
    let speed = 5;
    if (input.current.dash && dashCooldown.current <= 0) { speed = 13; dashCooldown.current = 3.5; input.current.dash = false; }
    player.current.x = THREE.MathUtils.clamp(player.current.x + input.current.x * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
    player.current.z = THREE.MathUtils.clamp(player.current.z + input.current.y * speed * dt, -7, 20);
    if (playerGroup.current) { playerGroup.current.position.copy(player.current); if (Math.abs(input.current.x) + Math.abs(input.current.y) > 0.1) playerGroup.current.rotation.y = Math.atan2(input.current.x, input.current.y); }
    enemyRefs.current.forEach((enemy, i) => {
      if (!enemy) return; const config = enemies[i]; const wave = 1 + Math.floor(elapsed.current / 20);
      enemy.position.x = Math.sin(elapsed.current * config.speed + config.angle) * (8 + i % 3);
      enemy.position.z += dt * (0.7 + wave * 0.12);
      if (enemy.position.z > 5) { enemy.position.z = -11 - (i % 4) * 2; integrity.current = Math.max(0, integrity.current - 4); }
      if (enemy.position.distanceTo(player.current) < 1.35) { score.current += 150; enemy.position.z = -12 - Math.random() * 8; }
    });
    if (elapsed.current - lastHud.current > 0.12) { lastHud.current = elapsed.current; onHud({ score: score.current, integrity: integrity.current, wave: 1 + Math.floor(elapsed.current / 20), detained: Math.floor(score.current / 150), dash: dashCooldown.current <= 0 }); }
  });
  return <>
    <color attach="background" args={['#9fc5df']} /><fog attach="fog" args={['#a7bdc8', 32, 72]} />
    <Sky distance={450000} sunPosition={[8, 12, 5]} turbidity={4} rayleigh={1.8} />
    <ambientLight intensity={1.2} /><directionalLight castShadow intensity={2.6} position={[12, 24, 10]} shadow-mapSize={[1024, 1024]} shadow-camera-far={65} />
    <Tirana2040City />
    <Parliament />
    <PoliceCar position={[-7, 0, -6]} rotation={Math.PI / 2} /><PoliceCar position={[7, 0, -6]} rotation={-Math.PI / 2} />
    {[-10, -6, 6, 10].map((x, i) => <Human key={x} position={[x, 0, -8 + (i % 2)]} uniform />)}
    {enemies.map((_, i) => <group key={i} ref={(node) => { if (node) enemyRefs.current[i] = node; }} position={[0, 0, -12 - (i % 4) * 3]}><Human position={[0, 0, 0]} scale={0.92} /></group>)}
    <group ref={playerGroup}><ChessAvatar /><pointLight color="#53b7ff" intensity={2} distance={5} position={[0, 2.2, 0]} /></group>
    <CameraFollow target={player} />
  </>;
}

export default function UnderrunArena() {
  useTelegramBackButton();
  const [hud, setHud] = useState<Hud>({ score: 0, integrity: 100, wave: 1, detained: 0, dash: true });
  const input = useRef<Input>({ x: 0, y: 0, dash: false });
  const pointer = useRef({ id: -1, x: 0, y: 0 });
  const race = useArcadeRace('underrunarena', hud.score);
  const updateHud = useCallback((next: Hud) => setHud(next), []);
  const down = (event: React.PointerEvent) => { pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: React.PointerEvent) => { if (pointer.current.id !== event.pointerId) return; input.current.x = THREE.MathUtils.clamp((event.clientX - pointer.current.x) / 45, -1, 1); input.current.y = THREE.MathUtils.clamp((event.clientY - pointer.current.y) / 45, -1, 1); };
  const up = () => { pointer.current.id = -1; input.current.x = 0; input.current.y = 0; };
  return <main className="flex h-screen flex-col overflow-hidden bg-[#071019] text-white">
    <ArcadeMatchHeader title="Tirana: Parliament Shield" score={hud.score} opponentScore={race.opponentScore} online={race.online} startsAt={race.startsAt} endsAt={race.endsAt} />
    <section className="mx-3 mb-2 rounded-2xl border border-sky-200/20 bg-[#0a1720]/95 px-3 py-2 shadow-xl">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em]"><span className="text-sky-300">Wave {hud.wave} · {hud.detained} secured</span><span className="text-red-300">Protect the Kuvendi</span></div>
      <div className="mt-2 flex items-center gap-2"><span className="text-[9px] font-bold text-white/55">INTEGRITY</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-red-500 via-amber-300 to-emerald-400 transition-all" style={{ width: `${hud.integrity}%` }} /></div><strong className="text-xs">{hud.integrity}%</strong></div>
    </section>
    <div className="relative mx-3 mb-[max(.75rem,env(safe-area-inset-bottom))] min-h-0 flex-1 overflow-hidden rounded-[1.7rem] border border-sky-200/25 shadow-[0_12px_55px_rgba(0,0,0,.55)] touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Canvas shadows dpr={[1, 1.55]} camera={{ fov: 54, near: 0.1, far: 140, position: [0, 11, 20] }} gl={{ antialias: true, powerPreference: 'high-performance' }}><CityGame input={input} onHud={updateHud} /></Canvas>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[64%] rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 backdrop-blur-md"><p className="text-[9px] font-black uppercase tracking-[.18em] text-sky-200">📍 Kuvendi, Tirana · 41.326° N</p><p className="mt-1 text-[9px] leading-4 text-white/65">Drag to patrol. Intercept intruders before they reach Parliament.</p></div>
      <div className="pointer-events-none absolute bottom-4 left-4 grid h-20 w-20 place-items-center rounded-full border border-white/25 bg-black/25 backdrop-blur"><div className="h-9 w-9 rounded-full border border-sky-200/40 bg-sky-300/20" /></div>
      <button type="button" disabled={!hud.dash} onClick={(event) => { event.stopPropagation(); input.current.dash = true; }} className="absolute bottom-4 right-4 h-16 w-16 rounded-full border-2 border-sky-200/50 bg-sky-500/25 text-[10px] font-black uppercase tracking-widest backdrop-blur active:scale-90 disabled:opacity-35"><span className="block text-xl">🚨</span>Sprint</button>
      {hud.integrity <= 0 && <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-8 text-center backdrop-blur"><div><div className="text-5xl">🇦🇱</div><strong className="mt-3 block text-2xl">Perimeter breached</strong><p className="mt-2 text-sm text-white/60">Score {hud.score.toLocaleString()} · Refresh to redeploy</p></div></div>}
    </div>
  </main>;
}
