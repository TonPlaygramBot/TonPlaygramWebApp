// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { addCurvedCurbs, addTireBarriers, TIRE_CENTERS } from './suppliedTrackGeometry.mjs';
import { disposeRacingResources } from './suppliedRuntimeResources.mjs';

const SAMPLE = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0";
const RAW_SAMPLE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";
const FERRARI = "https://threejs.org/examples/models/gltf/ferrari.glb";
const BUGGY = `${SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;
const BUGGY_RAW = `${RAW_SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;

const KNOWN = {
  awp: "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb",
  awpRaw: "https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb",
  mrtk: "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
  mrtkRaw: "https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
  pistol: "https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb",
  pistolRaw: "https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb",
  fps: "https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf",
  fpsRaw: "https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf",
};

const poly = (id) => `https://static.poly.pizza/${id}.glb`;

const WEAPONS = [
  { id: "shotgun", name: "Shotgun", icon: "SG", urls: [poly("032e6589-3188-41bc-b92b-e25528344275"), KNOWN.fps, KNOWN.awp], ammo: 6, power: 2.2, speed: 24, cooldown: 0.52 },
  { id: "assault", name: "Assault Rifle", icon: "AR", urls: [poly("b3e6be61-0299-4866-a227-58f5f3fe610b"), KNOWN.mrtk, KNOWN.awp], ammo: 18, power: 1.2, speed: 30, cooldown: 0.18 },
  { id: "pistol", name: "Pistol", icon: "P", urls: [poly("3b53f0fe-f86e-451c-816d-6ab9bd265cdc"), KNOWN.pistol, KNOWN.mrtk], ammo: 12, power: 1.0, speed: 28, cooldown: 0.28 },
  { id: "revolver", name: "Heavy Revolver", icon: "RV", urls: [poly("9e728565-67a3-44db-9567-982320abff09"), KNOWN.pistolRaw, KNOWN.mrtk], ammo: 8, power: 1.55, speed: 27, cooldown: 0.45 },
  { id: "sawed", name: "Sawed-Off", icon: "SO", urls: [poly("9a6ee0ee-068b-4774-8b0f-679c3cef0b6e"), KNOWN.fpsRaw, KNOWN.awp], ammo: 5, power: 2.5, speed: 22, cooldown: 0.62 },
  { id: "silver", name: "Silver Revolver", icon: "SR", urls: [poly("7951b3b9-d3a5-4ec8-81b7-11111f1c8e88"), KNOWN.pistol, KNOWN.mrtk], ammo: 8, power: 1.6, speed: 27, cooldown: 0.42 },
  { id: "longshot", name: "Long Shotgun", icon: "LS", urls: [poly("f71d6771-f512-4374-bd23-ba00b564db68"), KNOWN.fps, KNOWN.awp], ammo: 6, power: 2.1, speed: 24, cooldown: 0.52 },
  { id: "pump", name: "Pump Shotgun", icon: "PS", urls: [poly("08f27141-8e64-425a-9161-1bbd6956dfca"), KNOWN.fpsRaw, KNOWN.awpRaw], ammo: 7, power: 2.0, speed: 24, cooldown: 0.5 },
  { id: "smg", name: "SMG", icon: "SMG", urls: [poly("fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710"), KNOWN.mrtk, KNOWN.fps], ammo: 24, power: 0.85, speed: 31, cooldown: 0.12 },
  { id: "ak47", name: "AK47", icon: "AK", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf", KNOWN.awp, KNOWN.mrtk], ammo: 20, power: 1.35, speed: 30, cooldown: 0.18 },
  { id: "krsv", name: "KRSV", icon: "KR", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf", KNOWN.mrtk, KNOWN.awp], ammo: 18, power: 1.25, speed: 30, cooldown: 0.18 },
  { id: "smith", name: "Smith", icon: "ST", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf", KNOWN.pistol, KNOWN.mrtk], ammo: 10, power: 1.15, speed: 27, cooldown: 0.3 },
  { id: "mosin", name: "Mosin", icon: "MS", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf", KNOWN.awp, KNOWN.awpRaw], ammo: 5, power: 3.2, speed: 36, cooldown: 0.8 },
  { id: "uzi", name: "Uzi", icon: "UZ", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf", KNOWN.mrtk, KNOWN.fps], ammo: 26, power: 0.75, speed: 32, cooldown: 0.1 },
  { id: "sig", name: "SigSauer", icon: "SG", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf", KNOWN.pistolRaw, KNOWN.mrtk], ammo: 12, power: 1.1, speed: 28, cooldown: 0.28 },
  { id: "awp", name: "AWP Sniper", icon: "AWP", urls: [KNOWN.awp, KNOWN.awpRaw], ammo: 4, power: 4.0, speed: 40, cooldown: 0.95 },
  { id: "mrtk", name: "MRTK Gun", icon: "MG", urls: [KNOWN.mrtk, KNOWN.mrtkRaw], ammo: 12, power: 1.4, speed: 30, cooldown: 0.24 },
  { id: "fps", name: "FPS Shotgun", icon: "FS", urls: [KNOWN.fps, KNOWN.fpsRaw, KNOWN.awp], ammo: 6, power: 2.4, speed: 24, cooldown: 0.58 },
];

const TRACK = {
  name: "Alpine Grand Loop",
  width: 8.8,
  sky: 0x9fcfff,
  fogFar: 250,
  terrain: [210, 170],
  lapsToWin: 3,
  points: [[0, 44], [42, 34], [68, 8], [58, -30], [18, -54], [-34, -46], [-68, -14], [-58, 26]],
};

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const FALLBACK_TEX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l6m9WQAAAABJRU5ErkJggg==";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap01 = (v) => ((v % 1) + 1) % 1;
const fwd = (yaw) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
const yawFrom = (v) => Math.atan2(v.x, v.z);
const dAng = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

function patchTextures() {
  const orig = THREE.ImageLoader.prototype.load;
  THREE.ImageLoader.prototype.load = function patched(url, onLoad, onProgress, onError) {
    const fail = (e) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => onLoad?.(img);
      img.onerror = () => onError?.(e);
      img.src = FALLBACK_TEX;
    };
    return orig.call(this, url, onLoad, onProgress, fail);
  };
  return () => {
    THREE.ImageLoader.prototype.load = orig;
  };
}

function shadows(o) {
  o.traverse((c) => {
    if (c.isMesh || c.isSkinnedMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
      c.frustumCulled = false;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m) m.needsUpdate = true;
      });
    }
  });
  return o;
}

function makeLoader() {
  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  return { loader, draco };
}

function loadGLTF(loader, url) {
  return Promise.race([
    new Promise((resolve, reject) => loader.load(url, (g) => resolve({ scene: shadows(g.scene), animations: g.animations || [] }), undefined, reject)),
    new Promise((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 18000)),
  ]);
}

async function loadAny(loader, urls) {
  let last;
  for (const url of urls) {
    try {
      return await loadGLTF(loader, url);
    } catch (e) {
      console.warn("Failed asset", url, e);
      last = e;
    }
  }
  throw last || new Error("No asset loaded");
}

function cloneObject(o) {
  return shadows(o.clone(true));
}

function normalize(o, size = 2) {
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o);
  const dims = box.getSize(new THREE.Vector3());
  const max = Math.max(dims.x, dims.y, dims.z) || 1;
  o.scale.multiplyScalar(size / max);
  o.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(o);
  const center = box2.getCenter(new THREE.Vector3());
  o.position.add(new THREE.Vector3(-center.x, -box2.min.y, -center.z));
}

function mats() {
  const mk = (color, roughness = 0.65, metalness = 0.04) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const boost = mk(0x30f6ff, 0.25, 0.05);
  boost.emissive = new THREE.Color(0x0edcff);
  boost.emissiveIntensity = 0.9;
  const bubble = mk(0x6ee7ff, 0.1, 0.02);
  bubble.transparent = true;
  bubble.opacity = 0.28;
  const muzzle = mk(0xffd166, 0.3, 0.1);
  muzzle.emissive = new THREE.Color(0xffaa00);
  muzzle.emissiveIntensity = 1.2;
  const repair = mk(0x3cff7f, 0.32, 0.04);
  repair.emissive = new THREE.Color(0x20cc6a);
  repair.emissiveIntensity = 0.75;
  return {
    ground: mk(0x315b35),
    road: mk(0x25292d, 0.92, 0.02),
    shoulder: mk(0x4d4b45),
    white: mk(0xf7f7f2, 0.58, 0.03),
    red: mk(0xd72424, 0.58, 0.03),
    dark: mk(0x06070a),
    rubber: mk(0x090909, 0.94, 0),
    metal: mk(0xa0a8b2, 0.5, 0.3),
    blue: mk(0x3096e7),
    orange: mk(0xff7a1f),
    purple: mk(0x8c62ee),
    yellow: mk(0xffd166),
    boost,
    bubble,
    muzzle,
    repair,
  };
}

function makeTrack() {
  const curve = new THREE.CatmullRomCurve3(TRACK.points.map(([x, z]) => new THREE.Vector3(x, 0.04, z)), true, "catmullrom", 0.35);
  const samples = Array.from({ length: 560 }, (_, i) => curve.getPointAt(i / 560));
  return { ...TRACK, curve, samples };
}

function frame(track, t) {
  const u = wrap01(t);
  const center = track.curve.getPointAt(u);
  const tangent = track.curve.getTangentAt(u).normalize();
  const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  return { t: u, center, tangent, right, yaw: yawFrom(tangent) };
}

function place(o, fr, lane, y, forward = 0, yaw = 0) {
  o.position.copy(fr.center).addScaledVector(fr.right, lane).addScaledVector(fr.tangent, forward).setY(y);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.right, UP, fr.tangent));
  if (yaw) o.rotateOnWorldAxis(UP, yaw);
}

