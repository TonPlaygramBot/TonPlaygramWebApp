import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers, type PlayerSeat } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { CFG, type ShotState } from '../pages/Games/shared/poolRoyalReferenceHuman.ts';
import { createPoolRoyalCue, posePoolRoyalCue } from '../pages/Games/shared/createPoolRoyalCue.ts';
import { PoolRoyalShotCamera } from '../pages/Games/shared/poolRoyalShotCamera.ts';
import { advancePoolRoyalCueStroke, referenceCuePull, referenceCueFeather, resolveCueBallContact } from '../pages/Games/poolRoyaleCueStrokeTimeline.js';
import { SoftwareRenderer } from '../games/tennis/software.ts';

declare const POOL_PREVIEW_MODEL: string;
declare const POOL_PREVIEW_TABLE: { floorY: number; clothY: number; ballY: number; ballR: number; tableW: number; tableL: number; playW: number; playL: number; railH: number; thickness: number; cueLength: number; cueRadius: number; cueGap: number; cuePull: number; cueButtLift: number };
const METRICS = Object.fromEntries(Object.entries(POOL_PREVIEW_TABLE).map(([key, value]) => [key,
  (value - (['clothY', 'ballY', 'floorY'].includes(key) ? POOL_PREVIEW_TABLE.floorY : 0)) / 12
])) as typeof POOL_PREVIEW_TABLE;
type View = 'player' | 'table' | 'bridge';

