import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers, type PlayerSeat } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { CFG, type ShotState } from '../pages/Games/shared/poolRoyalReferenceHuman.ts';
import { SoftwareRenderer } from '../games/tennis/software.ts';

declare const POOL_PREVIEW_MODEL: string;

function CharacterPreview() {
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef({ state: 'idle' as ShotState, power: 0.55, yaw: 0, seat: 'A' as PlayerSeat, strikeAt: 0 });
  const [state, setState] = useState<ShotState>('idle');
  const [seat, setSeat] = useState<PlayerSeat>('A');
  const [power, setPower] = useState(55);
  const [direction, setDirection] = useState(0);
  const [status, setStatus] = useState('Loading players…');
  const [ready, setReady] = useState(false);
  const changeState = (next: ShotState) => {
    live.current.state = next;
    if (next === 'striking') live.current.strikeAt = performance.now();
    setState(next);
  };

  useEffect(() => {
    const host = stage.current!;
    let renderer: THREE.WebGLRenderer | SoftwareRenderer;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      renderer = context
        ? new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true })
        : new SoftwareRenderer();
    } catch {
      setStatus('This preview needs WebGL to display the players.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    if (renderer instanceof SoftwareRenderer) renderer.fillTriangleSeams = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const themeProbe = document.createElement('span');
    themeProbe.style.color = 'var(--background)';
    themeProbe.style.display = 'none'; host.appendChild(themeProbe);
    const syncTheme = () => { scene.background = new THREE.Color(getComputedStyle(themeProbe).color); };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true }); syncTheme();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05 * CFG.scale, 80 * CFG.scale);
    camera.position.set(1.85 * CFG.scale, 2.45 * CFG.scale, 7.85 * CFG.scale);
    const focus = new THREE.Vector3(0, 1.05 * CFG.scale, 0);
    const referenceCameraOffset = camera.position.clone().sub(focus);
    camera.lookAt(focus);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x665442, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(4, 14, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120),
      new THREE.ShadowMaterial({ opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    floor.visible = !(renderer instanceof SoftwareRenderer);
    scene.add(floor);
    const box = (size: number[], position: number[], color: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
      mesh.position.fromArray(position); mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh); return mesh;
    };
    const w = CFG.tableW * CFG.tableVisualMultiplier;
    const l = CFG.tableL * CFG.tableVisualMultiplier;
    const tableBase = box([w + 0.5, 0.65, l + 0.5], [0, CFG.tableTopY - 0.45, 0], 0x36271f);
    // The software preview has no depth buffer. Omit the covered base volume
    // so its hidden top faces cannot sort over the cloth and obscure the hands.
    tableBase.visible = !(renderer instanceof SoftwareRenderer);
    box([w, 0.16, l], [0, CFG.tableTopY - 0.08, 0], 0x1f6f43);
    for (const sign of [-1, 1]) {
      box([0.28, 0.2, l], [sign * w / 2, CFG.tableTopY + 0.1, 0], 0x174c31);
      box([w, 0.2, 0.28], [0, CFG.tableTopY + 0.1, sign * l / 2], 0x174c31);
      for (const end of [-1, 1]) box([0.48, CFG.tableTopY - 0.65, 0.48],
        [sign * (w / 2 - 0.6), (CFG.tableTopY - 0.65) / 2, end * (l / 2 - 0.7)], 0x36271f);
    }
    const ballPosition = new THREE.Vector3(0, CFG.tableTopY + CFG.ballR, CFG.tableL * 0.31);
    const ballGeometry = new THREE.SphereGeometry(CFG.ballR, 24, 16);
    const cueBall = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.16 }));
    cueBall.position.copy(ballPosition); cueBall.castShadow = true; scene.add(cueBall);
    let ballNumber = 0;
    for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
      const ball = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({
        color: [0xe0ac27, 0x296ba6, 0xba302a, 0x744596, 0xd86d22, 0x286945, 0x873232, 0x151515][ballNumber++ % 8], roughness: 0.23
      }));
      ball.position.set((col - row / 2) * CFG.ballR * 2.05, ballPosition.y,
        -CFG.tableL * 0.18 - row * CFG.ballR * 1.88); ball.castShadow = true; scene.add(ball);
    }
    const aimLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xb7d9c9, transparent: true, opacity: 0.65 }));
    scene.add(aimLine);
    let players: PoolRoyalHumanPlayers | undefined;
    let disposed = false;
    let raf = 0;
    let last = performance.now();
    const packed = Uint8Array.from(atob(POOL_PREVIEW_MODEL), c => c.charCodeAt(0));
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    new Response(stream).arrayBuffer().then(buffer => new GLTFLoader().parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = new PoolRoyalHumanPlayers(scene, { floorY: 0, clothY: CFG.tableTopY,
        tableW: CFG.tableW, tableL: CFG.tableL, model: gltf.scene });
      const loaded = await players.ready;
      if (!disposed) { setReady(loaded); setStatus(loaded ? 'Drag the scene to aim' : 'Players could not load.'); }
    }).catch(() => { if (!disposed) setStatus('Players could not load.'); });
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      renderer.setSize(width, height);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      // Pull straight back on narrow screens without changing the supplied
      // camera's viewing direction, model orientation, or character transforms.
      camera.position.copy(focus).addScaledVector(referenceCameraOffset, Math.max(1, 1.3 / camera.aspect));
      camera.lookAt(focus); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const draw = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const current = live.current;
      if (current.state === 'striking' && now - current.strikeAt >= (CFG.strikeTime + CFG.holdTime) * 1000) changeState('idle');
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, current.yaw);
      players?.update(dt, { activeSeat: current.seat, state: current.state, power: current.power,
        cueBall: ballPosition, aimForward: forward, nowMs: now });
      aimLine.geometry.setFromPoints([ballPosition, ballPosition.clone().addScaledVector(forward, 2.1 * CFG.scale)]);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    let pointer: number | null = null, previousX = 0;
    const down = (event: PointerEvent) => {
      pointer = event.pointerId; previousX = event.clientX;
      renderer.domElement.setPointerCapture(pointer);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      live.current.yaw -= (event.clientX - previousX) * 0.006;
      previousX = event.clientX;
      setDirection(Math.round(-live.current.yaw * 180 / Math.PI));
    };
    const up = () => { pointer = null; };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); themeObserver.disconnect();
      themeProbe.remove(); players?.dispose();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div className="pool-preview">
    <div className="viz-row"><span>Pool Royal · Players</span>
      <select className="form-select" aria-label="Active player" value={seat} onChange={event => {
        const next = event.target.value as PlayerSeat; setSeat(next); live.current.seat = next; changeState('idle');
      }}><option value="A">Player 1</option><option value="B">Player 2</option></select>
    </div>
    <div ref={stage} className="pool-preview-stage" role="img" aria-label="Two human pool players with the reference stance and cue movement" />
    <div className="viz-controls">
      <button className="btn" disabled={!ready} aria-pressed={state === 'idle'} onClick={() => changeState('idle')}>Stand</button>
      <button className="btn" disabled={!ready} aria-pressed={state === 'dragging'} onClick={() => changeState('dragging')}>Aim</button>
      <button className="btn btn-primary" disabled={!ready || state !== 'dragging'} onClick={() => changeState('striking')}>Strike</button>
    </div>
    <div className="viz-controls">
      <label className="form-label">Power · {power}%<input className="form-range" type="range" min="0" max="100" value={power}
        onChange={event => { const value = +event.target.value; setPower(value); live.current.power = value / 100; changeState('dragging'); }} /></label>
      <label className="form-label">Direction · {direction}°<input className="form-range" type="range" min="-180" max="180" value={THREE.MathUtils.euclideanModulo(direction + 180, 360) - 180}
        onChange={event => { const value = +event.target.value; setDirection(value); live.current.yaw = -value * Math.PI / 180; }} /></label>
    </div>
    <div className="text-small text-muted" role="status">{status}</div>
  </div>;
}

const container = document.getElementById('pool-royal-players');
if (container) createRoot(container).render(<CharacterPreview />);