function point(track, t, lane = 0) {
  const fr = frame(track, t);
  return fr.center.clone().addScaledVector(fr.right, lane).setY(0.18);
}

function near(track, pos) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < track.samples.length; i++) {
    const d = track.samples[i].distanceToSquared(pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const dist = Math.sqrt(bestD);
  return { t: best / track.samples.length, center: track.samples[best].clone(), on: dist <= track.width * 0.62, dist };
}

function ribbon(track, width, y, mat) {
  const verts = [];
  const uvs = [];
  const idx = [];
  const n = track.samples.length;
  for (let i = 0; i < n; i++) {
    const fr = frame(track, i / n);
    const a = fr.center.clone().addScaledVector(fr.right, -width / 2).setY(y);
    const b = fr.center.clone().addScaledVector(fr.right, width / 2).setY(y);
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uvs.push(0, i / 8, 1, i / 8);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function makeFlatTireStack(M, seed = 0) {
  const group = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 28);
  const rimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.18, 18);
  const colorPattern = [M.rubber, M.white, M.red, M.rubber, M.white, M.red, M.rubber, M.red];

  const addFlatTire = (x, y, z, index) => {
    const tireMat = colorPattern[(seed + index) % colorPattern.length];
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(x, y, z);
    tire.rotation.y = ((seed + index) % 5) * 0.18;
    tire.castShadow = true;
    tire.receiveShadow = true;

    const rim = new THREE.Mesh(rimGeo, M.dark);
    rim.position.set(x, y + 0.002, z);
    rim.castShadow = true;
    rim.receiveShadow = true;

    group.add(tire, rim);
  };

  TIRE_CENTERS.forEach(([x, y, z], index) => addFlatTire(x, y, z, index));
  return group;
}

function makeTree(M, seed = 0) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x77502a, roughness: 0.9 }));
  trunk.position.y = 0.55;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.85 + (seed % 3) * 0.08, 2.0, 9), M.ground.clone());
  top.material.color.setHex(0x2f6c3a);
  top.position.y = 1.8;
  g.add(trunk, top);
  return shadows(g);
}

