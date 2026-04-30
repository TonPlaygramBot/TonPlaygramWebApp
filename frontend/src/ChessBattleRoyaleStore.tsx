import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WEAPON_COUNT = 18;
const GRID_COLS = 3;
const GRID_ROWS = 6;
const GAP_X = 2.35;
const GAP_Z = 1.48;
const FPS_SHOTGUN_DISPLAY_LENGTH = 1.18;
const PARKING_PAD_RADIUS = 0.62;

const PELLET_SPEED = 30;
const PELLET_LIFETIME = 3.2;
const PELLET_TRAIL_POINTS = 14;

const WEAPON_TYPES = ['rifle', 'pistol', 'sniper'] as const;
type WeaponType = (typeof WEAPON_TYPES)[number];
type CameraMode = 'overview' | 'player' | 'projectile' | 'impact';

type WeaponEntry = { id: string; name: string; shortName: string; source: 'Quaternius' | 'Extra'; weaponType: WeaponType; urls: string[] };
type RuntimeWeapon = { entry: WeaponEntry; slot: THREE.Group; root: THREE.Object3D; muzzle: THREE.Object3D; basePosition: THREE.Vector3; index: number };
type Projectile = {
  owner: number;
  mesh: THREE.Mesh;
  trail: THREE.Line;
  history: THREE.Vector3[];
  velocity: THREE.Vector3;
  age: number;
  alive: boolean;
};

const polyGlb = (uuid: string) => `https://static.poly.pizza/${uuid}.glb`;
const EXTRA = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
};



const weaponTypeIcon: Record<WeaponType, string> = {
  rifle: '🔫',
  pistol: '🗡️',
  sniper: '🎯',
};

const createFallbackWeapon = (weaponType: WeaponType) => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.45, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 0.16), material);
  body.position.set(0.05, 0.2, 0);
  group.add(body);

  const barrelLength = weaponType === 'sniper' ? 0.62 : weaponType === 'rifle' ? 0.48 : 0.33;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, barrelLength, 12), material);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.45 + barrelLength * 0.42, 0.24, 0);
  group.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.06), material);
  grip.rotation.z = 0.38;
  grip.position.set(-0.06, 0.05, 0);
  group.add(grip);

  return group;
};

const addSeatedHumanReference = (scene: THREE.Scene) => {
  const human = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 5, 10), bodyMaterial);
  torso.position.set(0, 1.15, 2.1);
  human.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), bodyMaterial);
  head.position.set(0, 1.72, 2.12);
  human.add(head);

  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.3), pantsMaterial);
  hip.position.set(0, 0.84, 2.04);
  human.add(hip);

  const makeLeg = (side: number) => {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.26, 4, 8), pantsMaterial);
    upper.rotation.z = side * 0.06;
    upper.rotation.x = -Math.PI / 2.05;
    upper.position.set(side * 0.16, 0.74, 2.26);

    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.24, 4, 8), pantsMaterial);
    lower.rotation.x = Math.PI / 7;
    lower.position.set(side * 0.16, 0.54, 2.55);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.28), new THREE.MeshStandardMaterial({ color: '#0f172a' }));
    foot.position.set(side * 0.16, 0.46, 2.7);
    human.add(upper, lower, foot);
  };

  makeLeg(-1);
  makeLeg(1);
  scene.add(human);
};
const WEAPON_MANIFEST: WeaponEntry[] = [
  { id: 'poly-shotgun-01', name: 'Quaternius Shotgun', shortName: 'Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')] },
  { id: 'poly-assault-rifle-01', name: 'Quaternius Assault Rifle', shortName: 'Assault Rifle', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')] },
  { id: 'poly-pistol-01', name: 'Quaternius Pistol', shortName: 'Pistol', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')] },
  { id: 'poly-revolver-01', name: 'Quaternius Heavy Revolver', shortName: 'Heavy Revolver', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')] },
  { id: 'poly-sawed-off-01', name: 'Quaternius Sawed-Off Shotgun', shortName: 'Sawed-Off', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')] },
  { id: 'poly-revolver-02', name: 'Quaternius Revolver Silver', shortName: 'Silver Revolver', source: 'Quaternius', weaponType: 'pistol', urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')] },
  { id: 'poly-shotgun-02', name: 'Quaternius Long Shotgun', shortName: 'Long Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')] },
  { id: 'poly-shotgun-03', name: 'Quaternius Pump Shotgun', shortName: 'Pump Shotgun', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')] },
  { id: 'poly-smg-01', name: 'Quaternius Submachine Gun', shortName: 'SMG', source: 'Quaternius', weaponType: 'rifle', urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')] },
  { id: 'slot-10', name: 'AK47', shortName: 'AK47', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp] },
  { id: 'slot-11', name: 'KRSV', shortName: 'KRSV', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp] },
  { id: 'slot-12', name: 'Smith', shortName: 'Smith', source: 'Extra', weaponType: 'pistol', urls: [EXTRA.awp] },
  { id: 'slot-13', name: 'Mosin', shortName: 'Mosin', source: 'Extra', weaponType: 'sniper', urls: [EXTRA.awp] },
  { id: 'slot-14', name: 'Uzi', shortName: 'Uzi', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp] },
  { id: 'slot-15', name: 'SigSauer', shortName: 'SigSauer', source: 'Extra', weaponType: 'pistol', urls: [EXTRA.awp] },
  { id: 'slot-16', name: 'AWP', shortName: 'AWP', source: 'Extra', weaponType: 'sniper', urls: [EXTRA.awp] },
  { id: 'slot-17', name: 'MRTK Gun', shortName: 'MRTK Gun', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.awp] },
  { id: 'slot-18', name: 'FPS Gun', shortName: 'FPS Shotgun', source: 'Extra', weaponType: 'rifle', urls: [EXTRA.fps, EXTRA.awp] },
];

