"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const TAU = Math.PI * 2;
const WEAPON_COUNT = 18;
const VEHICLE_COUNT = 2;
const AIRCRAFT_COUNT = 3;
const EQUIPMENT_COUNT = 3;
const TOTAL_ITEMS = WEAPON_COUNT + VEHICLE_COUNT + AIRCRAFT_COUNT + EQUIPMENT_COUNT;

const TRACK = { outerX: 44, outerZ: 26, innerX: 29, innerZ: 12, centerX: 36, centerZ: 19, wobble: 0.08 };
const HUD_ICONS = { FIREARM: "🔫", MISSILE: "🚀", DRONE: "🛸", HELICOPTER: "🚁", JET: "✈️", TRUCK: "🚒", RADAR: "📡", BOOST: "⚡", AUTO: "🧠" };

const SAMPLE = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0";
const RAW_SAMPLE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";
const FERRARI = "https://threejs.org/examples/models/gltf/ferrari.glb";
const BUGGY = `${SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;
const BUGGY_RAW = `${RAW_SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;
const MILITARY_HOSTS = [
  "https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main",
  "https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main",
  "https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main"
];
const militaryUrls = (filename) => MILITARY_HOSTS.map((host) => `${host}/${filename}`);

const KNOWN_WORKING_GLB = {
  awp: "https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb",
  awpRaw: "https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb",
  mrtk: "https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
  mrtkRaw: "https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb",
  pistolHolster: "https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb",
  pistolHolsterRaw: "https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb",
  fps: "https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf",
  fpsRaw: "https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf"
};

const DISPLAY_ITEMS = [
  { id: "poly-shotgun-01", kind: "weapon", urls: ["https://static.poly.pizza/032e6589-3188-41bc-b92b-e25528344275.glb"] },
  { id: "poly-assault-rifle-01", kind: "weapon", urls: ["https://static.poly.pizza/b3e6be61-0299-4866-a227-58f5f3fe610b.glb"] },
  { id: "poly-pistol-01", kind: "weapon", urls: ["https://static.poly.pizza/3b53f0fe-f86e-451c-816d-6ab9bd265cdc.glb"] },
  { id: "poly-revolver-01", kind: "weapon", urls: ["https://static.poly.pizza/9e728565-67a3-44db-9567-982320abff09.glb"] },
  { id: "poly-sawed-off-01", kind: "weapon", urls: ["https://static.poly.pizza/9a6ee0ee-068b-4774-8b0f-679c3cef0b6e.glb"] },
  { id: "poly-revolver-02", kind: "weapon", urls: ["https://static.poly.pizza/7951b3b9-d3a5-4ec8-81b7-11111f1c8e88.glb"] },
  { id: "poly-shotgun-02", kind: "weapon", urls: ["https://static.poly.pizza/f71d6771-f512-4374-bd23-ba00b564db68.glb"] },
  { id: "poly-shotgun-03", kind: "weapon", urls: ["https://static.poly.pizza/08f27141-8e64-425a-9161-1bbd6956dfca.glb"] },
  { id: "poly-smg-01", kind: "weapon", urls: ["https://static.poly.pizza/fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710.glb"] },
  { id: "slot-10-ak47-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf", KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] },
  { id: "slot-11-krsv-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf", KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw] },
  { id: "slot-12-smith-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf", KNOWN_WORKING_GLB.pistolHolster, KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: "slot-13-mosin-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf", KNOWN_WORKING_GLB.awp] },
  { id: "slot-14-uzi-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf", KNOWN_WORKING_GLB.mrtk] },
  { id: "slot-15-sigsauer-gltf", kind: "weapon", urls: ["https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf", KNOWN_WORKING_GLB.pistolHolster] },
  { id: "slot-16-awp-glb", kind: "weapon", urls: [KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] },
  { id: "slot-17-mrtk-gun-glb", kind: "weapon", urls: [KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw] },
  { id: "slot-18-fps-gun-gltf", kind: "weapon", urls: [KNOWN_WORKING_GLB.fps, KNOWN_WORKING_GLB.fpsRaw] },
  { id: "vehicle-ferrari", kind: "vehicle", urls: [FERRARI] },
  { id: "vehicle-buggy", kind: "vehicle", urls: [BUGGY, BUGGY_RAW, FERRARI] },
  { id: "air-drone", kind: "aircraft", urls: militaryUrls("drone.glb") },
  { id: "air-heli", kind: "aircraft", urls: militaryUrls("helicopter.glb") },
  { id: "air-jet", kind: "aircraft", urls: militaryUrls("f15.glb") },
  { id: "equip-rocket", kind: "equipment", urls: militaryUrls("atlas_v.glb") },
  { id: "equip-antenna", kind: "equipment", urls: militaryUrls("antenna.glb") },
  { id: "equip-truck", kind: "equipment", urls: militaryUrls("fire_truck.glb") }
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pointOnTrack = (angle, lane = 0) => {
  const mod = 1 + Math.sin(angle * 3) * TRACK.wobble + Math.cos(angle * 5) * TRACK.wobble * 0.45;
  return new THREE.Vector3(Math.cos(angle) * (TRACK.centerX + lane) * mod, 0.2 + Math.sin(angle * 2.5) * 0.5, Math.sin(angle) * (TRACK.centerZ + lane * 0.45) * mod);
};
const tangentYaw = (angle) => {
  const e = 0.01;
  const p1 = pointOnTrack(angle, 0);
  const p2 = pointOnTrack(angle + e, 0);
  return Math.atan2(p2.x - p1.x, p2.z - p1.z);
};

