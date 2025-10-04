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

const TABLE_SURFACE_Y = 0.84;
const TABLE_TOP_THICKNESS = 0.045;
const RAIL_HEIGHT = 0.11;
const RAIL_THICKNESS = 0.15;
const FRAME_DROP = 0.2;
const LEG_HEIGHT = 0.78;
const LEG_OFFSET = 0.56;
const FLOOR_SIZE_MULTIPLIER = 3.4;

const DEFAULT_CONFIG = {
  preset: 'us9ft',
  clothColor: '#12539a',
  railColor: '#31211a',
  frameColor: '#553521',
  metalColor: '#d0d5df',
  ballFinish: 'glossy'
};

function setupControls(camera, domElement, focusY) {
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, focusY, 0);
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 7.2;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.52;
  return controls;
}

function tuneRenderer(renderer, width, height) {
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function addArena(scene, floorMaterial, playWidth, playLength) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(playWidth * FLOOR_SIZE_MULTIPLIER, playLength * FLOOR_SIZE_MULTIPLIER),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0a101d'),
    roughness: 0.82,
    metalness: 0.06
  });

  const wallHeight = 5.2;
  const wallThickness = 0.35;
  const wallLength = playLength * FLOOR_SIZE_MULTIPLIER;
  const wallWidth = playWidth * FLOOR_SIZE_MULTIPLIER;

  const north = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness), wallMat);
  north.position.set(0, wallHeight / 2, -wallLength / 2);
  scene.add(north);
  const south = north.clone();
  south.position.z = wallLength / 2;
  scene.add(south);

  const east = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallLength), wallMat);
  east.position.set(wallWidth / 2, wallHeight / 2, 0);
  scene.add(east);
  const west = east.clone();
  west.position.x = -wallWidth / 2;
  scene.add(west);

  const riserMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a2338'),
    roughness: 0.68,
    metalness: 0.1
  });
  const riserDepth = wallThickness * 2.4;
  const riserHeight = 0.48;
  for (let i = 0; i < 4; i++) {
    const riser = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth * 0.92 - i * 0.35, riserHeight, riserDepth),
      riserMaterial
    );
    riser.position.set(0, riserHeight * (i + 0.5), -playLength / 2 - 0.75 - i * (riserDepth + 0.1));
    scene.add(riser);

    const back = riser.clone();
    back.position.z = playLength / 2 + 0.75 + i * (riserDepth + 0.1);
    scene.add(back);
  }
}

function addLights(scene, tableY) {
  const hemi = new THREE.HemisphereLight(0xddeaff, 0x0c0f18, 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(-4.2, tableY + 5, 3.2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x6ca7ff, 0.48);
  fill.position.set(4.4, tableY + 4.6, -3.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x223344, 0.25);
  rim.position.set(0, tableY + 5.8, -6);
  scene.add(rim);

  const spot = new THREE.SpotLight(0xffffff, 1.55, 16, THREE.MathUtils.degToRad(68), 0.4, 1.8);
  spot.position.set(0, tableY + 4.6, 0.4);
  spot.target.position.set(0, tableY, 0);
  scene.add(spot);
  scene.add(spot.target);
}

function buildTable(materials, playWidth, playLength) {
  const table = new THREE.Group();

  const cloth = new THREE.Mesh(new THREE.BoxGeometry(playWidth, TABLE_TOP_THICKNESS, playLength), materials.cloth);
  cloth.position.y = TABLE_SURFACE_Y - TABLE_TOP_THICKNESS / 2;
  table.add(cloth);

  const railGeoLong = new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.4, RAIL_HEIGHT, RAIL_THICKNESS);
  const frontRail = new THREE.Mesh(railGeoLong, materials.rails);
  frontRail.position.set(0, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, playLength / 2 + RAIL_THICKNESS / 2);
  table.add(frontRail);
  const backRail = frontRail.clone();
  backRail.position.z = -playLength / 2 - RAIL_THICKNESS / 2;
  table.add(backRail);

  const railGeoShort = new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, playLength + RAIL_THICKNESS * 0.8);
  const leftRail = new THREE.Mesh(railGeoShort, materials.rails);
  leftRail.position.set(playWidth / 2 + RAIL_THICKNESS / 2, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, 0);
  table.add(leftRail);
  const rightRail = leftRail.clone();
  rightRail.position.x = -playWidth / 2 - RAIL_THICKNESS / 2;
  table.add(rightRail);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.8, 0.22, playLength + RAIL_THICKNESS * 2.8),
    materials.frame
  );
  frame.position.y = TABLE_SURFACE_Y - FRAME_DROP;
  table.add(frame);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 3, 0.05, playLength + RAIL_THICKNESS * 3),
    materials.chrome
  );
  trim.position.y = TABLE_SURFACE_Y + RAIL_HEIGHT + 0.025;
  table.add(trim);

  const legGeo = new THREE.CylinderGeometry(0.17, 0.21, LEG_HEIGHT, 24);
  const legPositions = [
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.2, playLength / 2 + LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.2, playLength / 2 + LEG_OFFSET],
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.2, -playLength / 2 - LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.2, -playLength / 2 - LEG_OFFSET]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, materials.frame.clone());
    leg.position.set(x, y, z);
    table.add(leg);
  });

  const pocketGroup = new THREE.Group();
  const pocketRadius = mmToMeters(POCKET_RADIUS_MM);
  const pocketDepth = 0.22;
  const pocketGeo = new THREE.CylinderGeometry(pocketRadius, pocketRadius * 0.75, pocketDepth, 28, 1, true);
  const pocketMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#040607'),
    roughness: 0.55,
    metalness: 0.2,
    side: THREE.DoubleSide
  });
  const positions = [
    [-playWidth / 2, TABLE_SURFACE_Y, -playLength / 2],
    [playWidth / 2, TABLE_SURFACE_Y, -playLength / 2],
    [-playWidth / 2, TABLE_SURFACE_Y, playLength / 2],
    [playWidth / 2, TABLE_SURFACE_Y, playLength / 2],
    [0, TABLE_SURFACE_Y, -playLength / 2],
    [0, TABLE_SURFACE_Y, playLength / 2]
  ];
  positions.forEach(([x, y, z], idx) => {
    const pocket = new THREE.Mesh(pocketGeo, pocketMaterial);
    pocket.position.set(x, y - pocketDepth / 2, z);
    pocket.rotation.x = Math.PI / 2;
    if (idx >= 4) pocket.scale.set(0.8, 1, 1);
    pocketGroup.add(pocket);
  });
  table.add(pocketGroup);

  return { table, cloth, rails: [frontRail, backRail, leftRail, rightRail], frame, trim };
}

