import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WEAPON_COUNT = 18;
const GRID_COLS = 3;
const GRID_ROWS = 6;
const GAP_X = 2.35;
const GAP_Z = 1.48;
const FPS_SHOTGUN_DISPLAY_LENGTH = 1.18;

const PELLET_SPEED = 30;
const PELLET_LIFETIME = 3.2;
const PELLET_TRAIL_POINTS = 14;

const WEAPON_TYPES = ['rifle', 'pistol', 'sniper'] as const;
type WeaponType = (typeof WEAPON_TYPES)[number];
type CameraMode = 'overview' | 'player' | 'projectile' | 'impact';
type AttackType = 'firearm' | 'truck' | 'drone' | 'helicopter' | 'jet';

type WeaponEntry = { id: string; name: string; shortName: string; source: 'Quaternius' | 'Extra'; weaponType: WeaponType; urls: string[]; attackType: AttackType };
type RuntimeWeapon = { entry: WeaponEntry; slot: THREE.Group; root: THREE.Object3D; muzzle: THREE.Object3D; basePosition: THREE.Vector3; index: number };
type Projectile = { owner: number; mesh: THREE.Mesh; trail: THREE.Line; history: THREE.Vector3[]; velocity: THREE.Vector3; age: number; alive: boolean };

type VehicleState = {
  type: AttackType;
  group: THREE.Group;
  parking: THREE.Vector3;
  active: boolean;
  phase: 'lift' | 'approach' | 'attack' | 'return';
  t: number;
  missileLaunched: boolean;
  rotor?: THREE.Mesh;
};

const polyGlb = (uuid: string) => `https://static.poly.pizza/${uuid}.glb`;
const EXTRA = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
};

const WEAPON_MANIFEST: WeaponEntry[] = [
  { id: 'poly-shotgun-01', name: 'Quaternius Shotgun', shortName: 'Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')], attackType: 'firearm' },
  { id: 'poly-assault-rifle-01', name: 'Quaternius Assault Rifle', shortName: 'Assault Rifle', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')], attackType: 'firearm' },
  { id: 'poly-pistol-01', name: 'Quaternius Pistol', shortName: 'Pistol', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')], attackType: 'firearm' },
  { id: 'poly-revolver-01', name: 'Quaternius Heavy Revolver', shortName: 'Heavy Revolver', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')], attackType: 'firearm' },
  { id: 'poly-sawed-off-01', name: 'Quaternius Sawed-Off Shotgun', shortName: 'Sawed-Off', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')], attackType: 'firearm' },
  { id: 'poly-revolver-02', name: 'Quaternius Revolver Silver', shortName: 'Silver Revolver', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')], attackType: 'firearm' },
  { id: 'poly-shotgun-02', name: 'Quaternius Long Shotgun', shortName: 'Long Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')], attackType: 'firearm' },
  { id: 'poly-shotgun-03', name: 'Quaternius Pump Shotgun', shortName: 'Pump Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')], attackType: 'firearm' },
  { id: 'poly-smg-01', name: 'Quaternius Submachine Gun', shortName: 'SMG', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')], attackType: 'firearm' },
  { id: 'slot-10', name: 'AK47', shortName: 'AK47', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp], attackType: 'truck' },
  { id: 'slot-11', name: 'KRSV', shortName: 'KRSV', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp], attackType: 'firearm' },
  { id: 'slot-12', name: 'Smith', shortName: 'Smith', source: 'Extra', weaponType: 'pistol', urls: [EXTRA.awp], attackType: 'firearm' },
  { id: 'slot-13', name: 'Mosin', shortName: 'Mosin', source: 'Extra', weaponType: 'sniper', urls: [EXTRA.awp], attackType: 'firearm' },
  { id: 'slot-14', name: 'Uzi', shortName: 'Uzi', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp], attackType: 'drone' },
  { id: 'slot-15', name: 'SigSauer', shortName: 'SigSauer', source: 'Extra', weaponType: 'pistol', urls: [EXTRA.awp], attackType: 'firearm' },
  { id: 'slot-16', name: 'AWP', shortName: 'AWP', source: 'Extra', weaponType: 'sniper', urls: [EXTRA.awp], attackType: 'helicopter' },
  { id: 'slot-17', name: 'MRTK Gun', shortName: 'MRTK Gun', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp], attackType: 'jet' },
  { id: 'slot-18', name: 'FPS Gun', shortName: 'FPS Shotgun', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.fps, EXTRA.awp], attackType: 'firearm' },
];