function buildTrack(scene, track, M) {
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(track.terrain[0], track.terrain[1], 20, 20), M.ground);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.03;
  scene.add(terrain, ribbon(track, track.width + 1.2, 0.008, M.shoulder), ribbon(track, track.width, 0.02, M.road));
  addCurvedCurbs(scene, track, M, frame);
  addTireBarriers(scene, track, M, makeFlatTireStack, frame);

  for (let i = 0; i < 210; i++) {
    const fr = frame(track, i / 210);
    if (i % 5 === 0) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 2.3), M.white);
      place(dash, fr, 0, 0.058);
      scene.add(dash);
    }
    if (i % 9 === 0) {
      for (const side of [-1, 1]) {
        const tree = makeTree(M, i + side * 99);
        place(tree, fr, side * (track.width / 2 + 5.5 + (i % 4) * 1.2), 0.0, 0, side * 0.4);
        scene.add(tree);
      }
    }
  }

  const start = frame(track, 0);
  const cell = 0.92;
  const across = Math.floor(track.width / cell);
  const cellWidth = track.width / across;
  for (let a = 0; a < across; a++) {
    for (let r = 0; r < 4; r++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(cellWidth, 0.045, cell), (a + r) % 2 ? M.dark : M.white);
      place(tile, start, -track.width / 2 + (a + 0.5) * cellWidth, 0.083, (r - 2) * cell);
      scene.add(tile);
    }
  }
  shadows(scene);
}

function label(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "white";
  ctx.font = "bold 42px system-ui";
  ctx.fillText(text, 28, 78);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(2.6, 0.65, 1);
  return sp;
}

function fallbackWeapon(M, id) {
  const group = new THREE.Group();
  const isLong = !/(pistol|revolver|smith|sig)/i.test(id);
  const body = new THREE.Mesh(new THREE.BoxGeometry(isLong ? 0.75 : 0.35, 0.08, 0.1), M.dark);
  body.position.y = 0.08;
  group.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.09), M.metal);
  grip.position.set(isLong ? 0.18 : -0.05, -0.08, 0);
  grip.rotation.z = -0.35;
  group.add(grip);
  if (isLong) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10), M.metal);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.58, 0.09, 0);
    group.add(barrel);
  }
  return group;
}

async function loadWeaponBubble(loader, M, weapon, track, t, lane) {
  const bubble = new THREE.Group();
  bubble.userData.weapon = weapon;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 16), M.bubble);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.03, 8, 40), M.boost);
  ring.rotation.x = Math.PI / 2;
  bubble.add(sphere, ring);
  const tag = label(weapon.name);
  tag.position.y = 0.82;
  bubble.add(tag);
  place(bubble, frame(track, t), lane, 0.95);
  try {
    const loaded = await loadAny(loader, weapon.urls);
    const model = cloneObject(loaded.scene);
    normalize(model, 0.82);
    model.rotation.y = Math.PI / 2;
    model.position.y = -0.1;
    bubble.add(model);
  } catch {
    const model = fallbackWeapon(M, weapon.id);
    model.position.y = -0.05;
    bubble.add(model);
  }
  return { root: bubble, weapon, t, lane, active: true, respawn: 0 };
}

function makeBoostBubble(M, track, t, lane) {
  const bubble = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 16), M.bubble.clone());
  sphere.material.color.setHex(0x44ff88);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 1), M.repair);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 40), M.repair);
  ring.rotation.x = Math.PI / 2;
  const tag = label("BOOST / REPAIR");
  tag.position.y = 0.82;
  bubble.add(sphere, ring, core, tag);
  place(bubble, frame(track, t), lane, 0.95);
  return { root: bubble, weapon: { id: "boost", name: "Boost Repair", boost: 45, repair: 20 }, t, lane, active: true, respawn: 8, special: true };
}

function makeFallbackVehicle(M, type = "kart") {
  const root = new THREE.Group();
  const mat = type === "ferrari" ? M.red : M.blue;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.2), mat);
  body.position.y = 0.35;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.85), M.dark);
  cabin.position.set(0, 0.78, -0.15);
  root.add(body, cabin);
  for (const x of [-0.7, 0.7]) {
    for (const z of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 20), M.rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      root.add(wheel);
    }
  }
  return root;
}

async function loadVehicle(loader, urls, M, type) {
  try {
    const loaded = await loadAny(loader, urls);
    const obj = cloneObject(loaded.scene);
    normalize(obj, type === "ferrari" ? 2.45 : 2.25);
    obj.rotation.y = Math.PI;
    return obj;
  } catch {
    const obj = makeFallbackVehicle(M, type);
    obj.rotation.y = Math.PI;
    return obj;
  }
}

function createVehicleGroup(model, track, routeT, lane, ai, name, radius = 1.35) {
  const root = new THREE.Group();
  root.add(model);
  const pos = point(track, routeT, lane);
  root.position.copy(pos);
  root.rotation.y = frame(track, routeT).yaw;
  root.userData.vehicle = true;
  root.userData.ai = ai;
  return {
    root,
    model,
    pos: pos.clone(),
    yaw: root.rotation.y,
    speed: 0,
    steer: 0,
    routeT,
    lastT: routeT,
    lap: 0,
    progress: routeT,
    lane,
    targetLane: lane,
    ai,
    name,
    radius,
    hp: 100,
    maxHp: 100,
    shield: ai ? 10 : 20,
    boost: ai ? 30 : 45,
    broken: false,
    respawn: 0,
    inventory: [],
    selectedId: null,
    fireCooldown: ai ? 1 + Math.random() * 2 : 0,
  };
}

