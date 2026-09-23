import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers, type PlayerSeat } from '../pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { type ShotState } from '../pages/Games/shared/poolRoyalReferenceHuman.ts';
import { createPoolRoyalCue, posePoolRoyalCue } from '../pages/Games/shared/createPoolRoyalCue.ts';
import { PoolRoyalShotCamera } from '../pages/Games/shared/poolRoyalShotCamera.ts';
import { advancePoolRoyalCueStroke, referenceCuePull, referenceCueFeather, resolveCueBallContact } from '../pages/Games/poolRoyaleCueStrokeTimeline.js';
import { clipGuideTravel } from '../pages/Games/shared/billiardsGuideGeometry.js';
import { createShowoodTableGeometry, groundShowoodTableLegs, raycastPoolCushions } from '../pages/Games/shared/poolRoyaleShowoodGeometry.js';

declare const POOL_PREVIEW_MODEL: string;
declare const POOL_PREVIEW_SHOWOOD: string;
declare const POOL_PREVIEW_TABLE: { floorY: number; clothY: number; ballY: number; ballR: number; tableW: number; tableL: number; playW: number; playL: number; railH: number; thickness: number; cueLength: number; cueRadius: number; cueGap: number; cuePull: number; cueButtLift: number };
const METRICS = Object.fromEntries(Object.entries(POOL_PREVIEW_TABLE).map(([key, value]) => [key,
  (value - (['clothY', 'ballY', 'floorY'].includes(key) ? POOL_PREVIEW_TABLE.floorY : 0)) / 12
])) as typeof POOL_PREVIEW_TABLE;
type View = 'player' | 'table' | 'bridge' | 'geometry';