const slotPosition = (i: number) => {
  const c = i % GRID_COLS;
  const r = Math.floor(i / GRID_COLS);
  const m = (GRID_ROWS - 1) / 2;
  return new THREE.Vector3((c - 1) * GAP_X, 0, (r - m) * GAP_Z);
};

const makeLoader = (url: string) => {
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const m = new THREE.LoadingManager();
  m.setURLModifier((r) => (/^(https?:)?\/\//i.test(r) ? r : new URL(r, base).toString()));
  return new GLTFLoader(m);
};

const normalizeWeapon = (m: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if (max > 0) m.scale.setScalar(FPS_SHOTGUN_DISPLAY_LENGTH / max);
  const normalized = new THREE.Box3().setFromObject(m);
  const center = normalized.getCenter(new THREE.Vector3());
  m.position.sub(center);
  m.position.y += -normalized.min.y + 0.08;
};

export default function ChessBattleRoyaleStore() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimesRef = useRef<RuntimeWeapon[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const selectedRef = useRef(0);
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
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 8, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(4, 10, 6);
    scene.add(dir);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 42), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    const target = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.6), new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
    target.position.set(0, 2.2, -15);
    scene.add(target);
    addSeatedHumanReference(scene);

    const slots: THREE.Group[] = [];
    WEAPON_MANIFEST.forEach((_, i) => {
      const slot = new THREE.Group();
      slot.position.copy(slotPosition(i));
      const parkingPad = new THREE.Mesh(new THREE.CylinderGeometry(PARKING_PAD_RADIUS, PARKING_PAD_RADIUS, 0.04, 28), new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.2, roughness: 0.85 }));
      parkingPad.position.y = -0.02;
      slot.add(parkingPad);
      scene.add(slot);
      slots.push(slot);
    });

    const loadOne = async (entry: WeaponEntry, index: number) => {
      try {
        const gltf = await new Promise<GLTF>((resolve, reject) => makeLoader(entry.urls[0]).load(entry.urls[0], resolve, undefined, reject));
        const model = gltf.scene;
        normalizeWeapon(model);
        model.rotation.y = -Math.PI / 2;
        model.position.z = 0.05;
        slots[index].add(model);
        const muzzle = new THREE.Object3D();
        muzzle.position.set(0.55, 0.2, 0);
        model.add(muzzle);
        runtimesRef.current.push({ entry, slot: slots[index], root: model, muzzle, basePosition: model.position.clone(), index });
        setLoadedCount((v) => v + 1);
      } catch {
        const fallback = createFallbackWeapon(entry.weaponType);
        slots[index].add(fallback);
        const muzzle = new THREE.Object3D();
        muzzle.position.set(0.45, 0.04, 0);
        fallback.add(muzzle);
        runtimesRef.current.push({ entry, slot: slots[index], root: fallback, muzzle, basePosition: fallback.position.clone(), index });
        setFailedCount((v) => v + 1);
      }
    };

    void Promise.all(WEAPON_MANIFEST.map(loadOne)).then(() => setStatus('Ready. Dynamic player + projectile camera broadcasting enabled for all weapons.'));

    const pelletGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const pelletMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', emissive: '#1d4ed8', emissiveIntensity: 0.4 });
    const trailMaterial = new THREE.LineBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.7 });
    const clock = new THREE.Clock();
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();

    const fireFromRuntime = (runtime: RuntimeWeapon) => {
      runtime.muzzle.getWorldPosition(vA);
      target.getWorldPosition(vB);
      const dirToTarget = vB.clone().sub(vA).normalize();
      const spread = runtime.entry.weaponType === 'pistol' ? 0.09 : runtime.entry.weaponType === 'sniper' ? 0.01 : 0.04;
      dirToTarget.x += THREE.MathUtils.randFloatSpread(spread);
      dirToTarget.y += THREE.MathUtils.randFloatSpread(spread * 0.6);
      dirToTarget.normalize();

      const mesh = new THREE.Mesh(pelletGeometry, pelletMaterial.clone());
      mesh.position.copy(vA);
      scene.add(mesh);
      const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([vA.clone(), vA.clone()]), trailMaterial.clone());
      scene.add(trail);

      const projectile: Projectile = {
        owner: runtime.index,
        mesh,
        trail,
        history: [vA.clone()],
        velocity: dirToTarget.multiplyScalar(PELLET_SPEED),
        age: 0,
        alive: true,
      };
      projectilesRef.current.push(projectile);
      activeProjectileRef.current = projectile;
      impactFocusUntilRef.current = performance.now() + 1500;
      setCameraMode('projectile');
      setStatus(`Broadcasting ${runtime.entry.shortName}: player view -> projectile tracking -> impact.`);
    };

    const fireSelected = () => {
      const runtime = runtimesRef.current.find((r) => r.index === selectedRef.current);
      if (runtime) fireFromRuntime(runtime);
    };

    const fireAll = () => {
      runtimesRef.current.forEach((runtime, i) => setTimeout(() => fireFromRuntime(runtime), i * 120));
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') fireSelected();
      if (e.key.toLowerCase() === 'f') fireAll();
    });

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const d = Math.min(clock.getDelta(), 0.033);

      runtimesRef.current.forEach((r) => {
        const selected = r.index === selectedRef.current;
        r.root.position.y = THREE.MathUtils.lerp(r.root.position.y, r.basePosition.y + (selected ? 0.38 : 0), 0.14);
      });

      projectilesRef.current.forEach((p) => {
        if (!p.alive) return;
        p.age += d;
        p.mesh.position.addScaledVector(p.velocity, d);
        p.history.push(p.mesh.position.clone());
        if (p.history.length > PELLET_TRAIL_POINTS) p.history.shift();
        p.trail.geometry.dispose();
        p.trail.geometry = new THREE.BufferGeometry().setFromPoints(p.history);

        if (p.age > PELLET_LIFETIME || p.mesh.position.distanceTo(target.position) < 1.1) {
          p.alive = false;
          impactFocusUntilRef.current = performance.now() + 1200;
          setCameraMode('impact');
        }
      });

      if (activeProjectileRef.current?.alive) {
        const p = activeProjectileRef.current;
        const dirTo = p.velocity.clone().normalize();
        const camPos = p.mesh.position.clone().addScaledVector(dirTo, -1.2).add(new THREE.Vector3(0, 0.35, 0.2));
        camera.position.lerp(camPos, 0.18);
        camera.lookAt(p.mesh.position.clone().addScaledVector(dirTo, 2.8));
      } else if (performance.now() < impactFocusUntilRef.current) {
        const focusPos = new THREE.Vector3(0, 3.5, -9.5);
        camera.position.lerp(focusPos, 0.1);
        camera.lookAt(target.position);
      } else {
        if (cameraMode !== 'overview') setCameraMode('overview');
        const selected = runtimesRef.current.find((r) => r.index === selectedRef.current);
        if (selected) {
          selected.muzzle.getWorldPosition(vA);
          const playerView = vA.clone().add(new THREE.Vector3(0, 0.35, 0.72));
          camera.position.lerp(playerView, 0.08);
          camera.lookAt(target.position);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    (window as any).fireSelectedWeapon = fireSelected;
    (window as any).fireAllWeapons = fireAll;

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      mount.innerHTML = '';
      pelletGeometry.dispose();
      pelletMaterial.dispose();
      trailMaterial.dispose();
    };
  }, [cameraMode]);

  return (
    <div className='relative h-screen w-full overflow-hidden bg-slate-950 text-white'>
      <div ref={mountRef} className='absolute inset-0' />
      <div className='absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs'>
        <div className='font-black text-yellow-300'>Ludo Battle Royale · Dynamic Weapon Broadcast</div>
        <div>{loadedCount}/{WEAPON_COUNT} loaded · {failedCount} fallback</div>
        <div>{status}</div>
        <div>Camera mode: {cameraMode}</div>
      </div>

      <div className='absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3'>
        <div className='mb-2 text-xs font-black text-yellow-300'>Selected: {selectedIndex + 1}. {selectedWeapon.shortName}</div>
        <div className='grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1'>
          {WEAPON_MANIFEST.map((weapon, index) => (
            <button
              key={weapon.id}
              onClick={() => setSelectedIndex(index)}
              className={`rounded-xl border px-2 py-2 text-left text-[11px] font-bold ${selectedIndex === index ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-white/10 text-slate-100'}`}
            >
              <span className='block text-[10px] opacity-70'>#{index + 1} · {weapon.weaponType}</span>
              <span className='mr-1 text-sm leading-none'>{weaponTypeIcon[weapon.weaponType]}</span>
              <span className='block truncate'>{weapon.shortName}</span>
            </button>
          ))}
        </div>
        <div className='mt-2 flex gap-2'>
          <button onClick={() => (window as any).fireSelectedWeapon?.()} className='rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-slate-950'>
            Fire Selected
          </button>
          <button onClick={() => (window as any).fireAllWeapons?.()} className='rounded-xl bg-red-700 px-3 py-2 text-xs font-black'>
            Broadcast All
          </button>
        </div>
      </div>
    </div>
  );
}
