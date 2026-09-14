// Self-contained, service-free movement preview. The real Chess model, game
// rules, reserve layout, camera and human choreography are shared with the game.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFourInRowHuman, disposeFourInRowHuman, reservePosition, createReserveInstances, reserveCount, advanceHumanPlacement, playerEyePosition, portraitBoardFov } from '../src/games/fourinrow/humanPresentation.ts';
import type { FourInRowHuman, HumanPlacement, PlayerToken } from '../src/games/fourinrow/humanPresentation.ts';
import { createBoard, cloneBoard, getDropRow, getWinningCells, chooseAiMove, isFull } from '../src/utils/fourInRowGame.js';
import { getFourInRowDropDuration, consumeFourInRowFrame } from '../src/utils/fourInRowMotion.ts';

const tableRadius = 3.4 * 0.75 * 0.49 * 0.25 * 0.74 * 1.5 * 1.6 * 1.2 * 1.3;
const tableY = 1.2 * 0.25 * 0.88 * 0.74 * 1.5 * 1.6 * 1.3;
const scale = 0.7 * 0.25 * 0.35 * 1.5 * 1.3;
const width = (1.08 + 7 * 0.19) * scale * 1.9, height = (0.92 + 6 * 0.2) * scale * 1.9;
const radius = Math.min(width / 7, height / 6) * 0.285, thickness = 0.15 * scale * 0.9;
const bottom = tableY + 0.075 * scale, center = bottom + height / 2;
const cell = (r: number, c: number) => new THREE.Vector3(-width / 2 + (c + 0.5) * width / 7, bottom + height - (r + 0.5) * height / 6, 0);

