import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BALL_SET,
  BALL_DIAMETER_MM,
  TABLE_DIMENSIONS_MM,
  POCKET_RADIUS_MM,
  computeRackLayout,
  createBallTexture,
  getCueBallPosition,
  mmToMeters
} from './BallSet.ts';
import { createTableMaterials } from './assets/materials/tableMaterials.js';

const TABLE_SURFACE_Y = 0.83;
const TABLE_TOP_THICKNESS = 0.042;
const RAIL_HEIGHT = 0.1;
const RAIL_THICKNESS = 0.13;
const FRAME_DROP = 0.19;
const LEG_HEIGHT = 0.74;
const LEG_OFFSET = 0.52;
const FLOOR_SIZE_MULTIPLIER = 3.1;

const DEFAULT_CONFIG = {
  preset: 'us8ft',
  clothColor: '#0f6130',
  railColor: '#3b2416',
  frameColor: '#6d4124',
  metalColor: '#d7d0c6',
  ballFinish: 'glossy'
};

function makeControls(camera, domElement, focusY) {
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, focusY, 0);
  controls.enablePan = false;
  controls.minDistance = 1.7;
  controls.maxDistance = 6.6;
  controls.maxPolarAngle = Math.PI / 2.12;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.55;
  return controls;
}

function configureRenderer(renderer, width, height) {
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function addEnvironment(scene, floorMaterial, playWidth, playLength) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(playWidth * FLOOR_SIZE_MULTIPLIER, playLength * FLOOR_SIZE_MULTIPLIER),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0c101c'),
    roughness: 0.84,
    metalness: 0.05
  });

  const wallHeight = 4.7;
  const wallThickness = 0.32;
  const wallLength = playLength * FLOOR_SIZE_MULTIPLIER;
  const wallWidth = playWidth * FLOOR_SIZE_MULTIPLIER;

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness), wallMaterial);
  northWall.position.set(0, wallHeight / 2, -wallLength / 2);
  scene.add(northWall);
  const southWall = northWall.clone();
  southWall.position.z = wallLength / 2;
  scene.add(southWall);

  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallLength), wallMaterial);
  eastWall.position.set(wallWidth / 2, wallHeight / 2, 0);
  scene.add(eastWall);
  const westWall = eastWall.clone();
  westWall.position.x = -wallWidth / 2;
  scene.add(westWall);

  const riserMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1b2335'),
    roughness: 0.7,
    metalness: 0.09
  });
  const riserDepth = wallThickness * 2.1;
  const riserHeight = 0.46;
  for (let i = 0; i < 3; i++) {
    const riser = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth * 0.9 - i * 0.3, riserHeight, riserDepth),
      riserMaterial
    );
    riser.position.set(0, riserHeight * (i + 0.5), -playLength / 2 - 0.65 - i * (riserDepth + 0.08));
    scene.add(riser);

    const back = riser.clone();
    back.position.z = playLength / 2 + 0.65 + i * (riserDepth + 0.08);
    scene.add(back);
  }
}

function addLighting(scene, tableY) {
  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x0b0e16, 0.68);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.18);
  key.position.set(-3.6, tableY + 4.8, 2.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x74b6ff, 0.42);
  fill.position.set(3.8, tableY + 4.2, -3.1);
  scene.add(fill);

  const back = new THREE.DirectionalLight(0x1f2a40, 0.22);
  back.position.set(0.5, tableY + 5.4, -5.2);
  scene.add(back);

  const spot = new THREE.SpotLight(0xffffff, 1.45, 14, THREE.MathUtils.degToRad(70), 0.45, 1.7);
  spot.position.set(0.1, tableY + 4.3, 0.2);
  spot.target.position.set(0, tableY, 0);
  scene.add(spot);
  scene.add(spot.target);
}

