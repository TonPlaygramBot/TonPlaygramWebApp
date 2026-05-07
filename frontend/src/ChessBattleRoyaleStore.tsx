import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const PLAYER_COUNT = 12;
const GRID_COLS = 3;
const GRID_ROWS = 4;
const GAP_X = 2.45;
const GAP_Z = 1.8;

const PROJECTILE_SPEED = 28;
const PROJECTILE_LIFETIME = 3.2;
const PROJECTILE_TRAIL_POINTS = 14;

const HUMAN_COLORS = ['#f97316', '#22c55e', '#38bdf8', '#e879f9', '#fde047', '#fb7185'] as const;
const WEAPON_TYPES = ['rifle', 'pistol', 'sniper'] as const;
type WeaponType = (typeof WEAPON_TYPES)[number];
type CameraMode = 'overview' | 'player' | 'projectile' | 'impact';

type HumanPlayerEntry = { id: string; name: string; shortName: string; weaponType: WeaponType; color: string };
type RuntimePlayer = {
  entry: HumanPlayerEntry;
  slot: THREE.Group;
  root: THREE.Group;
  muzzle: THREE.Object3D;
  basePosition: THREE.Vector3;
  index: number;
};
type Projectile = {
  owner: number;
  mesh: THREE.Mesh;
  trail: THREE.Line;
  history: THREE.Vector3[];
  velocity: THREE.Vector3;
  age: number;
  alive: boolean;
};

const HUMAN_PLAYER_MANIFEST: HumanPlayerEntry[] = Array.from({ length: PLAYER_COUNT }, (_, index) => {
  const type = WEAPON_TYPES[index % WEAPON_TYPES.length];
  return {
    id: `human-player-${index + 1}`,
    name: `Human Player ${index + 1}`,
    shortName: `Player ${index + 1}`,
    weaponType: type,
    color: HUMAN_COLORS[index % HUMAN_COLORS.length],
  };
});

const slotPosition = (i: number) => {
  const c = i % GRID_COLS;
  const r = Math.floor(i / GRID_COLS);
  const m = (GRID_ROWS - 1) / 2;
  return new THREE.Vector3((c - 1) * GAP_X, 0, (r - m) * GAP_Z);
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
};

const makeMazeWalls = () => {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8, metalness: 0.05 });
  const wallGeometry = new THREE.BoxGeometry(0.24, 1.15, 1.85);
  const horizontalGeometry = new THREE.BoxGeometry(2.1, 1.15, 0.24);

  const verticals = [
    [-4.9, -5.4],
    [-4.9, -1.8],
    [-4.9, 1.8],
    [-4.9, 5.4],
    [4.9, -5.4],
    [4.9, -1.8],
    [4.9, 1.8],
    [4.9, 5.4],
    [-1.25, -3.6],
    [1.25, 0],
    [-1.25, 3.6],
  ];
  verticals.forEach(([x, z]) => {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(x, 0.55, z);
    group.add(wall);
  });

  const horizontals = [
    [-2.45, -6.45],
    [0, -6.45],
    [2.45, -6.45],
    [-2.45, 6.45],
    [0, 6.45],
    [2.45, 6.45],
    [-2.45, -0.9],
    [2.45, 0.9],
  ];
  horizontals.forEach(([x, z]) => {
    const wall = new THREE.Mesh(horizontalGeometry, wallMaterial);
    wall.position.set(x, 0.55, z);
    group.add(wall);
  });

  return group;
};

const createHumanPlayer = (entry: HumanPlayerEntry, index: number) => {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: entry.color, roughness: 0.68 });
  const skin = new THREE.MeshStandardMaterial({ color: '#f8c79b', roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 });
  const weaponMaterial = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.5, metalness: 0.25 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.72, 4, 10), suit);
  body.position.y = 0.82;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skin);
  head.position.y = 1.42;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.035), dark);
  visor.position.set(0, 1.45, -0.2);
  group.add(visor);

  const armGeometry = new THREE.CapsuleGeometry(0.055, 0.42, 3, 8);
  const leftArm = new THREE.Mesh(armGeometry, suit);
  leftArm.position.set(-0.31, 0.93, -0.05);
  leftArm.rotation.z = 0.22;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, suit);
  rightArm.position.set(0.31, 0.93, -0.05);
  rightArm.rotation.z = -0.22;
  group.add(rightArm);

  const legGeometry = new THREE.CapsuleGeometry(0.07, 0.36, 3, 8);
  const leftLeg = new THREE.Mesh(legGeometry, dark);
  leftLeg.position.set(-0.12, 0.28, 0.02);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, dark);
  rightLeg.position.set(0.12, 0.28, 0.02);
  group.add(rightLeg);

  const weaponLength = entry.weaponType === 'pistol' ? 0.38 : entry.weaponType === 'sniper' ? 0.86 : 0.64;
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, weaponLength), weaponMaterial);
  weapon.position.set(0.22, 0.93, -0.32);
  group.add(weapon);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.22, 0.93, -0.32 - weaponLength / 2);
  group.add(muzzle);

  group.rotation.y = Math.PI;
  group.position.copy(slotPosition(index));
  return { group, muzzle };
};

