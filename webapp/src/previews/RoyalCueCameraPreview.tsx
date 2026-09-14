import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { SnookerRoyalShotCamera } from '../pages/Games/snookerRoyalShotCamera.ts';
import {
  normalizeSpinInput, spinFromScreenPoint, resolvePoolRoyalCueStrike,
  stepPoolRoyalClothSpin, resolvePoolRoyalCushionSpin, isPoolRoyalBallMoving
} from '../pages/Games/poolRoyaleSpinUtils.js';

declare const SNOOKER_PREVIEW_MODEL: string;
declare const SNOOKER_PREVIEW_METRICS: {
  floorY: number; clothY: number; ballY: number; ballR: number;
  tableW: number; tableL: number; targetHeight: number;
  playW: number; playL: number; cameraFov: number;
};
const m = SNOOKER_PREVIEW_METRICS;
type Spin = { x: number; y: number };
type Mode = 'snooker' | 'pool';

// Focused camera/controller inspection. The production character, shot-camera
// controller and Pool spin equations are imported above. The compact table and
// scripted Snooker ball path are illustrative; this does not run a match.
function RoyalCueCameraPreview() {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ mode: 'snooker' as Mode, spin: { x: 0, y: 0 }, shot: 0 });
  const [mode, setMode] = useState<Mode>('snooker');
  const [spin, setSpin] = useState<Spin>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading player view…');
  const drag = useRef<{ id: number; before: Spin } | null>(null);
  const selectSpin = (value: Spin) => {
    const next = normalizeSpinInput(value);
    live.current.spin = next; setSpin(next);
  };
  const spinAt = (event: React.PointerEvent<HTMLButtonElement>) => {
    selectSpin(spinFromScreenPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()));
  };
  const selectMode = (next: Mode) => {
    live.current.mode = next; live.current.shot = 0; setMode(next);
    setStatus(next === 'snooker' ? 'Player perspective' : 'Cushion spin');
  };

  useEffect(() => {
    const stage = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setStatus('WebGL is required for this 3D preview.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101b19);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x314c3f, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-60, 140, 110); scene.add(light);
    const camera = new THREE.PerspectiveCamera(m.cameraFov, 1, 0.01, 1500);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(m.tableW, 1, m.tableL),
      new THREE.MeshStandardMaterial({ color: 0x176844, roughness: 0.85 }));
    cloth.position.y = m.clothY - 0.5; scene.add(cloth);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3021, roughness: 0.7 });
    for (const sign of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, m.tableL + 6.4), wood);
      rail.position.set(sign * (m.tableW / 2 + 1.6), m.clothY, 0); scene.add(rail);
      const end = new THREE.Mesh(new THREE.BoxGeometry(m.tableW, 3, 3.2), wood);
      end.position.set(0, m.clothY, sign * (m.tableL / 2 + 1.6)); scene.add(end);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x202d28 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = m.floorY - 0.1; scene.add(ground);
    const cueStart = new THREE.Vector3(0, m.ballY, m.tableL * 0.32);
    const cueBall = new THREE.Mesh(new THREE.SphereGeometry(m.ballR, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xf7f6ef }));
    cueBall.position.copy(cueStart); scene.add(cueBall);
    for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(m.ballR * .16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xce2424 }));
      dot.position.fromArray(direction).multiplyScalar(m.ballR * .95); cueBall.add(dot);
    }
    const redBall = new THREE.Mesh(new THREE.SphereGeometry(m.ballR, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xbb282b }));
    const redStart = new THREE.Vector3(0, m.ballY, m.tableL * .13);
    redBall.position.copy(redStart); scene.add(redBall);
    const snookerMarks = new THREE.Group(); scene.add(snookerMarks);
    const baulkZ = m.playL * .30;
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe0d7b9 });
    snookerMarks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-m.playW / 2, m.clothY + .02, baulkZ),
      new THREE.Vector3(m.playW / 2, m.clothY + .02, baulkZ)
    ]), lineMaterial));
    snookerMarks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 40 }, (_, i) => new THREE.Vector3(
        Math.cos(i * Math.PI / 39) * m.playW * .16,
        m.clothY + .02, baulkZ + Math.sin(i * Math.PI / 39) * m.playW * .16
      ))), lineMaterial));
    const aim = new THREE.Vector3(0, 0, -1);
    const shotCamera = new SnookerRoyalShotCamera();
    const fallback = { position: new THREE.Vector3(0, m.ballY + m.ballR * 8, m.tableL * .70),
      target: cueStart.clone().addScaledVector(aim, m.ballR * 5), blend: 1 };
    let players: PoolRoyalHumanPlayers | null = null;
    let disposed = false, raf = 0, last = performance.now(), observedShot = 0;
    let previousMode: Mode = 'snooker', shotAt = -Infinity, completed = false;
    let velocity = { x: 0, y: 0 }, omega = { x: 0, y: 0, z: 0 }, accumulator = 0;
    const resize = () => {
      renderer.setSize(stage.clientWidth, stage.clientHeight);
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();
    const bytes = Uint8Array.from(atob(SNOOKER_PREVIEW_MODEL), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const loader = new GLTFLoader();
    // GLB bytes and embedded textures are already in this fragment. Parsing
    // supplies them directly, so the preview does not make runtime API calls.
    loader.register(parser => ({ name: 'InlineCharacterImages', loadTexture: (index: number) => {
      const asset = parser.json.images[parser.json.textures[index].source];
      return parser.getDependency('bufferView', asset.bufferView).then((buffer: ArrayBuffer) => new Promise<THREE.Texture>((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(new Blob([buffer], { type: asset.mimeType }));
        img.onload = () => { const texture = new THREE.Texture(img); texture.flipY = false; texture.needsUpdate = true; URL.revokeObjectURL(url); resolve(texture); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Character texture could not load')); };
        img.src = url;
      }));
    } }));
    new Response(stream).arrayBuffer().then(buffer => loader.parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = new PoolRoyalHumanPlayers(scene, { floorY: m.floorY, clothY: m.clothY,
        tableW: m.tableW, tableL: m.tableL, targetHeight: m.targetHeight, model: gltf.scene });
      const loaded = await players.ready;
      if (disposed) return;
      for (let i = 0; loaded && i < 36; i++) players.update(1 / 30, { activeSeat: 'A', state: 'dragging',
        cueBall: cueStart, aimForward: aim, power: .65, nowMs: i * 33 });
      setReady(loaded); setStatus(loaded
        ? live.current.mode === 'snooker' ? 'Player perspective' : 'Cushion spin'
        : 'Character could not load.');
    }).catch(() => { if (!disposed) setStatus('Character could not load.'); });
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, .033); last = now;
      const mode = live.current.mode;
      if (mode !== previousMode || live.current.shot !== observedShot) {
        const start = live.current.shot > 0;
        cueBall.position.copy(cueStart); cueBall.quaternion.identity(); redBall.position.copy(redStart);
        shotCamera.reset(); shotAt = start ? now : -Infinity; completed = false; accumulator = 0;
        if (mode === 'snooker' && start) shotCamera.beginShot(players?.eyeView ?? null, fallback);
        if (mode === 'pool' && start) {
          const launch = resolvePoolRoyalCueStrike({ spin: live.current.spin,
            direction: { x: .12, y: -1 }, speed: m.playL * .70, radius: m.ballR });
          velocity = launch.velocity; omega = launch.omega;
        }
        previousMode = mode; observedShot = live.current.shot;
      }
      const elapsed = now - shotAt, started = Number.isFinite(shotAt);
      if (mode === 'snooker') {
        snookerMarks.visible = true; redBall.visible = true;
        const travel = THREE.MathUtils.clamp((elapsed - 800) / 3600, 0, 1);
        if (started) {
          // Deliberately scripted travel makes a moving cue ball an isolated
          // camera regression case; it is not a Snooker physics simulation.
          cueBall.position.copy(cueStart).addScaledVector(aim, m.tableL * .30 * (1 - (1 - travel) ** 2));
          cueBall.position.x = Math.sin(travel * Math.PI / 2) * m.playW * .20;
          redBall.position.copy(redStart).addScaledVector(aim,
            m.tableL * .43 * THREE.MathUtils.smoothstep(travel, .20, 1));
        }
        players?.update(dt, { activeSeat: 'A', state: started && elapsed < 1100 ? 'striking' : 'dragging',
          cueBall: cueBall.position, aimForward: aim, power: .65, nowMs: now });
        const pose = shotCamera.resolve({ eye: players?.eyeView ?? null,
          stroke: started && elapsed < 1100, shooting: started,
          impactPending: started && elapsed < 800, cueBlend: 0 }) ?? fallback;
        camera.up.set(0, 1, 0); camera.position.copy(pose.position); camera.lookAt(pose.target);
        players?.updateCameraVisibility(camera, pose.target, 'A');
        if (started && elapsed > 4400 && !completed) { completed = true; setStatus('Player view held'); }
      } else {
        snookerMarks.visible = false; redBall.visible = false;
        if (players) players.group.visible = false;
        camera.up.set(0, 0, -1);
        const fit = Math.max(m.playL / 2, (m.playW / 2 + 6) / camera.aspect) / Math.tan(THREE.MathUtils.degToRad(m.cameraFov / 2));
        camera.position.set(0, m.clothY + fit * 1.12, 0); camera.lookAt(0, m.clothY, 0);
        if (started && !completed) {
          accumulator += dt;
          while (accumulator >= 1 / 120) {
            const next = stepPoolRoyalClothSpin({ velocity, omega, radius: m.ballR, dt: 1 / 120,
              gravity: 9.81 * m.ballR / .028575 });
            velocity = next.velocity; omega = next.omega;
            cueBall.position.x += velocity.x / 120; cueBall.position.z += velocity.y / 120;
            const halfX = m.tableW / 2 - m.ballR, halfZ = m.tableL / 2 - m.ballR;
            for (const axis of ['x', 'z'] as const) {
              const limit = axis === 'x' ? halfX : halfZ;
              if (Math.abs(cueBall.position[axis]) > limit) {
                const sign = Math.sign(cueBall.position[axis]); cueBall.position[axis] = sign * limit;
                const bounce = resolvePoolRoyalCushionSpin({ velocity, omega, radius: m.ballR,
                  normal: axis === 'x' ? { x: -sign, y: 0 } : { x: 0, y: -sign }, restitution: .92 });
                velocity = bounce.velocity; omega = bounce.omega;
              }
            }
            const angular = new THREE.Vector3(omega.x, omega.y, omega.z);
            if (angular.lengthSq() > 1e-10) cueBall.quaternion.premultiply(
              new THREE.Quaternion().setFromAxisAngle(angular.clone().normalize(), angular.length() / 120));
            accumulator -= 1 / 120;
          }
          if (elapsed > 12000 || (elapsed > 500 && !isPoolRoyalBallMoving({ vel: velocity, omega }, m.ballR, .05))) {
            completed = true; setStatus('Shot complete');
          }
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); players?.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh; mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const spinLabel = `${spin.y > 0 ? 'Follow' : spin.y < 0 ? 'Draw' : 'Center'}${spin.x < 0 ? ' · Left' : spin.x > 0 ? ' · Right' : ''}`;
  return <section className="royal-cue-inspector">
    <div className="royal-cue-controls" role="group" aria-label="Preview">
      <button type="button" aria-pressed={mode === 'snooker'} onClick={() => selectMode('snooker')}>Snooker camera</button>
      <button type="button" aria-pressed={mode === 'pool'} onClick={() => selectMode('pool')}>Pool spin</button>
    </div>
    <div ref={host} className="royal-cue-stage" role="img"
      aria-label={mode === 'snooker' ? 'Player perspective stays in place while the cue ball moves away' : 'Pool cue ball with selected spin and cushion rebounds, viewed from above'} />
    {mode === 'pool' && <div className="royal-cue-spin-controls">
      <div className="royal-cue-dial-label">Follow</div>
      <div className="royal-cue-dial-row"><span>Left</span>
        <button className="royal-cue-spin" type="button" aria-label={`Spin: ${spinLabel}. Drag or use arrow keys; Home centers.`}
          onPointerDown={e => { if (drag.current || !e.isPrimary || e.button !== 0) return; drag.current = { id: e.pointerId, before: { ...live.current.spin } }; e.currentTarget.setPointerCapture(e.pointerId); spinAt(e); }}
          onPointerMove={e => { if (drag.current?.id === e.pointerId) spinAt(e); }}
          onPointerUp={e => { if (drag.current?.id !== e.pointerId) return; spinAt(e); drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
          onPointerCancel={e => { if (drag.current?.id !== e.pointerId) return; const before = drag.current.before; drag.current = null; selectSpin(before); }}
          onLostPointerCapture={e => { if (drag.current?.id !== e.pointerId) return; const before = drag.current.before; drag.current = null; selectSpin(before); }}
          onKeyDown={e => {
            const delta = ({ ArrowUp: [0, .15], ArrowDown: [0, -.15], ArrowLeft: [-.15, 0], ArrowRight: [.15, 0] } as Record<string, number[]>)[e.key];
            if (delta) { e.preventDefault(); selectSpin({ x: spin.x + delta[0], y: spin.y + delta[1] }); }
            if (e.key === 'Home') { e.preventDefault(); selectSpin({ x: 0, y: 0 }); }
          }}><span style={{ left: `${50 + spin.x * 50}%`, top: `${50 - spin.y * 50}%` }} /></button>
        <span>Right</span>
      </div><div className="royal-cue-dial-label">Draw</div>
      <div className="royal-cue-spin-actions"><output aria-live="polite">{spinLabel}</output>
        <button type="button" onClick={() => selectSpin({ x: 0, y: 0 })}>Center</button>
      </div>
    </div>}
    <div className="royal-cue-controls">
      <button type="button" disabled={mode === 'snooker' && !ready} onClick={() => {
        live.current.shot++; setStatus(mode === 'snooker' ? 'Shot · player view held' : `Shot · ${spinLabel.toLowerCase()}`);
      }}>Play shot</button><output role="status">{status}</output>
    </div>
  </section>;
}

createRoot(document.getElementById('royal-cue-camera-preview')!).render(<RoyalCueCameraPreview />);
