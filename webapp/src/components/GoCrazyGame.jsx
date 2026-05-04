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
const MURLAN_HUMAN_MODEL_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const FERRARI_KART_URL = "https://threejs.org/examples/models/gltf/ferrari.glb";
const BUGGY_KART_URLS = [
  "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Buggy/glTF-Binary/Buggy.glb",
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb"
];
const PARKED_UNIT_MODELS = {
  HELICOPTER: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/helicopter.glb"],
  JET: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/f15.glb"],
  TRUCK: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/fire_truck.glb"],
  DRONE: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/drone.glb"],
  TOWER: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/antenna.glb"]
};

const TAU = Math.PI * 2;
const CHECKPOINTS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const TRACK_SIZE_MULTIPLIER = { length: 1.55, width: 1.35 };
const TRACK_PRESETS = {
  "alpine-ring": { outerX: 44, outerZ: 28, innerX: 28, innerZ: 12, centerX: 36, centerZ: 20, wobble: 0.08, hue: 0x2b2f36 },
  "sunset-circuit": { outerX: 42, outerZ: 26, innerX: 26, innerZ: 11, centerX: 34, centerZ: 18.5, wobble: 0.1, hue: 0x37312d },
  "canyon-flow": { outerX: 46, outerZ: 25, innerX: 29, innerZ: 10.8, centerX: 37, centerZ: 17.8, wobble: 0.12, hue: 0x343236 },
  "forest-sweep": { outerX: 43, outerZ: 29, innerX: 27, innerZ: 12.6, centerX: 35, centerZ: 21, wobble: 0.11, hue: 0x2a3130 },
  "storm-bend": { outerX: 45, outerZ: 27, innerX: 27.5, innerZ: 11.5, centerX: 36, centerZ: 19, wobble: 0.14, hue: 0x2b2d33 }
};
const WEAPON_PICKUPS = ["RIFLE", "FIREARM", "MISSILE", "DRONE", "HELICOPTER", "JET"]
const WEAPON_MODEL_CANDIDATES = {
  FIREARM: [
    "https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb",
    "https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb"
  ],
  RIFLE: [
    "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
    "https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
    "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb"
  ],
  MISSILE: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/atlas_v.glb"],
  DRONE: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/drone.glb"],
  HELICOPTER: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/helicopter.glb"],
  JET: ["https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/f15.glb"]
};
const DEFENSE_PICKUPS = ["MISSILE_RADAR", "DRONE_RADAR", "ANTI_MISSILE_BATTERY"];
const WEAPON_ICON = { FIREARM: "🔫", RIFLE: "🪖", MISSILE: "🚀", DRONE: "🛸", HELICOPTER: "🚁", JET: "✈️", TRUCK: "🚒", TOWER: "📡" };
const SUPPORT_PICKUP_TYPES = ["TRUCK", "DRONE", "HELICOPTER", "JET", "TOWER"];
const PICKUP_BUBBLE_COLORS = {
  FIREARM: 0xffd166,
  RIFLE: 0x8ec9ff,
  MISSILE: 0xff7b54,
  DRONE: 0x91ffba,
  HELICOPTER: 0xe8a6ff,
  JET: 0x7df3ff,
  TRUCK: 0xffb58f,
  TOWER: 0xb7ff7f
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function forwardFromYaw(yaw) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
}

function yawFromForward(v) {
  return Math.atan2(v.x, v.z);
}

function angleOnTrack(pos, track) {
  const a = Math.atan2(pos.z / track.centerZ, pos.x / track.centerX);
  return a < 0 ? a + TAU : a;
}

function pointOnTrack(angle, track, lane = 0) {
  const mod = 1 + Math.sin(angle * 3) * track.wobble + Math.cos(angle * 5) * track.wobble * 0.45;
  const hill = Math.sin(angle * 2.5 + Math.cos(angle * 0.7)) * 0.55 + Math.sin(angle * 7) * 0.15;
  return new THREE.Vector3(Math.cos(angle) * (track.centerX + lane) * mod, 0.18 + hill, Math.sin(angle) * (track.centerZ + lane * 0.45) * mod);
}

function tangentYaw(angle, track) {
  const e = 0.01;
  const p1 = pointOnTrack(angle, track, 0);
  const p2 = pointOnTrack(angle + e, track, 0);
  return Math.atan2(p2.x - p1.x, p2.z - p1.z);
}

function trackQuality(pos, track) {
  const outer = (pos.x * pos.x) / (track.outerX * track.outerX) + (pos.z * pos.z) / (track.outerZ * track.outerZ);
  const inner = (pos.x * pos.x) / (track.innerX * track.innerX) + (pos.z * pos.z) / (track.innerZ * track.innerZ);
  return { onRoad: outer <= 1 && inner >= 1 };
}


function scaledTrack(track) {
  return {
    ...track,
    outerX: track.outerX * TRACK_SIZE_MULTIPLIER.width,
    innerX: track.innerX * TRACK_SIZE_MULTIPLIER.width,
    centerX: track.centerX * TRACK_SIZE_MULTIPLIER.width,
    outerZ: track.outerZ * TRACK_SIZE_MULTIPLIER.length,
    innerZ: track.innerZ * TRACK_SIZE_MULTIPLIER.length,
    centerZ: track.centerZ * TRACK_SIZE_MULTIPLIER.length
  };
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
  const dracoDecoderPath = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
  return { dracoDecoderPath };
}