function buildTable(materials, playWidth, playLength) {
  const table = new THREE.Group();

  const cloth = new THREE.Mesh(new THREE.BoxGeometry(playWidth, TABLE_TOP_THICKNESS, playLength), materials.cloth);
  cloth.position.y = TABLE_SURFACE_Y - TABLE_TOP_THICKNESS / 2;
  table.add(cloth);

  const longRailGeo = new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.2, RAIL_HEIGHT, RAIL_THICKNESS);
  const northRail = new THREE.Mesh(longRailGeo, materials.rails);
  northRail.position.set(0, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, playLength / 2 + RAIL_THICKNESS / 2);
  table.add(northRail);
  const southRail = northRail.clone();
  southRail.position.z = -playLength / 2 - RAIL_THICKNESS / 2;
  table.add(southRail);

  const shortRailGeo = new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, playLength + RAIL_THICKNESS * 0.6);
  const eastRail = new THREE.Mesh(shortRailGeo, materials.rails);
  eastRail.position.set(playWidth / 2 + RAIL_THICKNESS / 2, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, 0);
  table.add(eastRail);
  const westRail = eastRail.clone();
  westRail.position.x = -playWidth / 2 - RAIL_THICKNESS / 2;
  table.add(westRail);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.6, 0.2, playLength + RAIL_THICKNESS * 2.6),
    materials.frame
  );
  frame.position.y = TABLE_SURFACE_Y - FRAME_DROP;
  table.add(frame);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.8, 0.045, playLength + RAIL_THICKNESS * 2.8),
    materials.chrome
  );
  trim.position.y = TABLE_SURFACE_Y + RAIL_HEIGHT + 0.02;
  table.add(trim);

  const legGeo = new THREE.BoxGeometry(0.2, LEG_HEIGHT, 0.2);
  const legPositions = [
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.18, playLength / 2 + LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.18, playLength / 2 + LEG_OFFSET],
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.18, -playLength / 2 - LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.18, -playLength / 2 - LEG_OFFSET]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, materials.frame.clone());
    leg.position.set(x, y, z);
    table.add(leg);
  });

  const pocketGroup = new THREE.Group();
  const cornerRadius = mmToMeters(POCKET_RADIUS_MM);
  const sideRadius = cornerRadius * 0.95;
  const pocketDepth = 0.2;
  const cornerGeo = new THREE.CylinderGeometry(cornerRadius, cornerRadius * 0.72, pocketDepth, 28, 1, true);
  const sideGeo = new THREE.CylinderGeometry(sideRadius, sideRadius * 0.7, pocketDepth, 24, 1, true);
  const pocketMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#040506'),
    roughness: 0.58,
    metalness: 0.22,
    side: THREE.DoubleSide
  });
  const cornerPositions = [
    [-playWidth / 2, TABLE_SURFACE_Y, -playLength / 2],
    [playWidth / 2, TABLE_SURFACE_Y, -playLength / 2],
    [-playWidth / 2, TABLE_SURFACE_Y, playLength / 2],
    [playWidth / 2, TABLE_SURFACE_Y, playLength / 2]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const pocket = new THREE.Mesh(cornerGeo, pocketMaterial);
    pocket.position.set(x, y - pocketDepth / 2, z);
    pocket.rotation.x = Math.PI / 2;
    pocketGroup.add(pocket);
  });

  const sidePositions = [
    [0, TABLE_SURFACE_Y, -playLength / 2],
    [0, TABLE_SURFACE_Y, playLength / 2]
  ];
  sidePositions.forEach(([x, y, z]) => {
    const pocket = new THREE.Mesh(sideGeo, pocketMaterial);
    pocket.position.set(x, y - pocketDepth / 2, z);
    pocket.rotation.x = Math.PI / 2;
    pocket.scale.set(0.9, 1, 1);
    pocketGroup.add(pocket);
  });
  table.add(pocketGroup);

  return { table, cloth, rails: [northRail, southRail, eastRail, westRail], frame, trim };
}