function CharacterPreview() {
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef({ state: 'dragging' as ShotState, view: 'bridge' as View, paused: false, power: 0.25, yaw: 0, seat: 'A' as PlayerSeat, strikeAt: 0, shotId: 0, resetId: 0, elapsed: 0, slow: false, ai: false, inspectContact: false, station: 0 });
  const [state, setState] = useState<ShotState>('dragging');
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<View>('bridge');
  const [seat, setSeat] = useState<PlayerSeat>('A');
  const [power, setPower] = useState(25);
  const [direction, setDirection] = useState(0);
  const [status, setStatus] = useState('Loading players…');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState('Aiming');
  const [canShoot, setCanShoot] = useState(false);
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
    let renderer: THREE.WebGLRenderer;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!context) throw new Error('WebGL unavailable');
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
    } catch {
      setStatus('This preview needs WebGL to display the players.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
    scene.add(floor);
    const w = METRICS.tableW;
    const l = METRICS.tableL;
    const tableGeometry = createShowoodTableGeometry({ playWidth: METRICS.playW,
      playLength: METRICS.playL, ballRadius: METRICS.ballR, clothHeight: METRICS.clothY });
    const collisionOverlay = new THREE.Group(); scene.add(collisionOverlay);
    const contourMaterial = new THREE.LineBasicMaterial({ color: 0xffda7a, depthTest: false });
    // This is the same measured nose/jaw contour used by Pool Royal collision.
    for (const polygon of tableGeometry.cushionPolygons) {
      const contour = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
        polygon.points.map((point: { x: number; y: number }) => new THREE.Vector3(point.x, METRICS.ballY, point.y))
      ), contourMaterial);
      contour.renderOrder = 10; collisionOverlay.add(contour);
    }
    collisionOverlay.visible = false;
    const unpack = (encoded: string) => {
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    };
    let loadedTable: THREE.Group | null = null;
    unpack(POOL_PREVIEW_SHOWOOD).then(buffer => new GLTFLoader().parseAsync(buffer, '')).then(gltf => {
      if (disposed) return;
      loadedTable = gltf.scene;
      loadedTable.scale.set(tableGeometry.fit.scale.x, tableGeometry.fit.scale.y, tableGeometry.fit.scale.z);
      loadedTable.position.set(tableGeometry.fit.position.x, tableGeometry.fit.position.y, tableGeometry.fit.position.z);
      loadedTable.updateMatrixWorld(true);
      groundShowoodTableLegs(loadedTable, METRICS.floorY);
      loadedTable.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeVertexNormals(); mesh.castShadow = true; mesh.receiveShadow = true;
        for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
          const surface = material as THREE.MeshStandardMaterial;
          surface.color.setHex(/cloth/.test(surface.name) ? 0x206e49 : /pocket|plastic/.test(surface.name) ? 0x17191a : 0x734a2d);
        }
      });
      scene.add(loadedTable);
    }).catch(() => { if (!disposed) setStatus('Showood table could not load.'); });
    const ballPosition = new THREE.Vector3(0, METRICS.ballY, METRICS.tableL * 0.31);
    const ballGeometry = new THREE.SphereGeometry(METRICS.ballR, 24, 16);
    const cueBall = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.16 }));
    cueBall.position.copy(ballPosition); cueBall.castShadow = true; scene.add(cueBall);
    let ballNumber = 0;
    const objectBalls: { id: number; active: boolean; pos: THREE.Vector2; mesh: THREE.Mesh }[] = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
      const ball = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({
        color: [0xe0ac27, 0x296ba6, 0xba302a, 0x744596, 0xd86d22, 0x286945, 0x873232, 0x151515][ballNumber++ % 8], roughness: 0.23
      }));
      ball.position.set((col - row / 2) * METRICS.ballR * 2.05, ballPosition.y,
        -METRICS.tableL * 0.18 - row * METRICS.ballR * 1.88); ball.castShadow = true; scene.add(ball);
      objectBalls.push({ id: ballNumber, active: true, pos: new THREE.Vector2(ball.position.x, ball.position.z), mesh: ball });
    }
    const guideTravel = (origin: THREE.Vector2, direction: THREE.Vector2, maxDistance: number, ignoreIds: number[] = []) => {
      const cushion = raycastPoolCushions(origin, direction, METRICS.ballR, tableGeometry.segments, maxDistance);
      return clipGuideTravel({ origin, direction, balls: objectBalls, ignoreIds, radius: METRICS.ballR,
        maxDistance: Math.min(maxDistance, cushion?.distance ?? maxDistance) });
    };
    const aimLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xb7d9c9, transparent: true, opacity: 0.65 }));
    scene.add(aimLine);
    const objectGuide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf4c66c }));
    const cueGuide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x76d9f4 }));
    const ghost = new THREE.Mesh(new THREE.RingGeometry(METRICS.ballR * 0.94, METRICS.ballR * 1.06, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    ghost.rotation.x = -Math.PI / 2;
    scene.add(objectGuide, cueGuide, ghost);
    const liveCue = createPoolRoyalCue({ ballRadius: METRICS.ballR, length: METRICS.cueLength, tipRadius: METRICS.cueRadius });
    liveCue.shaftMaterial.color.setHex(0xdeb887);
    scene.add(liveCue.body);
    const shotCamera = new PoolRoyalShotCamera(0.55);
    const shotTip = { position: new THREE.Vector3(), visible: true };
    let stroke: any = null;
    let seenShot = 0, seenReset = 0, seenStation = 0, simulationTime = 0, lastPhase = '', lastCanShoot = false;
    const shotAnchor = ballPosition.clone();
    const shotDirection = new THREE.Vector3();
    let travel = 0;
    const cueLength = liveCue.tipLocal.distanceTo(liveCue.buttLocal);
    let players: PoolRoyalHumanPlayers | undefined;
    let disposed = false;
    let raf = 0;
    let last = performance.now();
    unpack(POOL_PREVIEW_MODEL).then(buffer => new GLTFLoader().parseAsync(buffer, '')).then(async gltf => {
      if (disposed) return;
      players = new PoolRoyalHumanPlayers(scene, { floorY: 0, clothY: METRICS.clothY,
        tableW: tableGeometry.footprint.width, tableL: tableGeometry.footprint.length,
        targetHeight: Math.max(Math.max(METRICS.tableW, METRICS.tableL) * 0.82, (METRICS.clothY - METRICS.floorY) * 1.8),
        model: gltf.scene, realisticMovement: true });
      players.setCueAppearance(liveCue.body, liveCue.tipLocal, liveCue.buttLocal);
      const loaded = await players.ready;
      if (!disposed) { setReady(loaded); setStatus(loaded ? 'Showood geometry · simplified materials' : 'Players could not load.'); }
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
      if (seenStation !== current.station) {
        seenStation = current.station;
        const position = [
          [0, METRICS.tableL * 0.31], [METRICS.playW * 0.3, METRICS.playL * 0.07], [0, -METRICS.playL * 0.37]
        ][current.station % 3];
        ballPosition.set(position[0], METRICS.ballY, position[1]);
      }
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
      liveCue.body.visible = (stroke ? shotTip.visible : current.state !== 'idle') && !players?.walking;
      const bridgeSafety = {
        cueRadius: METRICS.ballR / 0.0525 * (0.008 + 0.017 * 0.28),
        bridgeBounds: { halfWidth: METRICS.playW / 2, halfLength: METRICS.playL / 2 },
        bridgeRailY: METRICS.clothY + 0.04161 * tableGeometry.fit.scale.y,
        bridgeObstacles: [{ position: cueBall.position, radius: METRICS.ballR }, ...objectBalls.map(ball => ({ position: ball.mesh.position, radius: METRICS.ballR }))]
      };
      if (current.inspectContact) for (let i = 0; i < 65; i++) players?.update(1 / 60, { activeSeat: current.seat, state: 'dragging', power: current.power, cueBall: ballPosition, aimForward: forward, nowMs: simulationTime, cueBack, cueTip, ...bridgeSafety });
      if (!current.paused) players?.update(dt * (current.slow ? 0.2 : 1), { activeSeat: current.seat, state: characterState, power: current.power,
        cueBall: shotAnchor.copy(ballPosition), aimForward: forward, nowMs: simulationTime, cueBack, cueTip,
        ...bridgeSafety });
      if (players?.readyToShoot !== lastCanShoot) { lastCanShoot = Boolean(players?.readyToShoot); setCanShoot(lastCanShoot); }
      if (players?.walking && !stroke) displayPhase = 'Walking to position';
      else if (!lastCanShoot && !stroke && current.state !== 'idle') displayPhase = 'Settling stance';
      // Inspection motion begins only at the production stroke's impact callback.
      // Ball collisions/rules are verified separately against the game modules.
      if (travel > 0 && !current.paused && !current.inspectContact) {
        const stop = guideTravel(new THREE.Vector2(ballPosition.x, ballPosition.z),
          new THREE.Vector2(shotDirection.x, shotDirection.z), METRICS.ballR * 22);
        travel = Math.min(travel + stepMs * METRICS.ballR * (0.02 + current.power * 0.055), Math.max(0, stop - 1e-5));
        cueBall.position.copy(ballPosition).addScaledVector(shotDirection, travel);
      }
      if (current.inspectContact) { current.inspectContact = false; current.paused = true; setPaused(true); cueBall.position.copy(ballPosition); needsRender = true; }
      if (displayPhase !== lastPhase) { lastPhase = displayPhase; setPhase(displayPhase); }
      const origin = new THREE.Vector2(ballPosition.x, ballPosition.z);
      const direction = new THREE.Vector2(forward.x, forward.z);
      const travelToContact = guideTravel(origin, direction, METRICS.playL * 2);
      const contact = origin.clone().addScaledVector(direction, travelToContact);
      const atHeight = (point: THREE.Vector2) => new THREE.Vector3(point.x, METRICS.ballY, point.y);
      aimLine.geometry.setFromPoints([ballPosition, atHeight(contact)]);
      aimLine.visible = current.state === 'dragging' && !players?.walking;
      ghost.visible = aimLine.visible;
      ghost.position.set(contact.x, METRICS.clothY + 0.014, contact.y);
      const hit = objectBalls.find(ball => Math.abs(ball.pos.distanceTo(contact) - 2 * METRICS.ballR) < METRICS.ballR * 0.01);
      objectGuide.visible = cueGuide.visible = Boolean(hit && aimLine.visible);
      if (hit) {
        const normal = hit.pos.clone().sub(contact).normalize();
        const cueExit = direction.clone().addScaledVector(normal, -direction.dot(normal));
        const objectLength = guideTravel(hit.pos, normal, METRICS.ballR * 16, [hit.id]);
        objectGuide.geometry.setFromPoints([atHeight(hit.pos), atHeight(hit.pos.clone().addScaledVector(normal, objectLength))]);
        cueGuide.visible = aimLine.visible && cueExit.lengthSq() > 1e-6;
        if (cueGuide.visible) {
          cueExit.normalize();
          const cueLength = guideTravel(contact, cueExit, METRICS.ballR * 12, [hit.id]);
          cueGuide.geometry.setFromPoints([atHeight(contact), atHeight(contact.clone().addScaledVector(cueExit, cueLength))]);
        }
      }
      const eye = shotCamera.resolve({ eye: players?.eyeView ?? null, stroke: Boolean(stroke && shotTip.visible),
        shooting: Boolean(stroke), cueBlend: 0, now: simulationTime, excluded: current.view !== 'player' });
      const fov = current.view === 'player' && eye ? 66 : 46;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      collisionOverlay.visible = current.view === 'geometry';
      if (current.view === 'player' && eye) {
        camera.position.copy(eye.position); camera.lookAt(eye.target);
      } else if (current.view === 'geometry') {
        const distance = Math.max(METRICS.playL * 0.6, METRICS.playW * 0.64 / camera.aspect) /
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.position.set(0, METRICS.clothY + distance, 0.001);
        camera.lookAt(0, METRICS.clothY, 0);
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
      players?.updateCameraVisibility(camera, eye?.target ?? focus, eye ? current.seat : undefined);
      renderer.render(scene, camera); needsRender = false; lastView = current.view;
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
    <div className="viz-row"><span>Pool Royal · Hands & eye view</span>
      <select className="form-select" aria-label="Active player" value={seat} onChange={event => {
        const next = event.target.value as PlayerSeat; setSeat(next); live.current.seat = next; changeState('dragging');
      }}><option value="A">Player 1</option><option value="B">AI player</option></select>
    </div>
    <div ref={stage} className="pool-preview-stage" role="img" aria-label="Pool Royal players walking around the Showood table, with player, bridge and measured collision views" />
    <div className="viz-controls" aria-label="Camera view">
      {(['player', 'table', 'bridge', 'geometry'] as View[]).map(value => <button key={value} className="btn" aria-pressed={view === value}
        onClick={() => { setView(value); live.current.view = value;  }}>
        {{ player: 'Player view', table: 'Table view', bridge: 'Bridge hand', geometry: 'Cushion mapping' }[value]}</button>)}
    </div>
    <div className="viz-controls">
      <button className="btn" disabled={!ready} aria-pressed={state === 'idle'} onClick={() => changeState('idle')}>Stand</button>
      <button className="btn" disabled={!ready} aria-pressed={state === 'dragging'} onClick={() => changeState('dragging')}>Aim</button>
      <button className="btn btn-primary" disabled={!ready || !canShoot || state !== 'dragging'} onClick={() => { live.current.ai = false; changeState('striking'); }}>Strike</button>
      <button className="btn" disabled={!ready || state === 'striking'} onClick={() => {
        live.current.station++; live.current.yaw = [0, Math.PI / 2, Math.PI][live.current.station % 3];
        setDirection(Math.round(-live.current.yaw * 180 / Math.PI)); changeState('dragging');
        setView('table'); live.current.view = 'table';
      }}>Walk to next shot</button>
      <button className="btn" disabled={!ready || !canShoot} onClick={() => { live.current.ai = false; changeState('striking'); live.current.inspectContact = true; }}>Inspect contact</button>
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
