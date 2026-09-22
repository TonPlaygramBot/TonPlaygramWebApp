/** Layout review: shares the live game's furniture and camera helpers. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeSeatedHumanScale, createRestoredSeatedHumanActor } from '../src/pages/Games/shared/seatedHumanActors.js';
import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../src/config/chessBattleInventoryConfig.js';
import {
  DOMINO_REFERENCE_LAYOUT as L,
  createReferenceTable,
  createReferenceChair,
  getReferenceSeatBasis,
  fitReferenceTableCamera
} from '../public/domino-royal-layout.js';

declare const __DOMINO_LAYOUT_MODEL_GZIP__: string;
type PlayerCount = 2 | 4;
type Engine = { players: (count: PlayerCount) => void; orbit: (direction: number) => void; dispose: () => void };

async function embeddedAvatar() {
  const bytes = Uint8Array.from(atob(__DOMINO_LAYOUT_MODEL_GZIP__), (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(stream).arrayBuffer();
  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register((parser) => {
      // The model's embedded images decode locally without network requests.
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'DOMINO_LAYOUT_EMBEDDED_TEXTURES' };
    });
    loader.parse(data, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function buildLayout(host: HTMLDivElement, report: (message: string) => void): Engine {
  let count: PlayerCount = 4;
  let disposed = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Domino Royal table, chairs and seated players');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07100f');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xe7eee8, 0x34453a, 1.8));
  const key = new THREE.DirectionalLight(0xffeed2, 3.2);
  key.position.set(2, 8, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x96cfc7, 1.8);
  rim.position.set(-4, 4, -3);
  scene.add(rim);
  const materials = {
    wood: new THREE.MeshStandardMaterial({ color: '#352619', roughness: 0.4, metalness: 0.12 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#174838', roughness: 0.96 }),
    metal: new THREE.MeshStandardMaterial({ color: '#b59959', roughness: 0.35, metalness: 0.72 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#23463a', roughness: 0.9 })
  };
  scene.add(createReferenceTable(THREE, materials));
  const chairs: THREE.Group[] = [];
  for (let seat = 0; seat < 4; seat++) {
    const wrapper = new THREE.Group();
    wrapper.position.copy(getReferenceSeatBasis(THREE, seat).position);
    wrapper.lookAt(new THREE.Vector3());
    wrapper.add(createReferenceChair(THREE, RoundedBoxGeometry, materials));
    scene.add(wrapper);
    chairs.push(wrapper);
  }
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.48;
  const render = () => { if (!disposed) renderer.render(scene, camera); };
  controls.addEventListener('change', render);
  const seatIndices = () => count === 2 ? [0, 2] : [0, 1, 2, 3];
  const fit = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const { position, target } = fitReferenceTableCamera(THREE, camera, { seatIndices: seatIndices() });
    camera.position.copy(position);
    controls.target.copy(target);
    const distance = position.distanceTo(target);
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 1.5;
    controls.update();
    render();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(host);
  fit();
  embeddedAvatar().then((template) => {
    if (disposed) return;
    // Match loadSeatedHumanTemplate's renderable-mesh normalization and adapter
    // metadata. This offline review retains original GLB materials; production
    // can additionally load its remote cloth overlays.
    template.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    template.traverse((object: any) => {
      if (!object.isMesh) return;
      const meshBounds = new THREE.Box3().setFromObject(object);
      if (Number.isFinite(meshBounds.min.y) && Number.isFinite(meshBounds.max.y)) {
        bounds.expandByPoint(meshBounds.min);
        bounds.expandByPoint(meshBounds.max);
      }
    });
    const center = bounds.getCenter(new THREE.Vector3());
    template.position.x -= center.x;
    template.position.z -= center.z;
    template.position.y -= bounds.min.y;
    template.updateMatrixWorld(true);
    const option = CHESS_HUMAN_CHARACTER_OPTIONS[0];
    if (option?.id !== 'rpm-current') throw new Error('Embedded preview avatar no longer matches the production default.');
    const adapter = option.seatedAdapter || {};
    template.userData = {
      ...template.userData,
      seatedHumanScale: computeSeatedHumanScale(template, L.LEGACY_DOMINO_HUMAN_HEIGHT) *
        (Number.isFinite(adapter.seatedScaleMultiplier) ? adapter.seatedScaleMultiplier : 1),
      seatedYawOffset: Number.isFinite(adapter.seatedYawOffset) ? adapter.seatedYawOffset : 0,
      seatedYOffset: Number.isFinite(adapter.seatedYOffset) ? adapter.seatedYOffset : 0,
      seatedZOffset: Number.isFinite(adapter.seatedZOffset) ? adapter.seatedZOffset : 0
    };
    template.traverse((object: any) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
    for (const chair of chairs) {
      const actor = createRestoredSeatedHumanActor(template, chair, {
        targetHeight: L.LEGACY_DOMINO_HUMAN_HEIGHT,
        seatHeight: L.STOOL_HEIGHT,
        supportsArmrest: true
      });
      if (!actor) throw new Error('The original avatar has no seated bone rig.');
    }
    fit();
    report('Drag to rotate · pinch to zoom');
  }).catch((error) => {
    console.error(error);
    if (!disposed) report('Avatar unavailable; table and chair layout shown');
  });
  return {
    players(next) {
      count = next;
      const occupied = new Set(seatIndices());
      chairs.forEach((chair, index) => { chair.visible = occupied.has(index); });
      fit();
    },
    orbit(direction) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 8);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      render();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materialSet = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object: any) => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material) continue;
          materialSet.add(material);
          for (const value of Object.values(material)) if ((value as any)?.isTexture) textures.add(value as THREE.Texture);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materialSet.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function LayoutPreview() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [players, setPlayers] = useState<PlayerCount>(4);
  const [message, setMessage] = useState('Loading seated players…');
  useEffect(() => {
    try { engine.current = buildLayout(host.current!, setMessage); }
    catch (error) {
      console.error(error);
      setMessage('WebGL is unavailable in this preview');
    }
    return () => engine.current?.dispose();
  }, []);
  return <main className="layout-preview">
    <header><strong>DOMINO ROYAL</strong><div className="player-controls" role="group" aria-label="Players">
      {([2, 4] as const).map((count) => <button className="cursor-interaction" type="button" key={count} aria-pressed={players === count} onClick={() => { setPlayers(count); engine.current?.players(count); }}>{count} players</button>)}
    </div></header>
    <div className="layout-stage" ref={host} role="img" aria-label={`${players} seated players around the Domino Royal octagon table`} />
    <footer><button className="cursor-interaction" type="button" aria-label="Rotate view left" onClick={() => engine.current?.orbit(-1)}>←</button><span role="status" aria-live="polite">{message}</span><button className="cursor-interaction" type="button" aria-label="Rotate view right" onClick={() => engine.current?.orbit(1)}>→</button></footer>
  </main>;
}

createRoot(document.getElementById('domino-royal-layout-root')!).render(<LayoutPreview />);
