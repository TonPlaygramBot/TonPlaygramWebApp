"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const ORIGINAL_ASSETS = {
  truckVariants: [
    "/stk-original-glb/karts/truck/truck.glb",
    "/stk-original-glb/karts/truck/truck-2.glb",
    "/stk-original-glb/karts/truck/truck-3.glb",
    "/stk-original-glb/karts/truck/truck-4.glb",
    "/stk-original-glb/karts/truck/truck-5.glb"
  ],
  track: "/stk-original-glb/tracks/main-track/track.glb",
  treeLocal: "/stk-original-glb/environment/tree.glb",
  treeRemote: "https://raw.githubusercontent.com/jagenjo/GTR_Framework/master/data/prefabs/tree.glb"
};

const TAU = Math.PI * 2;
const CHECKPOINTS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const TRACK_PRESETS = [
  { id: "sunset-gp", label: "Sunset GP", outerX: 42, outerZ: 29, innerX: 26, innerZ: 13, centerX: 34, centerZ: 21, laneScale: 0.52, bend: 0.22, wobble: 0.8 },
  { id: "forest-bend", label: "Forest Bend", outerX: 40, outerZ: 31, innerX: 24, innerZ: 14, centerX: 32, centerZ: 22, laneScale: 0.5, bend: 0.38, wobble: 1.2 },
  { id: "coastal-loop", label: "Coastal Loop", outerX: 45, outerZ: 26, innerX: 27, innerZ: 11, centerX: 36, centerZ: 18, laneScale: 0.45, bend: 0.3, wobble: 0.95 },
  { id: "night-curve", label: "Night Curve", outerX: 39, outerZ: 33, innerX: 22, innerZ: 14, centerX: 30, centerZ: 23, laneScale: 0.56, bend: 0.44, wobble: 1.4 },
  { id: "desert-sprint", label: "Desert Sprint", outerX: 44, outerZ: 30, innerX: 28, innerZ: 12.5, centerX: 35, centerZ: 21, laneScale: 0.5, bend: 0.26, wobble: 0.72 }
];
const DEFAULT_TRACK = TRACK_PRESETS[0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function forwardFromYaw(yaw) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
}

function yawFromForward(v) {
  return Math.atan2(v.x, v.z);
}

function warpRadius(angle, track) {
  return 1 + Math.sin(angle * 2 + 0.4) * track.bend * 0.16 + Math.sin(angle * 5 - 0.35) * track.bend * 0.09;
}

function angleOnTrack(pos, track = DEFAULT_TRACK) {
  const a = Math.atan2(pos.z / track.centerZ, pos.x / track.centerX);
  return a < 0 ? a + TAU : a;
}

function pointOnTrack(angle, lane = 0, track = DEFAULT_TRACK) {
  const warp = warpRadius(angle, track);
  const radiusX = (track.centerX + lane) * warp;
  const radiusZ = (track.centerZ + lane * track.laneScale) * (1 + Math.sin(angle * 3.3 + 0.7) * track.bend * 0.06);
  return new THREE.Vector3(Math.cos(angle) * radiusX, 0.18, Math.sin(angle) * radiusZ);
}

function tangentYaw(angle, track = DEFAULT_TRACK) {
  const dx = -Math.sin(angle) * track.centerX * warpRadius(angle, track);
  const dz = Math.cos(angle) * track.centerZ * warpRadius(angle + 0.02, track);
  return Math.atan2(dx, dz);
}

function trackQuality(pos, track = DEFAULT_TRACK) {
  const outer = (pos.x * pos.x) / (track.outerX * track.outerX) + (pos.z * pos.z) / (track.outerZ * track.outerZ);
  const inner = (pos.x * pos.x) / (track.innerX * track.innerX) + (pos.z * pos.z) / (track.innerZ * track.innerZ);
  return { onRoad: outer <= 1 && inner >= 1 };
}