function Preview() {
  const mount = useRef<HTMLDivElement>(null), play = useRef((column: number) => {}), reset = useRef(() => {});
  const [board, setBoard] = useState(() => createBoard(6, 7));
  const [busy, setBusy] = useState(true), [winner, setWinner] = useState(''), [status, setStatus] = useState('Loading characters…');
  const [phase, setPhase] = useState('');
  useEffect(() => {
    const host = mount.current!;
    let cancelled = false, raf = 0, aiTimer: ReturnType<typeof setTimeout> | undefined;
    let current = createBoard(6, 7), actors: FourInRowHuman[] = [], placement: HumanPlacement | null = null, won = '';
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setStatus('3D is unavailable on this device.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', '3D four in a row table with seated human players');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#111c2c');
    scene.add(new THREE.HemisphereLight('#fff1df', '#6484a8', 1.75));
    const key = new THREE.DirectionalLight('#ffeed9', 2.1); key.position.set(2.2, 4.5, 1.6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = key.shadow.camera.bottom = -2; key.shadow.camera.right = key.shadow.camera.top = 2;
    key.shadow.normalBias = 0.004; scene.add(key);
    const rim = new THREE.DirectionalLight('#8bbfff', 1.4); rim.position.set(-1.8, 2.6, -2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.015, 100);
    const material = (color: string, metalness = 0, roughness = 0.45) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const wood = material('#39251c', 0.12), felt = material('#143d39', 0, 0.88), metal = material('#bb9a69', 0.65, 0.32);
    const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.copy(position); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    add(new THREE.CylinderGeometry(tableRadius, tableRadius * 0.97, 0.065, 64), wood, new THREE.Vector3(0, tableY - 0.034, 0));
    add(new THREE.CylinderGeometry(tableRadius * 0.93, tableRadius * 0.93, 0.008, 64), felt, new THREE.Vector3(0, tableY - 0.004, 0));
    const tableRim = add(new THREE.TorusGeometry(tableRadius * 0.95, 0.006, 8, 80), metal, new THREE.Vector3(0, tableY + 0.001, 0)); tableRim.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.2, 0.27, tableY - 0.04, 32), wood, new THREE.Vector3(0, (tableY - 0.04) / 2, 0));
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, -height / 2); shape.lineTo(width / 2, -height / 2); shape.lineTo(width / 2, height / 2); shape.lineTo(-width / 2, height / 2); shape.closePath();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const hole = new THREE.Path(); hole.absarc((c + 0.5) * width / 7 - width / 2, height / 2 - (r + 0.5) * height / 6, radius * 0.96, 0, Math.PI * 2, true); shape.holes.push(hole);
    }
    const panel = material('#e3d6b9', 0.05, 0.6), boardGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.028 * scale, bevelEnabled: false, curveSegments: 32 });
    for (const side of [-1, 1]) add(boardGeo, panel, new THREE.Vector3(0, center, side * 0.15 * scale / 2 - (side < 0 ? 0.028 * scale : 0)));
    for (const x of [-1, 1]) {
      add(new THREE.BoxGeometry(0.02, height + 0.028, 0.034), wood, new THREE.Vector3(x * (width / 2 + 0.01), center, 0));
      add(new THREE.BoxGeometry(0.08, 0.018, 0.1), wood, new THREE.Vector3(x * (width / 2 + 0.01), tableY + 0.009, 0));
    }
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(width + 0.04, 0.015, 0.006), wood, new THREE.Vector3(0, bottom + height + 0.0075, z * 0.016));
    const holeRim = new THREE.TorusGeometry(radius * 0.97, 0.018 * scale, 8, 32);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const side of [-1, 1]) add(holeRim, metal, cell(r, c).add(new THREE.Vector3(0, 0, side * 0.013)));
    const chipMaterials = { player: material('#e3342f', 0.03, 0.35), ai: material('#2d79d8', 0.03, 0.3) };
    const chipRims = { player: material('#ff8c78', 0.05), ai: material('#8bc8ff', 0.05) };
    const chipBody = new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, thickness, 42);
    const chipRim = new THREE.TorusGeometry(radius * 0.9, thickness * 0.1, 8, 36);
    const createChip = (token: PlayerToken) => {
      const group = new THREE.Group(), body = new THREE.Mesh(chipBody, chipMaterials[token]), border = new THREE.Mesh(chipRim, chipRims[token]);
      border.rotation.x = Math.PI / 2; group.add(body, border); body.castShadow = body.receiveShadow = true; return group;
    };
    const reserves = Object.fromEntries((['player', 'ai'] as const).map(token => {
      const reserve = createReserveInstances(createChip(token), 21, token, radius, thickness * 1.16, tableY, tableRadius); scene.add(reserve.group); return [token, reserve];
    }));
    const chips = new THREE.Group(); scene.add(chips);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.position.copy(actors.length ? playerEyePosition(actors[0], scene) : new THREE.Vector3(0, tableY + tableRadius * 0.92, tableRadius * 1.04));
      camera.fov = portraitBoardFov(camera.aspect, width, camera.position.z); camera.updateProjectionMatrix(); camera.lookAt(0, center + height * 0.14, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    function move(column: number, token: PlayerToken) {
      if (placement || won || actors.length < 2) return;
      const row = getDropRow(current, column); if (row < 0) return;
      current = cloneBoard(current); current[row][column] = token; setBoard(current);
      const count = reserveCount(current, token); reserves[token].setCount(count);
      const mesh = createChip(token); chips.add(mesh);
      const target = cell(row, column), columnTop = cell(0, column); columnTop.y = bottom + height + height / 6 * 0.62;
      placement = { token, actor: actors[token === 'player' ? 0 : 1], mesh, from: reservePosition(count, token, 21, radius, thickness * 1.16, tableY, tableRadius), columnTop, target, motionTime: 0, chipRadius: radius, chipThickness: thickness, elapsed: 0, phase: 'preview', previewDuration: 0, dropDuration: getFourInRowDropDuration(row + 1.12), bounceHeight: height / 6 * 0.2 };
      setBusy(true); setPhase(token); setStatus(token === 'player' ? 'Your move · pick up & place' : 'Rival’s move · pick up & place');
      const winning = getWinningCells(current, token);
      won = winning ? token : isFull(current) ? 'draw' : '';
    }
    play.current = column => move(column, 'player');
    reset.current = () => { if (placement) return; clearTimeout(aiTimer); current = createBoard(6, 7); won = ''; chips.clear(); Object.values(reserves).forEach(reserve => reserve.setCount(21)); setBoard(current); setWinner(''); setBusy(false); setPhase(''); setStatus('Your turn · choose a column'); };
    const clock = new THREE.Clock(), frameClock = { pending: 0 };
    const draw = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(draw);
      const delta = consumeFourInRowFrame(frameClock, clock.getDelta(), 60); if (!delta) return;
      if (placement && advanceHumanPlacement(placement, delta).finished) {
        const token = placement.token; placement = null;
        if (won) { setWinner(won); setBusy(false); setPhase(''); setStatus(won === 'player' ? 'You connected four!' : won === 'ai' ? 'Rival connected four' : 'Draw · no spaces remain'); }
        else if (token === 'player') { setStatus('Rival is choosing…'); aiTimer = setTimeout(() => move(chooseAiMove(current, 'ai', 'player', 4), 'ai'), 420); }
        else { setBusy(false); setPhase(''); setStatus('Your turn · choose a column'); }
      }
      renderer.render(scene, camera);
    };
    const load = async () => {
      const encoded = document.getElementById('four-inline-model')!.textContent!.trim();
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const gltf = await new GLTFLoader().parseAsync(await new Response(stream).arrayBuffer(), '');
      if (cancelled) return;
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      gltf.scene.position.x -= (bounds.min.x + bounds.max.x) / 2; gltf.scene.position.z -= (bounds.min.z + bounds.max.z) / 2; gltf.scene.position.y -= bounds.min.y;
      gltf.scene.updateMatrixWorld(true);
      actors = (['player', 'ai'] as const).map(token => createFourInRowHuman(gltf.scene, token, tableRadius, tableY));
      actors.forEach(actor => scene.add(actor.root)); resize(); setBusy(false); setStatus('Your turn · choose a column');
    };
    void load().catch(() => { if (!cancelled) setStatus('The character preview could not load.'); }); draw();
    return () => {
      cancelled = true; cancelAnimationFrame(raf); clearTimeout(aiTimer); observer.disconnect(); actors.forEach(disposeFourInRowHuman);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.isMesh) { geometries.add(mesh.geometry); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(mat => materials.add(mat)); } });
      geometries.forEach(geo => geo.dispose()); materials.forEach(mat => mat.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="four-in-row-game four-inline-game">
    <div className="four-inline-stage" ref={mount} />
    <header className="four-match-header">
      <div className="four-brand"><span className="four-brand-mark">④</span><div><h1>4 in a row</h1><span>MOVEMENT PREVIEW · 7 × 6</span></div></div>
      <div className="four-players">{(['player', 'ai'] as const).map(token => <div key={token} className={`four-player ${phase === token || (!busy && !winner && token === 'player') ? 'is-turn' : ''}`}><span className={`four-chip-dot ${token === 'player' ? 'player' : 'rival'}`}/><div><strong>{token === 'player' ? 'You' : 'AI rival'}</strong><span>{reserveCount(board, token)} chips left</span></div></div>)}</div>
    </header>
    <div className="four-inline-controls"><p role="status" aria-live="polite">{status}</p><div className="four-column-buttons">{Array.from({ length: 7 }, (_, c) => <button key={c} type="button" aria-label={`Drop piece in column ${c + 1}`} disabled={busy || !!winner || getDropRow(board, c) < 0} onClick={() => play.current(c)}>{c + 1}</button>)}</div><button type="button" className="four-inline-reset" disabled={busy} onClick={() => reset.current()}>Play again</button></div>
  </div>;
}

createRoot(document.getElementById('four-in-row-inline')!).render(<Preview />);