function runSelfTests() {
  if (DISPLAY_ITEMS.length !== TOTAL_ITEMS) throw new Error(`Expected ${TOTAL_ITEMS} items`);
}
runSelfTests();

function cloneModel(model) { return SkeletonUtils.clone(model); }
function disposeObject(root) {
  root?.traverse?.((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"].forEach((k) => m[k]?.dispose?.());
      m.dispose?.();
    });
  });
}
function configureModel(model, renderer) {
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"].forEach((k) => {
        const tex = m[k];
        if (!tex) return;
        if (k === "map" || k === "emissiveMap") tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
      });
      m.needsUpdate = true;
    });
  });
}
function fitModel(model, target = 1.4, lift = 0.06, yaw = 0) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = target / Math.max(size.x, size.y, size.z, 0.0001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model);
  const c = b2.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y += -b2.min.y + lift;
  model.rotation.y += yaw;
}
function makeLoader(url) {
  const manager = new THREE.LoadingManager();
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  manager.setURLModifier((resource) => (/^(https?:)?\/\//i.test(resource) || resource.startsWith("data:") || resource.startsWith("blob:")) ? resource : new URL(resource, base).toString());
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  loader.setCrossOrigin("anonymous");
  return loader;
}
async function loadByUrls(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      const loader = makeLoader(url);
      const gltf = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(`Timeout ${url}`)), 22000);
        loader.load(url, (v) => { clearTimeout(timeout); resolve(v); }, undefined, (e) => { clearTimeout(timeout); reject(e); });
      });
      return { gltf, url };
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error("All urls failed");
}

function createTrack(scene) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(98, 72), new THREE.MeshStandardMaterial({ color: 0x173421, roughness: 0.96 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.03;
  scene.add(grass);
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, TRACK.outerX, TRACK.outerZ, 0, TAU, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, TRACK.innerX, TRACK.innerZ, 0, TAU, true, 0);
  shape.holes.push(hole);
  const road = new THREE.Mesh(new THREE.ShapeGeometry(shape, 300), new THREE.MeshStandardMaterial({ color: 0x2d3138, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  scene.add(road);
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * TAU;
    const p = pointOnTrack(a, i % 2 ? 8.5 : -8.5);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 10, 18), new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.96 }));
    tire.position.copy(p).add(new THREE.Vector3(0, 0.24, 0));
    tire.rotation.x = Math.PI / 2;
    tire.rotation.z = tangentYaw(a);
    scene.add(tire);
  }
}