function createBalls(config, playLength) {
  const ballDiameter = mmToMeters(BALL_DIAMETER_MM);
  const rackLayout = computeRackLayout(ballDiameter, playLength);
  const cuePosition = getCueBallPosition(ballDiameter, playLength);
  const radius = ballDiameter / 2;
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const finish = config.ballFinish ?? 'glossy';
  const roughness = finish === 'matte' ? 0.44 : finish === 'satin' ? 0.24 : 0.11;
  const clearcoat = finish === 'glossy' ? 0.88 : finish === 'satin' ? 0.62 : 0.28;
  const clearcoatRoughness = finish === 'glossy' ? 0.05 : finish === 'satin' ? 0.12 : 0.3;

  const group = new THREE.Group();
  const entries = new Map();

  BALL_SET.forEach((ball) => {
    const texture = createBallTexture(ball);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness,
      metalness: 0.0,
      clearcoat,
      clearcoatRoughness,
      sheen: 0.27,
      sheenRoughness: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = TABLE_SURFACE_Y + radius;
    if (ball.id === 'CUE') {
      mesh.position.add(cuePosition);
    } else {
      const entry = rackLayout.find((layout) => layout.id === ball.id);
      if (entry) {
        mesh.position.x = entry.position.x;
        mesh.position.z = entry.position.z;
      }
    }
    group.add(mesh);
    entries.set(ball.id, { mesh, material });
  });

  return { group, entries };
}

export default function AmericanEightArenaScene({ config }) {
  const hostRef = useRef(null);
  const rendererRef = useRef(null);
  const materialsRef = useRef(null);
  const ballRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return () => {};

    const width = host.clientWidth;
    const height = host.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    configureRenderer(renderer, width, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05090f');

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 55);
    camera.position.set(3.1, 2.2, 3.3);
    camera.lookAt(0, TABLE_SURFACE_Y, 0);

    const controls = makeControls(camera, renderer.domElement, TABLE_SURFACE_Y);

    const playWidth = mmToMeters(TABLE_DIMENSIONS_MM.width);
    const playLength = mmToMeters(TABLE_DIMENSIONS_MM.length);

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const materials = createTableMaterials(mergedConfig);
    materialsRef.current = materials;

    addLighting(scene, TABLE_SURFACE_Y);
    const { table, cloth, rails, frame, trim } = buildTable(materials, playWidth, playLength);
    scene.add(table);

    const { group: ballsGroup, entries } = createBalls(mergedConfig, playLength);
    ballRef.current = { ballsGroup, entries };
    scene.add(ballsGroup);

    addEnvironment(scene, materials.floor, playWidth, playLength);

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = host.clientWidth;
      const newHeight = host.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      configureRenderer(renderer, newWidth, newHeight);
    });
    resizeObserver.observe(host);

    renderer.setAnimationLoop(() => {
      controls.update();
      ballsGroup.children.forEach((mesh) => {
        mesh.rotation.y += 0.002;
      });
      renderer.render(scene, camera);
    });

    rendererRef.current = { renderer, scene, cloth, rails, frame, trim, controls };

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose?.());
          } else {
            object.material?.dispose?.();
          }
        }
      });
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const rendererState = rendererRef.current;
    const materials = materialsRef.current;
    const ballState = ballRef.current;
    if (!rendererState || !materials || !ballState) return;

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    materials.cloth.color.set(mergedConfig.clothColor);
    materials.rails.color.set(mergedConfig.railColor);
    materials.frame.color.set(mergedConfig.frameColor);
    materials.chrome.color.set(mergedConfig.metalColor);

    const finish = mergedConfig.ballFinish ?? 'glossy';
    const roughness = finish === 'matte' ? 0.44 : finish === 'satin' ? 0.24 : 0.11;
    const clearcoat = finish === 'glossy' ? 0.88 : finish === 'satin' ? 0.62 : 0.28;
    const clearcoatRoughness = finish === 'glossy' ? 0.05 : finish === 'satin' ? 0.12 : 0.3;

    ballState.entries.forEach(({ material }) => {
      material.roughness = roughness;
      material.clearcoat = clearcoat;
      material.clearcoatRoughness = clearcoatRoughness;
      material.needsUpdate = true;
    });
  }, [config]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
