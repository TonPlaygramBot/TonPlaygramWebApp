import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PoolRoyalHumanPlayers } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { SnookerRoyalShotCamera } from '../pages/Games/snookerRoyalShotCamera.ts';
import { clampBallInHand, projectPointerToSnookerTable } from '../games/snooker/ballInHand.ts';
import { createCueReachEquipment, poseCueReachEquipment } from '../pages/Games/shared/cueReachEquipment.ts';

declare const SNOOKER_PREVIEW_MODEL: string;
declare const SNOOKER_PREVIEW_METRICS: {
  floorY: number; clothY: number; ballY: number; ballR: number;
  tableW: number; tableL: number; targetHeight: number;
  playW: number; playL: number; cameraFov: number;
};
const m = SNOOKER_PREVIEW_METRICS;
type Mode = 'shot' | 'placement' | 'equipment';

// Focused interaction preview, not a full match. Production camera, projection,
// placement bounds, player rig and Blender equipment are used directly. Only the
// table shell and ball travel are illustrative; live match QA runs separately.
function SnookerInteractionReview() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ shoot(): void; place(): void; reset(): void } | null>(null);
  const state = useRef({ mode: 'shot' as Mode, part: 'extension', placing: true, shot: false });
  const [mode, setMode] = useState<Mode>('shot');
  const [part, setPart] = useState('extension');
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [status, setStatus] = useState('Loading player…');
  const select = (next: Mode) => {
    state.current.mode = next; setMode(next); api.current?.reset();
  };

  useEffect(() => {
    const stage = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setStatus('WebGL is required for the 3D view.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101b19);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303a32, 2));
    const key = new THREE.DirectionalLight(0xfff3dc, 3); key.position.set(-50, 120, 60); scene.add(key);
    const camera = new THREE.PerspectiveCamera(m.cameraFov, 1, .001, 2000);
    const table = new THREE.Group(); scene.add(table);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(m.playW, 2, m.playL),
      new THREE.MeshStandardMaterial({ color: 0x1d6845, roughness: .94 }));
    cloth.position.y = m.clothY - 1; table.add(cloth);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x422419, roughness: .4 });
    for (const sign of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, m.playL + 6), railMat);
      side.position.set(sign * (m.playW / 2 + 1.5), m.clothY, 0); table.add(side);
      const end = new THREE.Mesh(new THREE.BoxGeometry(m.playW, 3.5, 3), railMat);
      end.position.set(0, m.clothY, sign * (m.playL / 2 + 1.5)); table.add(end);
    }
    const baulkY = -m.playL * .30, dRadius = m.playW * .16;
    const bounds = { limitX: m.playW / 2 - m.ballR, limitY: m.playL / 2 - m.ballR,
      baulkY, dRadius, fullTable: false };
    const line = new THREE.LineBasicMaterial({ color: 0xe6decc });
    table.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-m.playW / 2, m.clothY + .03, baulkY),
      new THREE.Vector3(m.playW / 2, m.clothY + .03, baulkY)
    ]), line));
    table.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, (_, i) =>
      new THREE.Vector3(Math.cos(i * Math.PI / 59) * dRadius, m.clothY + .03,
        baulkY - Math.sin(i * Math.PI / 59) * dRadius))), line));
    const sphere = new THREE.SphereGeometry(m.ballR, 24, 16);
    const cue = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: 0xfffbef, roughness: .17 }));
    const red = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: 0xaa1024, roughness: .2 }));
    table.add(cue, red);
    const cueStart = new THREE.Vector3(0, m.ballY, m.playL * .28);
    const redStart = new THREE.Vector3(0, m.ballY, m.playL * .02);
    const aim = new THREE.Vector3(0, 0, -1);
    const director = new SnookerRoyalShotCamera();
    const fallback = { position: new THREE.Vector3(0, m.ballY + m.ballR * 7, m.playL * .66),
      target: cueStart.clone(), blend: 1 };
    const equipment = createCueReachEquipment(); scene.add(equipment.group);
    poseCueReachEquipment(equipment, { cueBack: new THREE.Vector3(0, .08, 1.8),
      cueTip: new THREE.Vector3(0, .07, 0), cueBall: new THREE.Vector3(0, .07, -.04),
      aimForward: aim, rootTarget: new THREE.Vector3(.08, 0, 3), clothY: 0, scale: 1,
      profile: { needsExtension: true, extensionLength: .65, rearRailDistance: 3,
        normalReach: 1.2, longAxisAlignment: 1, farSideThreshold: 2 } });
    let players: PoolRoyalHumanPlayers | null = null;
    let disposed = false, raf = 0, last = performance.now(), shotAt: number | null = null;
    let impacted = false, lastStatus = '', yaw = .5, pitch = .24;
    let gesture: { id: number; start: THREE.Vector3; x: number; y: number } | null = null;
    const announce = (value: string) => { if (value !== lastStatus) { lastStatus = value; setStatus(value); } };
    const reset = () => {
      shotAt = null; impacted = false; director.reset(); state.current.shot = false;
      state.current.placing = true; setShooting(false); setPlaced(false);
      cue.position.copy(state.current.mode === 'placement'
        ? new THREE.Vector3(0, m.ballY, baulkY - dRadius * .6) : cueStart);
      red.position.copy(redStart);
    };
    api.current = {
      reset,
      place: () => { if (!state.current.shot) { state.current.placing = true; setPlaced(false); } },
      shoot: () => {
        if (state.current.shot || (state.current.mode === 'placement' && state.current.placing)) return;
        state.current.shot = true; setShooting(true); shotAt = performance.now();
        director.beginShot(players?.eyeView ?? null, fallback);
      }
    };
    reset();
    const resize = () => { renderer.setSize(stage.clientWidth, stage.clientHeight);
      camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();
    const point = (e: PointerEvent) => projectPointerToSnookerTable(e,
      stage.getBoundingClientRect(), camera, table, m.ballY);
    const placeAt = (e: PointerEvent) => {
      const p = point(e); if (!p) return false;
      const legal = clampBallInHand(p, bounds); if (!legal) return false;
      cue.position.set(legal.x, m.ballY, legal.y); return true;
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || state.current.shot || gesture) return;
      if (state.current.mode === 'shot') return;
      if (state.current.mode === 'placement' && !state.current.placing) return;
      gesture = { id: e.pointerId, start: cue.position.clone(), x: e.clientX, y: e.clientY };
      if (state.current.mode === 'placement') placeAt(e);
      stage.setPointerCapture(e.pointerId); e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!gesture || gesture.id !== e.pointerId) return;
      if (state.current.mode === 'placement') placeAt(e);
      else { yaw -= (e.clientX - gesture.x) * .008; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - gesture.y) * .006, -.5, 1.2); }
      gesture.x = e.clientX; gesture.y = e.clientY;
    };
    const end = (e: PointerEvent) => {
      if (!gesture || gesture.id !== e.pointerId) return;
      if (state.current.mode === 'placement') {
        if (e.type === 'pointerup' && placeAt(e)) { state.current.placing = false; setPlaced(true); }
        else cue.position.copy(gesture.start);
      }
      gesture = null; if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    };
    stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    const bytes = Uint8Array.from(atob(SNOOKER_PREVIEW_MODEL), c => c.charCodeAt(0));
    const loader = new GLTFLoader();
    loader.register(parser => ({ name: 'InlineCharacterImages', loadTexture: (index: number) => {
      const asset = parser.json.images[parser.json.textures[index].source];
      return parser.getDependency('bufferView', asset.bufferView).then((buffer: ArrayBuffer) => new Promise<THREE.Texture>((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(new Blob([buffer], { type: asset.mimeType }));
        img.onload = () => { const texture = new THREE.Texture(img); texture.flipY = false; texture.needsUpdate = true; URL.revokeObjectURL(url); resolve(texture); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Texture load failed')); }; img.src = url;
      }));
    } }));
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      .then(buffer => loader.parseAsync(buffer, '')).then(async gltf => {
        if (disposed) return;
        players = new PoolRoyalHumanPlayers(scene, { floorY: m.floorY, clothY: m.clothY,
          tableW: m.tableW, tableL: m.tableL, targetHeight: m.targetHeight, model: gltf.scene });
        const loaded = await players.ready;
        if (!disposed) setReady(loaded);
      }).catch(() => { if (!disposed) announce('Player model could not load.'); });
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, .033); last = now;
      const mode = state.current.mode, elapsed = shotAt === null ? 0 : now - shotAt;
      table.visible = mode !== 'equipment'; equipment.group.visible = mode === 'equipment';
      if (players) players.group.visible = mode === 'shot';
      if (mode === 'equipment') {
        const extension = state.current.part === 'extension';
        equipment.extension.visible = extension; equipment.rest.visible = !extension;
        const target = extension ? new THREE.Vector3(0, .08, 2.10) : equipment.restHead.position.clone();
        const distance = extension ? .92 : .23;
        camera.fov = 42; camera.position.copy(target).add(new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance));
        camera.lookAt(target); announce(extension ? 'Telescopic extension · drag to turn' : 'Brass cross rest · drag to turn');
      } else if (mode === 'placement') {
        camera.fov = m.cameraFov;
        camera.position.set(m.playW * .15, m.ballY + m.playW * .95, -m.playL * .88);
        camera.lookAt(0, m.clothY, baulkY + dRadius * .6);
        announce(state.current.shot ? 'Placement locked for this shot' : state.current.placing ? 'Place inside the D' : 'Ready · you can move the cue ball again');
      } else {
        const started = shotAt !== null, stroke = started && elapsed < 1050;
        players?.update(dt, { activeSeat: 'A', state: stroke ? 'striking' : 'dragging',
          cueBall: cueStart, aimForward: aim, power: .65, nowMs: now });
        if (started && elapsed >= 650 && !impacted) {
          impacted = true; director.markImpact(now, players?.eyeView ?? null);
        }
        if (started) {
          const travel = THREE.MathUtils.clamp((elapsed - 650) / 3400, 0, 1);
          cue.position.copy(cueStart).addScaledVector(aim, m.playL * .45 * travel);
          cue.position.x = Math.sin(travel * Math.PI / 2) * m.playW * .22;
          red.position.copy(redStart).addScaledVector(aim, m.playL * .28 * Math.max(0, (travel - .25) / .75));
        }
        const pose = director.resolve({ eye: players?.eyeView ?? null, stroke, shooting: started,
          impactPending: started && !impacted, cueBlend: 0, now });
        camera.fov = m.cameraFov;
        if (pose) { camera.position.copy(pose.position); camera.lookAt(pose.target); }
        else if (director.isBroadcasting) {
          camera.position.set(-m.playW * .65, m.ballY + m.playL * .80, m.playL * .66);
          camera.lookAt(0, m.clothY, -m.playL * .07);
        } else { camera.position.copy(fallback.position); camera.lookAt(fallback.target); }
        players?.updateCameraVisibility(camera, cueStart, pose ? 'A' : undefined);
        announce(director.isBroadcasting ? 'Broadcast camera' : started ? 'Player follow-through' : 'Player perspective');
      }
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      stage.dataset.camera = JSON.stringify(camera.position.toArray());
      stage.dataset.cue = JSON.stringify(cue.position.toArray());
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); api.current = null;
      stage.removeEventListener('pointerdown', down); stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', end); stage.removeEventListener('pointercancel', end);
      players?.dispose(); environment.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => materials.add(mat));
      } });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => { (material as THREE.MeshStandardMaterial).map?.dispose(); material.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div>
    <div className="sr-toolbar" aria-label="Review mode">
      {(['shot', 'placement', 'equipment'] as Mode[]).map(item => <button key={item} type="button"
        aria-pressed={mode === item} onClick={() => select(item)}>{item === 'shot' ? 'Shot camera' : item === 'placement' ? 'Ball in hand' : 'Equipment'}</button>)}
    </div>
    <div ref={host} className="sr-stage" role="img" aria-label="Snooker camera, cue placement and equipment preview" />
    <div className="sr-toolbar">
      {mode === 'equipment' ? ['extension', 'rest'].map(item => <button type="button" key={item}
        aria-pressed={part === item} onClick={() => { state.current.part = item; setPart(item); }}>{item === 'extension' ? 'Extension' : 'Cross rest'}</button>) : <>
        {mode === 'placement' && <button type="button" disabled={shooting || !placed} onClick={() => api.current?.place()}>Move cue ball</button>}
        <button type="button" disabled={!ready || shooting || (mode === 'placement' && !placed)} onClick={() => api.current?.shoot()}>Shoot</button>
        <button type="button" onClick={() => api.current?.reset()}>Reset</button>
      </>}
    </div>
    <div className="sr-status" role="status" aria-live="polite">{status}</div>
  </div>;
}

createRoot(document.getElementById('snooker-interaction-review')!).render(<SnookerInteractionReview />);
