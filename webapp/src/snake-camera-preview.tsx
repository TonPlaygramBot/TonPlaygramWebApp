import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import {
  createSnakeBoardScene, updateSnakeBoardTokens, updateSnakeBoardLadders,
  updateSnakeBoardSnakes, getDiceOrientationQuaternion, SNAKE_SCENE_DIMENSIONS as sizes
} from './components/SnakeBoard3D';
import { createSnakeFirearmAnimation, createSnakeFirearmFallback } from './utils/snakeFirearmAnimation';
import { createSnakeCameraDirector } from './utils/snakeCameraDirector';
import { createRoyalDiceMotion } from './utils/royalDiceMotion';
import './snake-camera-preview.css';

function SnakeCameraPreview() {
  const mount = useRef<HTMLDivElement>(null);
  const play = useRef<((firearmOnly?: boolean) => void) | null>(null);
  const selectedWeapon = useRef('ak47VolleyAttack');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('Pamja e tabelës');
  const [error, setError] = useState(false);

  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Demonstrim 3D i kamerës së Snake and Ladder');
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e8edff', '#283327', 3));
    const light = new THREE.DirectionalLight('#fff5df', 4); light.position.set(3,6,4); scene.add(light);
    const root = new THREE.Group();
    root.scale.set(sizes.footprintScale, sizes.boardScale, sizes.footprintScale);
    scene.add(root);
    const board = createSnakeBoardScene(root, new THREE.Vector3(), renderer, []);
    const texture = new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1); texture.needsUpdate = true;
    updateSnakeBoardLadders(board.laddersGroup, { 6: 28 }, { 28: 9 }, board.indexToPosition, board.serpentineIndexToXZ, texture);
    updateSnakeBoardSnakes(board.snakesGroup, { 28: 9 }, { 6: 28 }, board.indexToPosition, board.serpentineIndexToXZ, texture);
    updateSnakeBoardTokens(board.boardTokensGroup, board.reserveTokensGroup,
      [{ position: 0, seatIndex: 0, color: '#fbbf24' }], board.indexToPosition, board.serpentineIndexToXZ,
      { baseLevelTop: board.baseLevelTop });
    const token = board.reserveTokensGroup.children[0];
    const rackWeapon = createSnakeFirearmFallback();
    rackWeapon.position.set(-0.85, 0.08, 1.8); scene.add(rackWeapon);
    board.boardTokensGroup.attach(token);
    const reserve = token.position.clone();
    const die = board.diceSet[0]; board.diceSet.slice(1).forEach(item => { item.visible = false; });
    const landing = new THREE.Vector3(0, board.diceBaseY, 0.95);
    const throwStart = new THREE.Vector3(0.1, board.diceBaseY + 0.07, 1.25);
    die.position.copy(landing);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.8,0.08,64), new THREE.MeshStandardMaterial({color:'#16413d',roughness:0.9}));
    table.position.y = -0.16; scene.add(table);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    const home = new THREE.Vector3(0,3.6,4.5), homeTarget = new THREE.Vector3(0,0.1,0.2);
    const target = homeTarget.clone(); camera.position.copy(home); camera.lookAt(target);
    const director = createSnakeCameraDirector(camera,target);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, alive = true, running = false, stage = 0, stageStart = 0;
    let motion: ReturnType<typeof createRoyalDiceMotion> | null = null;
    let firearm: ReturnType<typeof createSnakeFirearmAnimation> | null = null;
    let from = reserve.clone(), to = reserve.clone();
    let curve: THREE.Curve<THREE.Vector3> | null = null;
    const stages = [
      { label: 'Hedhja e zarit', kind: 'dice', tile: 0, duration: 1300 },
      { label: 'Hyrja në tabelë', kind: 'step', tile: 1, duration: 700 },
      ...[2,3,4,5,6].map(tile => ({ label: `Lëvizja · ${tile}`, kind: 'step', tile, duration: 340 })),
      { label: 'Ngjitja në shkallë', kind: 'ladder', tile: 28, duration: 1400 },
      { label: 'Zbritja te gjarpri', kind: 'snake', tile: 9, duration: 1400 }
    ];
    const tokenWorld = new THREE.Vector3(), goalWorld = new THREE.Vector3(), dieWorld = new THREE.Vector3();
    const startStage = (now: number) => {
      const current = stages[stage]; stageStart = now; setPhase(current.label);
      if (current.kind === 'dice') {
        motion = createRoyalDiceMotion(die, throwStart, landing, {
          startedAt: now, target: getDiceOrientationQuaternion(6), reducedMotion: preference.matches
        });
        director.start({ id: 'dice', priority: 1,
          points: () => [die.getWorldPosition(dieWorld)],
          overview: () => [throwStart,landing].map(p => die.parent!.localToWorld(p.clone()))
        }, now, home, homeTarget);
      } else {
        from = token.position.clone(); to = board.indexToPosition.get(current.tile).clone();
        curve = current.kind === 'ladder' ? board.laddersGroup.userData.paths.get(6).curve
          : current.kind === 'snake' ? board.snakesGroup.userData.paths.get(28).curve : null;
        const radius = sizes.tokenHeight * sizes.boardScale * 1.2;
        director.start({ id: `step:${stage}`, priority: 2,
          points: () => {
            token.getWorldPosition(tokenWorld); tokenWorld.y += radius * 0.4;
            board.boardTokensGroup.localToWorld(goalWorld.copy(to)); goalWorld.y += radius * 0.4;
            return [tokenWorld,goalWorld];
          },
          overview: () => [from,...(curve?.getPoints(16) ?? []),to].map(p => board.boardTokensGroup.localToWorld(p.clone()))
        }, now, home, homeTarget);
      }
    };
    const resize = () => {
      const width = host.clientWidth, height = Math.min(650, width * 1.5);
      renderer.setSize(width,height); camera.aspect = width/height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const animate = (now: number) => {
      if (!alive) return;
      if (firearm) {
        if (firearm.update(now)) {
          firearm.dispose(); firearm = null; director.finish('firearm',now,500);
          setBusy(false); setPhase('Pamja e lojtarit · pa zoom');
        }
      } else if (running) {
        const current = stages[stage];
        const t = Math.min(1,(now-stageStart)/current.duration);
        const ease = t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
        if (current.kind === 'dice') motion?.update(now);
        else {
          const point = curve && !preference.matches ? curve.getPoint(ease) : from.clone().lerp(to,ease);
          point.y += preference.matches ? 0 : Math.sin(t*Math.PI) * sizes.tokenHeight * (curve ? 0.25 : 0.55);
          token.position.copy(point);
        }
        if (t === 1) {
          director.finish(current.kind === 'dice' ? 'dice' : `step:${stage}`,now,900);
          if (++stage < stages.length) startStage(now);
          else { running = false; setBusy(false); setPhase('Pamja e tabelës'); }
        }
      }
      director.update(now,home,homeTarget,preference.matches);
      renderer.render(scene,camera);
      frame = requestAnimationFrame(animate);
    };
    play.current = (firearmOnly = false) => {
      if (running || firearm) return;
      if (firearmOnly) {
        director.cancel();
        token.position.copy(board.indexToPosition.get(9));
        const target = token.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,sizes.tokenHeight * sizes.boardScale * 0.6,0));
        firearm = createSnakeFirearmAnimation({scene,weaponId:selectedWeapon.current,parkedWeapon:rackWeapon,
          origin:rackWeapon.position.clone(),target,victims:[token],startedAt:performance.now(),reducedMotion:preference.matches,
          onShot:()=>setPhase('Qitja · zmbrapsja dhe gëzhojat'),onImpact:()=>setPhase('Goditja e tokenit')});
        const activeFirearm = firearm;
        director.start({id:'firearm',priority:3,points:()=>[activeFirearm.focus],overview:activeFirearm.overview},performance.now(),home,homeTarget);
        setBusy(true); setPhase('Ngritja dhe shënjestrimi i armës'); return;
      }
      director.cancel(); token.position.copy(reserve); stage = 0; running = true; setBusy(true); startStage(performance.now());
    };
    frame = requestAnimationFrame(animate);
    return () => {
      alive = false; play.current = null; firearm?.dispose(); director.cancel(); cancelAnimationFrame(frame); observer.disconnect();
      const textures = new Set<THREE.Texture>();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
          const map = (material as THREE.MeshStandardMaterial).map; if (map) textures.add(map); material.dispose();
        });
      });
      textures.forEach(item => item.dispose()); texture.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  },[]);

  return <div className="snake-camera-review">
    <div className="snake-camera-heading"><strong>Snake &amp; Ladder</strong><span>Perspektiva e lojtarit · pa zoom</span></div>
    <div ref={mount} className="snake-camera-canvas" />
    <div className="snake-camera-actions">
      <span role="status" aria-live="polite">{phase}</span>
      {error ? <span role="alert">Aktivizo WebGL për pamjen 3D.</span> :
        <>
          <button type="button" disabled={busy} onClick={() => play.current?.()}>Provo kamerën</button>
          <label className="snake-preview-weapon">Arma
            <select disabled={busy} defaultValue="ak47VolleyAttack" onChange={event => { selectedWeapon.current = event.target.value; }}>
              <option value="ak47VolleyAttack">AK-47</option><option value="glockSidearmAttack">Glock</option>
              <option value="shotgunBlastAttack">Shotgun</option><option value="sniperShotAttack">Sniper</option>
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => play.current?.(true)}>Provo animacionin e armës</button>
        </>}
    </div>
  </div>;
}

createRoot(document.getElementById('snake-camera-root')!).render(<SnakeCameraPreview />);