function makeMat(color, roughness = 0.78, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function enableShadows(obj) {
  obj.traverse((child) => {
    const mesh = child;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}

function cloneModel(model) {
  return SkeletonUtils.clone(model);
}

function normalizeLoadedModel(obj) {
  obj.traverse((child) => {
    const mesh = child;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}

function makeLoader() {
  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  return { loader, draco };
}

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve({ scene: normalizeLoadedModel(gltf.scene), animations: gltf.animations || [] }), undefined, reject);
  });
}

async function tryLoadTree(loader) {
  try {
    const local = await loadGltf(loader, ORIGINAL_ASSETS.treeLocal);
    return local.scene;
  } catch {
    try {
      const remote = await loadGltf(loader, ORIGINAL_ASSETS.treeRemote);
      return remote.scene;
    } catch (err) {
      console.warn("No GLTF tree available. Trees will be skipped; no procedural trees are spawned.", err);
      return undefined;
    }
  }
}

async function tryLoadOriginalAssets(loader) {
  const firstTruck = await loadGltf(loader, ORIGINAL_ASSETS.truckVariants[0]);
  const track = await loadGltf(loader, ORIGINAL_ASSETS.track);
  const trucks = [firstTruck.scene];
  const truckAnimations = [firstTruck.animations];

  for (const url of ORIGINAL_ASSETS.truckVariants.slice(1)) {
    try {
      const extra = await loadGltf(loader, url);
      trucks.push(extra.scene);
      truckAnimations.push(extra.animations);
    } catch {
      trucks.push(firstTruck.scene);
      truckAnimations.push(firstTruck.animations);
    }
  }

  const tree = await tryLoadTree(loader);
  return { trucks, truckAnimations, track: track.scene, tree };
}

function createProceduralTrack(scene, track = DEFAULT_TRACK) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(92, 72), makeMat(0x18351f, 0.95));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);

  const shape = new THREE.Shape();
  shape.absellipse(0, 0, track.outerX, track.outerZ, 0, TAU, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, track.innerX, track.innerZ, 0, TAU, true, 0);
  shape.holes.push(hole);

  const road = new THREE.Mesh(new THREE.ShapeGeometry(shape, 128), makeMat(0x2b2f36, 0.86));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);

  const curbMatA = makeMat(0xffffff, 0.52);
  const curbMatB = makeMat(0xd82020, 0.52);
  for (let i = 0; i < 112; i++) {
    const a = (i / 152) * TAU;
    const yaw = tangentYaw(a, track);
    const points = [
      pointOnTrack(a, track.outerX - track.centerX, track).setY(0.035),
      pointOnTrack(a, track.innerX - track.centerX, track).setY(0.036)
    ];
    for (const p of points) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.28), i % 2 === 0 ? curbMatA : curbMatB);
      curb.position.copy(p);
      curb.rotation.y = yaw;
      curb.castShadow = true;
      curb.receiveShadow = true;
      scene.add(curb);
    }
  }

  for (let x = -3; x <= 3; x++) {
    for (let z = 0; z < 2; z++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.035, 1.05), makeMat((x + z) % 2 === 0 ? 0xffffff : 0x050505, 0.4));
      tile.position.set(x * 1.05, 0.07, track.centerZ + z * 1.05 - 0.5);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }

  const coneMat = makeMat(0xffc13b, 0.55);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 18), coneMat);
    cone.position.set(Math.cos(a) * 38, 0.6, Math.sin(a) * 25);
    cone.castShadow = true;
    scene.add(cone);
  }
}

function scatterGltfTrees(scene, tree) {
  if (!tree) return;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.08;
    const clone = cloneModel(tree);
    clone.scale.setScalar(0.45 + (i % 4) * 0.09);
    clone.position.set(Math.cos(a) * (39 + (i % 3) * 2.2), 0, Math.sin(a) * (27 + (i % 2) * 2.3));
    clone.rotation.y = a + Math.PI * 0.25;
    enableShadows(clone);
    scene.add(clone);
  }
}