export default function ChessBattleRoyaleStore() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimesRef = useRef<RuntimePlayer[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const selectedRef = useRef(0);
  const activeProjectileRef = useRef<Projectile | null>(null);
  const impactFocusUntilRef = useRef(0);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('Loading lightweight human-only maze base...');
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');

  const selectedPlayer = useMemo(() => HUMAN_PLAYER_MANIFEST[selectedIndex], [selectedIndex]);
  useEffect(() => void (selectedRef.current = selectedIndex), [selectedIndex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 7.2, 11.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.65));
    const dir = new THREE.DirectionalLight(0xffffff, 1.7);
    dir.position.set(4, 10, 6);
    scene.add(dir);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 17), new THREE.MeshStandardMaterial({ color: '#172033' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);
    scene.add(makeMazeWalls());

    const target = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 0.35), new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#7c2d12', emissiveIntensity: 0.18 }));
    target.position.set(0, 1.35, -7.35);
    scene.add(target);

    HUMAN_PLAYER_MANIFEST.forEach((entry, index) => {
      const slot = new THREE.Group();
      const { group, muzzle } = createHumanPlayer(entry, index);
      slot.add(group);
      scene.add(slot);
      runtimesRef.current.push({ entry, slot, root: group, muzzle, basePosition: group.position.clone(), index });
    });
    setStatus('Ready. Base contains only lightweight human players; robot GLTF loading and FPS gun are removed.');

    const projectileGeometry = new THREE.SphereGeometry(0.05, 10, 10);
    const projectileMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', emissive: '#1d4ed8', emissiveIntensity: 0.4 });
    const trailMaterial = new THREE.LineBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.7 });
    const clock = new THREE.Clock();
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();

    const fireFromRuntime = (runtime: RuntimePlayer) => {
      runtime.muzzle.getWorldPosition(vA);
      target.getWorldPosition(vB);
      const dirToTarget = vB.clone().sub(vA).normalize();
      const spread = runtime.entry.weaponType === 'pistol' ? 0.08 : runtime.entry.weaponType === 'sniper' ? 0.01 : 0.035;
      dirToTarget.x += THREE.MathUtils.randFloatSpread(spread);
      dirToTarget.y += THREE.MathUtils.randFloatSpread(spread * 0.6);
      dirToTarget.normalize();

      const mesh = new THREE.Mesh(projectileGeometry, projectileMaterial.clone());
      mesh.position.copy(vA);
      scene.add(mesh);
      const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([vA.clone(), vA.clone()]), trailMaterial.clone());
      scene.add(trail);

      const projectile: Projectile = {
        owner: runtime.index,
        mesh,
        trail,
        history: [vA.clone()],
        velocity: dirToTarget.multiplyScalar(PROJECTILE_SPEED),
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') fireSelected();
      if (e.key.toLowerCase() === 'f') fireAll();
    };
    window.addEventListener('keydown', onKeyDown);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const d = Math.min(clock.getDelta(), 0.033);

      runtimesRef.current.forEach((r) => {
        const selected = r.index === selectedRef.current;
        r.root.position.y = THREE.MathUtils.lerp(r.root.position.y, r.basePosition.y + (selected ? 0.32 : 0), 0.14);
        r.root.rotation.y = Math.PI + Math.sin(performance.now() * 0.0016 + r.index) * 0.08;
      });

      projectilesRef.current.forEach((p) => {
        if (!p.alive) return;
        p.age += d;
        p.mesh.position.addScaledVector(p.velocity, d);
        p.history.push(p.mesh.position.clone());
        if (p.history.length > PROJECTILE_TRAIL_POINTS) p.history.shift();
        p.trail.geometry.dispose();
        p.trail.geometry = new THREE.BufferGeometry().setFromPoints(p.history);

        if (p.age > PROJECTILE_LIFETIME || p.mesh.position.distanceTo(target.position) < 0.9) {
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
        const focusPos = new THREE.Vector3(0, 3.4, -9.2);
        camera.position.lerp(focusPos, 0.1);
        camera.lookAt(target.position);
      } else {
        if (cameraMode !== 'overview') setCameraMode('overview');
        const selected = runtimesRef.current.find((r) => r.index === selectedRef.current);
        if (selected) {
          selected.muzzle.getWorldPosition(vA);
          const playerView = vA.clone().add(new THREE.Vector3(0, 0.36, 0.82));
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
      window.removeEventListener('keydown', onKeyDown);
      renderer.dispose();
      mount.innerHTML = '';
      disposeObject(scene);
      projectileGeometry.dispose();
      projectileMaterial.dispose();
      trailMaterial.dispose();
      runtimesRef.current = [];
      projectilesRef.current = [];
    };
  }, []);

  return (
    <div className='relative h-screen w-full overflow-hidden bg-slate-950 text-white'>
      <div ref={mountRef} className='absolute inset-0' />
      <div className='absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs'>
        <div className='font-black text-yellow-300'>Maze Battle Royale · Human-Only Base</div>
        <div>{PLAYER_COUNT} human players · 0 robot GLTF · FPS gun removed</div>
        <div>{status}</div>
        <div>Camera mode: {cameraMode}</div>
      </div>

      <div className='absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3'>
        <div className='mb-2 text-xs font-black text-yellow-300'>Selected: {selectedIndex + 1}. {selectedPlayer.shortName}</div>
        <div className='grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1'>
          {HUMAN_PLAYER_MANIFEST.map((player, index) => (
            <button
              key={player.id}
              onClick={() => {
                selectedRef.current = index;
                setSelectedIndex(index);
                setStatus(`Selected ${index + 1}/${PLAYER_COUNT}: ${player.name}`);
              }}
              className={`rounded-xl border px-2 py-2 text-left text-[11px] font-bold ${selectedIndex === index ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-white/10 text-slate-100'}`}
            >
              <span className='block text-[10px] opacity-70'>#{index + 1} · {player.weaponType}</span>
              <span className='block truncate'>{player.shortName}</span>
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