function CharacterPreview() {
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef({ state: 'dragging' as ShotState, view: 'player' as View, paused: false, power: 0.25, yaw: 0, seat: 'A' as PlayerSeat, strikeAt: 0, shotId: 0, resetId: 0, elapsed: 0, slow: false, ai: false, inspectContact: false });
  const [state, setState] = useState<ShotState>('dragging');
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<View>('player');
  const [seat, setSeat] = useState<PlayerSeat>('A');
  const [power, setPower] = useState(25);
  const [direction, setDirection] = useState(0);
  const [status, setStatus] = useState('Loading players…');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState('Aiming');
  const changeState = (next: ShotState) => {
    live.current.paused = false; setPaused(false);
    live.current.state = next;
    live.current.elapsed = 0; live.current.inspectContact = false;
    if (next === 'striking') live.current.shotId++;
    else { live.current.resetId++; live.current.ai = false; }
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
    const camera = new THREE.PerspectiveCamera(46, 1, 0.01, 200);
    const focus = new THREE.Vector3(0, METRICS.clothY * 0.7, METRICS.tableL * 0.22);
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
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2], size[0] > 2 ? 16 : 1, 1, size[2] > 2 ? 32 : 1),
        new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
      mesh.position.fromArray(position); mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh); return mesh;
    };
    const w = METRICS.tableW;
    const l = METRICS.tableL;
    const tableBase = box([w + 0.5, 0.65, l + 0.5], [0, METRICS.clothY - 0.45, 0], 0x36271f);
    // The software preview has no depth buffer. Omit the covered base volume
    // so its hidden top faces cannot sort over the cloth and obscure the hands.
    tableBase.visible = !(renderer instanceof SoftwareRenderer);
    box([w, 0.16, l], [0, METRICS.clothY - 0.08, 0], 0x1f6f43);
    for (const sign of [-1, 1]) {
      box([0.28, 0.2, l], [sign * w / 2, METRICS.clothY + 0.1, 0], 0x174c31);
      box([w, 0.2, 0.28], [0, METRICS.clothY + 0.1, sign * l / 2], 0x174c31);
      for (const end of [-1, 1]) box([0.48, METRICS.clothY - 0.65, 0.48],
        [sign * (w / 2 - 0.6), (METRICS.clothY - 0.65) / 2, end * (l / 2 - 0.7)], 0x36271f);
    }
    const ballPosition = new THREE.Vector3(0, METRICS.ballY, METRICS.tableL * 0.31);
    const ballGeometry = new THREE.SphereGeometry(METRICS.ballR, 24, 16);
    const cueBall = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.16 }));
    cueBall.position.copy(ballPosition); cueBall.castShadow = true; scene.add(cueBall);
    let ballNumber = 0;
    for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
      const ball = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({
        color: [0xe0ac27, 0x296ba6, 0xba302a, 0x744596, 0xd86d22, 0x286945, 0x873232, 0x151515][ballNumber++ % 8], roughness: 0.23
      }));
      ball.position.set((col - row / 2) * METRICS.ballR * 2.05, ballPosition.y,
        -METRICS.tableL * 0.18 - row * METRICS.ballR * 1.88); ball.castShadow = true; scene.add(ball);
    }
    const aimLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xb7d9c9, transparent: true, opacity: 0.65 }));
    scene.add(aimLine);
    const liveCue = createPoolRoyalCue({ ballRadius: METRICS.ballR, length: METRICS.cueLength, tipRadius: METRICS.cueRadius });
    liveCue.shaftMaterial.color.setHex(0xdeb887);
    scene.add(liveCue.body);
    const shotCamera = new PoolRoyalShotCamera();
    const shotTip = { position: new THREE.Vector3(), visible: true };
    let stroke: any = null;
    let seenShot = 0, seenReset = 0, simulationTime = 0, lastPhase = '';
    const shotAnchor = ballPosition.clone();
    const shotDirection = new THREE.Vector3();
    let travel = 0;
    const cueLength = liveCue.tipLocal.distanceTo(liveCue.buttLocal);
    let players: PoolRoyalHumanPlayers | undefined;
    let disposed = false;
    let raf = 0;
    let last = performance.now();
    const packed = Uint8Array.from(atob(POOL_PREVIEW_MODEL), c => c.charCodeAt(0));
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    new Response(stream).arrayBuffer().then(buffer => new GLTFLoader().parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = new PoolRoyalHumanPlayers(scene, { floorY: 0, clothY: METRICS.clothY,
        tableW: METRICS.tableW, tableL: METRICS.tableL, model: gltf.scene });
      players.setCueAppearance(liveCue.body, liveCue.tipLocal, liveCue.buttLocal);
      const loaded = await players.ready;
      if (!disposed) { setReady(loaded); setStatus(loaded ? 'Drag the scene to aim' : 'Players could not load.'); }
    }).catch(() => { if (!disposed) setStatus('Players could not load.'); });
    let needsRender = true;
    let lastView = live.current.view;
    const resize = () => {
      needsRender = true;
      const width = host.clientWidth, height = host.clientHeight;
      renderer.setSize(width, height);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const draw = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const current = live.current;
      if (current.paused && !needsRender && current.view === lastView) { current.strikeAt = now; raf = requestAnimationFrame(draw); return; }
      const stepMs = Math.min(100, (now - (current.strikeAt || now))) * (current.slow ? 0.2 : 1);
      current.strikeAt = now;
      if (!current.paused) { current.elapsed += stepMs; simulationTime += stepMs; }
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, current.yaw);
      const axis = forward.clone().addScaledVector(THREE.Object3D.DEFAULT_UP, -METRICS.cueButtLift / cueLength).normalize();
      if (seenReset !== current.resetId) {
        seenReset = current.resetId; stroke = null; travel = 0; cueBall.position.copy(ballPosition); shotCamera.reset();
      }
      const pull = referenceCuePull(current.power, METRICS.ballR) + referenceCueFeather(current.power, METRICS.ballR, simulationTime);
      const idleTip = ballPosition.clone().addScaledVector(forward, -METRICS.cueGap).addScaledVector(THREE.Object3D.DEFAULT_UP, -METRICS.ballR * 0.34);
      const aimingTip = idleTip.clone().addScaledVector(forward, -pull);
      if (seenShot !== current.shotId) {
        seenShot = current.shotId; travel = 0; shotAnchor.copy(ballPosition); cueBall.position.copy(ballPosition); shotDirection.copy(forward);
        const contact = resolveCueBallContact(ballPosition, axis, idleTip.clone().sub(ballPosition), METRICS.ballR, METRICS.cueRadius);
        stroke = { startTime: simulationTime - (current.inspectContact ? 120 * 0.88 + 0.001 : 0), idlePos: idleTip.clone(), pullPos: aimingTip.clone(), contactPos: contact,
          pullbackDuration: current.ai ? 650 : 0, strikeDuration: 120, holdDuration: 50,
          onImpact: () => { travel = 0.00001; } };
      }
      let displayPhase = current.state === 'idle' ? 'Standing' : 'Aiming';
      let characterState = current.state;
      if (stroke && (!current.paused || current.inspectContact)) {
        const sample = advancePoolRoyalCueStroke(shotTip, stroke, simulationTime);
        characterState = sample.phase === 'pullback' ? 'dragging' : sample.done ? 'idle' : 'striking';
        displayPhase = sample.phase === 'pullback' ? 'AI · pulling back' : sample.hitArmed ? 'Contact · cue ball released' : 'Pushing forward';
        if (sample.done) { current.state = 'idle'; setState('idle'); }
      } else if (stroke) {
        characterState = shotTip.visible ? (simulationTime - stroke.startTime < stroke.pullbackDuration ? 'dragging' : 'striking') : 'idle';
        displayPhase = lastPhase;
      }
      const cueTip = stroke ? shotTip.position.clone() : aimingTip;
      const cueBack = cueTip.clone().addScaledVector(axis, -cueLength);
      posePoolRoyalCue(liveCue.body, cueBack, cueTip, liveCue.tipLocal, liveCue.buttLocal);
      liveCue.body.visible = stroke ? shotTip.visible : current.state !== 'idle';
      if (current.inspectContact) for (let i = 0; i < 65; i++) players?.update(1 / 60, { activeSeat: current.seat, state: 'dragging', power: current.power, cueBall: ballPosition, aimForward: forward, nowMs: simulationTime, cueBack, cueTip });
      if (!current.paused) players?.update(dt, { activeSeat: current.seat, state: characterState, power: current.power,
        cueBall: shotAnchor.copy(ballPosition), aimForward: forward, nowMs: simulationTime, cueBack, cueTip });
      // Inspection motion begins only at the production stroke's impact callback.
      // Ball collisions/rules are verified separately against the game modules.
      if (travel > 0 && !current.paused && !current.inspectContact) {
        travel = Math.min(travel + stepMs * METRICS.ballR * (0.02 + current.power * 0.055), METRICS.ballR * 22);
        cueBall.position.copy(ballPosition).addScaledVector(shotDirection, travel);
      }
      if (current.inspectContact) { current.inspectContact = false; current.paused = true; setPaused(true); cueBall.position.copy(ballPosition); needsRender = true; }
      if (displayPhase !== lastPhase) { lastPhase = displayPhase; setPhase(displayPhase); }
      aimLine.geometry.setFromPoints([ballPosition, ballPosition.clone().addScaledVector(forward, 2.1 * CFG.scale)]);
      const eye = shotCamera.resolve({ eye: players?.eyeView ?? null, stroke: Boolean(stroke && shotTip.visible),
        shooting: Boolean(stroke), cueBlend: 0, now: simulationTime, excluded: current.view !== 'player' });
      const fov = current.view === 'player' && eye ? 66 : 46;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      players?.setFirstPerson(current.view === 'player' && Boolean(eye), current.seat);
      if (current.view === 'player' && eye) {
        camera.position.copy(eye.position); camera.lookAt(eye.target);
      } else if (current.view === 'bridge') {
        const side = new THREE.Vector3(forward.z, 0, -forward.x);
        camera.position.copy(ballPosition).addScaledVector(forward, -METRICS.ballR * 14)
          .addScaledVector(side, METRICS.ballR * 9).addScaledVector(THREE.Object3D.DEFAULT_UP, METRICS.ballR * 12);
        camera.lookAt(ballPosition.clone().addScaledVector(forward, -METRICS.ballR * 6.5).addScaledVector(side, METRICS.ballR * 2));
      } else {
        const bounds = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -l / 2), new THREE.Vector3(w / 2, METRICS.clothY, l / 2));
        if (players) for (const player of players.players) {
          const base = player.human.modelRoot.getWorldPosition(new THREE.Vector3());
          const height = players.humanHeight;
          bounds.expandByPoint(base.clone().add(new THREE.Vector3(-height * 0.2, 0, -height * 0.13)));
          bounds.expandByPoint(base.clone().add(new THREE.Vector3(height * 0.2, height, height * 0.13)));
        }
        bounds.getCenter(focus);
        const offset = new THREE.Vector3(0.38, 0.32, 1).normalize();
        const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, offset).normalize();
        const up = new THREE.Vector3().crossVectors(offset, right);
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        let distance = 0;
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(focus);
          distance = Math.max(distance, Math.abs(corner.dot(right)) / (tan * camera.aspect) + corner.dot(offset), Math.abs(corner.dot(up)) / tan + corner.dot(offset));
        }
        camera.position.copy(focus).addScaledVector(offset, distance * 1.06);
        camera.lookAt(focus);
      }
      if (!(renderer instanceof SoftwareRenderer) || needsRender || now - renderer.last > 100) {
        if (needsRender && renderer instanceof SoftwareRenderer) renderer.last = 0;
        renderer.render(scene, camera); needsRender = false; lastView = current.view;
      }
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
      live.current.paused = false; setPaused(false);
      if (live.current.state !== 'dragging') changeState('dragging');
      live.current.yaw -= (event.clientX - previousX) * 0.006;
      previousX = event.clientX;
      setDirection(Math.round(THREE.MathUtils.euclideanModulo(-live.current.yaw * 180 / Math.PI + 180, 360) - 180));
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
    <div className="viz-row"><span>Pool Royal · Shot inspection</span>
      <select className="form-select" aria-label="Active player" value={seat} onChange={event => {
        const next = event.target.value as PlayerSeat; setSeat(next); live.current.seat = next; changeState('dragging');
      }}><option value="A">Player 1</option><option value="B">AI player</option></select>
    </div>
    <div ref={stage} className="pool-preview-stage" role="img" aria-label="Pool Royal players at calibrated table scale, with eye-level and bridge views" />
    <div className="viz-controls" aria-label="Camera view">
      {(['player', 'table', 'bridge'] as View[]).map(value => <button key={value} className="btn" aria-pressed={view === value}
        onClick={() => { setView(value); live.current.view = value;  }}>
        {{ player: 'Player view', table: 'Table view', bridge: 'Bridge hand' }[value]}</button>)}
    </div>
    <div className="viz-controls">
      <button className="btn" disabled={!ready} aria-pressed={state === 'idle'} onClick={() => changeState('idle')}>Stand</button>
      <button className="btn" disabled={!ready} aria-pressed={state === 'dragging'} onClick={() => changeState('dragging')}>Aim</button>
      <button className="btn btn-primary" disabled={!ready || state !== 'dragging'} onClick={() => { live.current.ai = false; changeState('striking'); }}>Strike</button>
      <button className="btn" disabled={!ready || state === 'striking'} onClick={() => { live.current.seat = 'B'; setSeat('B'); live.current.ai = true; changeState('striking'); }}>AI shot</button>
      <button className="btn" disabled={!ready} onClick={() => { live.current.ai = false; changeState('striking'); live.current.inspectContact = true; }}>Inspect contact</button>
      <button className="btn" onClick={() => { live.current.paused = !paused; setPaused(!paused); }}>{paused ? 'Resume motion' : 'Pause motion'}</button>
    </div>
    <div className="viz-controls"><label className="form-check"><input className="form-check-input" type="checkbox" checked={slow} onChange={e => { setSlow(e.target.checked); live.current.slow = e.target.checked; }} /><span className="form-check-label">Slow motion</span></label><span role="status">{phase}</span></div>
    <div className="viz-controls">
      <label className="form-label">Power · {power}%<input className="form-range" type="range" min="0" max="100" value={power}
        onChange={event => { const value = +event.target.value; setPower(value); live.current.power = value / 100; changeState('dragging'); }} /></label>
      <label className="form-label">Direction · {direction}°<input className="form-range" type="range" min="-180" max="180" value={direction}
        onChange={event => { const value = +event.target.value; live.current.paused = false; setPaused(false); setDirection(value); live.current.yaw = -value * Math.PI / 180; changeState('dragging'); }} /></label>
    </div>
    <div className="text-small text-muted" role="status">{status}</div>
  </div>;
}

const container = document.getElementById('pool-royal-players');
if (container) createRoot(container).render(<CharacterPreview />);