function createTruckVariant(color, name, variant, ai = false, angle = Math.PI / 2, lane = 0, track = DEFAULT_TRACK) {
  const group = new THREE.Group();
  const bodyMat = makeMat(color, 0.48, 0.12);
  const darkMat = makeMat(0x101010, 0.65, 0.18);
  const seatMat = makeMat(0x22252b, 0.7);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x77bfff, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.65 });

  const dims = {
    sport: { base: [1.4, 0.32, 2.05], nose: [1.0, 0.22, 0.75], mass: 1.0, radius: 1.25, wheel: 0.28, cabZ: -0.28 },
    truck: { base: [1.62, 0.46, 2.45], nose: [1.2, 0.34, 0.85], mass: 1.25, radius: 1.45, wheel: 0.34, cabZ: -0.35 },
    heavy: { base: [1.85, 0.58, 2.8], nose: [1.32, 0.38, 0.9], mass: 1.55, radius: 1.7, wheel: 0.38, cabZ: -0.45 },
    rally: { base: [1.5, 0.38, 2.3], nose: [1.25, 0.28, 0.8], mass: 1.12, radius: 1.38, wheel: 0.32, cabZ: -0.28 },
    longnose: { base: [1.58, 0.42, 2.65], nose: [1.08, 0.3, 1.15], mass: 1.22, radius: 1.55, wheel: 0.33, cabZ: -0.52 }
  };
  const d = dims[variant];

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.85,0.28,3.05), bodyMat);
  base.position.y = 0.38;
  group.add(base);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(...d.nose), bodyMat);
  nose.position.set(0, 0.49, d.base[2] * 0.5 + d.nose[2] * 0.35);
  group.add(nose);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.48, 0.72), seatMat);
  seat.position.set(0, 0.78, d.cabZ);
  group.add(seat);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.08), glassMat);
  windshield.position.set(0, 0.94, d.cabZ + 0.45);
  windshield.rotation.x = -0.35;
  group.add(windshield);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(d.base[0] * 1.08, 0.12, 0.3), bodyMat);
  spoiler.position.set(0, 0.88, -d.base[2] * 0.52);
  group.add(spoiler);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(d.base[0] * 0.98, 0.16, 0.16), darkMat);
  bumperFront.position.set(0, 0.3, d.base[2] * 0.56 + d.nose[2] * 0.55);
  group.add(bumperFront);

  for (const x of [-d.base[0] * 0.56, d.base[0] * 0.56]) {
    for (const z of [-d.base[2] * 0.34, d.base[2] * 0.38]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(d.wheel, d.wheel, 0.3, 24), darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.26, z);
      group.add(wheel);
    }
  }

  const driver = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), makeMat(ai ? 0xf2d6b3 : 0xffd2a6, 0.6));
  driver.position.set(0, 1.08, d.cabZ);
  group.add(driver);

  enableShadows(group);
  const pos = pointOnTrack(angle, lane, track);
  group.position.copy(pos);
  group.rotation.y = tangentYaw(angle, track);

  return {
    group,
    pos: pos.clone(),
    yaw: group.rotation.y,
    speed: 0,
    steer: 0,
    lap: 1,
    checkpoint: 0,
    progress: angle,
    ai,
    lane,
    name,
    mass: d.mass,
    radius: d.radius,
    crashT: 0,
    damage: 0,
    yawKick: 0,
    variant,
    health: 100
  };
}