const slotPosition = (i: number) => new THREE.Vector3((i % GRID_COLS - 1) * GAP_X, 0, (Math.floor(i / GRID_COLS) - (GRID_ROWS - 1) / 2) * GAP_Z);
const makeLoader = (url: string) => { const base = url.slice(0, url.lastIndexOf('/') + 1); const m = new THREE.LoadingManager(); m.setURLModifier((r) => (/^(https?:)?\/\//i.test(r) ? r : new URL(r, base).toString())); return new GLTFLoader(m); };
const normalizeWeapon = (m: THREE.Object3D) => { const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3()); const max = Math.max(size.x, size.y, size.z); if (max > 0) m.scale.setScalar(FPS_SHOTGUN_DISPLAY_LENGTH / max); const n = new THREE.Box3().setFromObject(m); const c = n.getCenter(new THREE.Vector3()); m.position.sub(c); m.position.y += -n.min.y + 0.08; };

export default function ChessBattleRoyaleStore() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimesRef = useRef<RuntimeWeapon[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const vehicleStatesRef = useRef<VehicleState[]>([]);
  const selectedRef = useRef(0);
  const actorRef = useRef<THREE.Group | null>(null);
  const activeProjectileRef = useRef<Projectile | null>(null);
  const impactFocusUntilRef = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [status, setStatus] = useState('Loading weapons...');
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const selectedWeapon = useMemo(() => WEAPON_MANIFEST[selectedIndex], [selectedIndex]);
  useEffect(() => void (selectedRef.current = selectedIndex), [selectedIndex]);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0f172a');
    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 0.1, 200); camera.position.set(0, 8, 12);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(mount.clientWidth, mount.clientHeight); mount.innerHTML = ''; mount.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1.7)); const dir = new THREE.DirectionalLight(0xffffff, 1.8); dir.position.set(4, 10, 6); scene.add(dir);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 42), new THREE.MeshStandardMaterial({ color: '#1e293b' })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);
    const target = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.6), new THREE.MeshStandardMaterial({ color: '#f59e0b' })); target.position.set(0, 2.2, -15); scene.add(target);

    const actor = new THREE.Group();
    actor.position.set(-8.7, 0, 5.5);
    actor.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.2, 4, 8), new THREE.MeshStandardMaterial({ color: '#cbd5e1' })));
    scene.add(actor); actorRef.current = actor;

    const slots: THREE.Group[] = [];
    WEAPON_MANIFEST.forEach((_, i) => { const slot = new THREE.Group(); slot.position.copy(slotPosition(i)); scene.add(slot); slots.push(slot); });

    const spawnVehicle = (type: AttackType, sideX: number, sideZ: number) => {
      const g = new THREE.Group(); g.position.set(sideX, 0.2, sideZ);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: '#64748b' })));
      if (type === 'drone' || type === 'helicopter') {
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.08), new THREE.MeshStandardMaterial({ color: '#f8fafc' })); rotor.position.y = 0.28; g.add(rotor);
        vehicleStatesRef.current.push({ type, group: g, parking: g.position.clone(), active: false, phase: 'lift', t: 0, missileLaunched: false, rotor });
      } else {
        vehicleStatesRef.current.push({ type, group: g, parking: g.position.clone(), active: false, phase: 'lift', t: 0, missileLaunched: false });
      }
      scene.add(g);
    };
    spawnVehicle('drone', -11, 1.2); spawnVehicle('helicopter', -11, -1.4); spawnVehicle('jet', 11, 0.4);

    const pelletGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const pelletMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', emissive: '#1d4ed8', emissiveIntensity: 0.4 });
    const trailMaterial = new THREE.LineBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.7 });
    const clock = new THREE.Clock(); const vA = new THREE.Vector3(); const vB = new THREE.Vector3();

    const spawnProjectile = (from: THREE.Vector3, to: THREE.Vector3, owner: number, speedScale = 1) => {
      const dirToTarget = to.clone().sub(from).normalize();
      const mesh = new THREE.Mesh(pelletGeometry, pelletMaterial.clone()); mesh.position.copy(from); scene.add(mesh);
      const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]), trailMaterial.clone()); scene.add(trail);
      const projectile: Projectile = { owner, mesh, trail, history: [from.clone()], velocity: dirToTarget.multiplyScalar(PELLET_SPEED * speedScale), age: 0, alive: true };
      projectilesRef.current.push(projectile); activeProjectileRef.current = projectile; impactFocusUntilRef.current = performance.now() + 1500; setCameraMode('projectile');
    };

    const triggerVehicleAttack = (type: AttackType, owner: number) => {
      const vehicle = vehicleStatesRef.current.find((v) => v.type === type); if (!vehicle) return;
      vehicle.active = true; vehicle.phase = 'lift'; vehicle.t = 0; vehicle.missileLaunched = false;
      setStatus(`${type.toUpperCase()} lifting from side parking, then strike and return.`);
      const ticker = () => {
        if (!vehicle.active) return;
        vehicle.t += 0.025;
        const side = Math.sign(vehicle.parking.x);
        if (vehicle.phase === 'lift') {
          vehicle.group.position.y = THREE.MathUtils.lerp(vehicle.group.position.y, 2.9, 0.06);
          vehicle.group.position.x = THREE.MathUtils.lerp(vehicle.group.position.x, vehicle.parking.x - side * 1, 0.05);
          if (vehicle.type === 'drone' && vehicle.rotor) vehicle.rotor.rotation.y += vehicle.group.position.y > 0.9 ? 0.65 : 0;
          if (vehicle.t > 1) { vehicle.phase = 'approach'; vehicle.t = 0; }
        } else if (vehicle.phase === 'approach') {
          const p = vehicle.t;
          vehicle.group.position.x = THREE.MathUtils.lerp(vehicle.parking.x - side, 0, p);
          vehicle.group.position.z = THREE.MathUtils.lerp(vehicle.parking.z, -11.7, p);
          vehicle.group.position.y = 2.9 + Math.sin(p * Math.PI) * 1.1;
          if ((type !== 'drone' || !vehicle.missileLaunched) && p > 0.72) {
            vB.copy(target.position);
            spawnProjectile(vehicle.group.position.clone(), vB, owner, 1.25);
            vehicle.missileLaunched = true;
          }
          if (p >= 1) { vehicle.phase = 'return'; vehicle.t = 0; if (type === 'drone') vehicle.active = false; }
        } else if (vehicle.phase === 'return') {
          const p = vehicle.t;
          vehicle.group.position.lerp(vehicle.parking, 0.08);
          vehicle.group.position.y = THREE.MathUtils.lerp(vehicle.group.position.y, 0.2, 0.08);
          if (vehicle.rotor) vehicle.rotor.rotation.y += 0.42;
          if (p >= 1.4 || vehicle.group.position.distanceTo(vehicle.parking) < 0.2) { vehicle.active = false; vehicle.group.position.copy(vehicle.parking); }
        }
        requestAnimationFrame(ticker);
      };
      ticker();
    };

    const fireFromRuntime = (runtime: RuntimeWeapon) => {
      target.getWorldPosition(vB);
      if (runtime.entry.attackType === 'firearm') {
        runtime.slot.getWorldPosition(vA); actor.position.lerp(vA.clone().add(new THREE.Vector3(-0.8, 0, 0)), 1); actor.lookAt(vB);
        runtime.muzzle.getWorldPosition(vA); spawnProjectile(vA, vB, runtime.index, runtime.entry.weaponType === 'sniper' ? 1.8 : 1);
        setStatus(`Firearm attack: actor grabs ${runtime.entry.shortName}, aims, and fires visible rounds.`);
      } else if (runtime.entry.attackType === 'truck') {
        runtime.muzzle.getWorldPosition(vA); spawnProjectile(vA, vB, runtime.index, 1.25); setStatus('Truck missile attack path activated.');
      } else {
        triggerVehicleAttack(runtime.entry.attackType, runtime.index);
      }
    };

    WEAPON_MANIFEST.forEach(async (entry, index) => {
      try { let gltf: GLTF | null = null; for (const url of entry.urls) { try { gltf = await new Promise<GLTF>((resolve, reject) => makeLoader(url).load(url, resolve, undefined, reject)); break; } catch {} } if (!gltf) throw new Error('fail'); const model = gltf.scene; normalizeWeapon(model); slots[index].add(model); const muzzle = new THREE.Object3D(); muzzle.position.set(0.55, 0.2, 0); model.add(muzzle); runtimesRef.current.push({ entry, slot: slots[index], root: model, muzzle, basePosition: model.position.clone(), index }); setLoadedCount((v) => v + 1); }
      catch { const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.15), new THREE.MeshStandardMaterial({ color: '#94a3b8' })); slots[index].add(fallback); const muzzle = new THREE.Object3D(); muzzle.position.set(0.45, 0.04, 0); fallback.add(muzzle); runtimesRef.current.push({ entry, slot: slots[index], root: fallback, muzzle, basePosition: fallback.position.clone(), index }); setFailedCount((v) => v + 1); }
    });

    const fireSelected = () => { const runtime = runtimesRef.current.find((r) => r.index === selectedRef.current); if (runtime) fireFromRuntime(runtime); };
    const fireAll = () => runtimesRef.current.forEach((runtime, i) => setTimeout(() => fireFromRuntime(runtime), i * 150));
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') fireSelected(); if (e.key.toLowerCase() === 'f') fireAll(); });

    const animate = () => {
      requestAnimationFrame(animate);
      const d = Math.min(clock.getDelta(), 0.033);
      runtimesRef.current.forEach((r) => { const selected = r.index === selectedRef.current; r.root.position.y = THREE.MathUtils.lerp(r.root.position.y, r.basePosition.y + (selected ? 0.38 : 0), 0.14); });
      projectilesRef.current.forEach((p) => { if (!p.alive) return; p.age += d; p.mesh.position.addScaledVector(p.velocity, d); p.history.push(p.mesh.position.clone()); if (p.history.length > PELLET_TRAIL_POINTS) p.history.shift(); p.trail.geometry.dispose(); p.trail.geometry = new THREE.BufferGeometry().setFromPoints(p.history); if (p.age > PELLET_LIFETIME || p.mesh.position.distanceTo(target.position) < 1.1) { p.alive = false; impactFocusUntilRef.current = performance.now() + 1200; setCameraMode('impact'); } });
      if (activeProjectileRef.current?.alive) { const p = activeProjectileRef.current; const dirTo = p.velocity.clone().normalize(); camera.position.lerp(p.mesh.position.clone().addScaledVector(dirTo, -1.2).add(new THREE.Vector3(0, 0.35, 0.2)), 0.18); camera.lookAt(p.mesh.position.clone().addScaledVector(dirTo, 2.8)); }
      else if (performance.now() < impactFocusUntilRef.current) { camera.position.lerp(new THREE.Vector3(0, 3.5, -9.5), 0.1); camera.lookAt(target.position); }
      else { if (cameraMode !== 'overview') setCameraMode('overview'); const selected = runtimesRef.current.find((r) => r.index === selectedRef.current); if (selected) { selected.muzzle.getWorldPosition(vA); camera.position.lerp(vA.clone().add(new THREE.Vector3(0, 0.35, 0.72)), 0.08); camera.lookAt(target.position); } }
      renderer.render(scene, camera);
    }; animate();
    (window as any).fireSelectedWeapon = fireSelected; (window as any).fireAllWeapons = fireAll;
    return () => { renderer.dispose(); mount.innerHTML = ''; pelletGeometry.dispose(); pelletMaterial.dispose(); trailMaterial.dispose(); };
  }, []);

  return <div className='relative h-screen w-full overflow-hidden bg-slate-950 text-white'><div ref={mountRef} className='absolute inset-0' /><div className='absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs'><div className='font-black text-yellow-300'>Chess Battle Royale · Vehicle + Firearm Animations</div><div>{loadedCount}/{WEAPON_COUNT} loaded · {failedCount} fallback</div><div>{status}</div><div>Camera mode: {cameraMode}</div></div><div className='absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3'><div className='mb-2 text-xs font-black text-yellow-300'>Selected: {selectedIndex + 1}. {selectedWeapon.shortName}</div><div className='grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1'>{WEAPON_MANIFEST.map((weapon, index) => <button key={weapon.id} onClick={() => { selectedRef.current = index; setSelectedIndex(index); setStatus(`Selected ${index + 1}/${WEAPON_COUNT}: ${weapon.name} (${weapon.attackType})`); }} className={`rounded-xl border px-2 py-2 text-left text-[11px] font-bold ${selectedIndex === index ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-white/10 text-slate-100'}`}><span className='block text-[10px] opacity-70'>#{index + 1} · {weapon.weaponType} · {weapon.attackType}</span><span className='block truncate'>{weapon.shortName}</span></button>)}</div><div className='mt-2 flex gap-2'><button onClick={() => (window as any).fireSelectedWeapon?.()} className='rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-slate-950'>Fire Selected</button><button onClick={() => (window as any).fireAllWeapons?.()} className='rounded-xl bg-red-700 px-3 py-2 text-xs font-black'>Broadcast All</button></div></div></div>;
}
