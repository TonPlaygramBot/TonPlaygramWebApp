// Table clearance preview: baked production table geometry and the real
// Chess avatar. No game services or account state.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCheckersHumanActor, updateCheckersHumanMove, idleCheckersHuman, setCheckersHumanView, disposeCheckersHuman, checkersPortraitFov, CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT, PHYSICAL_MOVE_DURATION_MS } from '../src/games/checkers/checkersHumanActors.ts';
import type { CheckersHumanActor, CheckersHumanMove } from '../src/games/checkers/checkersHumanActors.ts';

const scale = 0.48 * 0.68, modelScale = 0.75 * scale, stoolScale = 1.02 * scale;
const radius = 2.6 * modelScale;
const tableY = 0.98 * modelScale - 0.09 * modelScale * stoolScale * 0.85 - 0.4 * modelScale + 0.09 * modelScale * stoolScale + 0.05 * modelScale;
const tile = ((8 * 4.2 + 3 * 2) * 0.049 * scale * 0.62) / 8;
const position = ({ r, c }: { r: number; c: number }) => new THREE.Vector3((c - 3.5) * tile, tableY + 0.022 + tile * 0.012, (r - 3.5) * tile);

type PreviewTable = { id: string; label: string; meshes: { positions: number[]; normals: number[]; color: string }[] };
async function decodeEmbedded(id: string) {
  const encoded = document.getElementById(id)!.textContent!.trim();
  const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
function Preview() {
  const mount = useRef<HTMLDivElement>(null);
  const play = useRef(() => {});
  const switchView = useRef(() => {});
  const selectTable = useRef((id: string) => {});
  const [tableId, setTableId] = useState('murlan-default');
  const [status, setStatus] = useState('Loading characters…');
  const [busy, setBusy] = useState(true);
  const [view, setView] = useState('Hapësira e këmbëve');
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setStatus('WebGL is unavailable on this device.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', 'Checkers board with the Chess human avatar picking up and placing tokens');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b1220');
    scene.add(new THREE.HemisphereLight('#fff4e4', '#516480', 2.4));
    const key = new THREE.DirectionalLight('#ffe4c0', 3.2); key.position.set(1, 3, 2); scene.add(key);
    const rim = new THREE.DirectionalLight('#86b9ff', 2); rim.position.set(-2, 1, -2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.02, 100);
    let viewIndex = 0;
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height; camera.fov = checkersPortraitFov(camera.aspect);
      camera.updateProjectionMatrix();
      if (viewIndex === 0) { camera.position.set(1.2, 0.5, 1.3); camera.lookAt(0, -0.02, 0); }
      else if (viewIndex === 2) { camera.position.set(0, tableY + 1.3, 0.001); camera.lookAt(0, tableY, 0); }
      else { camera.position.set(0, tableY + 2.05 * scale, radius * 0.98 * 1.06); camera.lookAt(0, tableY + CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT * scale, 0); }
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
    const tableGroup = new THREE.Group(); scene.add(tableGroup);
    let tables: PreviewTable[] = [];
    const showTable = (id: string) => {
      tableGroup.children.forEach(node => { const mesh = node as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
      tableGroup.clear();
      const chosen = tables.find(table => table.id === id) || tables[0];
      if (!chosen) return;
      chosen.meshes.forEach(part => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
        tableGroup.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.48, metalness: 0.18 })));
      });
      renderer.render(scene, camera);
    };
    selectTable.current = showTable;
    const border = new THREE.Mesh(new THREE.BoxGeometry(tile * 8.5, 0.018, tile * 8.5), new THREE.MeshStandardMaterial({ color: '#826445', metalness: 0.35, roughness: 0.35 }));
    border.position.y = tableY + 0.003; scene.add(border);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const square = new THREE.Mesh(new THREE.BoxGeometry(tile, 0.007, tile), new THREE.MeshStandardMaterial({ color: (r + c) % 2 ? '#344941' : '#d9c5a7', roughness: 0.48 }));
      square.position.set((c - 3.5) * tile, tableY + 0.014, (r - 3.5) * tile); scene.add(square);
    }
    const chips = new THREE.Group(); scene.add(chips);
    const createChip = (r: number, c: number, light: boolean) => {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(tile * 0.338, tile * 0.311, tile * 0.19, 48), new THREE.MeshStandardMaterial({ color: light ? '#efeee7' : '#687480', roughness: 0.32, metalness: 0.12 }));
      chip.position.copy(position({ r, c })); chips.add(chip); return chip;
    };
    const resetChips = () => {
      while (chips.children.length) {
        const mesh = chips.children[0] as THREE.Mesh;
        mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); chips.remove(mesh);
      }
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 && (r < 3 || r > 4)) createChip(r, c, r > 4);
    };
    resetChips(); resize();
    let actors: CheckersHumanActor[] = [], cancelled = false, raf = 0, example = 0;
    let animation: { action: CheckersHumanMove; actor: CheckersHumanActor; start: number; captured?: THREE.Mesh } | null = null;
    const draw = (now: number) => {
      if (cancelled) return;
      if (animation) {
        const u = Math.min(1, (now - animation.start) / PHYSICAL_MOVE_DURATION_MS);
        updateCheckersHumanMove(animation.actor, animation.action, u, tile);
        if (animation.captured && u >= 0.82) animation.captured.visible = false;
        if (u >= 1) { idleCheckersHuman(animation.actor); animation = null; setBusy(false); setStatus('Placed · hand released'); }
      }
      renderer.render(scene, camera);
      if (animation) raf = requestAnimationFrame(draw);
    };
    const start = () => {
      if (animation || actors.length !== 2) return;
      resetChips(); actors.forEach(idleCheckersHuman);
      const capture = example % 2 === 1;
      const fromCell = capture ? { r: 2, c: 3 } : { r: 5, c: 2 };
      const toCell = capture ? { r: 4, c: 5 } : { r: 4, c: 3 };
      const mesh = chips.children.find(chip => chip.position.distanceTo(position(fromCell)) < 0.001)!;
      const captured = capture ? createChip(3, 4, true) : undefined;
      animation = { actor: actors[capture ? 1 : 0], action: { mesh, fromCell, toCell, from: position(fromCell), to: position(toCell) }, start: performance.now(), captured };
      setBusy(true); setStatus(capture ? 'Opponent · capture' : 'You · pick up and place'); example++;
      raf = requestAnimationFrame(draw);
    };
    play.current = start;
    switchView.current = () => {
      viewIndex = (viewIndex + 1) % 3;
      actors.forEach(actor => setCheckersHumanView(actor, viewIndex === 1 ? '3d' : '2d'));
      setView(['Hapësira e këmbëve', 'Pamja e lojtarit', 'Nga lart'][viewIndex]); resize();
    };
    const load = async () => {
      const [buffer, tableBuffer] = await Promise.all([decodeEmbedded('checkers-preview-model'), decodeEmbedded('checkers-preview-tables')]);
      tables = JSON.parse(new TextDecoder().decode(tableBuffer));
      showTable('murlan-default');
      const gltf = await new GLTFLoader().parseAsync(buffer, '');
      if (cancelled) return;
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      gltf.scene.position.x -= (bounds.min.x + bounds.max.x) / 2;
      gltf.scene.position.z -= (bounds.min.z + bounds.max.z) / 2;
      gltf.scene.position.y -= bounds.min.y;
      gltf.scene.updateMatrixWorld(true);
      actors = (['bottom', 'top'] as const).map(seat => createCheckersHumanActor(gltf.scene, {
        seat, distance: radius + 0.56 * scale - 0.075 + (seat === 'bottom' ? 0.025 : 0), seatY: tableY - 0.12, height: radius * 2.4
      }));
      actors.forEach(actor => { setCheckersHumanView(actor, '2d'); scene.add(actor.root); });
      setStatus('Përshtatja e tavolinës'); setBusy(false); resize();
    };
    void load().catch(() => { if (!cancelled) setStatus('The character preview could not load.'); });
    return () => {
      cancelled = true; cancelAnimationFrame(raf); resizeObserver.disconnect();
      actors.forEach(disposeCheckersHuman);
      scene.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose()); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="checkers-preview-phone">
    <div className="checkers-preview-header">Checkers Battle Royal <span>{view}</span></div>
    <label className="checkers-preview-picker">Tavolina
      <select value={tableId} disabled={busy} onChange={event => { setTableId(event.target.value); selectTable.current(event.target.value); }}>
        <option value="murlan-default">Octagon</option><option value="hexagonTable">Hexagon</option><option value="grandOval">Oval</option><option value="diamondEdge">Diamond</option>
      </select>
    </label>
    <div className="checkers-preview-stage" ref={mount} />
    <div className="checkers-preview-footer">
      <div role="status" aria-live="polite">{status}</div>
      <div className="checkers-preview-controls">
        <button type="button" disabled={busy} onClick={() => play.current()}>Lëviz gurin</button>
        <button type="button" onClick={() => switchView.current()}>Ndrysho pamjen</button>
      </div>
    </div>
  </div>;
}

createRoot(document.getElementById('checkers-table-preview')!).render(<Preview />);
