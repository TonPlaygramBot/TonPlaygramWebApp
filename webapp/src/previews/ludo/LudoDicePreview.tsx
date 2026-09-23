import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { saveBoneRig, applySeatedHumanPose } from './generated/rig';
import { createLudoDiceHand, createLudoDiceContact, createLudoDiceThrow, updateLudoDiceThrow, LUDO_DICE_TIMING } from '../../utils/ludoDiceMotion.ts';

declare const LUDO_PREVIEW_MODEL: string;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function App() {
  const host = useRef<HTMLDivElement>(null);
  const control = useRef<{ roll: () => void; inspect: (ms: number) => void; view: (id: string) => void }>();
  const [ready, setReady] = useState(false), [status, setStatus] = useState('Loading character…');
  const [view, setView] = useState('table');
  useEffect(() => {
    let disposed = false, raf = 0, cleanup = () => {};
    const bytes = Uint8Array.from(atob(LUDO_PREVIEW_MODEL), (c) => c.charCodeAt(0));
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json().then((json) => {
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#172824');
      scene.add(new THREE.HemisphereLight('#f5efe1', '#66766e', 2.5));
      const light = new THREE.DirectionalLight('#fff4df', 3); light.position.set(-1, 3, -1); light.castShadow = true; scene.add(light);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
      const actor = new THREE.ObjectLoader().parse(json); actor.scale.setScalar(0.8); scene.add(actor);
      const rig = saveBoneRig(actor), hand = createLudoDiceHand(rig);
      const idle = () => { applySeatedHumanPose(rig, 'idle', 1, 0, {}, { idleBreathAmp: 0 }); actor.updateMatrixWorld(true); };
      idle(); actor.position.y += 0.32 - rig.hips.getWorldPosition(V()).y; actor.position.z = -0.74; idle();
      actor.traverse((node) => { if ((node as THREE.Mesh).isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      const tableY = rig.rightUpperArm.getWorldPosition(V()).y - 0.22;
      const box = (size: number[], point: number[], color: string) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
        mesh.position.set(...point as [number, number, number]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
      };
      box([1.45, 0.07, 1.25], [0, tableY - 0.045, 0.12], '#65432e');
      box([1.42, 0.012, 1.22], [0, tableY - 0.006, 0.12], '#356252');
      box([0.4, 0.05, 0.4], [0, 0.28, -0.74], '#65432e');
      box([0.43, 0.4, 0.04], [0, 0.48, -0.96], '#65432e');
      box([0.58, 0.016, 0.58], [-0.12, tableY + 0.008, 0.22], '#dfd4b1');
      ['#c76258', '#d7b24c', '#539ccc', '#63a06c'].forEach((color, i) => {
        const x = -0.12 + (i % 2 ? 1 : -1) * 0.18, z = 0.22 + (i < 2 ? -1 : 1) * 0.18;
        box([0.16, 0.005, 0.16], [x, tableY + 0.019, z], color);
        for (let j = 0; j < 4; j++) {
          const token = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.017, 0.025, 12), new THREE.MeshStandardMaterial({ color }));
          token.position.set(x + (j % 2 ? 1 : -1) * 0.035, tableY + 0.035, z + (j < 2 ? -1 : 1) * 0.035); scene.add(token);
        }
      });
      const dice = new THREE.Group(); scene.add(dice);
      const shell = box([0.054, 0.054, 0.054], [0, 0, 0], '#f5eee0'); scene.remove(shell); dice.add(shell);
      const normals = [V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), V(-1, 0, 0), V(0, 0, -1), V(0, -1, 0)];
      const pips = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]];
      normals.forEach((normal, i) => pips[i].forEach(([x, y]) => {
        const pip = new THREE.Mesh(new THREE.CircleGeometry(0.0038, 12), new THREE.MeshStandardMaterial({ color: '#26342b' }));
        pip.quaternion.setFromUnitVectors(V(0, 0, 1), normal);
        pip.position.copy(V(x * 0.014, y * 0.014, 0.0272).applyQuaternion(pip.quaternion)); dice.add(pip);
      }));
      const pickup = rig.rightUpperArm.getWorldPosition(V()).add(V(0.025, -0.22, 0.27)); pickup.y = tableY + 0.027;
      const landing = pickup.clone().add(V(0.08, 0, 0.12));
      dice.position.copy(pickup);
      const contact = createLudoDiceContact(hand, dice, 0.054)!;
      let action = createLudoDiceThrow(contact, dice, landing), started = 0, playing = false, selectedView = 'table';
      let released = false, release = V();
      function label(ms: number) { return ms < 280 ? 'Reach' : ms < 440 ? 'Close fingers' : ms < 660 ? 'Lift' : ms < 840 ? 'Wind up' : ms < 1040 ? 'Throw' : ms < 1580 ? 'Release & follow through' : 'Ready'; }
      function draw(ms: number) {
        idle();
        updateLudoDiceThrow(action, ms);
        if (ms >= LUDO_DICE_TIMING.release) {
          if (!released) { release.copy(dice.position); released = true; }
          const flight = Math.min(1, (ms - LUDO_DICE_TIMING.release) / 850);
          dice.position.copy(release).lerp(landing, flight); dice.position.y += Math.sin(flight * Math.PI) * 0.055;
          dice.rotation.set(flight * Math.PI * 4, flight * Math.PI * 2, flight * Math.PI * 2);
        }
        rig.head.scale.setScalar(selectedView === 'player' ? 0.001 : 1);
        renderer.render(scene, camera);
      }
      function restart() { idle(); dice.position.copy(pickup); dice.quaternion.identity(); action = createLudoDiceThrow(contact, dice, landing); released = false; }
      function setCamera(id: string) {
        selectedView = id;
        rig.head.scale.setScalar(id === 'player' ? 0.001 : 1);
        if (id === 'player') { camera.position.copy(rig.head.getWorldPosition(V())).add(V(0, 0.035, 0.13)); camera.lookAt(pickup.clone().lerp(landing, 0.5)); }
        else if (id === 'grip') { camera.position.copy(pickup).add(V(-0.20, 0.20, 0.31)); camera.lookAt(pickup.clone().add(V(0, 0.05, 0))); }
        else { camera.position.set(-1.12, 1.1, 1.36); camera.lookAt(-0.03, 0.5, -0.45); }
        renderer.render(scene, camera);
      }
      control.current = {
        roll() { restart(); started = performance.now(); playing = true; },
        inspect(ms) { playing = false; restart(); draw(ms); setStatus(label(ms)); },
        view(id) { setCamera(id); }
      };
      host.current!.appendChild(renderer.domElement);
      const resize = () => { renderer.setSize(host.current!.clientWidth, host.current!.clientHeight); camera.aspect = host.current!.clientWidth / host.current!.clientHeight; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
      const observer = new ResizeObserver(resize); observer.observe(host.current!); setCamera('table'); resize();
      setReady(true); setStatus('Ready');
      function frame(now: number) {
        if (disposed) return;
        if (playing) {
          const ms = (now - started) * 0.6; // Slower review of the production motion.
          draw(ms); setStatus(label(ms)); if (ms > 1950) playing = false;
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      cleanup = () => { observer.disconnect(); scene.traverse((node) => { const mesh = node as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach((m) => m.dispose()); } if ((node as THREE.SkinnedMesh).isSkinnedMesh) (node as THREE.SkinnedMesh).skeleton.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
    }).catch((error) => setStatus(`Preview could not load: ${error.message}`));
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }, []);
  return <div className="ludo-screen">
    <div className="ludo-stage" ref={host} role="img" aria-label="Ludo dice pickup and throwing animation" />
    <div className="ludo-controls">
      <select aria-label="View" disabled={!ready} value={view} onChange={(e) => { setView(e.target.value); control.current?.view(e.target.value); }}>
        <option value="table">Character &amp; table</option><option value="grip">Hand close-up</option><option value="player">Player perspective</option>
      </select>
      <button type="button" className="cursor-interaction" disabled={!ready} onClick={() => control.current?.roll()}>Roll dice</button>
      <button type="button" className="cursor-interaction" disabled={!ready} onClick={() => control.current?.inspect(440)}>Check grip</button>
      <button type="button" className="cursor-interaction" disabled={!ready} onClick={() => control.current?.inspect(1040)}>Check release</button>
    </div>
    <div className="ludo-status" role="status" aria-live="polite">{status}</div>
  </div>;
}
createRoot(document.getElementById('ludo-motion-preview')!).render(<App />);
