"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const ORIGINAL_ASSETS = {
  kartVariants: [
    "https://threejs.org/examples/models/gltf/ferrari.glb",
    "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Buggy/glTF-Binary/Buggy.glb"
  ],
  track: "/stk-original-glb/tracks/main-track/track.glb",
  treeLocal: "/stk-original-glb/environment/tree.glb",
  treeRemote: "https://raw.githubusercontent.com/jagenjo/GTR_Framework/master/data/prefabs/tree.glb"
};
const MURLAN_HUMAN_MODEL_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";

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
const WEAPON_PICKUPS = ["SHOTGUN", "ASSAULT_RIFLE", "PISTOL", "HEAVY_REVOLVER", "SAWED_OFF", "SILVER_REVOLVER", "LONG_SHOTGUN", "PUMP_SHOTGUN", "SMG", "AK47", "KRSV", "SMITH", "MOSIN", "UZI", "SIGSAUER", "AWP_SNIPER", "MRTK_GUN", "FPS_SHOTGUN"]
const WEAPON_STORE = [
  { id: "SHOTGUN", model: "https://static.poly.pizza/032e6589-3188-41bc-b92b-e25528344275.glb", price: 0 },
  { id: "ASSAULT_RIFLE", model: "https://static.poly.pizza/b3e6be61-0299-4866-a227-58f5f3fe610b.glb", price: 350 },
  { id: "PISTOL", model: "https://static.poly.pizza/3b53f0fe-f86e-451c-816d-6ab9bd265cdc.glb", price: 450 },
  { id: "HEAVY_REVOLVER", model: "https://static.poly.pizza/9e728565-67a3-44db-9567-982320abff09.glb", price: 600 },
  { id: "SAWED_OFF", model: "https://static.poly.pizza/9a6ee0ee-068b-4774-8b0f-679c3cef0b6e.glb", price: 750 },
  { id: "SILVER_REVOLVER", model: "https://static.poly.pizza/7951b3b9-d3a5-4ec8-81b7-11111f1c8e88.glb", price: 850 },
  { id: "LONG_SHOTGUN", model: "https://static.poly.pizza/f71d6771-f512-4374-bd23-ba00b564db68.glb", price: 950 },
  { id: "PUMP_SHOTGUN", model: "https://static.poly.pizza/08f27141-8e64-425a-9161-1bbd6956dfca.glb", price: 1050 },
  { id: "SMG", model: "https://static.poly.pizza/fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710.glb", price: 1200 },
  { id: "AK47", model: "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb", price: 1300 },
  { id: "KRSV", model: "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb", price: 1450 },
  { id: "SMITH", model: "https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb", price: 1550 },
  { id: "MOSIN", model: "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb", price: 1700 },
  { id: "UZI", model: "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb", price: 1800 },
  { id: "SIGSAUER", model: "https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb", price: 1900 },
  { id: "AWP_SNIPER", model: "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb", price: 2100 },
  { id: "MRTK_GUN", model: "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb", price: 2250 },
  { id: "FPS_SHOTGUN", model: "https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf", price: 2400 }
];
const DEFENSE_PICKUPS = ["MISSILE_RADAR", "DRONE_RADAR", "ANTI_MISSILE_BATTERY"];
const WEAPON_THUMBNAILS = Object.fromEntries(WEAPON_STORE.map((w) => [w.id, w.id.includes("PISTOL") || w.id.includes("REVOLVER") || w.id.includes("SMITH") || w.id.includes("SIGSAUER") ? "/store-thumbs/gocrazy/firearm-basic.png" : "/store-thumbs/gocrazy/rifle-mk2.png"]));

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

async function tryLoadMurlanHuman(loader) {
  try {
    const gltf = await loadGltf(loader, MURLAN_HUMAN_MODEL_URL);
    return gltf.scene;
  } catch (err) {
    console.warn("Murlan seated human GLTF could not load.", err);
    return null;
  }
}