function createOriginalKart(assets, name, ai, angle, lane, index, variant, track = DEFAULT_TRACK) {
  if (!assets.trucks.length) throw new Error("Original truck asset not loaded.");
  const group = new THREE.Group();
  const model = cloneModel(assets.trucks[index % assets.trucks.length]);
  group.add(model);
  const pos = pointOnTrack(angle, lane, track);
  group.position.copy(pos);
  group.rotation.y = tangentYaw(angle, track);
  const animations = assets.truckAnimations[index % assets.truckAnimations.length] || [];
  const mixer = animations.length ? new THREE.AnimationMixer(model) : undefined;
  if (mixer) mixer.clipAction(animations[0]).play();
  return { group, pos: pos.clone(), yaw: group.rotation.y, speed: 0, steer: 0, lap: 1, checkpoint: 0, progress: angle, ai, lane, name, mass: 1.25 + index * 0.08, radius: 1.45, crashT: 0, damage: 0, yawKick: 0, variant, mixer, health: 100 };
}

function updateCheckpoint(kart) {
  const a = angleOnTrack(kart.pos);
  const target = CHECKPOINTS[kart.checkpoint % CHECKPOINTS.length];
  const diff = Math.abs(Math.atan2(Math.sin(a - target), Math.cos(a - target)));
  if (diff < 0.18) {
    kart.checkpoint = (kart.checkpoint + 1) % CHECKPOINTS.length;
    if (kart.checkpoint === 0) kart.lap += 1;
  }
  kart.progress = (kart.lap - 1) * TAU + a;
}

function applyCrashDamping(kart, dt) {
  if (kart.crashT <= 0) return;
  kart.crashT = Math.max(0, kart.crashT - dt);
  kart.yaw += kart.yawKick * dt;
  kart.yawKick *= Math.exp(-5.5 * dt);
  kart.speed *= Math.exp(-1.7 * dt);
}

function updatePlayerKart(kart, input, dt, track = DEFAULT_TRACK) {
  const accel = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) + input.accel;
  const steerRaw = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) + input.steer;
  const brake = input.keys.Space || input.brake;
  const quality = trackQuality(kart.pos, track);
  const grip = quality.onRoad ? 1 : 0.55;
  const healthFactor = clamp(kart.health / 100, 0.22, 1);
  const maxSpeed = (quality.onRoad ? 16.5 : 7.5) * healthFactor;

  kart.speed += accel * 24 * dt * grip;
  kart.speed -= (brake ? 30 : 0) * dt * Math.sign(kart.speed || 1);
  kart.speed = Math.max(-7, Math.min(maxSpeed, kart.speed));
  kart.speed *= Math.exp(-(quality.onRoad ? 0.65 : 2.2) * dt);
  kart.steer = lerp(kart.steer, clamp(steerRaw, -1, 1), 1 - Math.exp(-9 * dt));
  const steerStrength = 1.8 * grip * clamp(Math.abs(kart.speed) / 8, 0.25, 1.15);
  kart.yaw -= kart.steer * steerStrength * dt * Math.sign(kart.speed || 1);
  applyCrashDamping(kart, dt);
  kart.pos.addScaledVector(forwardFromYaw(kart.yaw), kart.speed * dt);

  if (!quality.onRoad) {
    const pull = pointOnTrack(angleOnTrack(kart.pos, track), 0, track).sub(kart.pos).multiplyScalar(0.55 * dt);
    kart.pos.add(pull);
  }

  kart.group.position.copy(kart.pos);
  kart.group.rotation.y = kart.yaw;
  kart.mixer?.update(dt);
  updateCheckpoint(kart);
}

function updateAiKart(kart, all, dt, track = DEFAULT_TRACK) {
  const target = pointOnTrack(angleOnTrack(kart.pos, track) + 0.5, kart.lane, track);
  const to = target.sub(kart.pos).normalize();
  const desiredYaw = yawFromForward(to);
  const delta = Math.atan2(Math.sin(desiredYaw - kart.yaw), Math.cos(desiredYaw - kart.yaw));
  let targetSpeed = (12.5 + Math.abs(kart.lane) * 0.8 - kart.damage * 0.35) * clamp(kart.health / 100, 0.2, 1);

  for (const other of all) {
    if (other === kart) continue;
    const ahead = other.pos.clone().sub(kart.pos);
    if (ahead.length() < 4.4 && ahead.dot(forwardFromYaw(kart.yaw)) > 0) targetSpeed *= 0.62;
  }

  kart.speed = lerp(kart.speed, targetSpeed, 1 - Math.exp(-1.8 * dt));
  kart.steer = lerp(kart.steer, clamp(delta * 1.8, -1, 1), 1 - Math.exp(-7 * dt));
  kart.yaw += delta * (1 - Math.exp(-3.5 * dt));
  applyCrashDamping(kart, dt);
  kart.pos.addScaledVector(forwardFromYaw(kart.yaw), kart.speed * dt);
  kart.group.position.copy(kart.pos);
  kart.group.rotation.y = kart.yaw;
  kart.mixer?.update(dt);
  updateCheckpoint(kart);
}

