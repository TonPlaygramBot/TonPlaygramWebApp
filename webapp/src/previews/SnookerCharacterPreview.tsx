import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { PoolRoyalShotCamera } from '../pages/Games/shared/poolRoyalShotCamera.ts';
import type { ShotState } from '../pages/Games/shared/poolRoyalReferenceHuman.ts';

declare const SNOOKER_PREVIEW_MODEL: string;
declare const SNOOKER_PREVIEW_METRICS: {
  floorY: number; clothY: number; ballY: number; ballR: number;
  tableW: number; tableL: number; cueLength: number; targetHeight: number;
  cameraClearance: number; cameraFov: number;
};
const m = SNOOKER_PREVIEW_METRICS;

// Character/eye-handoff inspection only. The live game's arena and physics
// remain in SnookerRoyal.jsx; this viewer uses its measured dimensions.
function SnookerCharacterPreview() {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ taller: true, pose: 'idle' as ShotState, eye: false, shotAt: -Infinity });
  const [taller, setTaller] = useState(true);
  const [eye, setEye] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading character…');

  useEffect(() => {
    const stage = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setStatus('WebGL is required to show the character.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101b19);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x314c3f, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-60, 140, 110); scene.add(key);
    const camera = new THREE.PerspectiveCamera(m.cameraFov, 1, 0.01, 1500);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(m.tableW, 1, m.tableL),
      new THREE.MeshStandardMaterial({ color: 0x176844, roughness: 0.85 }));
    cloth.position.y = m.clothY - 0.5; scene.add(cloth);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3021, roughness: 0.7 });
    for (const sign of [-1, 1]) {
      for (const end of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.3, m.clothY - m.floorY, 12), wood);
        leg.position.set(sign * m.tableW * 0.4, (m.clothY + m.floorY) / 2, end * m.tableL * 0.4);
        scene.add(leg);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, m.tableL + 5), wood);
      rail.position.set(sign * (m.tableW / 2 + 1.25), m.clothY, 0); scene.add(rail);
      const endRail = new THREE.Mesh(new THREE.BoxGeometry(m.tableW, 2, 2.5), wood);
      endRail.position.set(0, m.clothY, sign * (m.tableL / 2 + 1.25)); scene.add(endRail);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x202d28 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = m.floorY - 0.1; scene.add(ground);
    const ballPosition = new THREE.Vector3(0, m.ballY, m.tableL * 0.32);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(m.ballR, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf7f6ef }));
    ball.position.copy(ballPosition); scene.add(ball);
    const aim = new THREE.Vector3(0, 0, -1);
    const shotCamera = new PoolRoyalShotCamera();
    let players: PoolRoyalHumanPlayers[] = [];
    let disposed = false, raf = 0, last = performance.now(), previous = -1;
    const resize = () => {
      renderer.setSize(stage.clientWidth, stage.clientHeight);
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();
    const bytes = Uint8Array.from(atob(SNOOKER_PREVIEW_MODEL), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    new Response(stream).arrayBuffer().then(buffer => new GLTFLoader().parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = [m.cueLength * 1.38, m.targetHeight].map(targetHeight => new PoolRoyalHumanPlayers(scene,
        { floorY: m.floorY, clothY: m.clothY, tableW: m.tableW, tableL: m.tableL, targetHeight, model: gltf.scene }));
      const loaded = (await Promise.all(players.map(p => p.ready))).every(Boolean);
      if (!disposed) { setReady(loaded); setStatus(loaded ? 'Character view' : 'Character could not load.'); }
    }).catch(() => { if (!disposed) setStatus('Character could not load.'); });
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.033); last = now;
      const index = live.current.taller ? 1 : 0;
      if (index !== previous) { shotCamera.reset(); previous = index; }
      const elapsed = now - live.current.shotAt;
      const running = elapsed < 2000;
      const stroke = running && elapsed >= 900 && elapsed < 1250;
      const pose: ShotState = running ? elapsed < 900 ? 'dragging' : stroke ? 'striking' : 'idle' : live.current.pose;
      players.forEach((p, i) => {
        p.update(dt, { activeSeat: 'A', state: pose, cueBall: ballPosition, aimForward: aim,
          power: pose === 'idle' ? 0 : 0.75, nowMs: now, hidden: i !== index });
      });
      // One fixed inspection camera makes the height comparison visible.
      const focus = new THREE.Vector3(0, m.floorY + m.targetHeight * 0.57, m.tableL * 0.37);
      const distance = m.targetHeight * Math.max(1.5, 0.88 / camera.aspect);
      camera.position.copy(focus).add(new THREE.Vector3(distance * 0.48, distance * 0.35, distance));
      camera.lookAt(focus);
      const p = players[index];
      if (p && live.current.eye) {
        const eyePose = shotCamera.resolve({ eye: p.eyeView, stroke, shooting: stroke || (running && elapsed >= 1250),
          cueBlend: 0, now });
        if (eyePose) {
          const position = eyePose.position.clone();
          position.y = Math.max(position.y, m.clothY + m.cameraClearance);
          camera.position.lerp(position, eyePose.blend);
          camera.lookAt(focus.clone().lerp(eyePose.target, eyePose.blend));
        }
      }
      p?.updateCameraVisibility(camera, live.current.eye && p.eyeView ? p.eyeView.target : focus);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      players.forEach(p => p.dispose());
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <section className="snooker-character-inspector">
    <div className="snooker-inspector-controls">
      <button type="button" aria-pressed={!taller} onClick={() => { live.current.taller = false; setTaller(false); }}>Previous height</button>
      <button type="button" aria-pressed={taller} onClick={() => { live.current.taller = true; setTaller(true); }}>Taller +5%</button>
    </div>
    <div ref={host} className="snooker-inspector-stage" role="img" aria-label="Snooker human character and shooting-eye preview" />
    <div className="snooker-inspector-controls">
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'idle'; live.current.shotAt = -Infinity; }}>Stand</button>
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'dragging'; live.current.shotAt = -Infinity; }}>Aim</button>
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'idle'; live.current.shotAt = performance.now(); }}>Shoot</button>
      <label><input type="checkbox" checked={eye} onChange={e => { live.current.eye = e.target.checked; setEye(e.target.checked); }} />Eye view</label>
    </div>
    <div className="snooker-inspector-status" role="status">{status}</div>
  </section>;
}

createRoot(document.getElementById('snooker-character-preview')!).render(<SnookerCharacterPreview />);