function updateVehicle(v, input, track, dt, phase) {
  v.fireCooldown = Math.max(0, v.fireCooldown - dt);

  if (v.broken) {
    v.respawn -= dt;
    v.speed *= Math.exp(-7 * dt);
    v.root.rotation.z = Math.sin(performance.now() * 0.018) * 0.4;
    if (v.respawn <= 0) {
      const safe = frame(track, wrap01(v.routeT - 0.01));
      v.pos.copy(safe.center).addScaledVector(safe.right, v.targetLane).setY(0.18);
      v.yaw = safe.yaw;
      v.hp = v.ai ? 70 : 75;
      v.shield = v.ai ? 6 : 12;
      v.broken = false;
      v.root.rotation.z = 0;
    }
    v.root.position.copy(v.pos);
    return;
  }

  const inf = near(track, v.pos);
  let accel = phase === "race" ? 1 : 0;
  let steerInput = 0;
  let brake = phase !== "race";
  let boosting = false;

  if (input && phase === "race") {
    const keyAccel = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0);
    accel = Math.max(0.35, keyAccel + input.accel);
    steerInput = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) + input.steer;
    steerInput = clamp(steerInput, -1, 1);
    brake = input.brake || input.keys.Space;
    boosting = (input.boost || input.keys.ShiftLeft || input.keys.ShiftRight) && v.boost > 0;
    v.targetLane = clamp(v.targetLane - steerInput * dt * 3.5, -track.width * 0.36, track.width * 0.36);
  } else if (phase === "race") {
    const wobble = Math.sin(performance.now() * 0.00025 + v.radius * 7) * 1.2;
    v.targetLane = clamp(v.lane + wobble, -track.width * 0.35, track.width * 0.35);
    const target = point(track, v.routeT + 0.04 + clamp(v.speed / 380, 0, 0.025), v.targetLane).sub(v.pos).normalize();
    steerInput = clamp(-dAng(v.yaw, yawFrom(target)) * 1.3, -1, 1);
    accel = 0.82;
    boosting = v.boost > 18 && Math.sin(performance.now() * 0.001 + v.radius) > 0.94;
  }

  v.routeT = inf.t;
  const lead = 0.035 + clamp(v.speed / 430, 0, 0.03);
  const targetPoint = point(track, v.routeT + lead, v.targetLane);
  const desiredYaw = yawFrom(targetPoint.sub(v.pos).normalize());
  const autoDelta = dAng(v.yaw, desiredYaw);
  const trackAssist = input ? 1.28 : 1.12;

  v.speed += accel * 18.5 * dt * (inf.on ? 1 : 0.55);
  if (boosting) {
    v.speed += 23 * dt;
    v.boost = Math.max(0, v.boost - 32 * dt);
  } else {
    v.boost = Math.min(100, v.boost + (Math.abs(v.steer) > 0.55 && v.speed > 12 ? 5.5 : 1.8) * dt);
  }
  if (brake) v.speed -= 34 * dt * Math.sign(v.speed || 1);
  v.speed = clamp(v.speed, -6, (boosting ? 26 : 20) * (inf.on ? 1 : 0.45));
  v.speed *= Math.exp(-(inf.on ? 0.62 : 2.2) * dt);

  v.steer = lerp(v.steer, steerInput, 1 - Math.exp(-6.5 * dt));
  v.yaw += autoDelta * trackAssist * dt;
  if (input) v.yaw -= v.steer * 0.28 * dt * clamp(Math.abs(v.speed) / 10, 0.15, 0.9);

  v.pos.addScaledVector(fwd(v.yaw), v.speed * dt);
  if (!inf.on) v.pos.lerp(inf.center.clone().setY(v.pos.y), 0.48 * dt);
  const after = near(track, v.pos);
  v.routeT = after.t;

  if (v.lastT > 0.86 && v.routeT < 0.14 && phase === "race") v.lap += 1;
  if (v.lastT < 0.12 && v.routeT > 0.9 && phase === "race") v.lap = Math.max(0, v.lap - 1);
  v.lastT = v.routeT;
  v.progress = v.lap + v.routeT;

  v.root.position.copy(v.pos);
  v.root.rotation.y = v.yaw;
  v.root.rotation.z = -v.steer * 0.07 * clamp(Math.abs(v.speed) / 14, 0, 1);
}

function projectileStyle(weapon) {
  const id = weapon?.id || "";
  if (/awp|mosin/i.test(id)) return { color: 0x8c62ee, size: 0.16, life: 4.5, homing: 0.45 };
  if (/shotgun|sawed|pump|fps|longshot/i.test(id)) return { color: 0xffd166, size: 0.14, life: 3.2, homing: 0.28 };
  if (/pistol|revolver|smith|sig|silver/i.test(id)) return { color: 0x9ad1ff, size: 0.11, life: 3.6, homing: 0.36 };
  return { color: 0xff7a1f, size: 0.12, life: 4, homing: 0.4 };
}

function addWeaponToInventory(inventory, weapon) {
  const list = inventory.map((item) => ({ ...item }));
  const found = list.find((item) => item.id === weapon.id);
  if (found) found.ammo += weapon.ammo;
  else list.push({ ...weapon, ammo: weapon.ammo });
  return list;
}

function chooseSelected(inventory, selectedId) {
  const active = inventory.find((item) => item.id === selectedId && item.ammo > 0);
  if (active) return selectedId;
  return inventory.find((item) => item.ammo > 0)?.id || null;
}

function getSelectedWeapon(inventory, selectedId) {
  return inventory.find((item) => item.id === selectedId && item.ammo > 0) || null;
}

function nearestTarget(owner, vehicles, maxDist = 80) {
  const forward = fwd(owner.yaw);
  let best = null;
  let bestScore = Infinity;
  for (const v of vehicles) {
    if (v === owner || v.broken) continue;
    const offset = v.pos.clone().sub(owner.pos);
    const dist = offset.length();
    const dot = offset.clone().normalize().dot(forward);
    if (dist > maxDist || dot < -0.25) continue;
    const score = dist * (1.35 - dot);
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

function spawnShot(owner, target, scene, M, weapon, muzzleFx) {
  if (!weapon || !target || target.broken || owner.fireCooldown > 0) return null;
  const style = projectileStyle(weapon);
  owner.fireCooldown = weapon.cooldown ?? 0.3;
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(style.size, 16, 10), new THREE.MeshStandardMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.8 }));
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(style.size * 0.25, style.size * 0.25, 0.6, 8), M.boost);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = -0.35;
  root.add(body, trail);
  const dir = fwd(owner.yaw);
  const pos = owner.pos.clone().addScaledVector(dir, 1.55).add(new THREE.Vector3(0, 0.55, 0));
  root.position.copy(pos);
  scene.add(root);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.muzzle.clone());
  flash.position.copy(pos);
  scene.add(flash);
  muzzleFx.push({ mesh: flash, age: 0, max: 0.15 });
  return { root, pos, vel: dir.multiplyScalar(weapon.speed), owner, target, weapon, life: style.life, homing: style.homing, pulse: 0 };
}

function createExplosion(pos, scene) {
  const root = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12), new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0xff5a00, emissiveIntensity: 1.2 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 10, 36), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 1 }));
  ring.rotation.x = Math.PI / 2;
  root.position.copy(pos);
  root.add(sphere, ring);
  scene.add(root);
  return { root, age: 0 };
}

function updateMuzzleFx(list, dt, scene) {
  for (let i = list.length - 1; i >= 0; i--) {
    const fx = list[i];
    fx.age += dt;
    const t = fx.age / fx.max;
    fx.mesh.scale.setScalar(1 + t * 2);
    fx.mesh.material.opacity = 1 - t;
    fx.mesh.material.transparent = true;
    if (fx.age >= fx.max) {
      scene.remove(fx.mesh);
      list.splice(i, 1);
    }
  }
}

