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

const TABLE_SURFACE_Y = 0.82;
const TABLE_TOP_THICKNESS = 0.04;
const RAIL_HEIGHT = 0.09;
const RAIL_THICKNESS = 0.12;
const FRAME_DROP = 0.18;
const LEG_HEIGHT = 0.7;
const LEG_OFFSET = 0.5;
const FLOOR_SIZE_MULTIPLIER = 3;

const DEFAULT_CONFIG = {
  preset: 'uk7ft',
  clothColor: '#0c5f31',
  railColor: '#362219',
  frameColor: '#6f4122',
  metalColor: '#d3cec4',
  ballFinish: 'glossy'
};

function createOrbitControls(camera, domElement, targetY) {
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, targetY, 0);
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 6.5;
  controls.maxPolarAngle = Math.PI / 2.1;
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

function buildArenaEnvironment(scene, floorMaterial, playWidth, playLength) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(playWidth * FLOOR_SIZE_MULTIPLIER, playLength * FLOOR_SIZE_MULTIPLIER),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0d121f'),
    roughness: 0.85,
    metalness: 0.05
  });

  const wallHeight = 4.5;
  const wallThickness = 0.3;
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

  const seatingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#192135'),
    roughness: 0.7,
    metalness: 0.08
  });
  const riserHeight = 0.45;
  for (let i = 0; i < 3; i++) {
    const riser = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth * 0.92 - i * 0.4, riserHeight, wallThickness * 2.2),
      seatingMaterial
    );
    riser.position.set(0, riserHeight * (i + 0.5), -playLength / 2 - 0.6 - i * (wallThickness * 1.2));
    scene.add(riser);

    const riserBack = riser.clone();
    riserBack.position.z = playLength / 2 + 0.6 + i * (wallThickness * 1.2);
    scene.add(riserBack);
  }
}

function buildLightingRig(scene, tableY) {
  const hemi = new THREE.HemisphereLight(0xdde6ff, 0x0a0c12, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-3.5, tableY + 4.5, 2.5);
  key.castShadow = false;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x7cb8ff, 0.45);
  fill.position.set(4.2, tableY + 3.8, -2.8);
  scene.add(fill);

  const overhead = new THREE.SpotLight(0xffffff, 1.35, 12, THREE.MathUtils.degToRad(70), 0.45, 1.6);
  overhead.position.set(0, tableY + 4.2, 0);
  overhead.target.position.set(0, tableY, 0);
  scene.add(overhead);
  scene.add(overhead.target);
}

function buildTableGeometry(materials, playWidth, playLength) {
  const table = new THREE.Group();

  const cloth = new THREE.Mesh(new THREE.BoxGeometry(playWidth, TABLE_TOP_THICKNESS, playLength), materials.cloth);
  cloth.position.y = TABLE_SURFACE_Y - TABLE_TOP_THICKNESS / 2;
  cloth.receiveShadow = true;
  table.add(cloth);

  const railGeoLong = new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2, RAIL_HEIGHT, RAIL_THICKNESS);
  const railNorth = new THREE.Mesh(railGeoLong, materials.rails);
  railNorth.position.set(0, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, playLength / 2 + RAIL_THICKNESS / 2);
  table.add(railNorth);

  const railSouth = railNorth.clone();
  railSouth.position.z = -playLength / 2 - RAIL_THICKNESS / 2;
  table.add(railSouth);

  const railGeoShort = new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, playLength);
  const railEast = new THREE.Mesh(railGeoShort, materials.rails);
  railEast.position.set(playWidth / 2 + RAIL_THICKNESS / 2, TABLE_SURFACE_Y + RAIL_HEIGHT / 2, 0);
  table.add(railEast);

  const railWest = railEast.clone();
  railWest.position.x = -playWidth / 2 - RAIL_THICKNESS / 2;
  table.add(railWest);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.6, 0.2, playLength + RAIL_THICKNESS * 2.6),
    materials.frame
  );
  frame.position.y = TABLE_SURFACE_Y - FRAME_DROP;
  table.add(frame);

  const chromeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth + RAIL_THICKNESS * 2.8, 0.04, playLength + RAIL_THICKNESS * 2.8),
    materials.chrome
  );
  chromeTrim.position.y = TABLE_SURFACE_Y + RAIL_HEIGHT + 0.02;
  table.add(chromeTrim);

  const legGeo = new THREE.BoxGeometry(0.22, LEG_HEIGHT, 0.22);
  const legPositions = [
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.15, playLength / 2 + LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.15, playLength / 2 + LEG_OFFSET],
    [playWidth / 2 + LEG_OFFSET, LEG_HEIGHT / 2 - 0.15, -playLength / 2 - LEG_OFFSET],
    [-playWidth / 2 - LEG_OFFSET, LEG_HEIGHT / 2 - 0.15, -playLength / 2 - LEG_OFFSET]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, materials.frame.clone());
    leg.position.set(x, y, z);
    table.add(leg);
  });

  const pocketGroup = new THREE.Group();
  const pocketRadius = mmToMeters(POCKET_RADIUS_MM);
  const pocketDepth = 0.18;
  const pocketGeo = new THREE.CylinderGeometry(pocketRadius, pocketRadius * 0.7, pocketDepth, 24, 1, true);
  const pocketMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#050608'),
    roughness: 0.6,
    metalness: 0.15,
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
  positions.forEach(([x, y, z], index) => {
    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(x, y - pocketDepth / 2, z);
    pocket.rotation.x = Math.PI / 2;
    if (index >= 4) {
      pocket.scale.set(0.85, 1, 1);
    }
    pocketGroup.add(pocket);
  });
  table.add(pocketGroup);

  return { table, cloth, rails: [railNorth, railSouth, railEast, railWest], frame, chromeTrim };
}

