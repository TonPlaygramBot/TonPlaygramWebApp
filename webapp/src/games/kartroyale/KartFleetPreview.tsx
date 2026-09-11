import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { prepareVehicleAsset } from './vehicleAssetAdapter';
import { vehicleAssetUrl, KART_ASSETS } from './vehicleAssetConfig.mjs';
import { TyreSmoke } from './tyreSmoke';
import type { Racer } from './simulation.mjs';
const names = [
  'Apex Sprint',
  'Eagle Shifter',
  'Illyrian Drift',
  'Besa Endurance',
  'Dajti Cross'
];
const ids = Object.keys(KART_ASSETS);
const modes = ['Inspect', 'Drive', 'Reverse', 'Drift', 'Crash', 'Rollover'];
declare global {
  interface Window {
    kartPreviewData?: Record<string, string>;
  }
}
async function load(id: string) {
  const encoded = window.kartPreviewData?.[id];
  if (!encoded)
    return (await new GLTFLoader().loadAsync(vehicleAssetUrl(id))).scene;
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return (await new GLTFLoader().parseAsync(data.buffer, '')).scene;
}
function Fleet() {
  const host = useRef<HTMLDivElement>(null),
    change = useRef<(id: string) => void>(() => {}),
    motion = useRef('Inspect');
  const [id, setId] = useState('apex'),
    [mode, setMode] = useState('Inspect'),
    [status, setStatus] = useState('Loading kart…');
  useEffect(() => {
    const el = host.current!;
    let alive = true,
      model: T.Group | undefined,
      token = 0,
      spin = 0,
      time = 0,
      raf = 0;
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(el.clientWidth, 400);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color('#17202b');
    const camera = new T.PerspectiveCamera(38, el.clientWidth / 400, 0.05, 60);
    camera.position.set(3.7, 2.6, 4.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.3;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.48;
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      env = pmrem.fromScene(room);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight('#d9edff', '#6f6960', 2));
    const sun = new T.DirectionalLight('#fff3d8', 3);
    sun.position.set(2, 5, 3);
    scene.add(sun);
    const ground = new T.Mesh(
      new T.CircleGeometry(3, 64),
      new T.MeshStandardMaterial({
        color: '#283443',
        roughness: 0.65,
        metalness: 0.15
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    scene.add(ground);
    const smoke = new TyreSmoke();
    scene.add(smoke.mesh);
    const models = new Map<string, T.Group>();
    const dispose = (root: T.Group) =>
      root.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            for (const v of Object.values(m))
              if (v instanceof T.Texture) v.dispose();
            m.dispose();
          }
        }
      });
    change.current = async (next) => {
      const request = ++token;
      setStatus('Loading kart…');
      try {
        let asset = models.get(next);
        if (!asset) {
          asset = prepareVehicleAsset(await load(next), next);
          if (!alive) {
            dispose(asset);
            return;
          }
          models.set(next, asset);
        }
        if (request !== token) return;
        if (model) scene.remove(model);
        model = asset;
        scene.add(model);
        setStatus('Drag to rotate · pinch to zoom');
        spin = 0;
        smoke.clear();
      } catch {
        if (alive && request === token)
          setStatus('Could not load this kart. Select it to retry.');
      }
    };
    change.current('apex');
    const resize = () => {
      renderer.setSize(el.clientWidth, 400);
      camera.aspect = el.clientWidth / 400;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    let before = performance.now();
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - before) / 1000);
      before = now;
      time += dt;
      controls.update();
      const mode = motion.current,
        speed = mode === 'Reverse' ? -5 : mode === 'Inspect' ? 0 : 15;
      spin += (speed * dt) / 0.28;
      if (model) {
        const body = model.getObjectByName('body')!;
        const roll = mode === 'Rollover' ? ((time % 3) / 3) * Math.PI * 2 : 0;
        body.rotation.z = roll + (mode === 'Drift' ? 0.045 : 0);
        body.rotation.x = mode === 'Crash' ? Math.sin(time * 20) * 0.1 : 0;
        body.position.y =
          mode === 'Rollover'
            ? 0.88 * Math.abs(Math.sin(roll)) +
              1.42 * Math.max(0, -Math.cos(roll))
            : mode === 'Crash'
              ? Math.abs(Math.sin(time * 14)) * 0.06
              : 0;
        model.rotation.y = mode === 'Drift' ? Math.sin(time) * 0.28 : 0;
        model.traverse((o) => {
          if (/^wheel_[fr][lr]$/.test(o.name)) o.rotation.x = spin;
          if (/^steer_f[lr]$/.test(o.name))
            o.rotation.y = mode === 'Drift' ? -0.35 : 0;
        });
        smoke.update(dt, [
          {
            id: 'preview',
            x: 0,
            z: 0,
            yaw: 0,
            speed,
            drifting: mode === 'Drift',
            acceleration: mode === 'Crash' ? -25 : 0,
            health: mode === 'Crash' ? 20 : 100
          } as Racer
        ]);
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      smoke.dispose();
      models.forEach(dispose);
      ground.geometry.dispose();
      (ground.material as T.Material).dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <section
      style={{
        background: '#111923',
        color: '#edf3fa',
        fontFamily: 'system-ui',
        borderRadius: 16,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}
      >
        <strong>RACING ROYAL</strong>
        <span style={{ fontSize: 12, color: '#b5c4d4' }}>KART RIG PREVIEW</span>
      </div>
      <div
        ref={host}
        style={{ height: 400, touchAction: 'none' }}
        aria-label="Interactive 3D kart"
      />
      <div style={{ padding: '0 16px 18px' }}>
        <select
          aria-label="Kart model"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            change.current(e.target.value);
          }}
          style={{
            width: '100%',
            padding: 12,
            background: '#263647',
            color: '#fff',
            border: '1px solid #4a6075',
            borderRadius: 8,
            fontSize: 16
          }}
        >
          {ids.map((key, i) => (
            <option key={key} value={key}>
              {names[i]}
            </option>
          ))}
        </select>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 8,
            marginTop: 12
          }}
        >
          {modes.map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                motion.current = m;
              }}
              style={{
                padding: '12px 4px',
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid #4a6075',
                background: mode === m ? '#baff29' : '#263647',
                color: mode === m ? '#101820' : '#edf3fa'
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p
          role="status"
          style={{ fontSize: 13, margin: '12px 0 0', color: '#b5c4d4' }}
        >
          {status}
        </p>
      </div>
    </section>
  );
}
const target = document.getElementById('kart-fleet-preview');
if (target) createRoot(target).render(<Fleet />);