function resolveVehicleCrashes(karts) {
  let strongest = 0;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const delta = b.pos.clone().sub(a.pos);
      const dist = Math.max(delta.length(), 0.001);
      const minDist = a.radius + b.radius;
      if (dist >= minDist) continue;

      const normal = delta.multiplyScalar(1 / dist);
      const overlap = minDist - dist;
      const totalMass = a.mass + b.mass;
      a.pos.addScaledVector(normal, -overlap * (b.mass / totalMass));
      b.pos.addScaledVector(normal, overlap * (a.mass / totalMass));

      const va = forwardFromYaw(a.yaw).multiplyScalar(a.speed);
      const vb = forwardFromYaw(b.yaw).multiplyScalar(b.speed);
      const rel = vb.clone().sub(va);
      const closing = -rel.dot(normal);
      const impact = Math.max(0, closing) + Math.abs(a.speed - b.speed) * 0.18;
      const restitution = 0.38;
      const impulse = impact > 0 ? ((1 + restitution) * closing) / (1 / a.mass + 1 / b.mass) : 1.2;
      const impulseVec = normal.clone().multiplyScalar(impulse);
      const va2 = va.clone().addScaledVector(impulseVec, -1 / a.mass);
      const vb2 = vb.clone().addScaledVector(impulseVec, 1 / b.mass);

      a.speed = clamp(va2.dot(forwardFromYaw(a.yaw)), -8, 15);
      b.speed = clamp(vb2.dot(forwardFromYaw(b.yaw)), -8, 15);
      const sideA = normal.dot(new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw)));
      const sideB = normal.dot(new THREE.Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw)));
      a.yawKick += -sideA * (0.8 + impact * 0.25) / a.mass;
      b.yawKick += sideB * (0.8 + impact * 0.25) / b.mass;
      a.crashT = Math.max(a.crashT, 0.35 + impact * 0.03);
      b.crashT = Math.max(b.crashT, 0.35 + impact * 0.03);
      a.damage = clamp(a.damage + impact * 0.07, 0, 10);
      b.damage = clamp(b.damage + impact * 0.07, 0, 10);
      a.health = clamp(a.health - impact * 1.7, 5, 100);
      b.health = clamp(b.health - impact * 1.7, 5, 100);
      strongest = Math.max(strongest, impact);

      a.group.position.copy(a.pos);
      b.group.position.copy(b.pos);
      a.group.rotation.z = Math.sin(a.crashT * 30) * 0.08;
      b.group.rotation.z = -Math.sin(b.crashT * 30) * 0.08;
    }
  }
  return strongest;
}