function buildBallMeshes(config, playLength) {
  const ballDiameter = mmToMeters(BALL_DIAMETER_MM);
  const rackLayout = computeRackLayout(ballDiameter, playLength);
  const cuePosition = getCueBallPosition(ballDiameter, playLength);
  const radius = ballDiameter / 2;
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const finish = config.ballFinish ?? 'glossy';
  const roughness = finish === 'matte' ? 0.45 : finish === 'satin' ? 0.25 : 0.12;
  const clearcoat = finish === 'glossy' ? 0.9 : finish === 'satin' ? 0.6 : 0.2;
  const clearcoatRoughness = finish === 'glossy' ? 0.05 : finish === 'satin' ? 0.12 : 0.35;

  const balls = new Map();
  const group = new THREE.Group();

  BALL_SET.forEach((ball) => {
    const texture = createBallTexture(ball);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness,
      metalness: 0.0,
      clearcoat,
      clearcoatRoughness,
      sheen: 0.25,
      sheenRoughness: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.position.y = TABLE_SURFACE_Y + radius;
    if (ball.id === 'CUE') {
      mesh.position.add(cuePosition);
    } else {
      const rackPos = rackLayout.find((entry) => entry.id === ball.id);
      if (rackPos) {
        mesh.position.x = rackPos.position.x;
        mesh.position.z = rackPos.position.z;
      }
    }
    balls.set(ball.id, { mesh, material });
    group.add(mesh);
  });

  return { group, balls };
}

export default function PoolUK8ArenaScene({ config }) {
  const hostRef = useRef(null);
  const rendererRef = useRef(null);
  const materialsRef = useRef(null);
  const ballStateRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return () => {};

    const width = host.clientWidth;
    const height = host.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    configureRenderer(renderer, width, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05090f');

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 50);
    camera.position.set(2.8, 2.1, 3.1);
    camera.lookAt(0, TABLE_SURFACE_Y, 0);

    const controls = createOrbitControls(camera, renderer.domElement, TABLE_SURFACE_Y);

    const playWidth = mmToMeters(TABLE_DIMENSIONS_MM.width);
    const playLength = mmToMeters(TABLE_DIMENSIONS_MM.length);

    const initialConfig = { ...DEFAULT_CONFIG, ...config };
    const materials = createTableMaterials(initialConfig);
    materialsRef.current = materials;

    buildLightingRig(scene, TABLE_SURFACE_Y);
    const { table, cloth, rails, frame, chromeTrim } = buildTableGeometry(
      materials,
      playWidth,
      playLength
    );
    scene.add(table);

    const { group: ballsGroup, balls } = buildBallMeshes(initialConfig, playLength);
    ballStateRef.current = { ballsGroup, balls };
    scene.add(ballsGroup);

    buildArenaEnvironment(scene, materials.floor, playWidth, playLength);

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

    rendererRef.current = { renderer, scene, cloth, rails, frame, chromeTrim };
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
    const state = rendererRef.current;
    const materials = materialsRef.current;
    const balls = ballStateRef.current;
    if (!state || !materials || !balls) return;

    const nextConfig = { ...DEFAULT_CONFIG, ...config };
    materials.cloth.color.set(nextConfig.clothColor);
    materials.rails.color.set(nextConfig.railColor);
    materials.frame.color.set(nextConfig.frameColor);
    materials.chrome.color.set(nextConfig.metalColor);

    const finish = nextConfig.ballFinish ?? 'glossy';
    const roughness = finish === 'matte' ? 0.45 : finish === 'satin' ? 0.25 : 0.12;
    const clearcoat = finish === 'glossy' ? 0.9 : finish === 'satin' ? 0.6 : 0.2;
    const clearcoatRoughness = finish === 'glossy' ? 0.05 : finish === 'satin' ? 0.12 : 0.35;
    balls.balls.forEach(({ material }) => {
      material.roughness = roughness;
      material.clearcoat = clearcoat;
      material.clearcoatRoughness = clearcoatRoughness;
      material.needsUpdate = true;
    });
  }, [config]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
