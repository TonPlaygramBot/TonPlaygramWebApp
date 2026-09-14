import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { PoolRoyalShotCamera } from '../pages/Games/shared/poolRoyalShotCamera.ts';
import type { ShotState } from '../pages/Games/shared/poolRoyalReferenceHuman.ts';
import { clampBallInHand, projectPointerToSnookerTable } from '../games/snooker/ballInHand';
import { createUploadedSnookerMapping, uploadedBallFits } from '../pages/Games/snookerUploadedTable';
import { normalizeSpinInput, mapSpinForPhysics } from '../pages/Games/snookerRoyalSpinUtils.js';

declare const SNOOKER_PREVIEW_MODEL: string;
declare const SNOOKER_PREVIEW_METRICS: {
  floorY: number; clothY: number; ballY: number; ballR: number;
  tableW: number; tableL: number; cueLength: number; targetHeight: number;
  playW: number; playL: number;
  cameraClearance: number; cameraFov: number;
};
const m = SNOOKER_PREVIEW_METRICS;

// Character/eye-handoff inspection only. The live game's arena and physics
// remain in SnookerRoyal.jsx; this viewer uses its measured dimensions.
function SnookerCharacterPreview() {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ taller: true, pose: 'idle' as ShotState, eye: false, shotAt: -Infinity,
    placing: false, spin: { x: 0, y: 0 } });
  const [taller, setTaller] = useState(true);
  const [eye, setEye] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading character…');
  const [placing, setPlacing] = useState(false);
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const spinDrag = useRef<{ id: number; before: { x: number; y: number } } | null>(null);
  const selectSpin = (x: number, y: number) => {
    const value = normalizeSpinInput({ x, y }); live.current.spin = value; setSpin(value);
  };
  const spinAt = (event: React.PointerEvent<HTMLButtonElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    selectSpin((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2);
  };

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
    const mapping = createUploadedSnookerMapping(m.playW, m.playL, m.ballR);
    const baulkY = mapping.spots.brown[1], dRadius = Math.abs(mapping.spots.green[0] - mapping.spots.yellow[0]) / 2;
    const arcPoints = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(
      Math.cos(i * Math.PI / 48) * dRadius, m.clothY + .05, baulkY - Math.sin(i * Math.PI / 48) * dRadius));
    arcPoints.push(arcPoints[0].clone());
    const d = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints), new THREE.LineBasicMaterial({ color: 0xf5e9c9 }));
    scene.add(d);
    const spinMark = new THREE.Mesh(new THREE.SphereGeometry(m.ballR * .16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf04444 }));
    scene.add(spinMark);
    let placementPointer: number | null = null, beforePlacement = ballPosition.clone();
    const placeFromPointer = (event: PointerEvent) => {
      const p = projectPointerToSnookerTable(event, renderer.domElement.getBoundingClientRect(), camera, scene, m.ballY);
      if (!p) return false;
      const clamped = clampBallInHand(p, { limitX: mapping.limitX, limitY: mapping.limitY, baulkY, dRadius, fullTable: false });
      if (!clamped || !uploadedBallFits(mapping, clamped)) return false;
      ballPosition.set(clamped.x, m.ballY, clamped.y); return true;
    };
    renderer.domElement.style.touchAction = 'none';
    const down = (e: PointerEvent) => {
      if (!live.current.placing || placementPointer !== null || !e.isPrimary || e.button !== 0) return;
      beforePlacement = ballPosition.clone();
      if (!placeFromPointer(e)) return;
      placementPointer = e.pointerId; renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => { if (placementPointer === e.pointerId) placeFromPointer(e); };
    const up = (e: PointerEvent) => {
      if (placementPointer !== e.pointerId) return;
      const placed = e.type === 'pointerup' && placeFromPointer(e);
      placementPointer = null;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
      if (placed) { live.current.placing = false; setPlacing(false); setStatus('Ball placed'); }
      else ballPosition.copy(beforePlacement);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    renderer.domElement.addEventListener('lostpointercapture', up);
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
    const loader = new GLTFLoader();
    loader.register(parser => ({ name: 'InlineCharacterImages', loadTexture: (index: number) => {
      const image = parser.json.images[parser.json.textures[index].source];
      return parser.getDependency('bufferView', image.bufferView).then((buffer: ArrayBuffer) => new Promise<THREE.Texture>((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(new Blob([buffer], { type: image.mimeType }));
        img.onload = () => { const texture = new THREE.Texture(img); texture.flipY = false; texture.needsUpdate = true; URL.revokeObjectURL(url); resolve(texture); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Character texture could not load')); };
        img.src = url;
      }));
    } }));
    new Response(stream).arrayBuffer().then(buffer => loader.parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = [m.cueLength * 1.68, m.targetHeight].map(targetHeight => new PoolRoyalHumanPlayers(scene,
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
      ball.position.copy(ballPosition);
      aim.set(0, 0, ballPosition.z >= 0 ? -1 : 1);
      const offset = normalizeSpinInput(live.current.spin);
      const side = new THREE.Vector3(-aim.z, 0, aim.x);
      spinMark.position.copy(ballPosition).addScaledVector(side, offset.x * m.ballR)
        .addScaledVector(aim, -Math.sqrt(Math.max(0, 1 - offset.x ** 2 - offset.y ** 2)) * m.ballR);
      spinMark.position.y += offset.y * m.ballR;
      players.forEach((p, i) => {
        p.update(dt, { activeSeat: 'A', state: pose, cueBall: ballPosition, aimForward: aim,
          power: pose === 'idle' ? 0 : 0.75, nowMs: now, hidden: i !== index });
      });
      // One fixed inspection camera makes the height comparison visible.
      camera.up.set(0, 1, 0);
      const focus = new THREE.Vector3(0, m.floorY + m.targetHeight * 0.57, m.tableL * 0.37);
      const distance = m.targetHeight * Math.max(1.5, 0.88 / camera.aspect);
      camera.position.copy(focus).add(new THREE.Vector3(distance * 0.48, distance * 0.35, distance));
      camera.lookAt(focus);
      const p = players[index];
      if (p && live.current.eye && !live.current.placing) {
        const eyePose = shotCamera.resolve({ eye: p.eyeView, stroke, shooting: stroke || (running && elapsed >= 1250),
          cueBlend: 0, now });
        if (eyePose) {
          camera.position.lerp(eyePose.position, eyePose.blend);
          camera.lookAt(focus.clone().lerp(eyePose.target, eyePose.blend));
        }
      }
      if (live.current.placing) {
        camera.up.set(0, 0, 1);
        camera.position.set(0, m.clothY + m.playL * 1.25, 0);
        camera.lookAt(0, m.clothY, 0);
      }
      p?.updateCameraVisibility(camera, live.current.eye && p.eyeView ? p.eyeView.target : focus);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      renderer.domElement.removeEventListener('lostpointercapture', up);
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
      <button type="button" aria-pressed={taller} onClick={() => { live.current.taller = true; setTaller(true); }}>5% bigger + taller</button>
    </div>
    <div ref={host} className="snooker-inspector-stage" role="img" aria-label="Snooker human character and shooting-eye preview" />
    <div className="snooker-inspector-controls">
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'idle'; live.current.shotAt = -Infinity; }}>Stand</button>
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'dragging'; live.current.shotAt = -Infinity; }}>Aim</button>
      <button type="button" disabled={!ready} onClick={() => { live.current.pose = 'idle'; live.current.shotAt = performance.now(); }}>Shoot</button>
      <label><input type="checkbox" checked={eye} onChange={e => { live.current.eye = e.target.checked; setEye(e.target.checked); }} />Eye view</label>
      <button type="button" disabled={!ready} aria-pressed={placing} onClick={() => {
        live.current.placing = true; live.current.shotAt = -Infinity; live.current.pose = 'idle';
        setPlacing(true); setStatus('Tap or drag inside the D');
      }}>Ball in hand</button>
    </div>
    <div className="snooker-inspector-controls">
      <button className="snooker-preview-spin" type="button" aria-label="Cue-ball spin: use arrow keys or drag the red dot"
        onPointerDown={e => { if (spinDrag.current || !e.isPrimary || e.button !== 0) return; spinDrag.current = { id: e.pointerId, before: { ...live.current.spin } }; e.currentTarget.setPointerCapture(e.pointerId); spinAt(e); }}
        onPointerMove={e => { if (spinDrag.current?.id === e.pointerId) spinAt(e); }}
        onPointerUp={e => { if (spinDrag.current?.id !== e.pointerId) return; spinAt(e); spinDrag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={e => { if (spinDrag.current?.id !== e.pointerId) return; const v = spinDrag.current.before; spinDrag.current = null; selectSpin(v.x, v.y); }}
        onKeyDown={e => {
          const deltas: Record<string, number[]> = { ArrowUp: [0, .15], ArrowDown: [0, -.15], ArrowLeft: [-.15, 0], ArrowRight: [.15, 0] };
          const delta = deltas[e.key];
          if (delta) { e.preventDefault(); selectSpin(spin.x + delta[0], spin.y + delta[1]); }
          if (e.key === 'Home') selectSpin(0, 0);
        }}>
        <span style={{ left: `${50 + spin.x * 50}%`, top: `${50 - spin.y * 50}%` }} />
      </button>
      <div><div>{spin.y > 0 ? 'Topspin' : spin.y < 0 ? 'Backspin' : 'Center'}{spin.x < 0 ? ' · Left' : spin.x > 0 ? ' · Right' : ''}</div>
        <button type="button" onClick={() => selectSpin(0, 0)}>Center spin</button>
        <output aria-live="polite"> {Math.round(Math.hypot(...Object.values(mapSpinForPhysics(spin))) / .75 * 100)}%</output>
      </div>
    </div>
    <div className="snooker-inspector-status" role="status">{status}</div>
  </section>;
}

createRoot(document.getElementById('snooker-character-preview')!).render(<SnookerCharacterPreview />);