export default function SuperTuxKartPlayablePreview({ selectedTrack = TRACK_PRESETS[0].id }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ lap: 1, speed: 0, position: 1, checkpoint: 0, help: true, status: "Loading...", mode: "playable-preview", crash: "", health: 100, trackName: "" });
  const hudRef = useRef(hud);

  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let cancelled = false;
    let frameId = 0;
    const { loader, draco } = makeLoader();
    const input = { keys: {}, steer: 0, accel: 0, brake: false, pointerId: null, startX: 0, startY: 0, lookId: null, lastX: 0, camYaw: 0 };
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x85c7f2, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x85c7f2, 42, 125);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 180);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2d3f30, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-18, 32, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const onKeyDown = (e) => { input.keys[e.code] = true; };
    const onKeyUp = (e) => { input.keys[e.code] = false; };
    const onPointerDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      canvas.setPointerCapture(e.pointerId);
      if (e.clientX - rect.left < rect.width * 0.55 && input.pointerId === null) {
        input.pointerId = e.pointerId;
        input.startX = e.clientX;
        input.startY = e.clientY;
      } else {
        input.lookId = e.pointerId;
        input.lastX = e.clientX;
      }
    };
    const onPointerMove = (e) => {
      if (input.pointerId === e.pointerId) {
        input.steer = clamp((e.clientX - input.startX) / 70, -1, 1);
        input.accel = clamp(-(e.clientY - input.startY) / 75, -0.65, 1);
      }
      if (input.lookId === e.pointerId) {
        const dx = e.clientX - input.lastX;
        input.lastX = e.clientX;
        input.camYaw -= dx * 0.005;
      }
    };
    const onPointerUp = (e) => {
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (input.pointerId === e.pointerId) {
        input.pointerId = null;
        input.steer = 0;
        input.accel = 0;
      }
      if (input.lookId === e.pointerId) input.lookId = null;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    async function start() {
      let assets = null;
      let originalMode = false;
      try {
        assets = await tryLoadOriginalAssets(loader);
        originalMode = Boolean(assets.trucks.length && assets.track);
      } catch (err) {
        console.warn("Original SuperTuxKart GLB files are not available. Running playable fallback.", err);
        const tree = await tryLoadTree(loader);
        assets = { trucks: [], truckAnimations: [], tree };
      }

      if (cancelled) return;
      const activeTrack = TRACK_PRESETS.find((t) => t.id === selectedTrack) || TRACK_PRESETS[0];
      if (originalMode && assets?.track) scene.add(cloneModel(assets.track));
      else createProceduralTrack(scene, activeTrack);
      scatterGltfTrees(scene, assets?.tree);

      const variants = ["sport", "truck", "heavy", "rally", "longnose"];
      const colors = [0xff3b30, 0x35c3ff, 0xffcc00, 0x7cff6b, 0xb469ff];
      const names = ["Red Sport Truck", "Blue Box Truck", "Yellow Heavy Truck", "Green Rally Truck", "Purple Longnose"];
      const starts = [
        { angle: Math.PI / 2, lane: 0 },
        { angle: Math.PI / 2 - 0.18, lane: -1.5 },
        { angle: Math.PI / 2 - 0.32, lane: 1.2 },
        { angle: Math.PI / 2 - 0.48, lane: 0.2 },
        { angle: Math.PI / 2 - 0.64, lane: -0.4 }
      ];

      const makeKart = (i) => originalMode && assets?.trucks.length
        ? createOriginalKart(assets, names[i], i > 0, starts[i].angle, starts[i].lane, i, variants[i], activeTrack)
        : createTruckVariant(colors[i], names[i], variants[i], i > 0, starts[i].angle, starts[i].lane, activeTrack);

      const player = makeKart(0);
      const ai1 = makeKart(1);
      const ai2 = makeKart(2);
      const ai3 = makeKart(3);
      const ai4 = makeKart(4);
      const karts = [player, ai1, ai2, ai3, ai4];
      karts.forEach((k) => scene.add(k.group));
      setHud((h) => ({ ...h, status: originalMode ? "Original STK GLB mode" : "Playable fallback with 5 different trucks", mode: originalMode ? "original-assets" : "playable-preview", trackName: activeTrack.label }));

      let last = performance.now();
      let crashTextT = 0;
      const updateCamera = (dt) => {
        const yaw = player.yaw + Math.PI + input.camYaw * 0.35;
        const back = forwardFromYaw(yaw).multiplyScalar(8.5);
        const shake = player.crashT > 0 ? new THREE.Vector3((Math.random() - 0.5) * player.crashT * 0.35, (Math.random() - 0.5) * player.crashT * 0.18, 0) : new THREE.Vector3();
        const desired = player.pos.clone().add(back).add(new THREE.Vector3(0, 4.4, 0)).add(shake);
        camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
        const look = player.pos.clone().add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(forwardFromYaw(player.yaw), 4.2);
        camera.lookAt(look);
      };

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const now = performance.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        input.brake = Boolean(input.keys.Space);
        updatePlayerKart(player, input, dt, activeTrack);
        for (const ai of [ai1, ai2, ai3, ai4]) updateAiKart(ai, karts, dt, activeTrack);
        const impact = resolveVehicleCrashes(karts);
        if (impact > 0.8) {
          crashTextT = 1.2;
          hudRef.current.crash = impact > 6 ? "Heavy crash!" : "Vehicle contact";
        }
        crashTextT = Math.max(0, crashTextT - dt);
        updateCamera(dt);
        const sorted = [...karts].sort((a, b) => b.progress - a.progress);
        const position = sorted.findIndex((k) => k === player) + 1;
        const baseStatus = originalMode ? "Original STK GLB mode" : trackQuality(player.pos, activeTrack).onRoad ? "5-truck racing" : "Off-road slowdown";
        setHud({ ...hudRef.current, lap: player.lap, speed: Math.abs(player.speed), position, checkpoint: player.checkpoint, status: baseStatus, crash: crashTextT > 0 ? hudRef.current.crash : "", health: player.health });
        renderer.render(scene, camera);
      };
      animate();
    }
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      draco.dispose();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = o;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose?.();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    };
  }, []);

  const brakeDown = () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  const brakeUp = () => window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#85c7f2", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "white" }}>
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ background: "rgba(0,0,0,0.56)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "10px 12px", boxShadow: "0 12px 30px rgba(0,0,0,0.22)", maxWidth: 540 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>SuperTuxKart Truck Test</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Pos {hud.position}/5 · Lap {hud.lap}</div><div style={{fontSize:11,opacity:0.9}}>Track: {hud.trackName} · Kart health: {Math.round(hud.health)}%</div>
            <div style={{ fontSize: 11, opacity: 0.82 }}>{hud.status} · {Math.round(hud.speed * 8)} km/h</div>
            {hud.crash && <div style={{ marginTop: 2, fontSize: 12, fontWeight: 900, color: "#ffd166" }}>{hud.crash}</div>}
          </div>
          <button onClick={() => setHud((h) => ({ ...h, help: !h.help }))} style={{ pointerEvents: "auto", width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "white", fontSize: 18, fontWeight: 900 }}>?</button>
        </div>

        {hud.help && (
          <div style={{ position: "absolute", left: 10, bottom: 18, maxWidth: 352, background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "10px 12px", fontSize: 12, lineHeight: 1.35 }}>
            <b>Controls</b><br />
            Desktop: W/↑ accelerate, S/↓ reverse, A/D steer, Space brake.<br />
            Mobile: drag left side to accelerate/steer, right side to rotate camera.<br />
            Now includes 5 different trucks and impulse-based crash response.<br />
            Trees are GLTF-only. If no GLTF tree loads, no procedural trees are spawned.<br />
            Current mode: {hud.mode === "original-assets" ? "Original STK GLB assets loaded." : "Playable fallback because original STK GLBs are not available in this preview."}
          </div>
        )}

        <button onPointerDown={brakeDown} onPointerUp={brakeUp} onPointerCancel={brakeUp} style={{ pointerEvents: "auto", position: "absolute", right: 18, bottom: 22, width: 78, height: 78, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.48)", color: "white", fontSize: 13, fontWeight: 900, boxShadow: "0 12px 30px rgba(0,0,0,0.28)" }}>BRAKE</button>
      </div>
    </div>
  );
}