function loadGltf(dracoDecoderPath, url) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoDecoderPath);
  loader.setDRACOLoader(draco);
  loader.setCrossOrigin("anonymous");
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  manager.setURLModifier((assetUrl) => {
    if (/^(https?:)?\/\//i.test(assetUrl) || assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) return assetUrl;
    return new URL(assetUrl, base).toString();
  });
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Timeout loading ${url}`)), 18000);
    loader.load(url, (gltf) => {
      window.clearTimeout(timeout);
      resolve({ scene: applyOriginalTextureQuality(normalizeLoadedModel(gltf.scene)), animations: gltf.animations || [] });
    }, undefined, (err) => {
      window.clearTimeout(timeout);
      draco.dispose();
      reject(err);
    });
  });
}

async function tryLoadTree(dracoDecoderPath) {
  try {
    const local = await loadGltf(dracoDecoderPath, ORIGINAL_ASSETS.treeLocal);
    return local.scene;
  } catch {
    try {
      const remote = await loadGltf(dracoDecoderPath, ORIGINAL_ASSETS.treeRemote);
      return remote.scene;
    } catch (err) {
      console.warn("No GLTF tree available. Trees will be skipped; no procedural trees are spawned.", err);
      return undefined;
    }
  }
}

async function tryLoadMurlanHuman(dracoDecoderPath) {
  try {
    const gltf = await loadGltf(dracoDecoderPath, MURLAN_HUMAN_MODEL_URL);
    return gltf.scene;
  } catch (err) {
    console.warn("Murlan seated human GLTF could not load.", err);
    return null;
  }
}

async function tryLoadVehicleModel(dracoDecoderPath, urls) {
  for (const url of urls) {
    try {
      const gltf = await loadGltf(dracoDecoderPath, url);
      return gltf.scene;
    } catch (err) {
      console.warn("Vehicle model URL failed:", url, err);
    }
  }
  return null;
}

async function tryLoadOriginalAssets(dracoDecoderPath) {
  const firstTruck = await loadGltf(dracoDecoderPath, ORIGINAL_ASSETS.truckVariants[0]);
  const track = await loadGltf(dracoDecoderPath, ORIGINAL_ASSETS.track);
  const trucks = [firstTruck.scene];
  const truckAnimations = [firstTruck.animations];

  for (const url of ORIGINAL_ASSETS.truckVariants.slice(1)) {
    try {
      const extra = await loadGltf(dracoDecoderPath, url);
      trucks.push(extra.scene);
      truckAnimations.push(extra.animations);
    } catch {
      trucks.push(firstTruck.scene);
      truckAnimations.push(firstTruck.animations);
    }
  }

  const tree = await tryLoadTree(dracoDecoderPath);
  return { trucks, truckAnimations, track: track.scene, tree };
}

function createProceduralTrack(scene, track) {
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

  const road = new THREE.Mesh(new THREE.ShapeGeometry(shape, 256), makeMat(track.hue, 0.86));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);

  const curbMatA = makeMat(0xffffff, 0.52);
  const curbMatB = makeMat(0xd82020, 0.52);
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * TAU;
    const yaw = tangentYaw(a, track);
    const points = [
      new THREE.Vector3(Math.cos(a) * track.outerX, 0.035, Math.sin(a) * track.outerZ),
      new THREE.Vector3(Math.cos(a) * track.innerX, 0.036, Math.sin(a) * track.innerZ)
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

  const tireBlack = makeMat(0x181818, 0.97, 0.02);
  const tireRed = makeMat(0xa01717, 0.88, 0.03);
  const tireWhite = makeMat(0xe3e3e3, 0.7, 0.01);
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * TAU;
    const yaw = tangentYaw(a, track);
    const ringSet = [
      { x: Math.cos(a) * (track.outerX + 2.1), z: Math.sin(a) * (track.outerZ + 1.8), y: 0.2, stacked: i % 3 === 0 },
      { x: Math.cos(a) * (track.innerX - 1.5), z: Math.sin(a) * (track.innerZ - 1.1), y: 0.2, stacked: i % 4 === 0 }
    ];
    ringSet.forEach((entry, idx) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 12, 28), i % 2 === 0 ? tireRed : tireWhite);
      tire.rotation.x = Math.PI / 2;
      tire.rotation.y = yaw + (idx === 0 ? 0.05 : -0.05);
      tire.position.set(entry.x, entry.y, entry.z);
      scene.add(tire);
      const top = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.18, 10, 24), tireBlack);
      top.rotation.x = Math.PI / 2;
      top.position.set(entry.x, entry.y + 0.02, entry.z);
      scene.add(top);
      if (entry.stacked) {
        const upper = tire.clone();
        upper.position.y += 0.34;
        scene.add(upper);
      }
    });
  }
}

function scatterGltfTrees(scene, tree, track) {
  if (!tree) return;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.08;
    const clone = cloneModel(tree);
    clone.scale.setScalar(0.45 + (i % 4) * 0.09);
    const side = i % 2 === 0 ? 1 : -1;
    const sideOffset = side > 0 ? 6.5 : -6.5;
    const edge = pointOnTrack(a, track, sideOffset);
    clone.position.set(edge.x, 0, edge.z);
    clone.rotation.y = a + Math.PI * 0.25;
    enableShadows(clone);
    scene.add(clone);
  }
}

function createTruckVariant(color, name, variant, track, ai = false, angle = Math.PI / 2, lane = 0) {
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

  const base = new THREE.Mesh(new THREE.BoxGeometry(...d.base), bodyMat);
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

  const driverGroup = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 8), makeMat(ai ? 0x4f6bd6 : 0xdf3131, 0.6));
  torso.position.set(0, 0.93, d.cabZ - 0.03);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), makeMat(ai ? 0xf2d6b3 : 0xffd2a6, 0.6));
  head.position.set(0, 1.26, d.cabZ + 0.05);
  const armMat = makeMat(ai ? 0x2e3e7a : 0x811f1f, 0.6);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 4, 8), armMat);
  const rightArm = leftArm.clone();
  leftArm.position.set(-0.16, 1.03, d.cabZ + 0.28);
  rightArm.position.set(0.16, 1.03, d.cabZ + 0.28);
  leftArm.rotation.z = 0.55;
  rightArm.rotation.z = -0.55;
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 10, 28), darkMat);
  steeringWheel.position.set(0, 0.98, d.cabZ + 0.36);
  steeringWheel.rotation.x = Math.PI / 2.8;
  driverGroup.add(torso, head, leftArm, rightArm, steeringWheel);
  group.add(driverGroup);

  enableShadows(group);
  const pos = pointOnTrack(angle, track, lane);
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
    variant
  };
}


function disposeObject3D(root) {
  if (!root) return;
  root.traverse?.((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
    else mat?.dispose?.();
  });
}

function addPrecisionHelpers(node, { color = 0xff44ff, size = 0.7 } = {}) {
  if (!node) return;
  const box = new THREE.Box3().setFromObject(node);
  if (!Number.isFinite(box.min.x)) return;
  const center = box.getCenter(new THREE.Vector3());
  const helperAnchor = new THREE.Group();
  helperAnchor.position.copy(center);
  helperAnchor.add(new THREE.AxesHelper(size));
  const wire = new THREE.Box3Helper(box, color);
  node.parent?.add(wire);
  node.parent?.add(helperAnchor);
}

function createOriginalKart(assets, name, ai, angle, lane, index, variant, track) {
  if (!assets.trucks.length) throw new Error("Original truck asset not loaded.");
  const group = new THREE.Group();
  const model = cloneModel(assets.trucks[index % assets.trucks.length]);
  group.add(model);
  const pos = pointOnTrack(angle, track, lane);
  group.position.copy(pos);
  group.rotation.y = tangentYaw(angle, track);
  const animations = assets.truckAnimations[index % assets.truckAnimations.length] || [];
  const mixer = animations.length ? new THREE.AnimationMixer(model) : undefined;
  if (mixer) mixer.clipAction(animations[0]).play();
  return { group, pos: pos.clone(), yaw: group.rotation.y, speed: 0, steer: 0, lap: 1, checkpoint: 0, progress: angle, ai, lane, name, mass: 1.25 + index * 0.08, radius: 1.45, crashT: 0, damage: 0, yawKick: 0, variant, mixer };
}

function fitVehicleModel(model, { targetLength = 2.5, lift = 0.12, yaw = Math.PI } = {}) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  const scale = targetLength / maxDim;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += -fitted.min.y + lift;
  model.rotation.y += yaw;
  enableShadows(model);
  return model;
}

function stripEmbeddedDriver(model) {
  model.traverse((obj) => {
    const name = (obj.name || "").toLowerCase();
    if (/(driver|human|pilot|character|head|body|helmet)/.test(name)) obj.visible = false;
  });
}

function updateCheckpoint(kart, track) {
  const a = angleOnTrack(kart.pos, track);
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

function updatePlayerKart(kart, input, track, dt) {
  const accel = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) + input.accel;
  const steerRaw = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) + input.steer;
  const brake = input.keys.Space || input.brake;
  const quality = trackQuality(kart.pos, track);
  const grip = quality.onRoad ? 1 : 0.55;
  const maxSpeed = quality.onRoad ? 16.5 - kart.damage * 0.9 : 7.5 - kart.damage * 0.5;

  kart.speed += accel * 24 * dt * grip;
  kart.speed -= (brake ? 30 : 0) * dt * Math.sign(kart.speed || 1);
  kart.speed = Math.max(-7, Math.min(maxSpeed, kart.speed));
  kart.speed *= Math.exp(-(quality.onRoad ? 0.65 : 2.2) * dt);
  kart.steer = lerp(kart.steer, clamp(steerRaw, -1, 1), 1 - Math.exp(-5.2 * dt));
  const steerStrength = 1.7 * grip * clamp(Math.abs(kart.speed) / 9, 0.24, 1.12);
  kart.yaw -= kart.steer * steerStrength * dt * Math.sign(kart.speed || 1);
  applyCrashDamping(kart, dt);
  kart.pos.addScaledVector(forwardFromYaw(kart.yaw), kart.speed * dt);

  if (!quality.onRoad) {
    const pull = pointOnTrack(angleOnTrack(kart.pos, track), track, 0).sub(kart.pos).multiplyScalar(0.55 * dt);
    kart.pos.add(pull);
  }

  kart.group.position.copy(kart.pos);
  kart.group.rotation.y = kart.yaw;
  kart.mixer?.update(dt);
  updateCheckpoint(kart, track);
}

function updateAiKart(kart, all, track, dt) {
  const target = pointOnTrack(angleOnTrack(kart.pos, track) + 0.5, track, kart.lane);
  const to = target.sub(kart.pos).normalize();
  const desiredYaw = yawFromForward(to);
  const delta = Math.atan2(Math.sin(desiredYaw - kart.yaw), Math.cos(desiredYaw - kart.yaw));
  let targetSpeed = 12.5 + Math.abs(kart.lane) * 0.8 - kart.damage * 0.35;

  for (const other of all) {
    if (other === kart) continue;
    const ahead = other.pos.clone().sub(kart.pos);
    if (ahead.length() < 4.4 && ahead.dot(forwardFromYaw(kart.yaw)) > 0) targetSpeed *= 0.62;
  }

  kart.speed = lerp(kart.speed, targetSpeed, 1 - Math.exp(-1.8 * dt));
  kart.steer = lerp(kart.steer, clamp(delta * 1.4, -1, 1), 1 - Math.exp(-5.5 * dt));
  kart.yaw += delta * (1 - Math.exp(-2.7 * dt));
  applyCrashDamping(kart, dt);
  kart.pos.addScaledVector(forwardFromYaw(kart.yaw), kart.speed * dt);
  kart.group.position.copy(kart.pos);
  kart.group.rotation.y = kart.yaw;
  kart.mixer?.update(dt);
  updateCheckpoint(kart, track);
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
      strongest = Math.max(strongest, impact);

      a.group.position.copy(a.pos);
      b.group.position.copy(b.pos);
      a.group.rotation.z = Math.sin(a.crashT * 30) * 0.08;
      b.group.rotation.z = -Math.sin(b.crashT * 30) * 0.08;
    }
  }
  return strongest;
}



const GO_CRAZY_PARKED_CONFIG = Object.freeze({
  HELICOPTER: { targetLength: 5.8, lift: 0.35, laneOffset: 10.4, bank: 0.05, spin: 0.3, hoverAmp: 0.09, hoverSpeed: 2.2, pulse: 0.9, bubbleColor: 0x9ef4ff },
  JET: { targetLength: 6.2, lift: 0.28, laneOffset: -10.6, bank: 0.08, spin: 0.12, hoverAmp: 0.03, hoverSpeed: 1.6, pulse: 0.8, bubbleColor: 0xc0d4ff },
  TRUCK: { targetLength: 5.9, lift: 0.24, laneOffset: 10.8, bank: 0.03, spin: 0.08, hoverAmp: 0.02, hoverSpeed: 1.2, pulse: 0.5, bubbleColor: 0xffc297 },
  DRONE: { targetLength: 4.2, lift: 0.42, laneOffset: -10.9, bank: 0.06, spin: 0.65, hoverAmp: 0.12, hoverSpeed: 2.8, pulse: 1.15, bubbleColor: 0x94ffd8 },
  TOWER: { targetLength: 5.4, lift: 0.21, laneOffset: 11.1, bank: 0.02, spin: 0.04, hoverAmp: 0.01, hoverSpeed: 0.9, pulse: 0.45, bubbleColor: 0xc5ff9e },
  MISSILE: { targetLength: 5.5, lift: 0.3, laneOffset: -10.2, bank: 0.03, spin: 0.15, hoverAmp: 0.05, hoverSpeed: 1.9, pulse: 0.85, bubbleColor: 0xffa786 }
});

const GO_CRAZY_PICKUP_CONFIG = Object.freeze({
  FIREARM: { targetLength: 1.35, lift: 0.08, yaw: 0, baseY: 1.03, bubbleScale: 1.02, bob: 0.09, glow: 0.2, lane: 0.8 },
  RIFLE: { targetLength: 1.55, lift: 0.08, yaw: Math.PI * 0.5, baseY: 1.08, bubbleScale: 1.08, bob: 0.1, glow: 0.23, lane: -0.82 },
  MISSILE: { targetLength: 1.72, lift: 0.1, yaw: 0, baseY: 1.12, bubbleScale: 1.11, bob: 0.12, glow: 0.26, lane: 0.9 },
  DRONE: { targetLength: 1.48, lift: 0.09, yaw: 0, baseY: 1.16, bubbleScale: 1.16, bob: 0.13, glow: 0.24, lane: -0.94 },
  HELICOPTER: { targetLength: 1.62, lift: 0.1, yaw: 0, baseY: 1.2, bubbleScale: 1.18, bob: 0.14, glow: 0.24, lane: 0.95 },
  JET: { targetLength: 1.66, lift: 0.1, yaw: 0, baseY: 1.24, bubbleScale: 1.2, bob: 0.15, glow: 0.26, lane: -0.98 },
  TRUCK: { targetLength: 1.8, lift: 0.09, yaw: 0, baseY: 1.1, bubbleScale: 1.12, bob: 0.1, glow: 0.21, lane: 0.86 },
  TOWER: { targetLength: 1.95, lift: 0.1, yaw: 0, baseY: 1.1, bubbleScale: 1.09, bob: 0.09, glow: 0.19, lane: -0.86 }
});

const GO_CRAZY_LAYOUT_TUNING = Object.freeze([
  { id: 'slot_001', angleMul: 1/240, lane: -0.68, lift: 0.03, scale: 0.82, tint: 0x33748e },
  { id: 'slot_002', angleMul: 2/240, lane: 0.76, lift: 0.04, scale: 0.89, tint: 0x33a4c7 },
  { id: 'slot_003', angleMul: 3/240, lane: -0.84, lift: 0.05, scale: 0.96, tint: 0x33d500 },
  { id: 'slot_004', angleMul: 4/240, lane: 0.92, lift: 0.06, scale: 1.03, tint: 0x340539 },
  { id: 'slot_005', angleMul: 5/240, lane: -0.60, lift: 0.07, scale: 1.10, tint: 0x343572 },
  { id: 'slot_006', angleMul: 6/240, lane: 0.68, lift: 0.08, scale: 0.75, tint: 0x3465ab },
  { id: 'slot_007', angleMul: 7/240, lane: -0.76, lift: 0.02, scale: 0.82, tint: 0x3495e4 },
  { id: 'slot_008', angleMul: 8/240, lane: 0.84, lift: 0.03, scale: 0.89, tint: 0x34c61d },
  { id: 'slot_009', angleMul: 9/240, lane: -0.92, lift: 0.04, scale: 0.96, tint: 0x34f656 },
  { id: 'slot_010', angleMul: 10/240, lane: 0.60, lift: 0.05, scale: 1.03, tint: 0x35268f },
  { id: 'slot_011', angleMul: 11/240, lane: -0.68, lift: 0.06, scale: 1.10, tint: 0x3556c8 },
  { id: 'slot_012', angleMul: 12/240, lane: 0.76, lift: 0.07, scale: 0.75, tint: 0x358701 },
  { id: 'slot_013', angleMul: 13/240, lane: -0.84, lift: 0.08, scale: 0.82, tint: 0x35b73a },
  { id: 'slot_014', angleMul: 14/240, lane: 0.92, lift: 0.02, scale: 0.89, tint: 0x35e773 },
  { id: 'slot_015', angleMul: 15/240, lane: -0.60, lift: 0.03, scale: 0.96, tint: 0x3617ac },
  { id: 'slot_016', angleMul: 16/240, lane: 0.68, lift: 0.04, scale: 1.03, tint: 0x3647e5 },
  { id: 'slot_017', angleMul: 17/240, lane: -0.76, lift: 0.05, scale: 1.10, tint: 0x36781e },
  { id: 'slot_018', angleMul: 18/240, lane: 0.84, lift: 0.06, scale: 0.75, tint: 0x36a857 },
  { id: 'slot_019', angleMul: 19/240, lane: -0.92, lift: 0.07, scale: 0.82, tint: 0x36d890 },
  { id: 'slot_020', angleMul: 20/240, lane: 0.60, lift: 0.08, scale: 0.89, tint: 0x3708c9 },
  { id: 'slot_021', angleMul: 21/240, lane: -0.68, lift: 0.02, scale: 0.96, tint: 0x373902 },
  { id: 'slot_022', angleMul: 22/240, lane: 0.76, lift: 0.03, scale: 1.03, tint: 0x37693b },
  { id: 'slot_023', angleMul: 23/240, lane: -0.84, lift: 0.04, scale: 1.10, tint: 0x379974 },
  { id: 'slot_024', angleMul: 24/240, lane: 0.92, lift: 0.05, scale: 0.75, tint: 0x37c9ad },
  { id: 'slot_025', angleMul: 25/240, lane: -0.60, lift: 0.06, scale: 0.82, tint: 0x37f9e6 },
  { id: 'slot_026', angleMul: 26/240, lane: 0.68, lift: 0.07, scale: 0.89, tint: 0x382a1f },
  { id: 'slot_027', angleMul: 27/240, lane: -0.76, lift: 0.08, scale: 0.96, tint: 0x385a58 },
  { id: 'slot_028', angleMul: 28/240, lane: 0.84, lift: 0.02, scale: 1.03, tint: 0x388a91 },
  { id: 'slot_029', angleMul: 29/240, lane: -0.92, lift: 0.03, scale: 1.10, tint: 0x38baca },
  { id: 'slot_030', angleMul: 30/240, lane: 0.60, lift: 0.04, scale: 0.75, tint: 0x38eb03 },
  { id: 'slot_031', angleMul: 31/240, lane: -0.68, lift: 0.05, scale: 0.82, tint: 0x391b3c },
  { id: 'slot_032', angleMul: 32/240, lane: 0.76, lift: 0.06, scale: 0.89, tint: 0x394b75 },
  { id: 'slot_033', angleMul: 33/240, lane: -0.84, lift: 0.07, scale: 0.96, tint: 0x397bae },
  { id: 'slot_034', angleMul: 34/240, lane: 0.92, lift: 0.08, scale: 1.03, tint: 0x39abe7 },
  { id: 'slot_035', angleMul: 35/240, lane: -0.60, lift: 0.02, scale: 1.10, tint: 0x39dc20 },
  { id: 'slot_036', angleMul: 36/240, lane: 0.68, lift: 0.03, scale: 0.75, tint: 0x3a0c59 },
  { id: 'slot_037', angleMul: 37/240, lane: -0.76, lift: 0.04, scale: 0.82, tint: 0x3a3c92 },
  { id: 'slot_038', angleMul: 38/240, lane: 0.84, lift: 0.05, scale: 0.89, tint: 0x3a6ccb },
  { id: 'slot_039', angleMul: 39/240, lane: -0.92, lift: 0.06, scale: 0.96, tint: 0x3a9d04 },
  { id: 'slot_040', angleMul: 40/240, lane: 0.60, lift: 0.07, scale: 1.03, tint: 0x3acd3d },
  { id: 'slot_041', angleMul: 41/240, lane: -0.68, lift: 0.08, scale: 1.10, tint: 0x3afd76 },
  { id: 'slot_042', angleMul: 42/240, lane: 0.76, lift: 0.02, scale: 0.75, tint: 0x3b2daf },
  { id: 'slot_043', angleMul: 43/240, lane: -0.84, lift: 0.03, scale: 0.82, tint: 0x3b5de8 },
  { id: 'slot_044', angleMul: 44/240, lane: 0.92, lift: 0.04, scale: 0.89, tint: 0x3b8e21 },
  { id: 'slot_045', angleMul: 45/240, lane: -0.60, lift: 0.05, scale: 0.96, tint: 0x3bbe5a },
  { id: 'slot_046', angleMul: 46/240, lane: 0.68, lift: 0.06, scale: 1.03, tint: 0x3bee93 },
  { id: 'slot_047', angleMul: 47/240, lane: -0.76, lift: 0.07, scale: 1.10, tint: 0x3c1ecc },
  { id: 'slot_048', angleMul: 48/240, lane: 0.84, lift: 0.08, scale: 0.75, tint: 0x3c4f05 },
  { id: 'slot_049', angleMul: 49/240, lane: -0.92, lift: 0.02, scale: 0.82, tint: 0x3c7f3e },
  { id: 'slot_050', angleMul: 50/240, lane: 0.60, lift: 0.03, scale: 0.89, tint: 0x3caf77 },
  { id: 'slot_051', angleMul: 51/240, lane: -0.68, lift: 0.04, scale: 0.96, tint: 0x3cdfb0 },
  { id: 'slot_052', angleMul: 52/240, lane: 0.76, lift: 0.05, scale: 1.03, tint: 0x3d0fe9 },
  { id: 'slot_053', angleMul: 53/240, lane: -0.84, lift: 0.06, scale: 1.10, tint: 0x3d4022 },
  { id: 'slot_054', angleMul: 54/240, lane: 0.92, lift: 0.07, scale: 0.75, tint: 0x3d705b },
  { id: 'slot_055', angleMul: 55/240, lane: -0.60, lift: 0.08, scale: 0.82, tint: 0x3da094 },
  { id: 'slot_056', angleMul: 56/240, lane: 0.68, lift: 0.02, scale: 0.89, tint: 0x3dd0cd },
  { id: 'slot_057', angleMul: 57/240, lane: -0.76, lift: 0.03, scale: 0.96, tint: 0x3e0106 },
  { id: 'slot_058', angleMul: 58/240, lane: 0.84, lift: 0.04, scale: 1.03, tint: 0x3e313f },
  { id: 'slot_059', angleMul: 59/240, lane: -0.92, lift: 0.05, scale: 1.10, tint: 0x3e6178 },
  { id: 'slot_060', angleMul: 60/240, lane: 0.60, lift: 0.06, scale: 0.75, tint: 0x3e91b1 },
  { id: 'slot_061', angleMul: 61/240, lane: -0.68, lift: 0.07, scale: 0.82, tint: 0x3ec1ea },
  { id: 'slot_062', angleMul: 62/240, lane: 0.76, lift: 0.08, scale: 0.89, tint: 0x3ef223 },
  { id: 'slot_063', angleMul: 63/240, lane: -0.84, lift: 0.02, scale: 0.96, tint: 0x3f225c },
  { id: 'slot_064', angleMul: 64/240, lane: 0.92, lift: 0.03, scale: 1.03, tint: 0x3f5295 },
  { id: 'slot_065', angleMul: 65/240, lane: -0.60, lift: 0.04, scale: 1.10, tint: 0x3f82ce },
  { id: 'slot_066', angleMul: 66/240, lane: 0.68, lift: 0.05, scale: 0.75, tint: 0x3fb307 },
  { id: 'slot_067', angleMul: 67/240, lane: -0.76, lift: 0.06, scale: 0.82, tint: 0x3fe340 },
  { id: 'slot_068', angleMul: 68/240, lane: 0.84, lift: 0.07, scale: 0.89, tint: 0x401379 },
  { id: 'slot_069', angleMul: 69/240, lane: -0.92, lift: 0.08, scale: 0.96, tint: 0x4043b2 },
  { id: 'slot_070', angleMul: 70/240, lane: 0.60, lift: 0.02, scale: 1.03, tint: 0x4073eb },
  { id: 'slot_071', angleMul: 71/240, lane: -0.68, lift: 0.03, scale: 1.10, tint: 0x40a424 },
  { id: 'slot_072', angleMul: 72/240, lane: 0.76, lift: 0.04, scale: 0.75, tint: 0x40d45d },
  { id: 'slot_073', angleMul: 73/240, lane: -0.84, lift: 0.05, scale: 0.82, tint: 0x410496 },
  { id: 'slot_074', angleMul: 74/240, lane: 0.92, lift: 0.06, scale: 0.89, tint: 0x4134cf },
  { id: 'slot_075', angleMul: 75/240, lane: -0.60, lift: 0.07, scale: 0.96, tint: 0x416508 },
  { id: 'slot_076', angleMul: 76/240, lane: 0.68, lift: 0.08, scale: 1.03, tint: 0x419541 },
  { id: 'slot_077', angleMul: 77/240, lane: -0.76, lift: 0.02, scale: 1.10, tint: 0x41c57a },
  { id: 'slot_078', angleMul: 78/240, lane: 0.84, lift: 0.03, scale: 0.75, tint: 0x41f5b3 },
  { id: 'slot_079', angleMul: 79/240, lane: -0.92, lift: 0.04, scale: 0.82, tint: 0x4225ec },
  { id: 'slot_080', angleMul: 80/240, lane: 0.60, lift: 0.05, scale: 0.89, tint: 0x425625 },
  { id: 'slot_081', angleMul: 81/240, lane: -0.68, lift: 0.06, scale: 0.96, tint: 0x42865e },
  { id: 'slot_082', angleMul: 82/240, lane: 0.76, lift: 0.07, scale: 1.03, tint: 0x42b697 },
  { id: 'slot_083', angleMul: 83/240, lane: -0.84, lift: 0.08, scale: 1.10, tint: 0x42e6d0 },
  { id: 'slot_084', angleMul: 84/240, lane: 0.92, lift: 0.02, scale: 0.75, tint: 0x431709 },
  { id: 'slot_085', angleMul: 85/240, lane: -0.60, lift: 0.03, scale: 0.82, tint: 0x434742 },
  { id: 'slot_086', angleMul: 86/240, lane: 0.68, lift: 0.04, scale: 0.89, tint: 0x43777b },
  { id: 'slot_087', angleMul: 87/240, lane: -0.76, lift: 0.05, scale: 0.96, tint: 0x43a7b4 },
  { id: 'slot_088', angleMul: 88/240, lane: 0.84, lift: 0.06, scale: 1.03, tint: 0x43d7ed },
  { id: 'slot_089', angleMul: 89/240, lane: -0.92, lift: 0.07, scale: 1.10, tint: 0x440826 },
  { id: 'slot_090', angleMul: 90/240, lane: 0.60, lift: 0.08, scale: 0.75, tint: 0x44385f },
  { id: 'slot_091', angleMul: 91/240, lane: -0.68, lift: 0.02, scale: 0.82, tint: 0x446898 },
  { id: 'slot_092', angleMul: 92/240, lane: 0.76, lift: 0.03, scale: 0.89, tint: 0x4498d1 },
  { id: 'slot_093', angleMul: 93/240, lane: -0.84, lift: 0.04, scale: 0.96, tint: 0x44c90a },
  { id: 'slot_094', angleMul: 94/240, lane: 0.92, lift: 0.05, scale: 1.03, tint: 0x44f943 },
  { id: 'slot_095', angleMul: 95/240, lane: -0.60, lift: 0.06, scale: 1.10, tint: 0x45297c },
  { id: 'slot_096', angleMul: 96/240, lane: 0.68, lift: 0.07, scale: 0.75, tint: 0x4559b5 },
  { id: 'slot_097', angleMul: 97/240, lane: -0.76, lift: 0.08, scale: 0.82, tint: 0x4589ee },
  { id: 'slot_098', angleMul: 98/240, lane: 0.84, lift: 0.02, scale: 0.89, tint: 0x45ba27 },
  { id: 'slot_099', angleMul: 99/240, lane: -0.92, lift: 0.03, scale: 0.96, tint: 0x45ea60 },
  { id: 'slot_100', angleMul: 100/240, lane: 0.60, lift: 0.04, scale: 1.03, tint: 0x461a99 },
  { id: 'slot_101', angleMul: 101/240, lane: -0.68, lift: 0.05, scale: 1.10, tint: 0x464ad2 },
  { id: 'slot_102', angleMul: 102/240, lane: 0.76, lift: 0.06, scale: 0.75, tint: 0x467b0b },
  { id: 'slot_103', angleMul: 103/240, lane: -0.84, lift: 0.07, scale: 0.82, tint: 0x46ab44 },
  { id: 'slot_104', angleMul: 104/240, lane: 0.92, lift: 0.08, scale: 0.89, tint: 0x46db7d },
  { id: 'slot_105', angleMul: 105/240, lane: -0.60, lift: 0.02, scale: 0.96, tint: 0x470bb6 },
  { id: 'slot_106', angleMul: 106/240, lane: 0.68, lift: 0.03, scale: 1.03, tint: 0x473bef },
  { id: 'slot_107', angleMul: 107/240, lane: -0.76, lift: 0.04, scale: 1.10, tint: 0x476c28 },
  { id: 'slot_108', angleMul: 108/240, lane: 0.84, lift: 0.05, scale: 0.75, tint: 0x479c61 },
  { id: 'slot_109', angleMul: 109/240, lane: -0.92, lift: 0.06, scale: 0.82, tint: 0x47cc9a },
  { id: 'slot_110', angleMul: 110/240, lane: 0.60, lift: 0.07, scale: 0.89, tint: 0x47fcd3 },
  { id: 'slot_111', angleMul: 111/240, lane: -0.68, lift: 0.08, scale: 0.96, tint: 0x482d0c },
  { id: 'slot_112', angleMul: 112/240, lane: 0.76, lift: 0.02, scale: 1.03, tint: 0x485d45 },
  { id: 'slot_113', angleMul: 113/240, lane: -0.84, lift: 0.03, scale: 1.10, tint: 0x488d7e },
  { id: 'slot_114', angleMul: 114/240, lane: 0.92, lift: 0.04, scale: 0.75, tint: 0x48bdb7 },
  { id: 'slot_115', angleMul: 115/240, lane: -0.60, lift: 0.05, scale: 0.82, tint: 0x48edf0 },
  { id: 'slot_116', angleMul: 116/240, lane: 0.68, lift: 0.06, scale: 0.89, tint: 0x491e29 },
  { id: 'slot_117', angleMul: 117/240, lane: -0.76, lift: 0.07, scale: 0.96, tint: 0x494e62 },
  { id: 'slot_118', angleMul: 118/240, lane: 0.84, lift: 0.08, scale: 1.03, tint: 0x497e9b },
  { id: 'slot_119', angleMul: 119/240, lane: -0.92, lift: 0.02, scale: 1.10, tint: 0x49aed4 },
  { id: 'slot_120', angleMul: 120/240, lane: 0.60, lift: 0.03, scale: 0.75, tint: 0x49df0d },
  { id: 'slot_121', angleMul: 121/240, lane: -0.68, lift: 0.04, scale: 0.82, tint: 0x4a0f46 },
  { id: 'slot_122', angleMul: 122/240, lane: 0.76, lift: 0.05, scale: 0.89, tint: 0x4a3f7f },
  { id: 'slot_123', angleMul: 123/240, lane: -0.84, lift: 0.06, scale: 0.96, tint: 0x4a6fb8 },
  { id: 'slot_124', angleMul: 124/240, lane: 0.92, lift: 0.07, scale: 1.03, tint: 0x4a9ff1 },
  { id: 'slot_125', angleMul: 125/240, lane: -0.60, lift: 0.08, scale: 1.10, tint: 0x4ad02a },
  { id: 'slot_126', angleMul: 126/240, lane: 0.68, lift: 0.02, scale: 0.75, tint: 0x4b0063 },
  { id: 'slot_127', angleMul: 127/240, lane: -0.76, lift: 0.03, scale: 0.82, tint: 0x4b309c },
  { id: 'slot_128', angleMul: 128/240, lane: 0.84, lift: 0.04, scale: 0.89, tint: 0x4b60d5 },
  { id: 'slot_129', angleMul: 129/240, lane: -0.92, lift: 0.05, scale: 0.96, tint: 0x4b910e },
  { id: 'slot_130', angleMul: 130/240, lane: 0.60, lift: 0.06, scale: 1.03, tint: 0x4bc147 },
  { id: 'slot_131', angleMul: 131/240, lane: -0.68, lift: 0.07, scale: 1.10, tint: 0x4bf180 },
  { id: 'slot_132', angleMul: 132/240, lane: 0.76, lift: 0.08, scale: 0.75, tint: 0x4c21b9 },
  { id: 'slot_133', angleMul: 133/240, lane: -0.84, lift: 0.02, scale: 0.82, tint: 0x4c51f2 },
  { id: 'slot_134', angleMul: 134/240, lane: 0.92, lift: 0.03, scale: 0.89, tint: 0x4c822b },
  { id: 'slot_135', angleMul: 135/240, lane: -0.60, lift: 0.04, scale: 0.96, tint: 0x4cb264 },
  { id: 'slot_136', angleMul: 136/240, lane: 0.68, lift: 0.05, scale: 1.03, tint: 0x4ce29d },
  { id: 'slot_137', angleMul: 137/240, lane: -0.76, lift: 0.06, scale: 1.10, tint: 0x4d12d6 },
  { id: 'slot_138', angleMul: 138/240, lane: 0.84, lift: 0.07, scale: 0.75, tint: 0x4d430f },
  { id: 'slot_139', angleMul: 139/240, lane: -0.92, lift: 0.08, scale: 0.82, tint: 0x4d7348 },
  { id: 'slot_140', angleMul: 140/240, lane: 0.60, lift: 0.02, scale: 0.89, tint: 0x4da381 },
  { id: 'slot_141', angleMul: 141/240, lane: -0.68, lift: 0.03, scale: 0.96, tint: 0x4dd3ba },
  { id: 'slot_142', angleMul: 142/240, lane: 0.76, lift: 0.04, scale: 1.03, tint: 0x4e03f3 },
  { id: 'slot_143', angleMul: 143/240, lane: -0.84, lift: 0.05, scale: 1.10, tint: 0x4e342c },
  { id: 'slot_144', angleMul: 144/240, lane: 0.92, lift: 0.06, scale: 0.75, tint: 0x4e6465 },
  { id: 'slot_145', angleMul: 145/240, lane: -0.60, lift: 0.07, scale: 0.82, tint: 0x4e949e },
  { id: 'slot_146', angleMul: 146/240, lane: 0.68, lift: 0.08, scale: 0.89, tint: 0x4ec4d7 },
  { id: 'slot_147', angleMul: 147/240, lane: -0.76, lift: 0.02, scale: 0.96, tint: 0x4ef510 },
  { id: 'slot_148', angleMul: 148/240, lane: 0.84, lift: 0.03, scale: 1.03, tint: 0x4f2549 },
  { id: 'slot_149', angleMul: 149/240, lane: -0.92, lift: 0.04, scale: 1.10, tint: 0x4f5582 },
  { id: 'slot_150', angleMul: 150/240, lane: 0.60, lift: 0.05, scale: 0.75, tint: 0x4f85bb },
  { id: 'slot_151', angleMul: 151/240, lane: -0.68, lift: 0.06, scale: 0.82, tint: 0x4fb5f4 },
  { id: 'slot_152', angleMul: 152/240, lane: 0.76, lift: 0.07, scale: 0.89, tint: 0x4fe62d },
  { id: 'slot_153', angleMul: 153/240, lane: -0.84, lift: 0.08, scale: 0.96, tint: 0x501666 },
  { id: 'slot_154', angleMul: 154/240, lane: 0.92, lift: 0.02, scale: 1.03, tint: 0x50469f },
  { id: 'slot_155', angleMul: 155/240, lane: -0.60, lift: 0.03, scale: 1.10, tint: 0x5076d8 },
  { id: 'slot_156', angleMul: 156/240, lane: 0.68, lift: 0.04, scale: 0.75, tint: 0x50a711 },
  { id: 'slot_157', angleMul: 157/240, lane: -0.76, lift: 0.05, scale: 0.82, tint: 0x50d74a },
  { id: 'slot_158', angleMul: 158/240, lane: 0.84, lift: 0.06, scale: 0.89, tint: 0x510783 },
  { id: 'slot_159', angleMul: 159/240, lane: -0.92, lift: 0.07, scale: 0.96, tint: 0x5137bc },
  { id: 'slot_160', angleMul: 160/240, lane: 0.60, lift: 0.08, scale: 1.03, tint: 0x5167f5 },
  { id: 'slot_161', angleMul: 161/240, lane: -0.68, lift: 0.02, scale: 1.10, tint: 0x51982e },
  { id: 'slot_162', angleMul: 162/240, lane: 0.76, lift: 0.03, scale: 0.75, tint: 0x51c867 },
  { id: 'slot_163', angleMul: 163/240, lane: -0.84, lift: 0.04, scale: 0.82, tint: 0x51f8a0 },
  { id: 'slot_164', angleMul: 164/240, lane: 0.92, lift: 0.05, scale: 0.89, tint: 0x5228d9 },
  { id: 'slot_165', angleMul: 165/240, lane: -0.60, lift: 0.06, scale: 0.96, tint: 0x525912 },
  { id: 'slot_166', angleMul: 166/240, lane: 0.68, lift: 0.07, scale: 1.03, tint: 0x52894b },
  { id: 'slot_167', angleMul: 167/240, lane: -0.76, lift: 0.08, scale: 1.10, tint: 0x52b984 },
  { id: 'slot_168', angleMul: 168/240, lane: 0.84, lift: 0.02, scale: 0.75, tint: 0x52e9bd },
  { id: 'slot_169', angleMul: 169/240, lane: -0.92, lift: 0.03, scale: 0.82, tint: 0x5319f6 },
  { id: 'slot_170', angleMul: 170/240, lane: 0.60, lift: 0.04, scale: 0.89, tint: 0x534a2f },
  { id: 'slot_171', angleMul: 171/240, lane: -0.68, lift: 0.05, scale: 0.96, tint: 0x537a68 },
  { id: 'slot_172', angleMul: 172/240, lane: 0.76, lift: 0.06, scale: 1.03, tint: 0x53aaa1 },
  { id: 'slot_173', angleMul: 173/240, lane: -0.84, lift: 0.07, scale: 1.10, tint: 0x53dada },
  { id: 'slot_174', angleMul: 174/240, lane: 0.92, lift: 0.08, scale: 0.75, tint: 0x540b13 },
  { id: 'slot_175', angleMul: 175/240, lane: -0.60, lift: 0.02, scale: 0.82, tint: 0x543b4c },
  { id: 'slot_176', angleMul: 176/240, lane: 0.68, lift: 0.03, scale: 0.89, tint: 0x546b85 },
  { id: 'slot_177', angleMul: 177/240, lane: -0.76, lift: 0.04, scale: 0.96, tint: 0x549bbe },
  { id: 'slot_178', angleMul: 178/240, lane: 0.84, lift: 0.05, scale: 1.03, tint: 0x54cbf7 },
  { id: 'slot_179', angleMul: 179/240, lane: -0.92, lift: 0.06, scale: 1.10, tint: 0x54fc30 },
  { id: 'slot_180', angleMul: 180/240, lane: 0.60, lift: 0.07, scale: 0.75, tint: 0x552c69 },
  { id: 'slot_181', angleMul: 181/240, lane: -0.68, lift: 0.08, scale: 0.82, tint: 0x555ca2 },
  { id: 'slot_182', angleMul: 182/240, lane: 0.76, lift: 0.02, scale: 0.89, tint: 0x558cdb },
  { id: 'slot_183', angleMul: 183/240, lane: -0.84, lift: 0.03, scale: 0.96, tint: 0x55bd14 },
  { id: 'slot_184', angleMul: 184/240, lane: 0.92, lift: 0.04, scale: 1.03, tint: 0x55ed4d },
  { id: 'slot_185', angleMul: 185/240, lane: -0.60, lift: 0.05, scale: 1.10, tint: 0x561d86 },
  { id: 'slot_186', angleMul: 186/240, lane: 0.68, lift: 0.06, scale: 0.75, tint: 0x564dbf },
  { id: 'slot_187', angleMul: 187/240, lane: -0.76, lift: 0.07, scale: 0.82, tint: 0x567df8 },
  { id: 'slot_188', angleMul: 188/240, lane: 0.84, lift: 0.08, scale: 0.89, tint: 0x56ae31 },
  { id: 'slot_189', angleMul: 189/240, lane: -0.92, lift: 0.02, scale: 0.96, tint: 0x56de6a },
  { id: 'slot_190', angleMul: 190/240, lane: 0.60, lift: 0.03, scale: 1.03, tint: 0x570ea3 },
  { id: 'slot_191', angleMul: 191/240, lane: -0.68, lift: 0.04, scale: 1.10, tint: 0x573edc },
  { id: 'slot_192', angleMul: 192/240, lane: 0.76, lift: 0.05, scale: 0.75, tint: 0x576f15 },
  { id: 'slot_193', angleMul: 193/240, lane: -0.84, lift: 0.06, scale: 0.82, tint: 0x579f4e },
  { id: 'slot_194', angleMul: 194/240, lane: 0.92, lift: 0.07, scale: 0.89, tint: 0x57cf87 },
  { id: 'slot_195', angleMul: 195/240, lane: -0.60, lift: 0.08, scale: 0.96, tint: 0x57ffc0 },
  { id: 'slot_196', angleMul: 196/240, lane: 0.68, lift: 0.02, scale: 1.03, tint: 0x582ff9 },
  { id: 'slot_197', angleMul: 197/240, lane: -0.76, lift: 0.03, scale: 1.10, tint: 0x586032 },
  { id: 'slot_198', angleMul: 198/240, lane: 0.84, lift: 0.04, scale: 0.75, tint: 0x58906b },
  { id: 'slot_199', angleMul: 199/240, lane: -0.92, lift: 0.05, scale: 0.82, tint: 0x58c0a4 },
  { id: 'slot_200', angleMul: 200/240, lane: 0.60, lift: 0.06, scale: 0.89, tint: 0x58f0dd },
  { id: 'slot_201', angleMul: 201/240, lane: -0.68, lift: 0.07, scale: 0.96, tint: 0x592116 },
  { id: 'slot_202', angleMul: 202/240, lane: 0.76, lift: 0.08, scale: 1.03, tint: 0x59514f },
  { id: 'slot_203', angleMul: 203/240, lane: -0.84, lift: 0.02, scale: 1.10, tint: 0x598188 },
  { id: 'slot_204', angleMul: 204/240, lane: 0.92, lift: 0.03, scale: 0.75, tint: 0x59b1c1 },
  { id: 'slot_205', angleMul: 205/240, lane: -0.60, lift: 0.04, scale: 0.82, tint: 0x59e1fa },
  { id: 'slot_206', angleMul: 206/240, lane: 0.68, lift: 0.05, scale: 0.89, tint: 0x5a1233 },
  { id: 'slot_207', angleMul: 207/240, lane: -0.76, lift: 0.06, scale: 0.96, tint: 0x5a426c },
  { id: 'slot_208', angleMul: 208/240, lane: 0.84, lift: 0.07, scale: 1.03, tint: 0x5a72a5 },
  { id: 'slot_209', angleMul: 209/240, lane: -0.92, lift: 0.08, scale: 1.10, tint: 0x5aa2de },
  { id: 'slot_210', angleMul: 210/240, lane: 0.60, lift: 0.02, scale: 0.75, tint: 0x5ad317 },
  { id: 'slot_211', angleMul: 211/240, lane: -0.68, lift: 0.03, scale: 0.82, tint: 0x5b0350 },
  { id: 'slot_212', angleMul: 212/240, lane: 0.76, lift: 0.04, scale: 0.89, tint: 0x5b3389 },
  { id: 'slot_213', angleMul: 213/240, lane: -0.84, lift: 0.05, scale: 0.96, tint: 0x5b63c2 },
  { id: 'slot_214', angleMul: 214/240, lane: 0.92, lift: 0.06, scale: 1.03, tint: 0x5b93fb },
  { id: 'slot_215', angleMul: 215/240, lane: -0.60, lift: 0.07, scale: 1.10, tint: 0x5bc434 },
  { id: 'slot_216', angleMul: 216/240, lane: 0.68, lift: 0.08, scale: 0.75, tint: 0x5bf46d },
  { id: 'slot_217', angleMul: 217/240, lane: -0.76, lift: 0.02, scale: 0.82, tint: 0x5c24a6 },
  { id: 'slot_218', angleMul: 218/240, lane: 0.84, lift: 0.03, scale: 0.89, tint: 0x5c54df },
  { id: 'slot_219', angleMul: 219/240, lane: -0.92, lift: 0.04, scale: 0.96, tint: 0x5c8518 },
  { id: 'slot_220', angleMul: 220/240, lane: 0.60, lift: 0.05, scale: 1.03, tint: 0x5cb551 },
  { id: 'slot_221', angleMul: 221/240, lane: -0.68, lift: 0.06, scale: 1.10, tint: 0x5ce58a },
  { id: 'slot_222', angleMul: 222/240, lane: 0.76, lift: 0.07, scale: 0.75, tint: 0x5d15c3 },
  { id: 'slot_223', angleMul: 223/240, lane: -0.84, lift: 0.08, scale: 0.82, tint: 0x5d45fc },
  { id: 'slot_224', angleMul: 224/240, lane: 0.92, lift: 0.02, scale: 0.89, tint: 0x5d7635 },
  { id: 'slot_225', angleMul: 225/240, lane: -0.60, lift: 0.03, scale: 0.96, tint: 0x5da66e },
  { id: 'slot_226', angleMul: 226/240, lane: 0.68, lift: 0.04, scale: 1.03, tint: 0x5dd6a7 },
  { id: 'slot_227', angleMul: 227/240, lane: -0.76, lift: 0.05, scale: 1.10, tint: 0x5e06e0 },
  { id: 'slot_228', angleMul: 228/240, lane: 0.84, lift: 0.06, scale: 0.75, tint: 0x5e3719 },
  { id: 'slot_229', angleMul: 229/240, lane: -0.92, lift: 0.07, scale: 0.82, tint: 0x5e6752 },
  { id: 'slot_230', angleMul: 230/240, lane: 0.60, lift: 0.08, scale: 0.89, tint: 0x5e978b },
  { id: 'slot_231', angleMul: 231/240, lane: -0.68, lift: 0.02, scale: 0.96, tint: 0x5ec7c4 },
  { id: 'slot_232', angleMul: 232/240, lane: 0.76, lift: 0.03, scale: 1.03, tint: 0x5ef7fd },
  { id: 'slot_233', angleMul: 233/240, lane: -0.84, lift: 0.04, scale: 1.10, tint: 0x5f2836 },
  { id: 'slot_234', angleMul: 234/240, lane: 0.92, lift: 0.05, scale: 0.75, tint: 0x5f586f },
  { id: 'slot_235', angleMul: 235/240, lane: -0.60, lift: 0.06, scale: 0.82, tint: 0x5f88a8 },
  { id: 'slot_236', angleMul: 236/240, lane: 0.68, lift: 0.07, scale: 0.89, tint: 0x5fb8e1 },
  { id: 'slot_237', angleMul: 237/240, lane: -0.76, lift: 0.08, scale: 0.96, tint: 0x5fe91a },
  { id: 'slot_238', angleMul: 238/240, lane: 0.84, lift: 0.02, scale: 1.03, tint: 0x601953 },
  { id: 'slot_239', angleMul: 239/240, lane: -0.92, lift: 0.03, scale: 1.10, tint: 0x60498c },
  { id: 'slot_240', angleMul: 240/240, lane: 0.60, lift: 0.04, scale: 0.75, tint: 0x6079c5 },
]);

function spawnLayoutHelpers(scene, track) {
  const group = new THREE.Group();
  group.name = "goCrazyLayoutHelpers";
  GO_CRAZY_LAYOUT_TUNING.forEach((entry, idx) => {
    const a = entry.angleMul * TAU;
    const p = pointOnTrack(a, track, entry.lane);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.15 * entry.scale, 0.08 * entry.scale, 0.9 * entry.scale),
      new THREE.MeshStandardMaterial({ color: entry.tint, transparent: true, opacity: 0.45, roughness: 0.6, metalness: 0.05 })
    );
    marker.position.copy(p).add(new THREE.Vector3(0, entry.lift + 0.04, 0));
    marker.rotation.y = tangentYaw(a, track);
    marker.userData.phase = idx * 0.17;
    marker.userData.baseY = marker.position.y;
    const axis = new THREE.AxesHelper(0.22 * entry.scale);
    axis.position.copy(marker.position).add(new THREE.Vector3(0, 0.08, 0));
    group.add(marker, axis);
  });
  scene.add(group);
  return group;
}

function animateLayoutHelpers(group, now) {
  if (!group) return;
  group.children.forEach((child) => {
    if (!child.isMesh) return;
    const phase = child.userData.phase || 0;
    child.position.y = (child.userData.baseY || child.position.y) + Math.sin(now * 0.002 + phase) * 0.015;
  });
}

function applyOriginalTextureQuality(root) {
  root?.traverse?.((child) => {
    if (!child?.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.filter(Boolean).forEach((mat) => {
      if (mat.map) {
        mat.map.flipY = false;
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = 8;
        mat.map.needsUpdate = true;
      }
      if (mat.normalMap) mat.normalMap.needsUpdate = true;
      if (mat.roughnessMap) mat.roughnessMap.needsUpdate = true;
      if (mat.metalnessMap) mat.metalnessMap.needsUpdate = true;
      mat.needsUpdate = true;
    });
  });
  return root;
}

function makeGroundHelperBundle(node, color = 0x66ffee, axisScale = 1.1) {
  const root = new THREE.Group();
  const box = new THREE.Box3().setFromObject(node);
  const center = box.getCenter(new THREE.Vector3());
  const footY = box.min.y;
  const axis = new THREE.AxesHelper(axisScale);
  axis.position.set(center.x, footY, center.z);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(0.45, box.getSize(new THREE.Vector3()).x * 0.2), 0.03, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 })
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.set(center.x, footY + 0.02, center.z);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), new THREE.MeshBasicMaterial({ color }));
  marker.position.set(center.x, footY + 0.25, center.z);
  root.add(axis, ring, marker, new THREE.Box3Helper(box, color));
  return root;
}

function createRoadEdgeDecorations(scene, track) {
  const group = new THREE.Group();
  group.name = 'goCrazyRoadDecorations';
  const tireMat = makeMat(0x141414, 0.82, 0.16);
  const treadMat = makeMat(0x2f2f33, 0.75, 0.08);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const outer = pointOnTrack(a, track, 12.4);
    const inner = pointOnTrack(a, track, -12.4);
    [outer, inner].forEach((pt, idx) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.14, 12, 18), tireMat);
      tire.position.copy(pt).add(new THREE.Vector3(0, 0.28, 0));
      tire.rotation.x = Math.PI * 0.5;
      tire.rotation.z = (idx ? -1 : 1) * a * 0.66;
      const tread = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.55, 12), treadMat);
      tread.position.copy(pt).add(new THREE.Vector3(0, 0.09, 0));
      tread.rotation.z = Math.PI * 0.5;
      tread.rotation.y = tangentYaw(a, track) + (idx ? Math.PI * 0.5 : -Math.PI * 0.5);
      group.add(tire, tread);
    });
  }
  scene.add(group);
  return group;
}

const GO_CRAZY_PULSE_PROFILE = Object.freeze([
  { t: 0, y: 0.92, alpha: 0.20, scale: 0.85 },
  { t: 1, y: 0.93, alpha: 0.28, scale: 0.88 },
  { t: 2, y: 0.94, alpha: 0.36, scale: 0.91 },
  { t: 3, y: 0.95, alpha: 0.44, scale: 0.94 },
  { t: 4, y: 0.96, alpha: 0.52, scale: 0.97 },
  { t: 5, y: 0.97, alpha: 0.60, scale: 1.00 },
  { t: 6, y: 0.98, alpha: 0.68, scale: 1.03 },
  { t: 7, y: 0.99, alpha: 0.20, scale: 1.06 },
  { t: 8, y: 1.00, alpha: 0.28, scale: 1.09 },
  { t: 9, y: 0.92, alpha: 0.36, scale: 1.12 },
  { t: 10, y: 0.93, alpha: 0.44, scale: 1.15 },
  { t: 11, y: 0.94, alpha: 0.52, scale: 0.85 },
  { t: 12, y: 0.95, alpha: 0.60, scale: 0.88 },
  { t: 13, y: 0.96, alpha: 0.68, scale: 0.91 },
  { t: 14, y: 0.97, alpha: 0.20, scale: 0.94 },
  { t: 15, y: 0.98, alpha: 0.28, scale: 0.97 },
  { t: 16, y: 0.99, alpha: 0.36, scale: 1.00 },
  { t: 17, y: 1.00, alpha: 0.44, scale: 1.03 },
  { t: 18, y: 0.92, alpha: 0.52, scale: 1.06 },
  { t: 19, y: 0.93, alpha: 0.60, scale: 1.09 },
  { t: 20, y: 0.94, alpha: 0.68, scale: 1.12 },
  { t: 21, y: 0.95, alpha: 0.20, scale: 1.15 },
  { t: 22, y: 0.96, alpha: 0.28, scale: 0.85 },
  { t: 23, y: 0.97, alpha: 0.36, scale: 0.88 },
  { t: 24, y: 0.98, alpha: 0.44, scale: 0.91 },
  { t: 25, y: 0.99, alpha: 0.52, scale: 0.94 },
  { t: 26, y: 1.00, alpha: 0.60, scale: 0.97 },
  { t: 27, y: 0.92, alpha: 0.68, scale: 1.00 },
  { t: 28, y: 0.93, alpha: 0.20, scale: 1.03 },
  { t: 29, y: 0.94, alpha: 0.28, scale: 1.06 },
  { t: 30, y: 0.95, alpha: 0.36, scale: 1.09 },
  { t: 31, y: 0.96, alpha: 0.44, scale: 1.12 },
  { t: 32, y: 0.97, alpha: 0.52, scale: 1.15 },
  { t: 33, y: 0.98, alpha: 0.60, scale: 0.85 },
  { t: 34, y: 0.99, alpha: 0.68, scale: 0.88 },
  { t: 35, y: 1.00, alpha: 0.20, scale: 0.91 },
  { t: 36, y: 0.92, alpha: 0.28, scale: 0.94 },
  { t: 37, y: 0.93, alpha: 0.36, scale: 0.97 },
  { t: 38, y: 0.94, alpha: 0.44, scale: 1.00 },
  { t: 39, y: 0.95, alpha: 0.52, scale: 1.03 },
  { t: 40, y: 0.96, alpha: 0.60, scale: 1.06 },
  { t: 41, y: 0.97, alpha: 0.68, scale: 1.09 },
  { t: 42, y: 0.98, alpha: 0.20, scale: 1.12 },
  { t: 43, y: 0.99, alpha: 0.28, scale: 1.15 },
  { t: 44, y: 1.00, alpha: 0.36, scale: 0.85 },
  { t: 45, y: 0.92, alpha: 0.44, scale: 0.88 },
  { t: 46, y: 0.93, alpha: 0.52, scale: 0.91 },
  { t: 47, y: 0.94, alpha: 0.60, scale: 0.94 },
  { t: 48, y: 0.95, alpha: 0.68, scale: 0.97 },
  { t: 49, y: 0.96, alpha: 0.20, scale: 1.00 },
  { t: 50, y: 0.97, alpha: 0.28, scale: 1.03 },
  { t: 51, y: 0.98, alpha: 0.36, scale: 1.06 },
  { t: 52, y: 0.99, alpha: 0.44, scale: 1.09 },
  { t: 53, y: 1.00, alpha: 0.52, scale: 1.12 },
  { t: 54, y: 0.92, alpha: 0.60, scale: 1.15 },
  { t: 55, y: 0.93, alpha: 0.68, scale: 0.85 },
  { t: 56, y: 0.94, alpha: 0.20, scale: 0.88 },
  { t: 57, y: 0.95, alpha: 0.28, scale: 0.91 },
  { t: 58, y: 0.96, alpha: 0.36, scale: 0.94 },
  { t: 59, y: 0.97, alpha: 0.44, scale: 0.97 },
  { t: 60, y: 0.98, alpha: 0.52, scale: 1.00 },
  { t: 61, y: 0.99, alpha: 0.60, scale: 1.03 },
  { t: 62, y: 1.00, alpha: 0.68, scale: 1.06 },
  { t: 63, y: 0.92, alpha: 0.20, scale: 1.09 },
  { t: 64, y: 0.93, alpha: 0.28, scale: 1.12 },
  { t: 65, y: 0.94, alpha: 0.36, scale: 1.15 },
  { t: 66, y: 0.95, alpha: 0.44, scale: 0.85 },
  { t: 67, y: 0.96, alpha: 0.52, scale: 0.88 },
  { t: 68, y: 0.97, alpha: 0.60, scale: 0.91 },
  { t: 69, y: 0.98, alpha: 0.68, scale: 0.94 },
  { t: 70, y: 0.99, alpha: 0.20, scale: 0.97 },
  { t: 71, y: 1.00, alpha: 0.28, scale: 1.00 },
  { t: 72, y: 0.92, alpha: 0.36, scale: 1.03 },
  { t: 73, y: 0.93, alpha: 0.44, scale: 1.06 },
  { t: 74, y: 0.94, alpha: 0.52, scale: 1.09 },
  { t: 75, y: 0.95, alpha: 0.60, scale: 1.12 },
  { t: 76, y: 0.96, alpha: 0.68, scale: 1.15 },
  { t: 77, y: 0.97, alpha: 0.20, scale: 0.85 },
  { t: 78, y: 0.98, alpha: 0.28, scale: 0.88 },
  { t: 79, y: 0.99, alpha: 0.36, scale: 0.91 },
  { t: 80, y: 1.00, alpha: 0.44, scale: 0.94 },
  { t: 81, y: 0.92, alpha: 0.52, scale: 0.97 },
  { t: 82, y: 0.93, alpha: 0.60, scale: 1.00 },
  { t: 83, y: 0.94, alpha: 0.68, scale: 1.03 },
  { t: 84, y: 0.95, alpha: 0.20, scale: 1.06 },
  { t: 85, y: 0.96, alpha: 0.28, scale: 1.09 },
  { t: 86, y: 0.97, alpha: 0.36, scale: 1.12 },
  { t: 87, y: 0.98, alpha: 0.44, scale: 1.15 },
  { t: 88, y: 0.99, alpha: 0.52, scale: 0.85 },
  { t: 89, y: 1.00, alpha: 0.60, scale: 0.88 },
  { t: 90, y: 0.92, alpha: 0.68, scale: 0.91 },
  { t: 91, y: 0.93, alpha: 0.20, scale: 0.94 },
  { t: 92, y: 0.94, alpha: 0.28, scale: 0.97 },
  { t: 93, y: 0.95, alpha: 0.36, scale: 1.00 },
  { t: 94, y: 0.96, alpha: 0.44, scale: 1.03 },
  { t: 95, y: 0.97, alpha: 0.52, scale: 1.06 },
  { t: 96, y: 0.98, alpha: 0.60, scale: 1.09 },
  { t: 97, y: 0.99, alpha: 0.68, scale: 1.12 },
  { t: 98, y: 1.00, alpha: 0.20, scale: 1.15 },
  { t: 99, y: 0.92, alpha: 0.28, scale: 0.85 },
  { t: 100, y: 0.93, alpha: 0.36, scale: 0.88 },
  { t: 101, y: 0.94, alpha: 0.44, scale: 0.91 },
  { t: 102, y: 0.95, alpha: 0.52, scale: 0.94 },
  { t: 103, y: 0.96, alpha: 0.60, scale: 0.97 },
  { t: 104, y: 0.97, alpha: 0.68, scale: 1.00 },
  { t: 105, y: 0.98, alpha: 0.20, scale: 1.03 },
  { t: 106, y: 0.99, alpha: 0.28, scale: 1.06 },
  { t: 107, y: 1.00, alpha: 0.36, scale: 1.09 },
  { t: 108, y: 0.92, alpha: 0.44, scale: 1.12 },
  { t: 109, y: 0.93, alpha: 0.52, scale: 1.15 },
  { t: 110, y: 0.94, alpha: 0.60, scale: 0.85 },
  { t: 111, y: 0.95, alpha: 0.68, scale: 0.88 },
  { t: 112, y: 0.96, alpha: 0.20, scale: 0.91 },
  { t: 113, y: 0.97, alpha: 0.28, scale: 0.94 },
  { t: 114, y: 0.98, alpha: 0.36, scale: 0.97 },
  { t: 115, y: 0.99, alpha: 0.44, scale: 1.00 },
  { t: 116, y: 1.00, alpha: 0.52, scale: 1.03 },
  { t: 117, y: 0.92, alpha: 0.60, scale: 1.06 },
  { t: 118, y: 0.93, alpha: 0.68, scale: 1.09 },
  { t: 119, y: 0.94, alpha: 0.20, scale: 1.12 },
  { t: 120, y: 0.95, alpha: 0.28, scale: 1.15 },
  { t: 121, y: 0.96, alpha: 0.36, scale: 0.85 },
  { t: 122, y: 0.97, alpha: 0.44, scale: 0.88 },
  { t: 123, y: 0.98, alpha: 0.52, scale: 0.91 },
  { t: 124, y: 0.99, alpha: 0.60, scale: 0.94 },
  { t: 125, y: 1.00, alpha: 0.68, scale: 0.97 },
  { t: 126, y: 0.92, alpha: 0.20, scale: 1.00 },
  { t: 127, y: 0.93, alpha: 0.28, scale: 1.03 },
  { t: 128, y: 0.94, alpha: 0.36, scale: 1.06 },
  { t: 129, y: 0.95, alpha: 0.44, scale: 1.09 },
  { t: 130, y: 0.96, alpha: 0.52, scale: 1.12 },
  { t: 131, y: 0.97, alpha: 0.60, scale: 1.15 },
  { t: 132, y: 0.98, alpha: 0.68, scale: 0.85 },
  { t: 133, y: 0.99, alpha: 0.20, scale: 0.88 },
  { t: 134, y: 1.00, alpha: 0.28, scale: 0.91 },
  { t: 135, y: 0.92, alpha: 0.36, scale: 0.94 },
  { t: 136, y: 0.93, alpha: 0.44, scale: 0.97 },
  { t: 137, y: 0.94, alpha: 0.52, scale: 1.00 },
  { t: 138, y: 0.95, alpha: 0.60, scale: 1.03 },
  { t: 139, y: 0.96, alpha: 0.68, scale: 1.06 },
  { t: 140, y: 0.97, alpha: 0.20, scale: 1.09 },
  { t: 141, y: 0.98, alpha: 0.28, scale: 1.12 },
  { t: 142, y: 0.99, alpha: 0.36, scale: 1.15 },
  { t: 143, y: 1.00, alpha: 0.44, scale: 0.85 },
  { t: 144, y: 0.92, alpha: 0.52, scale: 0.88 },
  { t: 145, y: 0.93, alpha: 0.60, scale: 0.91 },
  { t: 146, y: 0.94, alpha: 0.68, scale: 0.94 },
  { t: 147, y: 0.95, alpha: 0.20, scale: 0.97 },
  { t: 148, y: 0.96, alpha: 0.28, scale: 1.00 },
  { t: 149, y: 0.97, alpha: 0.36, scale: 1.03 },
  { t: 150, y: 0.98, alpha: 0.44, scale: 1.06 },
  { t: 151, y: 0.99, alpha: 0.52, scale: 1.09 },
  { t: 152, y: 1.00, alpha: 0.60, scale: 1.12 },
  { t: 153, y: 0.92, alpha: 0.68, scale: 1.15 },
  { t: 154, y: 0.93, alpha: 0.20, scale: 0.85 },
  { t: 155, y: 0.94, alpha: 0.28, scale: 0.88 },
  { t: 156, y: 0.95, alpha: 0.36, scale: 0.91 },
  { t: 157, y: 0.96, alpha: 0.44, scale: 0.94 },
  { t: 158, y: 0.97, alpha: 0.52, scale: 0.97 },
  { t: 159, y: 0.98, alpha: 0.60, scale: 1.00 },
  { t: 160, y: 0.99, alpha: 0.68, scale: 1.03 },
  { t: 161, y: 1.00, alpha: 0.20, scale: 1.06 },
  { t: 162, y: 0.92, alpha: 0.28, scale: 1.09 },
  { t: 163, y: 0.93, alpha: 0.36, scale: 1.12 },
  { t: 164, y: 0.94, alpha: 0.44, scale: 1.15 },
  { t: 165, y: 0.95, alpha: 0.52, scale: 0.85 },
  { t: 166, y: 0.96, alpha: 0.60, scale: 0.88 },
  { t: 167, y: 0.97, alpha: 0.68, scale: 0.91 },
  { t: 168, y: 0.98, alpha: 0.20, scale: 0.94 },
  { t: 169, y: 0.99, alpha: 0.28, scale: 0.97 },
  { t: 170, y: 1.00, alpha: 0.36, scale: 1.00 },
  { t: 171, y: 0.92, alpha: 0.44, scale: 1.03 },
  { t: 172, y: 0.93, alpha: 0.52, scale: 1.06 },
  { t: 173, y: 0.94, alpha: 0.60, scale: 1.09 },
  { t: 174, y: 0.95, alpha: 0.68, scale: 1.12 },
  { t: 175, y: 0.96, alpha: 0.20, scale: 1.15 },
  { t: 176, y: 0.97, alpha: 0.28, scale: 0.85 },
  { t: 177, y: 0.98, alpha: 0.36, scale: 0.88 },
  { t: 178, y: 0.99, alpha: 0.44, scale: 0.91 },
  { t: 179, y: 1.00, alpha: 0.52, scale: 0.94 },
]);

function applyPulseProfileToBubble(bubble, nowMs, phase = 0) {
  if (!bubble) return;
  const idx = Math.floor((nowMs * 0.03 + phase) % GO_CRAZY_PULSE_PROFILE.length);
  const p = GO_CRAZY_PULSE_PROFILE[idx];
  if (!p) return;
  bubble.scale.setScalar(p.scale);
  bubble.material.opacity = Math.min(0.65, Math.max(0.2, p.alpha));
}
function createPickupBubble(weapon) {
  const cfg = GO_CRAZY_PICKUP_CONFIG[weapon] || GO_CRAZY_PICKUP_CONFIG.FIREARM;
  const c = PICKUP_BUBBLE_COLORS[weapon] || 0x8fd3ff;
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.bubbleScale, 20, 18),
    new THREE.MeshStandardMaterial({
      color: c,
      emissive: new THREE.Color(c).multiplyScalar(cfg.glow),
      transparent: true,
      opacity: 0.35,
      roughness: 0.18,
      metalness: 0.09
    })
  );
  bubble.position.y = 0.18;
  return bubble;
}

function animateSupportUnitActor(actor, kind, now, dt) {
  if (!actor) return;
  const cfg = GO_CRAZY_PARKED_CONFIG[kind] || GO_CRAZY_PARKED_CONFIG.TRUCK;
  const phase = actor.userData.animPhase || 0;
  const time = now * 0.001 + phase;
  const baseY = actor.userData.baseY ?? actor.position.y;
  actor.position.y = baseY + Math.sin(time * cfg.hoverSpeed) * cfg.hoverAmp;
  actor.rotation.y += dt * cfg.spin;
  actor.rotation.z = Math.sin(time * (cfg.hoverSpeed * 0.7)) * cfg.bank;
  actor.rotation.x = Math.cos(time * (cfg.hoverSpeed * 0.45)) * cfg.bank * 0.55;
  const helperPulse = actor.userData.helperPulse;
  if (helperPulse) {
    const s = 1 + Math.sin(time * 2.2) * 0.08 * cfg.pulse;
    helperPulse.scale.setScalar(s);
  }
}

function animateAirStrikeCraft(craftState, now, dt) {
  if (!craftState?.craft) return;
  const s = craftState;
  const swing = Math.sin(now * 0.004 + s.phase) * 0.06;
  if (s.kind === 'HELICOPTER' || s.kind === 'DRONE') s.craft.rotation.y += dt * 3.8;
  if (s.kind === 'JET') s.craft.rotation.z = swing;
  if (s.kind === 'MISSILE') s.craft.rotation.x = -0.2 + swing * 0.4;
}

export default function SuperTuxKartPlayablePreview() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ lap: 1, speed: 0, position: 1, checkpoint: 0, status: "Loading...", mode: "playable-preview", crash: "", weapon: "FIREARM", ammo: 999, collectedWeapons: ["FIREARM"] });
  const hudRef = useRef(hud);

  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const params = new URLSearchParams(window.location.search);
    const selectedTrackId = params.get("track") || "alpine-ring";
    const selectedTrack = scaledTrack(TRACK_PRESETS[selectedTrackId] || TRACK_PRESETS["alpine-ring"]);
    if (!host || !canvas) return;

    let cancelled = false;
    let frameId = 0;
    const { dracoDecoderPath } = makeLoader();
    const input = { keys: {}, steer: 0, accel: 0, brake: false, pointerId: null, startX: 0, startY: 0, lookId: null, lastX: 0, camYaw: 0, firePressed: false, fireTarget: null };
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
        input.firePressed = true;
      }
    };
    const onPointerMove = (e) => {
      if (input.pointerId === e.pointerId) {
        input.steer = clamp((e.clientX - input.startX) / 48, -1, 1);
        input.accel = clamp(-(e.clientY - input.startY) / 60, -0.55, 1);
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
      input.firePressed = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    let onTargetClick = null;

    async function start() {
      let assets = null;
      let originalMode = false;
      try {
        assets = await tryLoadOriginalAssets(dracoDecoderPath);
        originalMode = Boolean(assets.trucks.length && assets.track);
      } catch (err) {
        console.warn("Original SuperTuxKart GLB files are not available. Running playable fallback.", err);
        const tree = await tryLoadTree(dracoDecoderPath);
        assets = { trucks: [], truckAnimations: [], tree };
      }

      const murlanHumanTemplate = await tryLoadMurlanHuman(dracoDecoderPath);
      if (cancelled) return;
      if (originalMode && assets?.track) scene.add(cloneModel(assets.track));
      else createProceduralTrack(scene, selectedTrack);
      const layoutHelpers = spawnLayoutHelpers(scene, selectedTrack);
      createRoadEdgeDecorations(scene, selectedTrack);
      scatterGltfTrees(scene, assets?.tree, selectedTrack);

      const variants = ["sport", "truck", "heavy", "rally", "longnose"];
      const colors = [0xff3b30, 0x35c3ff, 0xffcc00, 0x7cff6b, 0xb469ff];
      const names = ["Ferrari Sport", "Go-Kart Buggy", "Go-Kart Buggy", "Ferrari Sport", "Go-Kart Buggy"];
      const starts = [
        { angle: Math.PI / 2, lane: 0 },
        { angle: Math.PI / 2 - 0.18, lane: -1.5 },
        { angle: Math.PI / 2 - 0.32, lane: 1.2 },
        { angle: Math.PI / 2 - 0.48, lane: 0.2 },
        { angle: Math.PI / 2 - 0.64, lane: -0.4 }
      ];

      const makeKart = (i) => originalMode && assets?.trucks.length
        ? createOriginalKart(assets, names[i], i > 0, starts[i].angle, starts[i].lane, i, variants[i], selectedTrack)
        : createTruckVariant(colors[i], names[i], variants[i], selectedTrack, i > 0, starts[i].angle, starts[i].lane);

      const player = makeKart(0);
      const ai1 = makeKart(1);
      const ai2 = makeKart(2);
      const ai3 = makeKart(3);
      const ai4 = makeKart(4);
      const karts = [player, ai1, ai2, ai3, ai4];
      karts.forEach((k) => scene.add(k.group));
      karts.forEach((kart, i) => { kart.group.userData.vehicleType = i === 0 || i === 3 ? "ferrari" : "buggy"; });
      Promise.allSettled([
        tryLoadVehicleModel(dracoDecoderPath, [FERRARI_KART_URL]),
        tryLoadVehicleModel(dracoDecoderPath, BUGGY_KART_URLS)
      ]).then(([ferrariRes, buggyRes]) => {
        if (cancelled) return;
        const ferrariTemplate = ferrariRes.status === "fulfilled" ? ferrariRes.value : null;
        const buggyTemplate = buggyRes.status === "fulfilled" ? buggyRes.value : null;
        karts.forEach((kart, i) => {
          const useFerrari = i === 0 || i === 3;
          const template = useFerrari ? ferrariTemplate : buggyTemplate;
          if (!template) return;
          kart.group.clear();
          const vehicle = cloneModel(template);
          if (!useFerrari) stripEmbeddedDriver(vehicle);
          fitVehicleModel(vehicle, { targetLength: useFerrari ? 2.55 : 2.35, lift: 0.1, yaw: Math.PI });
          kart.group.add(vehicle);
        });
      });
      const parkedKinds = ["HELICOPTER", "JET", "TRUCK", "DRONE", "TOWER"];
      const parkedTemplates = {};
      const parkedActors = {};
      Promise.allSettled(parkedKinds.map((kind) => tryLoadVehicleModel(dracoDecoderPath, PARKED_UNIT_MODELS[kind] || []))).then((results) => {
        if (cancelled) return;
        results.forEach((res, i) => {
          const kind = parkedKinds[i];
          if (res.status === "fulfilled" && res.value) {
            parkedTemplates[kind] = res.value;
            const park = cloneModel(res.value);
            fitVehicleModel(park, { targetLength: 5.4, lift: 0.24, yaw: 0 });
            addPrecisionHelpers(park, { color: 0x76ffea, size: 0.9 });
            const a = (i / parkedKinds.length) * TAU + 0.18;
            const edge = pointOnTrack(a, selectedTrack, i % 2 === 0 ? 9.5 : -9.5);
            park.position.copy(edge).add(new THREE.Vector3(0, 0.2, 0));
            park.rotation.y = tangentYaw(a, selectedTrack) + (i % 2 === 0 ? 0.5 : -0.5);
            scene.add(park);
            parkedActors[kind] = park;
          }
        });
      });
      const playerCombat = { activeWeapon: "FIREARM", inventory: new Set(["FIREARM"]), defenses: new Set(), ammo: { FIREARM: 999, RIFLE: 45, MISSILE: 2, DRONE: 1, HELICOPTER: 1, JET: 1 } };
      const weaponTemplates = {};
      const makeWeaponPickupMesh = (weapon) => {
        const model = weaponTemplates[weapon];
        if (model) {
          const pickup = cloneModel(model);
          const cfg = GO_CRAZY_PICKUP_CONFIG[weapon] || GO_CRAZY_PICKUP_CONFIG.FIREARM;
          fitVehicleModel(pickup, { targetLength: cfg.targetLength, lift: cfg.lift, yaw: cfg.yaw });
          return pickup;
        }
        if (weapon === "MISSILE") return new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 14), makeMat(0xff7b00, 0.35));
        if (weapon === "DRONE") return new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), makeMat(0x74f0ff, 0.35));
        if (weapon === "HELICOPTER") return new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.72, 6, 10), makeMat(0x89ff9b, 0.35));
        if (weapon === "JET") return new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 12), makeMat(0x8ec9ff, 0.35));
        if (weapon === "RIFLE") return new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.24), makeMat(0xf2d17a, 0.35));
        return new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.24), makeMat(0xffe066, 0.35));
      };
      const pickupSlots = Array.from({ length: 12 }, (_, i) => (i / 12) * TAU + 0.25);
      const pickupTypes = [...WEAPON_PICKUPS, ...SUPPORT_PICKUP_TYPES];
      const pickups = pickupTypes.map((weapon, i) => {
        const cfg = GO_CRAZY_PICKUP_CONFIG[weapon] || GO_CRAZY_PICKUP_CONFIG.FIREARM;
        const p = pointOnTrack((i / WEAPON_PICKUPS.length) * TAU + 0.36, selectedTrack, cfg.lane);
        const weaponPickup = SUPPORT_PICKUP_TYPES.includes(weapon)
          ? new THREE.Group()
          : makeWeaponPickupMesh(weapon);
        if (SUPPORT_PICKUP_TYPES.includes(weapon)) {
          const src = parkedTemplates[weapon];
          if (src) {
            const mini = cloneModel(src);
            const miniCfg = GO_CRAZY_PICKUP_CONFIG[weapon] || GO_CRAZY_PICKUP_CONFIG.FIREARM;
            fitVehicleModel(mini, { targetLength: miniCfg.targetLength, lift: miniCfg.lift, yaw: miniCfg.yaw });
            weaponPickup.add(mini);
          }
        }
        const bubbleColor = PICKUP_BUBBLE_COLORS[weapon] || 0x8fd3ff;
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 14), new THREE.MeshStandardMaterial({ color: bubbleColor, emissive: new THREE.Color(bubbleColor).multiplyScalar(0.18), transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.08 }));
        bubble.position.y = 0.15;
        weaponPickup.add(bubble);
        weaponPickup.position.copy(p).add(new THREE.Vector3(0, 0.88, 0));
        weaponPickup.userData = { weapon, taken: false, slotIndex: i, baseY: weaponPickup.position.y };
        scene.add(weaponPickup);
        return weaponPickup;
      });
      Promise.allSettled(pickupTypes.map(async (weapon) => {
        if (SUPPORT_PICKUP_TYPES.includes(weapon)) return;
        const candidates = WEAPON_MODEL_CANDIDATES[weapon] || [];
        for (const modelUrl of candidates) {
          try {
            const gltf = await loadGltf(dracoDecoderPath, modelUrl);
            weaponTemplates[weapon] = gltf.scene;
            const pickup = pickups.find((node) => node.userData.weapon === weapon);
            if (pickup && !pickup.userData.taken) {
              scene.remove(pickup);
              const upgraded = makeWeaponPickupMesh(weapon);
              const ubColor = PICKUP_BUBBLE_COLORS[weapon] || 0x8fd3ff;
              const ub = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 14), new THREE.MeshStandardMaterial({ color: ubColor, emissive: new THREE.Color(ubColor).multiplyScalar(0.18), transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.08 }));
              ub.position.y = 0.15;
              upgraded.add(ub);
              upgraded.position.copy(pickup.position);
              upgraded.userData = { ...pickup.userData, baseY: pickup.userData.baseY ?? pickup.position.y };
              scene.add(upgraded);
              pickups[pickups.indexOf(pickup)] = upgraded;
            }
            break;
          } catch (err) {
            console.warn("Weapon pickup model failed:", weapon, modelUrl, err);
          }
        }
      }));
      const defensePickups = DEFENSE_PICKUPS.map((defense, i) => {
        const p = pointOnTrack((i / DEFENSE_PICKUPS.length) * TAU + 1.2, selectedTrack, i % 2 === 0 ? -0.62 : 0.62);
        const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), makeMat(0x69ff8f, 0.45));
        node.position.copy(p).add(new THREE.Vector3(0, 0.52, 0));
        node.userData = { defense, taken: false };
        scene.add(node);
        return node;
      });

      const activeProjectiles = [];
      const activeAirStrikes = [];

      function spawnProjectile(from, to, color = 0xffaa00, speed = 42, damage = 20) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), makeMat(color, 0.25, 0.2));
        mesh.position.copy(from);
        scene.add(mesh);
        activeProjectiles.push({ mesh, vel: to.clone().sub(from).normalize().multiplyScalar(speed), ttl: 2, target: null, damage });
      }

      function callAirSupport(kind, target) {
        const template = parkedTemplates[kind];
        const parked = parkedActors[kind];
        const launchPos = parked ? parked.position.clone().add(new THREE.Vector3(0, 0.5, 0)) : player.pos.clone().add(new THREE.Vector3(-10, 0.5, -9));
        const craft = template ? cloneModel(template) : new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8), makeMat(kind === "JET" ? 0x92c7ff : 0x6fffa6, 0.3, 0.2));
        fitVehicleModel(craft, { targetLength: 5.4, lift: 0.05, yaw: 0 });
        craft.position.copy(launchPos);
        scene.add(craft);
        activeAirStrikes.push({ kind, craft, target, ttl: 3.2, fired: 0, stage: "takeoff", home: launchPos.clone(), phase: Math.random() * TAU });
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const aiGroups = [ai1.group, ai2.group, ai3.group, ai4.group];
      aiGroups.forEach((g, idx) => { g.userData.aiRef = [ai1, ai2, ai3, ai4][idx]; });
      onTargetClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(aiGroups, true);
        if (hits[0]) {
          const hitGroup = hits[0].object.parent;
          const aiRef = hits[0].object?.parent?.userData?.aiRef || hitGroup?.userData?.aiRef;
          input.fireTarget = aiRef || null;
          input.firePressed = true;
        }
      };
      canvas.addEventListener("click", onTargetClick);

      if (murlanHumanTemplate) {
        karts.forEach((kart, i) => {
          if (kart.group.userData.vehicleType !== "ferrari") return;
          const human = cloneModel(murlanHumanTemplate);
          human.scale.setScalar(0.66 + (i % 3) * 0.05);
          human.position.set(0, 0.45, -0.05);
          human.rotation.y = 0;
          human.rotation.x = -0.16;
          human.traverse((child) => {
            if (child.isBone) {
              const n = child.name.toLowerCase();
              if (n.includes("arm") && n.includes("left")) child.rotation.x = -0.8;
              if (n.includes("arm") && n.includes("right")) child.rotation.x = -0.8;
              if (n.includes("forearm") && n.includes("left")) child.rotation.z = 0.65;
              if (n.includes("forearm") && n.includes("right")) child.rotation.z = -0.65;
            }
          });
          enableShadows(human);
          kart.group.add(human);
          kart.group.userData.humanModel = human;
          kart.group.userData.humanOffset = i * 0.06;
        });
      }
      setHud((h) => ({ ...h, status: originalMode ? "Original STK GLB mode" : "Playable fallback with 5 different trucks", mode: originalMode ? "original-assets" : "playable-preview" }));

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
        updatePlayerKart(player, input, selectedTrack, dt);
        for (const ai of [ai1, ai2, ai3, ai4]) updateAiKart(ai, karts, selectedTrack, dt);
        for (const ai of [ai1, ai2, ai3, ai4]) {
          const d = ai.pos.distanceTo(player.pos);
          if (d < 18 && Math.random() < dt * 0.7) {
            spawnProjectile(ai.pos.clone().add(new THREE.Vector3(0, 0.95, 0)), player.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xff665c, 38, 8);
            hudRef.current.crash = `${ai.name} fired`;
          }
        }
        const impact = resolveVehicleCrashes(karts);
        if (impact > 0.8) {
          crashTextT = 1.2;
          hudRef.current.crash = impact > 6 ? "Heavy crash!" : "Vehicle contact";
        }
        crashTextT = Math.max(0, crashTextT - dt);
        updateCamera(dt);
        Object.entries(parkedActors).forEach(([kind, actor], idx) => {
          if (!actor) return;
          const t = now * 0.0015 + idx * 0.7;
          if (kind === "HELICOPTER" || kind === "DRONE") actor.position.y = 0.24 + Math.sin(t * 2.2) * 0.06;
          if (kind === "JET") actor.rotation.z = Math.sin(t * 1.4) * 0.04;
          actor.rotation.y += dt * (kind === "DRONE" ? 0.35 : 0.08);
        });
        karts.forEach((kart) => {
          const h = kart.group.userData.humanModel;
          if (!h) return;
          h.position.y = 0.44 + Math.sin(now * 0.002 + (kart.group.userData.humanOffset || 0)) * 0.01;
        });
        pickups.forEach((pickup) => {
          if (pickup.userData.taken) return;
          const phase = (now * 0.001 + pickup.userData.slotIndex * 0.87) % 14;
          if (phase > 4.6) {
            pickup.visible = false;
            return;
          }
          pickup.visible = true;
          pickup.rotation.y += dt * 1.6;
          pickup.position.y = (pickup.userData.baseY ?? 0.88) + Math.sin(now * 0.004 + pickup.position.x) * 0.08;
          if (pickup.position.distanceTo(player.pos) < 1.6) {
            pickup.userData.taken = true;
            pickup.visible = false;
            playerCombat.inventory.add(pickup.userData.weapon);
            playerCombat.activeWeapon = pickup.userData.weapon;
            hudRef.current.status = `Picked up ${pickup.userData.weapon}`;
            setTimeout(() => {
              pickup.userData.taken = false;
              pickup.userData.slotIndex = (pickup.userData.slotIndex + 1 + Math.floor(Math.random() * 5)) % pickupSlots.length;
              const np = pointOnTrack(pickupSlots[pickup.userData.slotIndex], selectedTrack, Math.random() > 0.5 ? 0.8 : -0.8);
              pickup.position.copy(np).add(new THREE.Vector3(0, 0.88, 0));
              pickup.userData.baseY = pickup.position.y;
            }, 2200);
          }
        });
        defensePickups.forEach((pickup) => {
          if (pickup.userData.taken) return;
          pickup.rotation.y -= dt * 1.8;
          if (pickup.position.distanceTo(player.pos) < 1.5) {
            pickup.userData.taken = true;
            pickup.visible = false;
            playerCombat.defenses.add(pickup.userData.defense);
            hudRef.current.status = `Defense online: ${pickup.userData.defense}`;
          }
        });

        if (input.firePressed) {
          const target = input.fireTarget || [ai1, ai2, ai3, ai4].filter((k) => k.damage < 100).sort((a,b)=>a.pos.distanceTo(player.pos)-b.pos.distanceTo(player.pos))[0];
          if (target) {
            const w = playerCombat.activeWeapon;
            const canShoot = (playerCombat.ammo[w] ?? 0) > 0 || w === "FIREARM";
            if (canShoot) {
              if (w !== "FIREARM") playerCombat.ammo[w] = Math.max(0, (playerCombat.ammo[w] ?? 0) - 1);
              if (w === "FIREARM" || w === "RIFLE") {
                spawnProjectile(player.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), target.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xffee88, 56, w === "RIFLE" ? 16 : 10);
              } else if (w === "MISSILE") {
                spawnProjectile(player.pos.clone().add(new THREE.Vector3(1.1, 0.65, 0)), target.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xff6a00, 34, 34);
              } else {
                callAirSupport(w, target);
              }
              hudRef.current.crash = `${w} locked ${target.name}`;
              if (target.damage > 92) hudRef.current.crash = `${target.name} disabled`;
            }
          }
          input.firePressed = false;
          input.fireTarget = null;
        }

        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
          const p = activeProjectiles[i];
          p.ttl -= dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          const hit = [ai1, ai2, ai3, ai4].find((k) => k.pos.distanceTo(p.mesh.position) < 1.2);
          if (hit) {
            hit.damage += p.damage;
            hit.speed *= 0.6;
            p.ttl = 0;
          }
          if (p.ttl <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); activeProjectiles.splice(i, 1); }
        }
        for (let i = activeAirStrikes.length - 1; i >= 0; i--) {
          const s = activeAirStrikes[i];
          s.ttl -= dt;
          const hover = s.target.pos.clone().add(new THREE.Vector3(0, 8.5, 0));
          const land = s.home.clone();
          animateAirStrikeCraft(s, now, dt);
          if (s.stage === "takeoff") {
            s.craft.position.lerp(hover, 1 - Math.exp(-2.8 * dt));
            if (s.craft.position.distanceTo(hover) < 1.5) s.stage = "strike";
          } else if (s.stage === "strike") {
            s.craft.position.lerp(hover, 1 - Math.exp(-4.5 * dt));
          } else {
            s.craft.position.lerp(land, 1 - Math.exp(-2.4 * dt));
          }
          if (s.fired < 2 && s.ttl < 2.5 - s.fired * 0.3) {
            spawnProjectile(s.craft.position.clone(), s.target.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4433, 45, 36);
            s.fired += 1;
            if (s.fired >= 2) s.stage = "land";
          }
          if (s.ttl <= 0) { scene.remove(s.craft); disposeObject3D(s.craft); activeAirStrikes.splice(i, 1); }
        }

        const sorted = [...karts].sort((a, b) => b.progress - a.progress);
        const position = sorted.findIndex((k) => k === player) + 1;
        const baseStatus = originalMode ? "Original STK GLB mode" : trackQuality(player.pos, selectedTrack).onRoad ? `Track: ${selectedTrackId}` : "Off-road slowdown";
        const weapon = playerCombat.activeWeapon;
        const ammo = playerCombat.ammo[weapon] ?? 0;
        setHud({ ...hudRef.current, lap: player.lap, speed: Math.abs(player.speed), position, checkpoint: player.checkpoint, status: baseStatus, crash: crashTextT > 0 ? hudRef.current.crash : "", weapon, ammo, collectedWeapons: Array.from(playerCombat.inventory) });
        renderer.render(scene, camera);
      };
      animate();
    }
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      if (onTargetClick) {
        canvas.removeEventListener("click", onTargetClick);
      }
      renderer.dispose();
      disposeObject3D(scene);
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
            <div style={{ fontSize: 13, fontWeight: 800 }}>Pos {hud.position}/5 · Lap {hud.lap}</div>
            <div style={{ fontSize: 11, opacity: 0.82 }}>{hud.status} · {Math.round(hud.speed * 8)} km/h</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Weapon: {hud.weapon} · Ammo: {hud.ammo}</div>
            {hud.crash && <div style={{ marginTop: 2, fontSize: 12, fontWeight: 900, color: "#ffd166" }}>{hud.crash}</div>}
            <div style={{ marginTop: 4, fontSize: 14 }}>{Array.from(new Set(["FIREARM", hud.weapon])).map((w) => <span key={w} style={{ marginRight: 6 }}>{WEAPON_ICON[w] || "🎯"}</span>)}</div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 12, right: 12, bottom: 20, display: "flex", justifyContent: "center", gap: 8 }}>
          {(hud.collectedWeapons || ["FIREARM"]).map((k) => [k, WEAPON_ICON[k]]).filter(([, v]) => Boolean(v)).map(([k, v]) => (
            <div key={k} style={{ background: k === hud.weapon ? "rgba(255,214,102,0.25)" : "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, width: 34, height: 34, display: "grid", placeItems: "center", fontSize: 18 }}>{v}</div>
          ))}
        </div>

        <button onPointerDown={brakeDown} onPointerUp={brakeUp} onPointerCancel={brakeUp} style={{ pointerEvents: "auto", position: "absolute", right: 18, bottom: 22, width: 78, height: 78, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.48)", color: "white", fontSize: 13, fontWeight: 900, boxShadow: "0 12px 30px rgba(0,0,0,0.28)" }}>BRAKE</button>
      </div>
    </div>
  );
}