async function tryLoadOriginalAssets(loader) {
  const firstTruck = await loadGltf(loader, ORIGINAL_ASSETS.kartVariants[0]);
  const track = await loadGltf(loader, ORIGINAL_ASSETS.track);
  const trucks = [firstTruck.scene];
  const truckAnimations = [firstTruck.animations];

  for (const url of ORIGINAL_ASSETS.kartVariants.slice(1)) {
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

export default function SuperTuxKartPlayablePreview() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ lap: 1, speed: 0, position: 1, checkpoint: 0, help: true, status: "Loading...", mode: "playable-preview", crash: "", weapon: "SHOTGUN", weaponIcon: "", ammo: 999 });
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
    const { loader, draco } = makeLoader();
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
        assets = await tryLoadOriginalAssets(loader);
        originalMode = Boolean(assets.trucks.length && assets.track);
      } catch (err) {
        console.warn("Original SuperTuxKart GLB files are not available. Running playable fallback.", err);
        const tree = await tryLoadTree(loader);
        assets = { trucks: [], truckAnimations: [], tree };
      }

      const murlanHumanTemplate = await tryLoadMurlanHuman(loader);
      if (cancelled) return;
      if (originalMode && assets?.track) scene.add(cloneModel(assets.track));
      else createProceduralTrack(scene, selectedTrack);
      scatterGltfTrees(scene, assets?.tree, selectedTrack);

      const variants = ["ferrari-sport", "go-kart-buggy", "go-kart-buggy", "go-kart-buggy", "go-kart-buggy"];
      const colors = [0xff3b30, 0x35c3ff, 0xffcc00, 0x7cff6b, 0xb469ff];
      const names = ["Ferrari Sport", "Go-Kart Buggy Blue", "Go-Kart Buggy Yellow", "Go-Kart Buggy Green", "Go-Kart Buggy Purple"];
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
      const playerCombat = { activeWeapon: "SHOTGUN", inventory: new Set(["SHOTGUN"]), defenses: new Set(), ammo: Object.fromEntries(WEAPON_STORE.map((w) => [w.id, 12])), defensesAmmo: { MISSILE: 2, DRONE: 1, HELICOPTER: 1, JET: 1 } };
      const weaponModelCache = new Map();
      const createWeaponPickupFromStore = async (weaponId) => {
        const def = WEAPON_STORE.find((item) => item.id === weaponId);
        if (!def?.model) return null;
        try {
          let cached = weaponModelCache.get(weaponId);
          if (!cached) {
            const loaded = await loadGltf(loader, def.model);
            cached = loaded.scene;
            weaponModelCache.set(weaponId, cached);
          }
          const clone = cloneModel(cached);
          const box = new THREE.Box3().setFromObject(clone);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          clone.scale.multiplyScalar(0.7 / maxDim);
          clone.rotation.x = -0.15;
          enableShadows(clone);
          return clone;
        } catch (error) {
          console.warn("Weapon pickup GLTF failed", weaponId, error);
          return null;
        }
      };

      const makeWeaponPickupMesh = (weapon) => {
        if (weapon === "MISSILE") return new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 14), makeMat(0xff7b00, 0.35));
        if (weapon === "DRONE") return new THREE.Mesh(new THREE.OctahedronGeometry(0.33, 0), makeMat(0x74f0ff, 0.35));
        if (weapon === "HELICOPTER") return new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 6, 10), makeMat(0x89ff9b, 0.35));
        if (weapon === "JET") return new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 12), makeMat(0x8ec9ff, 0.35));
        if (weapon === "RIFLE") return new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.18), makeMat(0xf2d17a, 0.35));
        return new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.18), makeMat(0xffe066, 0.35));
      };
      const pickups = [];
      for (let i = 0; i < WEAPON_PICKUPS.length; i += 1) {
        const weapon = WEAPON_PICKUPS[i];
        const p = pointOnTrack((i / WEAPON_PICKUPS.length) * TAU + 0.36, selectedTrack, i % 2 === 0 ? 0.35 : -0.35);
        const gltfPickup = await createWeaponPickupFromStore(weapon);
        const gem = gltfPickup || makeWeaponPickupMesh(weapon);
        gem.position.copy(p).add(new THREE.Vector3(0, 0.62, 0));
        gem.userData = { weapon, taken: false };
        scene.add(gem);
        pickups.push(gem);
      }
      const defensePickups = DEFENSE_PICKUPS.map((defense, i) => {
        const p = pointOnTrack((i / DEFENSE_PICKUPS.length) * TAU + 1.2, selectedTrack, i % 2 === 0 ? -0.62 : 0.62);
        const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), makeMat(0x69ff8f, 0.45));
        node.position.copy(p).add(new THREE.Vector3(0, 0.52, 0));
        node.userData = { defense, taken: false };
        scene.add(node);
        return node;
      });

      
      const findRightHandNode = (root) => {
        let found = null;
        root.traverse((child) => {
          if (found) return;
          const n = (child.name || "").toLowerCase();
          if (n.includes("righthand") || n.includes("right_hand") || n.includes("hand_r") || n.includes("mixamorig:righthand")) found = child;
        });
        return found;
      };
      const attachWeaponToDriver = async (kart, weaponId) => {
        const hand = kart.group.userData?.rightHandNode;
        if (!hand) return;
        const existing = kart.group.userData?.heldWeaponModel;
        if (existing) { existing.parent?.remove(existing); }
        const loaded = await createWeaponPickupFromStore(weaponId);
        if (!loaded) return;
        loaded.position.set(0.04, -0.02, -0.03);
        loaded.rotation.set(-0.1, Math.PI * 0.5, 0.1);
        loaded.scale.multiplyScalar(0.35);
        hand.add(loaded);
        kart.group.userData.heldWeaponModel = loaded;
      };

      const towerSpots = [0.05, 0.22, 0.38, 0.55, 0.72, 0.88].map((t) => pointOnTrack(t * TAU, selectedTrack, 3.8));
      towerSpots.forEach((pos, idx) => {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.7, 12), makeMat(0x4a5568, 0.8));
        tower.position.copy(pos).add(new THREE.Vector3(0, 1.3, 0));
        tower.rotation.y = idx * 0.3;
        tower.castShadow = true;
        scene.add(tower);
      });

      const supportParked = [];
      const supportTypes = ["JET", "HELICOPTER", "DRONE", "TRUCK"];
      const parkedCount = karts.length;
      for (let i = 0; i < parkedCount; i += 1) {
        const type = supportTypes[i % supportTypes.length];
        const slot = pointOnTrack((i / parkedCount) * TAU + 0.14, selectedTrack, 6.1);
        const body = type === "JET" ? new THREE.ConeGeometry(0.35, 1.2, 8) : type === "HELICOPTER" ? new THREE.CapsuleGeometry(0.2, 0.7, 6, 10) : type === "DRONE" ? new THREE.OctahedronGeometry(0.33, 0) : new THREE.BoxGeometry(1.2, 0.45, 0.6);
        const mesh = new THREE.Mesh(body, makeMat(type === "JET" ? 0x9bc5ff : type === "HELICOPTER" ? 0x8cffc1 : type === "DRONE" ? 0x9df4ff : 0xffa66f, 0.42));
        mesh.position.copy(slot).add(new THREE.Vector3(0, type === "DRONE" ? 1.8 : 0.6, 0));
        mesh.userData = { type, home: mesh.position.clone() };
        mesh.castShadow = true;
        scene.add(mesh);
        supportParked.push(mesh);
      }

      const activeProjectiles = [];
      const activeAirStrikes = [];

      function spawnProjectile(from, to, color = 0xffaa00, speed = 42, damage = 20) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), makeMat(color, 0.25, 0.2));
        mesh.position.copy(from);
        scene.add(mesh);
        activeProjectiles.push({ mesh, vel: to.clone().sub(from).normalize().multiplyScalar(speed), ttl: 2, target: null, damage });
      }

      function callAirSupport(kind, target) {
        const color = kind === "JET" ? 0x92c7ff : kind === "HELICOPTER" ? 0x6fffa6 : 0xffa14d;
        const craft = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8), makeMat(color, 0.3, 0.2));
        craft.rotation.x = Math.PI / 2;
        craft.position.copy(target.pos).add(new THREE.Vector3(-6, 9, -6));
        scene.add(craft);
        activeAirStrikes.push({ kind, craft, target, ttl: 2.2, fired: false });
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
          const human = cloneModel(murlanHumanTemplate);
          human.scale.setScalar(0.72);
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
          kart.group.userData.rightHandNode = findRightHandNode(human);
        });
      }
      setHud((h) => ({ ...h, status: originalMode ? "Original STK GLB mode" : "Playable preview", mode: originalMode ? "original-assets" : "playable-preview", weaponIcon: WEAPON_THUMBNAILS[WEAPON_STORE[0]?.id] || "" }));

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
        karts.forEach((kart) => {
          const h = kart.group.userData.humanModel;
          if (!h) return;
          h.position.y = 0.44 + Math.sin(now * 0.002 + (kart.group.userData.humanOffset || 0)) * 0.01;
        });
        pickups.forEach((pickup) => {
          if (pickup.userData.taken) return;
          pickup.rotation.y += dt * 1.6;
          pickup.position.y = 0.62 + Math.sin(now * 0.004 + pickup.position.x) * 0.05;
          if (pickup.position.distanceTo(player.pos) < 1.6) {
            pickup.userData.taken = true;
            pickup.visible = false;
            playerCombat.inventory.add(pickup.userData.weapon);
            playerCombat.activeWeapon = pickup.userData.weapon;
            hudRef.current.status = `Picked up ${pickup.userData.weapon}`;
            const picked = WEAPON_STORE.find((w) => w.id === pickup.userData.weapon);
            hudRef.current.weaponIcon = WEAPON_THUMBNAILS[pickup.userData.weapon] || "";
            attachWeaponToDriver(player, pickup.userData.weapon);
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
            const canShoot = (playerCombat.ammo[w] ?? 0) > 0;
            if (canShoot) {
              playerCombat.ammo[w] = Math.max(0, (playerCombat.ammo[w] ?? 0) - 1);
              if (["SHOTGUN","ASSAULT_RIFLE","PISTOL","HEAVY_REVOLVER","SAWED_OFF","SILVER_REVOLVER","LONG_SHOTGUN","PUMP_SHOTGUN","SMG","AK47","KRSV","SMITH","MOSIN","UZI","SIGSAUER","AWP_SNIPER","MRTK_GUN","FPS_SHOTGUN"].includes(w)) {
                spawnProjectile(player.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), target.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xffee88, 56, w === "ASSAULT_RIFLE" ? 16 : 10);
              } else {
                const parked = supportParked.find((m) => m.userData.type === "DRONE") || supportParked[0];
                if (parked) callAirSupport(parked.userData.type, target);
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
          s.craft.position.lerp(hover, 1 - Math.exp(-3 * dt));
          if (!s.fired && s.ttl < 1.5) {
            s.fired = true;
            const shots = s.kind === "JET" ? 2 : 1;
            for (let j = 0; j < shots; j += 1) {
              const from = s.craft.position.clone().add(new THREE.Vector3(j * 0.35, 0, 0));
              spawnProjectile(from, s.target.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4433, 45, 36);
            }
          }
          if (s.ttl <= 0) { scene.remove(s.craft); s.craft.geometry.dispose(); s.craft.material.dispose(); activeAirStrikes.splice(i, 1); }
        }

        const sorted = [...karts].sort((a, b) => b.progress - a.progress);
        const position = sorted.findIndex((k) => k === player) + 1;
        const baseStatus = originalMode ? "Original STK GLB mode" : trackQuality(player.pos, selectedTrack).onRoad ? `Track: ${selectedTrackId}` : "Off-road slowdown";
        const weapon = playerCombat.activeWeapon;
        const ammo = playerCombat.ammo[weapon] ?? 0;
        setHud({ ...hudRef.current, lap: player.lap, speed: Math.abs(player.speed), position, checkpoint: player.checkpoint, status: baseStatus, crash: crashTextT > 0 ? hudRef.current.crash : "", weapon, ammo });
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
      if (onTargetClick) {
        canvas.removeEventListener("click", onTargetClick);
      }
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
            <div style={{ fontSize: 13, fontWeight: 800 }}>Pos {hud.position}/5 · Lap {hud.lap}</div>
            <div style={{ fontSize: 11, opacity: 0.82 }}>{hud.status} · {Math.round(hud.speed * 8)} km/h</div>
            <div style={{ fontSize: 11, opacity: 0.9, display: "flex", alignItems: "center", gap: 8 }}>Weapon: {hud.weapon} · Ammo: {hud.ammo} {hud.weaponIcon ? <img src={hud.weaponIcon} alt={hud.weapon} style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.35)" }} /> : null}</div>
            {hud.crash && <div style={{ marginTop: 2, fontSize: 12, fontWeight: 900, color: "#ffd166" }}>{hud.crash}</div>}
          </div>
          <button onClick={() => setHud((h) => ({ ...h, help: !h.help }))} style={{ pointerEvents: "auto", width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "white", fontSize: 18, fontWeight: 900 }}>?</button>
        </div>

        <div style={{ position: "absolute", right: 10, top: 64, maxWidth: 260, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 12, padding: "8px 10px", fontSize: 10 }}>
          <b>Weapon Store (GLTF slots)</b>
          {WEAPON_STORE.map((w) => <div key={w.id}>{w.id} · ${w.price} · {w.model}</div>)}
        </div>

        {hud.help && (
          <div style={{ position: "absolute", left: 10, bottom: 18, maxWidth: 352, background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "10px 12px", fontSize: 12, lineHeight: 1.35 }}>
            <b>Controls</b><br />
            Desktop: W/↑ accelerate, S/↓ reverse, A/D steer, Space brake.<br />
            Mobile: drag left side to accelerate/steer, right side to rotate camera.<br />
            Trees are GLTF-only. If no GLTF tree loads, no procedural trees are spawned.<br />
            Current mode: {hud.mode === "original-assets" ? "Original STK GLB assets loaded." : "Playable fallback because original STK GLBs are not available in this preview."}
          </div>
        )}

        <button onPointerDown={brakeDown} onPointerUp={brakeUp} onPointerCancel={brakeUp} style={{ pointerEvents: "auto", position: "absolute", right: 18, bottom: 22, width: 78, height: 78, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.48)", color: "white", fontSize: 13, fontWeight: 900, boxShadow: "0 12px 30px rgba(0,0,0,0.28)" }}>BRAKE</button>
      </div>
    </div>
  );
}