export default function GoCrazyGame() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ status: "Loading", speed: 0, weapon: "FIREARM", ammo: 999, alert: "", features: ["AUTO", "BOOST", "RADAR"] });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x81bfe8, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x81bfe8, 40, 150);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 220);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3d2d, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-16, 28, 18);
    sun.castShadow = true;
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
    window.addEventListener("resize", resize);

    createTrack(scene);

    const input = { keys: {}, steer: 0, accel: 0, brake: false, autoDrive: false, boost: false, radar: true, fire: false };
    window.addEventListener("keydown", (e) => {
      input.keys[e.code] = true;
      if (e.code === "KeyR") input.radar = !input.radar;
      if (e.code === "KeyB") input.boost = !input.boost;
      if (e.code === "KeyT") input.autoDrive = !input.autoDrive;
      if (e.code === "KeyF") input.fire = true;
    });
    window.addEventListener("keyup", (e) => { input.keys[e.code] = false; });

    const player = { pos: pointOnTrack(Math.PI / 2, 0), yaw: tangentYaw(Math.PI / 2), speed: 0, lap: 1, progress: Math.PI / 2, ammo: { FIREARM: 999, MISSILE: 4, DRONE: 2, HELICOPTER: 1, JET: 1 }, weapon: "FIREARM", hp: 100 };
    const ai = [0, 1, 2, 3].map((i) => ({ pos: pointOnTrack(Math.PI / 2 - 0.3 - i * 0.2, i % 2 ? 1 : -1), yaw: tangentYaw(Math.PI / 2 - 0.3 - i * 0.2), speed: 10 + i, progress: 0, hp: 100, name: `AI-${i + 1}` }));
    const karts = [];

    function fallbackKart(color) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })));
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.76), new THREE.MeshStandardMaterial({ color: 0x2f3540 }));
      top.position.set(0.2, 0.3, 0);
      g.add(top);
      return g;
    }

    async function loadCoreVehicles() {
      const loadNames = [["player", [FERRARI]], ["ai1", [BUGGY, BUGGY_RAW]], ["ai2", [BUGGY, BUGGY_RAW]], ["ai3", [FERRARI]], ["ai4", [BUGGY, BUGGY_RAW]]];
      for (let i = 0; i < loadNames.length; i++) {
        const isPlayer = i === 0;
        let model = null;
        try {
          const { gltf } = await loadByUrls(loadNames[i][1]);
          model = cloneModel(gltf.scene);
          configureModel(model, renderer);
          fitModel(model, isPlayer ? 2.8 : 2.4, 0.08, Math.PI);
        } catch {
          model = fallbackKart(isPlayer ? 0xff3b30 : 0x31b8ff);
        }
        scene.add(model);
        karts.push(model);
      }
    }

    const parkedTemplates = {};
    const parkedUnits = [];
    async function loadSupportUnits() {
      const defs = [{ key: "DRONE", urls: militaryUrls("drone.glb"), lane: 11.2 }, { key: "HELICOPTER", urls: militaryUrls("helicopter.glb"), lane: -11.2 }, { key: "JET", urls: militaryUrls("f15.glb"), lane: 10.5 }, { key: "TRUCK", urls: militaryUrls("fire_truck.glb"), lane: -10.5 }];
      for (let i = 0; i < defs.length; i++) {
        let node;
        try {
          const { gltf } = await loadByUrls(defs[i].urls);
          node = cloneModel(gltf.scene);
          configureModel(node, renderer);
          fitModel(node, 5.8, 0.2, 0);
        } catch {
          node = fallbackKart(0x88ffad);
          fitModel(node, 4.5, 0.2, 0);
        }
        const a = (i / defs.length) * TAU + 0.3;
        node.position.copy(pointOnTrack(a, defs[i].lane));
        node.rotation.y = tangentYaw(a);
        scene.add(node);
        parkedUnits.push({ key: defs[i].key, node, phase: Math.random() * TAU, baseY: node.position.y, angle: a });
        parkedTemplates[defs[i].key] = node;
      }
    }

    const pickups = [];
    async function loadPickupGallery() {
      for (let i = 0; i < DISPLAY_ITEMS.length; i++) {
        const item = DISPLAY_ITEMS[i];
        const slot = new THREE.Group();
        const a = (i / DISPLAY_ITEMS.length) * TAU;
        slot.position.copy(pointOnTrack(a, i % 2 ? 2.2 : -2.2));
        let visual;
        try {
          const { gltf } = await loadByUrls(item.urls);
          visual = cloneModel(gltf.scene);
          configureModel(visual, renderer);
          fitModel(visual, item.kind === "weapon" ? 1.2 : 1.7, 0.05, item.kind === "weapon" ? Math.PI : 0);
        } catch {
          visual = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xf5cc66 }));
        }
        slot.add(visual);
        const color = item.kind === "weapon" ? 0x8fd3ff : item.kind === "aircraft" ? 0x8dffad : 0xffba8f;
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.96, 16, 14), new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.2), transparent: true, opacity: 0.35 }));
        bubble.position.y = 0.14;
        bubble.userData.bubble = true;
        slot.add(bubble);
        scene.add(slot);
        pickups.push({ slot, item, taken: false, angle: a, baseY: slot.position.y, spin: 1.2 + Math.random() * 0.7 });
      }
    }

    const missiles = [];
    const airStrikes = [];
    function spawnMissile(from, target) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0x4f1a00 }));
      m.position.copy(from);
      scene.add(m);
      missiles.push({ mesh: m, vel: target.clone().sub(from).normalize().multiplyScalar(38), ttl: 2.4, target });
      setHud((h) => ({ ...h, alert: "Incoming missile detected ⚠️" }));
    }

    function callCinematicSupport(kind, targetPos) {
      const src = parkedTemplates[kind];
      if (!src) return;
      const craft = cloneModel(src);
      fitModel(craft, 5.4, 0.06, 0);
      craft.position.copy(player.pos).add(new THREE.Vector3(-8, 0.8, -8));
      scene.add(craft);
      airStrikes.push({ kind, craft, targetPos: targetPos.clone(), phase: Math.random() * TAU, ttl: 4, stage: "entry", fired: false });
    }

    const clock = new THREE.Clock();
    Promise.all([loadCoreVehicles(), loadSupportUnits(), loadPickupGallery()]).then(() => {
      const animate = () => {
        if (cancelled) return;
        frame = requestAnimationFrame(animate);
        const dt = Math.min(0.033, clock.getDelta());
        const now = performance.now();

        const accel = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0);
        const steer = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0);
        const autoAngle = Math.atan2(player.pos.z / TRACK.centerZ, player.pos.x / TRACK.centerX);
        const autoYaw = tangentYaw(autoAngle + 0.3);

        const controlSteer = input.autoDrive ? clamp(Math.atan2(Math.sin(autoYaw - player.yaw), Math.cos(autoYaw - player.yaw)), -1, 1) : steer;
        const controlAccel = input.autoDrive ? 0.85 : accel;
        const maxSpeed = input.boost ? 25 : 16;

        player.speed += controlAccel * 22 * dt;
        player.speed *= Math.exp(-0.9 * dt);
        player.speed = clamp(player.speed, -4, maxSpeed);
        player.yaw -= controlSteer * dt * 1.8;
        player.pos.add(new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(player.speed * dt));

        if (karts[0]) {
          karts[0].position.copy(player.pos);
          karts[0].rotation.y = player.yaw;
        }
        ai.forEach((bot, i) => {
          const targ = pointOnTrack(Math.atan2(bot.pos.z / TRACK.centerZ, bot.pos.x / TRACK.centerX) + 0.5, i % 2 ? 1 : -1);
          const desired = Math.atan2(targ.x - bot.pos.x, targ.z - bot.pos.z);
          bot.yaw += Math.atan2(Math.sin(desired - bot.yaw), Math.cos(desired - bot.yaw)) * dt * 2.5;
          bot.speed = lerp(bot.speed, 12 - i * 0.8, 1 - Math.exp(-1.4 * dt));
          bot.pos.add(new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw)).multiplyScalar(bot.speed * dt));
          if (karts[i + 1]) {
            karts[i + 1].position.copy(bot.pos);
            karts[i + 1].rotation.y = bot.yaw;
          }
          if (input.radar && bot.pos.distanceTo(player.pos) < 16 && Math.random() < dt * 0.6) {
            spawnMissile(bot.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), player.pos.clone().add(new THREE.Vector3(0, 0.7, 0)));
          }
        });

        parkedUnits.forEach((u, idx) => {
          const t = now * 0.001 + u.phase;
          u.node.position.y = u.baseY + Math.sin(t * (u.key === "DRONE" ? 2.8 : 1.8)) * (u.key === "JET" ? 0.03 : 0.08);
          u.node.rotation.y += dt * (u.key === "DRONE" ? 1.2 : 0.25);
          if (u.key === "HELICOPTER") u.node.rotation.z = Math.sin(t * 1.4) * 0.05;
          if (u.key === "JET") u.node.rotation.z = Math.sin(t * 0.9) * 0.08;
          if (u.key === "TRUCK") u.node.rotation.x = Math.sin(t * 1.2) * 0.02;
        });

        pickups.forEach((p, i) => {
          if (p.taken) return;
          p.slot.rotation.y += dt * p.spin;
          p.slot.position.y = p.baseY + Math.sin(now * 0.003 + i) * 0.09;
          const bubble = p.slot.children.find((n) => n.userData?.bubble);
          if (bubble) {
            bubble.scale.setScalar(1 + Math.sin(now * 0.004 + i) * 0.06);
            bubble.material.opacity = 0.33 + Math.sin(now * 0.002 + i) * 0.08;
          }
          if (p.slot.position.distanceTo(player.pos) < 1.6) {
            p.taken = true;
            p.slot.visible = false;
            if (p.item.kind === "weapon") player.weapon = p.item.id.includes("rocket") ? "MISSILE" : "FIREARM";
            if (p.item.id.includes("rocket")) player.ammo.MISSILE += 1;
            if (p.item.id.includes("drone")) player.ammo.DRONE += 1;
            if (p.item.id.includes("helicopter")) player.ammo.HELICOPTER += 1;
            if (p.item.id.includes("f15")) player.ammo.JET += 1;
            setTimeout(() => {
              p.taken = false;
              p.slot.visible = true;
              const na = Math.random() * TAU;
              p.slot.position.copy(pointOnTrack(na, Math.random() > 0.5 ? 2.4 : -2.4));
              p.baseY = p.slot.position.y;
            }, 2600);
          }
        });

        for (let i = missiles.length - 1; i >= 0; i--) {
          const m = missiles[i];
          m.ttl -= dt;
          m.mesh.position.addScaledVector(m.vel, dt);
          m.mesh.rotation.z += dt * 15;
          if (m.mesh.position.distanceTo(player.pos) < 1.3) {
            player.hp = Math.max(0, player.hp - 12);
            m.ttl = 0;
            setHud((h) => ({ ...h, alert: "Missile hit! Use defence radar!" }));
          }
          if (m.ttl <= 0) {
            scene.remove(m.mesh);
            disposeObject(m.mesh);
            missiles.splice(i, 1);
          }
        }

        if (input.fire) {
          const nearest = ai.sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
          if (player.weapon === "MISSILE" && player.ammo.MISSILE > 0) {
            spawnMissile(player.pos.clone().add(new THREE.Vector3(0.8, 0.8, 0)), nearest.pos.clone().add(new THREE.Vector3(0, 0.8, 0)));
            player.ammo.MISSILE -= 1;
          } else if (player.ammo.DRONE > 0) {
            callCinematicSupport("DRONE", nearest.pos);
            player.ammo.DRONE -= 1;
          } else if (player.ammo.HELICOPTER > 0) {
            callCinematicSupport("HELICOPTER", nearest.pos);
            player.ammo.HELICOPTER -= 1;
          } else if (player.ammo.JET > 0) {
            callCinematicSupport("JET", nearest.pos);
            player.ammo.JET -= 1;
          }
          input.fire = false;
        }

        for (let i = airStrikes.length - 1; i >= 0; i--) {
          const a = airStrikes[i];
          a.ttl -= dt;
          const hover = a.targetPos.clone().add(new THREE.Vector3(0, 9, 0));
          if (a.stage === "entry") {
            a.craft.position.lerp(hover, 1 - Math.exp(-2.8 * dt));
            if (a.craft.position.distanceTo(hover) < 1.2) a.stage = "attack";
          } else {
            a.craft.position.lerp(player.pos.clone().add(new THREE.Vector3(-9, 1.2, -9)), 1 - Math.exp(-2.2 * dt));
          }
          a.craft.rotation.y += dt * (a.kind === "DRONE" ? 3.5 : 1.2);
          a.craft.rotation.z = Math.sin(now * 0.004 + a.phase) * (a.kind === "JET" ? 0.12 : 0.06);
          if (!a.fired && a.stage === "attack") {
            a.fired = true;
            spawnMissile(a.craft.position.clone(), a.targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)));
          }
          if (a.ttl <= 0) {
            scene.remove(a.craft);
            disposeObject(a.craft);
            airStrikes.splice(i, 1);
          }
        }

        camera.position.lerp(player.pos.clone().add(new THREE.Vector3(Math.sin(player.yaw + Math.PI) * 8.4, 4.8, Math.cos(player.yaw + Math.PI) * 8.4)), 1 - Math.exp(-8 * dt));
        camera.lookAt(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)), 4.4));

        setHud({ status: input.autoDrive ? "Auto Drive ON" : "Manual Drive", speed: Math.round(Math.abs(player.speed) * 8), weapon: player.weapon, ammo: player.ammo[player.weapon] ?? player.ammo.FIREARM, alert: input.radar ? (player.hp < 35 ? "Critical HP" : "Radar scanning") : "Radar off", features: [input.autoDrive ? "AUTO ON" : "AUTO OFF", input.boost ? "BOOST ON" : "BOOST OFF", input.radar ? "RADAR ON" : "RADAR OFF"] });

        renderer.render(scene, camera);
      };
      animate();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      renderer.dispose();
      scene.traverse((obj) => { if (obj.isMesh) disposeObject(obj); });
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#7dbce8" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
      <div style={{ position: "fixed", top: 8, left: 8, right: 8, pointerEvents: "none", color: "white", fontFamily: "system-ui" }}>
        <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 12 }}>GO CRAZY REBUILD</div>
          <div style={{ fontSize: 12 }}>Status: {hud.status}</div>
          <div style={{ fontSize: 12 }}>Speed: {hud.speed} km/h</div>
          <div style={{ fontSize: 12 }}>Weapon: {hud.weapon} {HUD_ICONS[hud.weapon] || "🎯"} · Ammo: {hud.ammo}</div>
          <div style={{ fontSize: 12, color: "#ffd166" }}>Alert: {hud.alert}</div>
          <div style={{ marginTop: 4, fontSize: 11 }}>{hud.features.join(" · ")}</div>
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyT" }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.45)", color: "white" }}>AUTO</button>
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB" }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.45)", color: "white" }}>BOOST</button>
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.45)", color: "white" }}>RADAR</button>
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,89,34,0.65)", color: "white" }}>FIRE</button>
      </div>
    </div>
  );
}
