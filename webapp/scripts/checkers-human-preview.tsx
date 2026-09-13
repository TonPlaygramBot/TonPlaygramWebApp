// Standalone movement preview: the production character controller and bundled
// Chess avatar, with a small board stage. No game services or account state.
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

function Preview() {
  const mount = useRef<HTMLDivElement>(null);
  const play = useRef(() => {});
  const switchView = useRef(() => {});
  const [status, setStatus] = useState('Loading characters…');
  const [busy, setBusy] = useState(true);
  const [view, setView] = useState('3D');
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
    let topDown = false;
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height; camera.fov = checkersPortraitFov(camera.aspect);
      camera.updateProjectionMatrix();
      if (topDown) { camera.position.set(0, tableY + 1.3, 0.001); camera.lookAt(0, tableY, 0); }
      else { camera.position.set(0, tableY + 2.05 * scale, radius * 0.98 * 1.06); camera.lookAt(0, tableY + CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT * scale, 0); }
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.035, 64), new THREE.MeshStandardMaterial({ color: '#183c36', roughness: 0.9 }));
    table.position.y = tableY - 0.014; scene.add(table);
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
      topDown = !topDown;
      actors.forEach(actor => setCheckersHumanView(actor, topDown ? '2d' : '3d'));
      setView(topDown ? '2D' : '3D'); resize();
    };
    const load = async () => {
      const encoded = document.getElementById('checkers-preview-model')!.textContent!.trim();
      const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
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
      actors.forEach(actor => { setCheckersHumanView(actor, '3d'); scene.add(actor.root); });
      setStatus('Human movement preview'); setBusy(false); resize();
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
    <div className="checkers-preview-stage" ref={mount} />
    <div className="checkers-preview-footer">
      <div role="status" aria-live="polite">{status}</div>
      <div className="checkers-preview-controls">
        <button type="button" disabled={busy} onClick={() => play.current()}>Play move</button>
        <button type="button" onClick={() => switchView.current()}>{view === '3D' ? 'Top view' : 'Player view'}</button>
      </div>
    </div>
  </div>;
}

createRoot(document.getElementById('checkers-human-preview')!).render(<Preview />);
