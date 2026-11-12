import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import {
  createSnakeArena,
  createSnakeBoardScene,
  updateSnakeSeatWeapons,
  computeDiceThrowLayout
} from '../../components/SnakeBoard3D';
import { MURLAN_TABLE_THEMES } from '../../config/murlanThemes';

// Local copies of the exact remote assets keep reviews repeatable/offline.
THREE.DefaultLoadingManager.setURLModifier((url) => {
  if (/Textures\/jpg\/1k\/(hessian_230|denim_fabric)\//.test(url))
    return '/assets/snake-table-review/fabric/' + url.split('/').pop();
  const weapons: Record<string, string> = {
    'b3e6be61-0299-4866-a227-58f5f3fe610b': 'polyAssaultRifle01Attack',
    '3b53f0fe-f86e-451c-816d-6ab9bd265cdc': 'polyPistol01Attack',
    '032e6589-3188-41bc-b92b-e25528344275': 'polyShotgun01Attack'
  };
  for (const [uuid, id] of Object.entries(weapons))
    if (url.includes(uuid))
      return '/assets/tirana-streets/imported/' + id + '.glb';
  if (/AntiqueChair|SheenChair/.test(url))
    return '/assets/snake-table-review/chair.glb';
  const match = url.match(/Models\/gltf\/\dk\/([^/]+)\/(.*)/);
  if (match)
    return `/assets/snake-table-review/${match[1]}/${match[2].endsWith('.gltf') ? 'scene.gltf' : match[2]}`;
  return url;
});
function Review() {
  const host = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState('murlan-default');
  const [angle, setAngle] = useState('portrait');
  const [status, setStatus] = useState('Loading');
  const view = useRef(angle);
  view.current = angle;
  useEffect(() => {
    const element = host.current!;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(1);
    element.appendChild(renderer.domElement);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x756353, 2.2));
    const key = new THREE.DirectionalLight(0xffedcf, 3);
    key.position.set(3, 7, 4);
    scene.add(key);
    const cleanup: Array<() => void> = [],
      cameraRef = { current: null as THREE.PerspectiveCamera | null };
    const arena = createSnakeArena(
      scene,
      renderer,
      element,
      cameraRef,
      cleanup,
      {
        tableTheme: MURLAN_TABLE_THEMES.find((t) => t.id === theme),
        tableTextures: false,
        arena: { background: '#26303a' }
      },
      4
    );
    const camera = cameraRef.current!;
    const portrait = {
      position: camera.position.clone(),
      target: arena.boardLookTarget.clone()
    };
    const board = createSnakeBoardScene(
      arena.boardGroup,
      arena.boardLookTarget,
      renderer,
      cleanup
    );
    const weaponDisplayGroup = new THREE.Group();
    weaponDisplayGroup.userData.byPlayer = new Map();
    arena.boardGroup.add(weaponDisplayGroup);
    Object.assign(board, {
      weaponDisplayGroup,
      seatAnchors: arena.seatAnchors,
      getSeatHuman: arena.getSeatHuman,
      boardLookTarget: arena.boardLookTarget
    });
    Object.defineProperty(board, 'tableInfo', { get: () => arena.tableInfo });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: '#444b50', roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.837;
    scene.add(floor);
    let frame = 0,
      lastCount = -1;
    arena.boardGroup.userData.onTableChanged = () => {
      lastCount = -1;
    };
    const render = () => {
      const count = arena.seatAnchors.filter(
        (_, i) => arena.getSeatChair(i)?.humanActor
      ).length;
      const tableInfo = arena.tableInfo as typeof arena.tableInfo & {
        themeId?: string;
        assetId?: string;
      };
      const loaded =
        tableInfo.themeId === theme &&
        (theme === 'murlan-default' || tableInfo.assetId === theme);
      if (count !== lastCount) {
        updateSnakeSeatWeapons(
          board,
          [0, 1, 2, 3].map((seatIndex) => ({
            seatIndex,
            weaponType: [
              'polyAssaultRifle01Attack',
              'polyPistol01Attack',
              'polyShotgun01Attack',
              'polyAssaultRifle01Attack'
            ][seatIndex]
          }))
        );
        lastCount = count;
      }
      const die = board.diceSet[0];
      die.position.copy(computeDiceThrowLayout(board, 0, 1).basePositions[0]);
      if (view.current === 'side') {
        camera.position.set(11, 3.2, 12.8);
        camera.lookAt(0, -0.1, 0);
      } else if (view.current === 'top') {
        camera.position.set(0, 10, 0.01);
        camera.lookAt(0, 0, 0);
      } else {
        camera.position.copy(portrait.position);
        camera.lookAt(portrait.target);
      }
      if (count === 4 && loaded) setStatus('Ready · WebGL 2');
      renderer.render(scene, camera);
      frame = window.setTimeout(render, 200);
    };
    (window as any).snakeReview = {
      scene,
      arena,
      board,
      camera,
      renderer,
      theme,
      THREE
    };
    setStatus('Loading');
    render();
    return () => {
      clearTimeout(frame);
      cleanup.forEach((fn) => fn());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete (window as any).snakeReview;
    };
  }, [theme]);
  return (
    <main
      style={{
        background: '#26303a',
        color: '#f8fafc',
        font: '13px system-ui',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ padding: 8, display: 'flex', gap: 6 }}>
        <select
          aria-label="Table"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          {MURLAN_TABLE_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          aria-label="View"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
        >
          <option value="portrait">Phone portrait</option>
          <option value="side">Leg clearance</option>
          <option value="top">Above table</option>
        </select>
      </div>
      <div ref={host} style={{ flex: 1, minHeight: 0 }} />
      <div role="status" style={{ padding: 8 }}>
        {status}
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Review />);