function createBallGroup(config, playLength) {
  const ballDiameter = mmToMeters(BALL_DIAMETER_MM);
  const rackLayout = computeRackLayout(ballDiameter, playLength);
  const cuePosition = getCueBallPosition(ballDiameter, playLength);
  const radius = ballDiameter / 2;
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const finish = config.ballFinish ?? 'glossy';
  const resolvedRoughness = finish === 'matte' ? 0.46 : finish === 'satin' ? 0.26 : 0.1;
  const clearcoat = finish === 'glossy' ? 0.9 : finish === 'satin' ? 0.62 : 0.25;
  const clearcoatRoughness = finish === 'glossy' ? 0.04 : finish === 'satin' ? 0.12 : 0.32;

  const group = new THREE.Group();
  const entries = new Map();

  BALL_SET.forEach((ball) => {
    const texture = createBallTexture(ball);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: resolvedRoughness,
      metalness: 0.0,
      clearcoat,
      clearcoatRoughness,
      sheen: 0.28,
      sheenRoughness: 0.38
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

export default function NineBallArenaScene({ config }) {
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
    tuneRenderer(renderer, width, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#04080f');

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 60);
    camera.position.set(3.4, 2.4, 3.6);
    camera.lookAt(0, TABLE_SURFACE_Y, 0);

    const controls = setupControls(camera, renderer.domElement, TABLE_SURFACE_Y);

    const playWidth = mmToMeters(TABLE_DIMENSIONS_MM.width);
    const playLength = mmToMeters(TABLE_DIMENSIONS_MM.length);

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const materials = createTableMaterials(mergedConfig);
    materialsRef.current = materials;

    addLights(scene, TABLE_SURFACE_Y);
    const { table, cloth, rails, frame, trim } = buildTable(materials, playWidth, playLength);
    scene.add(table);

    const { group: ballsGroup, entries } = createBallGroup(mergedConfig, playLength);
    ballRef.current = { ballsGroup, entries };
    scene.add(ballsGroup);

    addArena(scene, materials.floor, playWidth, playLength);

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = host.clientWidth;
      const newHeight = host.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      tuneRenderer(renderer, newWidth, newHeight);
    });
    resizeObserver.observe(host);

    renderer.setAnimationLoop(() => {
      controls.update();
      ballsGroup.children.forEach((mesh) => {
        mesh.rotation.y += 0.0022;
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
    const roughness = finish === 'matte' ? 0.46 : finish === 'satin' ? 0.26 : 0.1;
    const clearcoat = finish === 'glossy' ? 0.9 : finish === 'satin' ? 0.62 : 0.25;
    const clearcoatRoughness = finish === 'glossy' ? 0.04 : finish === 'satin' ? 0.12 : 0.32;

    ballState.entries.forEach(({ material }) => {
      material.roughness = roughness;
      material.clearcoat = clearcoat;
      material.clearcoatRoughness = clearcoatRoughness;
      material.needsUpdate = true;
    });
  }, [config]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