function updateShots(shots, vehicles, explosions, scene, dt) {
  let msg = "";
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    s.pulse += dt * 12;
    if (s.life <= 0) {
      scene.remove(s.root);
      shots.splice(i, 1);
      continue;
    }
    if (s.target && !s.target.broken) {
      const desired = s.target.pos.clone().add(new THREE.Vector3(0, 0.45, 0)).sub(s.pos).normalize().multiplyScalar(s.weapon.speed);
      s.vel.lerp(desired, 1 - Math.exp(-s.homing * 6 * dt));
    }
    s.pos.addScaledVector(s.vel, dt);
    s.root.position.copy(s.pos);
    s.root.lookAt(s.pos.clone().add(s.vel));
    s.root.scale.setScalar(1 + Math.sin(s.pulse) * 0.08);
    for (const v of vehicles) {
      if (v === s.owner || v.broken) continue;
      if (s.pos.distanceTo(v.pos) < v.radius + 0.4) {
        const shieldHit = Math.min(v.shield || 0, s.weapon.power * 7);
        v.shield = Math.max(0, (v.shield || 0) - shieldHit);
        v.hp = Math.max(0, v.hp - s.weapon.power * 18 + shieldHit * 0.5);
        v.speed *= 0.4;
        if (v.hp <= 0) {
          v.broken = true;
          v.respawn = v.ai ? 3 : 2.2;
        }
        explosions.push(createExplosion(s.pos.clone(), scene));
        scene.remove(s.root);
        shots.splice(i, 1);
        msg = `${s.weapon.name} hit ${v.name}!`;
        break;
      }
    }
  }
  return msg;
}

function updateExplosions(explosions, dt, scene) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.age += dt;
    e.root.scale.setScalar(1 + e.age * 4);
    e.root.rotation.y += dt * 6;
    e.root.children.forEach((child, index) => {
      if (child.material) {
        child.material.transparent = true;
        child.material.opacity = 1 - e.age / 0.7;
      }
      if (index === 1) child.rotation.z += dt * 8;
    });
    if (e.age > 0.7) {
      scene.remove(e.root);
      explosions.splice(i, 1);
    }
  }
}

function updateBubbles(bubbles, player, track, dt, time, inventoryRef, selectedIdRef, commitInventory) {
  let msg = "";
  for (const b of bubbles) {
    if (!b.active) {
      b.respawn -= dt;
      if (b.respawn <= 0) {
        b.active = true;
        b.root.visible = true;
      }
      continue;
    }
    place(b.root, frame(track, b.t), b.lane, 0.95 + Math.sin(time * 2.4 + b.t * 9) * 0.08);
    b.root.rotation.y += dt * 0.8;
    b.root.children.forEach((child, idx) => {
      if (idx > 1) child.rotation.y += dt * 0.6;
    });
    if (player.pos.distanceTo(b.root.position) < player.radius + 0.65) {
      if (b.special) {
        player.boost = Math.min(100, player.boost + 45);
        player.hp = Math.min(player.maxHp, player.hp + 20);
        msg = "Collected boost repair";
      } else {
        const nextInventory = addWeaponToInventory(inventoryRef.current, b.weapon);
        const nextSelected = chooseSelected(nextInventory, selectedIdRef.current || b.weapon.id);
        commitInventory(nextInventory, nextSelected);
        msg = `Collected ${b.weapon.name}`;
      }
      b.active = false;
      b.respawn = b.special ? 8 : 10;
      b.root.visible = false;
    }
  }
  return msg;
}

function updateExplosiveCollisions(vehicles) {
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i];
      const b = vehicles[j];
      if (a.broken || b.broken) continue;
      const d = a.pos.distanceTo(b.pos);
      const min = a.radius + b.radius;
      if (d < min && d > 0.001) {
        const push = a.pos.clone().sub(b.pos).normalize();
        const overlap = (min - d) * 0.5;
        a.pos.addScaledVector(push, overlap);
        b.pos.addScaledVector(push, -overlap);
        const av = a.speed;
        a.speed = b.speed * 0.72;
        b.speed = av * 0.72;
        a.hp = Math.max(0, a.hp - 0.12);
        b.hp = Math.max(0, b.hp - 0.12);
      }
    }
  }
}

function rankOf(player, vehicles) {
  const sorted = [...vehicles].sort((a, b) => b.progress - a.progress);
  return `${sorted.findIndex((v) => v === player) + 1}/${vehicles.length}`;
}

function miniMapStyleFor(v, player) {
  const dx = (v.pos.x - player.pos.x) * 0.45;
  const dz = (v.pos.z - player.pos.z) * 0.45;
  return {
    left: `${50 + clamp(dx, -42, 42)}%`,
    top: `${50 + clamp(dz, -42, 42)}%`,
    opacity: v.broken ? 0.35 : 1,
  };
}

export default function WeaponKartGameMobileAssets({ onExit, onOpenGarage }: { onExit?: () => void; onOpenGarage?: () => void }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({
    loading: true,
    status: "Loading Ferrari, Buggy, and weapon assets...",
    weapon: "None",
    ammo: 0,
    targets: 3,
    hp: 100,
    shield: 20,
    boost: 45,
    lap: 1,
    laps: TRACK.lapsToWin,
    rank: "1/4",
    speed: 0,
    message: "Mobile controls ready",
    countdown: 3,
    finished: false,
    finishText: "",
    vehicles: [],
  });
  const [inventoryUi, setInventoryUi] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const inventoryRef = useRef([]);
  const selectedIdRef = useRef(null);
  const touch = useRef({ brake: false, boost: false, fire: false });
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let raf = 0;
    let cancelled = false;
    const restore = patchTextures();
    const M = mats();
    const track = makeTrack();
    const { loader, draco } = makeLoader();
    const input = { keys: {}, steer: 0, accel: 0, brake: false, boost: false, driveId: null, sx: 0, sy: 0, lookId: null, lx: 0, ly: 0, camYaw: 0, camPitch: 0.22, tapStartX: 0, tapStartY: 0, tapTime: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    touch.current = { brake: false, boost: false, fire: false };

    const commitInventory = (list, nextSelected = null) => {
      const clone = list.map((item) => ({ ...item }));
      inventoryRef.current = clone;
      const safeSelected = chooseSelected(clone, nextSelected ?? selectedIdRef.current);
      selectedIdRef.current = safeSelected;
      setSelectedId(safeSelected);
      setInventoryUi(clone.map((item) => ({ ...item })));
    };

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch (error) {
      restore();
      draco.dispose();
      disposeRacingResources(...Object.values(M));
      throw error; // Let the app's game boundary offer a retry/back action.
    }
    renderer.setClearColor(track.sky, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(track.sky, 65, track.fogFar);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 280);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x304030, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-34, 50, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xa7c6ff, 0.42));

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const keyDown = (e) => {
      input.keys[e.code] = true;
      if (e.code === "KeyF") touch.current.fire = true;
      const n = Number(e.key);
      if (n >= 1 && n <= inventoryRef.current.length) {
        const item = inventoryRef.current[n - 1];
        if (item) {
          selectedIdRef.current = item.id;
          setSelectedId(item.id);
        }
      }
    };
    const keyUp = (e) => {
      input.keys[e.code] = false;
    };

    let vehicles = [];
    let enemyRoots = [];
    let player = null;
    const shots = [];
    const explosions = [];
    const bubbles = [];
    const muzzleFx = [];
    let phase = "countdown";
    let countdownStart = performance.now();

    const fireAtTarget = (target) => {
      if (!player || !target) return "No target";
      const current = getSelectedWeapon(inventoryRef.current, selectedIdRef.current);
      if (!current) return "Collect a weapon first";
      if (current.ammo <= 0) return "Selected weapon has no ammo";
      if (player.fireCooldown > 0) return "Weapon cooling down";
      current.ammo -= 1;
      const nextInventory = inventoryRef.current.map((item) => item.id === current.id ? { ...item, ammo: current.ammo } : { ...item });
      commitInventory(nextInventory, current.id);
      const shot = spawnShot(player, target, scene, M, { ...current, ammo: current.ammo }, muzzleFx);
      if (shot) {
        shots.push(shot);
        return `Fired ${current.name} at ${target.name}`;
      }
      return "Could not fire";
    };

    const tryShootAt = (clientX, clientY) => {
      if (!player) return "";
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(enemyRoots, true)[0];
      if (hit) {
        let targetRoot = hit.object;
        while (targetRoot && !targetRoot.userData.vehicle) targetRoot = targetRoot.parent;
        const target = vehicles.find((v) => v.root === targetRoot);
        if (target && !target.broken) return fireAtTarget(target);
      }
      const auto = nearestTarget(player, vehicles, 72);
      if (auto) return fireAtTarget(auto);
      return "No enemy in front";
    };

    const pointerDown = (e) => {
      if (e.target.closest?.("button")) return;
      const r = canvas.getBoundingClientRect();
      canvas.setPointerCapture(e.pointerId);
      input.tapStartX = e.clientX;
      input.tapStartY = e.clientY;
      input.tapTime = performance.now();
      if (e.clientX - r.left < r.width * 0.52 && input.driveId === null) {
        input.driveId = e.pointerId;
        input.sx = e.clientX;
        input.sy = e.clientY;
      } else {
        input.lookId = e.pointerId;
        input.lx = e.clientX;
        input.ly = e.clientY;
      }
    };

    const pointerMove = (e) => {
      if (input.driveId === e.pointerId) {
        input.steer = clamp((e.clientX - input.sx) / 90, -1, 1);
        input.accel = clamp(-(e.clientY - input.sy) / 80, -0.6, 1);
      }
      if (input.lookId === e.pointerId) {
        input.camYaw -= (e.clientX - input.lx) * 0.005;
        input.camPitch = clamp(input.camPitch + (e.clientY - input.ly) * 0.003, -0.05, 0.72);
        input.lx = e.clientX;
        input.ly = e.clientY;
      }
    };

    const pointerUp = (e) => {
      const moved = Math.hypot(e.clientX - input.tapStartX, e.clientY - input.tapStartY);
      const quickTap = e.type === "pointerup" && moved < 12 && performance.now() - input.tapTime < 260;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (input.driveId === e.pointerId) {
        input.driveId = null;
        input.steer = 0;
        input.accel = 0;
      }
      if (input.lookId === e.pointerId) {
        if (quickTap && phase === "race") {
          const msg = tryShootAt(e.clientX, e.clientY);
          if (msg) setHud((prev) => ({ ...prev, message: msg }));
        }
        input.lookId = null;
      }
    };

    const releaseControls = () => {
      for (const id of [input.driveId, input.lookId]) {
        if (id !== null) try { canvas.releasePointerCapture(id); } catch {}
      }
      input.keys = {};
      input.driveId = input.lookId = null;
      input.steer = input.accel = 0;
      input.brake = input.boost = false;
      touch.current = { brake: false, boost: false, fire: false };
    };
    const visibilityChanged = () => { if (document.hidden) releaseControls(); };
    window.addEventListener("blur", releaseControls);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);

    async function start() {
      buildTrack(scene, track, M);
      setHud((prev) => ({ ...prev, loading: true, status: "Loading original Ferrari + Buggy assets...", message: "Loading vehicles" }));
      const [ferrari, buggy] = await Promise.all([
        loadVehicle(loader, [FERRARI], M, "ferrari"),
        loadVehicle(loader, [BUGGY, BUGGY_RAW], M, "kart"),
      ]);
      if (cancelled) {
        disposeRacingResources(ferrari, buggy);
        return;
      }

      vehicles = [
        createVehicleGroup(ferrari, track, 0.01, 0, false, "Player Ferrari", 1.5),
        createVehicleGroup(cloneObject(buggy), track, 0.98, 1.4, true, "Enemy Go-Kart", 1.35),
        createVehicleGroup(cloneObject(ferrari), track, 0.965, -1.4, true, "Enemy Ferrari", 1.5),
        createVehicleGroup(cloneObject(buggy), track, 0.94, 0, true, "Enemy Kart 2", 1.35),
      ];
      vehicles.forEach((v) => scene.add(v.root));
      enemyRoots = vehicles.filter((v) => v.ai).map((v) => v.root);
      player = vehicles[0];

      setHud((prev) => ({ ...prev, status: "Loading original weapon bubble models...", message: "Loading weapon bubbles" }));
      for (let i = 0; i < WEAPONS.length; i++) {
        const lane = (i % 3 - 1) * 1.55;
        const t = (i + 1) / (WEAPONS.length + 3);
        const bubble = await loadWeaponBubble(loader, M, WEAPONS[i], track, t, lane);
        if (cancelled) {
          disposeRacingResources(bubble.root);
          return;
        }
        scene.add(bubble.root);
        bubbles.push(bubble);
      }
      for (let i = 0; i < 6; i++) {
        const t = 0.08 + i * 0.15;
        const lane = i % 2 ? 2.1 : -2.1;
        const bubble = makeBoostBubble(M, track, t, lane);
        scene.add(bubble.root);
        bubbles.push(bubble);
      }

      commitInventory([], null);
      let last = performance.now();
      let message = "Semi-auto steering active";
      countdownStart = performance.now();
      phase = "countdown";

      const updateCamera = (dt) => {
        const yaw = player.yaw + Math.PI + input.camYaw * 0.35;
        const back = fwd(yaw).multiplyScalar(10.8);
        const desired = player.pos.clone().add(back).add(new THREE.Vector3(0, 4.2 + input.camPitch * 4, 0));
        camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
        camera.lookAt(player.pos.clone().add(new THREE.Vector3(0, 1.1 + input.camPitch * 1.4, 0)).addScaledVector(fwd(player.yaw), 4.8));
      };

      const finishRace = () => {
        if (phase === "finished") return;
        phase = "finished";
        const sorted = [...vehicles].sort((a, b) => b.progress - a.progress);
        const place = sorted.findIndex((v) => v === player) + 1;
        message = place === 1 ? "Victory! You won the Alpine Grand Loop." : `Finished P${place}. Restart to try again.`;
      };

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        const time = now * 0.001;
        last = now;

        const cd = Math.max(0, 3 - Math.floor((now - countdownStart) / 1000));
        if (phase === "countdown" && now - countdownStart > 3200) {
          phase = "race";
          message = "GO! Collect weapon bubbles and tap enemies to shoot.";
        }

        input.brake = Boolean(touch.current.brake);
        input.boost = Boolean(touch.current.boost);
        updateVehicle(player, input, track, dt, phase);
        vehicles.slice(1).forEach((v) => {
          updateVehicle(v, null, track, dt, phase);
          if (phase === "race" && !v.broken && v.fireCooldown <= 0 && v.pos.distanceTo(player.pos) < 56 && Math.sin(time * 0.8 + v.radius * 5) > 0.988) {
            const w = WEAPONS[(Math.floor(time + v.radius * 10) % 5) + 1] || WEAPONS[1];
            const shot = spawnShot(v, player, scene, M, w, muzzleFx);
            if (shot) shots.push(shot);
          }
        });
        updateExplosiveCollisions(vehicles);

        if (phase === "race" && touch.current.fire) {
          touch.current.fire = false;
          const target = nearestTarget(player, vehicles, 76);
          if (target) message = fireAtTarget(target);
          else message = "No enemy in front";
        }

        const collectMsg = updateBubbles(bubbles, player, track, dt, time, inventoryRef, selectedIdRef, commitInventory);
        if (collectMsg) message = collectMsg;
        const shotMsg = updateShots(shots, vehicles, explosions, scene, dt);
        if (shotMsg) message = shotMsg;
        updateExplosions(explosions, dt, scene);
        updateMuzzleFx(muzzleFx, dt, scene);

        vehicles.forEach((v) => {
          if (v.lap >= track.lapsToWin) finishRace();
        });

        const alive = vehicles.filter((v) => v.ai && !v.broken).length;
        const selected = getSelectedWeapon(inventoryRef.current, selectedIdRef.current);
        updateCamera(dt);
        setHud({
          loading: false,
          status: phase === "finished" ? "Race finished" : phase === "countdown" ? "Get ready" : "Drive · collect weapons · tap enemy or FIRE",
          weapon: selected?.name || "None",
          ammo: selected?.ammo || 0,
          targets: alive,
          hp: Math.round(player.hp),
          shield: Math.round(player.shield || 0),
          boost: Math.round(player.boost || 0),
          lap: clamp(player.lap + 1, 1, track.lapsToWin),
          laps: track.lapsToWin,
          rank: rankOf(player, vehicles),
          speed: Math.round(Math.abs(player.speed) * 3.6),
          message,
          countdown: cd,
          finished: phase === "finished",
          finishText: phase === "finished" ? [...vehicles].sort((a, b) => b.progress - a.progress).map((v, i) => `${i + 1}. ${v.name}`).join(" · ") : "",
          vehicles: vehicles.map((v) => ({ name: v.name, ai: v.ai, broken: v.broken, style: player ? miniMapStyleFor(v, player) : {} })),
        });
        renderer.render(scene, camera);
      };
      loop();
    }

    start().catch((error) => {
      if (cancelled) return;
      console.error("Racing Royal could not start", error);
      setHud((prev) => ({ ...prev, status: "Could not start the race. Tap RESTART to retry or GAMES to exit.", message: "Loading failed" }));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      releaseControls();
      restore();
      draco.dispose();
      disposeRacingResources(scene, ...Object.values(M));
      renderer.dispose();
      window.removeEventListener("blur", releaseControls);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [restartKey]);

  const btnBase = {
    pointerEvents: "auto",
    border: "1px solid rgba(255,255,255,.25)",
    color: "white",
    boxShadow: "0 12px 28px rgba(0,0,0,.24)",
    fontWeight: 900,
    touchAction: "none",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <div data-testid="supplied-racing-royal" style={{ position: "fixed", inset: 0, zIndex: 60, overflow: "hidden", background: "#85c7f2", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", color: "white", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
        <div style={{ position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: 10, right: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "start" }}>
            <div style={{ background: "rgba(0,0,0,.58)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 16, padding: "10px 12px", maxWidth: 840, backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 12, fontWeight: 950, textTransform: "uppercase", color: "#ffd166" }}>Ferrari + Go-Kart Weapon Bubble Game</div>
              <div style={{ fontSize: 13, fontWeight: 850 }}>{hud.status}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>Lap {hud.lap}/{hud.laps} · Pos {hud.rank} · Speed {hud.speed} km/h · Enemies {hud.targets}</div>
              <div style={{ fontSize: 11, opacity: 0.82 }}>Selected: {hud.weapon} · Ammo: {hud.ammo} · HP: {hud.hp} · Shield: {hud.shield} · Boost: {hud.boost}%</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>Left drag = drive · right drag = camera · tap enemy or FIRE = shoot</div>
              {hud.message && <div style={{ marginTop: 3, fontSize: 12, fontWeight: 950, color: "#ffd166" }}>{hud.message}</div>}
            </div>
            <div style={{ display: 'grid', gap: 6, flexShrink: 0 }}>
            {onExit && <button onClick={onExit} style={{ ...btnBase, borderRadius: 14, padding: '10px 11px', background: 'rgba(0,0,0,.55)', fontSize: 11 }}>GAMES</button>}
            {onOpenGarage && <button onClick={onOpenGarage} style={{ ...btnBase, borderRadius: 14, padding: '10px 11px', background: 'rgba(0,0,0,.55)', fontSize: 11 }}>TPG / MODES</button>}
            <button
              onClick={() => setRestartKey((n) => n + 1)}
              style={{ ...btnBase, pointerEvents: "auto", borderRadius: 14, padding: "10px 11px", background: "rgba(0,0,0,.55)", fontSize: 11 }}
            >
              RESTART
            </button>
            <div style={{ width: 86, height: 86, justifySelf: 'end', position: 'relative', borderRadius: 16, background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.14)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, marginLeft: -2, marginTop: -2, borderRadius: 10, background: '#ffd166' }} />
              {hud.vehicles.map((v, i) => (
                <div key={`${v.name}-${i}`} style={{ position: 'absolute', width: v.ai ? 7 : 9, height: v.ai ? 7 : 9, marginLeft: -4, marginTop: -4, borderRadius: 999, background: v.ai ? '#ff4d4d' : '#48d8ff', boxShadow: '0 0 8px rgba(255,255,255,.5)', ...v.style }} />
              ))}
            </div>
            </div>
          </div>
          {hud.finishText && <div style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "8px 10px", fontSize: 11, fontWeight: 850 }}>{hud.finishText}</div>}
        </div>

        {hud.loading && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", background: "rgba(10,20,35,.18)" }}>
            <div style={{ background: "rgba(0,0,0,.62)", borderRadius: 22, padding: "18px 20px", border: "1px solid rgba(255,255,255,.18)", width: "min(82vw, 360px)" }}>
              <div style={{ fontSize: 16, fontWeight: 950, color: "#ffd166" }}>Loading original assets</div>
              <div style={{ marginTop: 5, fontSize: 12, opacity: 0.86 }}>{hud.status}</div>
            </div>
          </div>
        )}

        {!hud.loading && hud.countdown > 0 && !hud.finished && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div style={{ background: "rgba(0,0,0,.38)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 26, padding: "18px 26px", backdropFilter: "blur(6px)" }}>
              <div style={{ fontSize: 64, lineHeight: 1, fontWeight: 1000, textShadow: "0 10px 28px rgba(0,0,0,.38)" }}>{hud.countdown}</div>
              <div style={{ fontSize: 12, fontWeight: 850 }}>Get ready</div>
            </div>
          </div>
        )}

        <div style={{ position: "absolute", left: 14, bottom: 110, width: 126, height: 126, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", background: "radial-gradient(circle, rgba(255,255,255,.16), rgba(0,0,0,.22))", display: "grid", placeItems: "center", textAlign: "center", fontSize: 11, fontWeight: 900, opacity: 0.9 }}>
          DRAG<br />DRIVE
        </div>

        <div style={{ position: "absolute", right: 14, bottom: 104, display: "grid", gap: 9, justifyItems: "end" }}>
          <button
            onPointerDown={() => (touch.current.fire = true)}
            style={{ ...btnBase, width: 86, height: 86, borderRadius: 999, background: "rgba(255,108,37,.72)", fontSize: 15 }}
          >
            FIRE
          </button>
          <button
            onPointerDown={() => (touch.current.boost = true)}
            onPointerUp={() => (touch.current.boost = false)}
            onPointerCancel={() => (touch.current.boost = false)}
            onPointerLeave={() => (touch.current.boost = false)}
            style={{ ...btnBase, width: 78, height: 62, borderRadius: 18, background: "rgba(30,220,255,.38)", fontSize: 12 }}
          >
            BOOST
          </button>
          <button
            onPointerDown={() => (touch.current.brake = true)}
            onPointerUp={() => (touch.current.brake = false)}
            onPointerCancel={() => (touch.current.brake = false)}
            onPointerLeave={() => (touch.current.brake = false)}
            style={{ ...btnBase, width: 78, height: 58, borderRadius: 18, background: "rgba(0,0,0,.48)", fontSize: 12 }}
          >
            BRAKE
          </button>
        </div>

        <div style={{ position: "absolute", left: 12, right: 12, bottom: "max(12px, env(safe-area-inset-bottom))", display: "flex", gap: 8, overflowX: "auto", pointerEvents: "auto", paddingBottom: 4 }}>
          {inventoryUi.length === 0 && (
            <div style={{ background: "rgba(0,0,0,.55)", color: "white", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(255,255,255,.14)", fontSize: 12, whiteSpace: "nowrap" }}>
              Collect weapon bubbles to unlock weapons
            </div>
          )}
          {inventoryUi.map((item) => {
            const selected = item.id === selectedId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  selectedIdRef.current = item.id;
                  setSelectedId(item.id);
                }}
                style={{ minWidth: 88, height: 62, borderRadius: 16, border: selected ? "2px solid #ffd166" : "1px solid rgba(255,255,255,.18)", background: selected ? "rgba(255,186,56,.2)" : "rgba(5,9,18,.68)", color: "white", boxShadow: selected ? "0 0 0 2px rgba(255,209,102,.18), 0 10px 20px rgba(0,0,0,.25)" : "0 8px 18px rgba(0,0,0,.24)", display: "grid", alignContent: "center", justifyItems: "center", gap: 2, flexShrink: 0, transform: selected ? "translateY(-2px) scale(1.02)" : "none", touchAction: "manipulation" }}
              >
                <div style={{ fontSize: 16, fontWeight: 950 }}>{item.icon || item.name.slice(0, 2).toUpperCase()}</div>
                <div style={{ fontSize: 10, fontWeight: 850, lineHeight: 1, textAlign: "center" }}>{item.name}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Ammo {item.ammo}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
