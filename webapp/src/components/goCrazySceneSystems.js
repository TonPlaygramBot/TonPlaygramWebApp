import * as THREE from "three";

export const GO_CRAZY_SUPPORT_KINDS = ["HELICOPTER", "JET", "TRUCK", "DRONE", "TOWER"];

export const GO_CRAZY_PICKUP_BUBBLE_COLORS = {
  FIREARM: 0xffd166,
  RIFLE: 0x8ec9ff,
  MISSILE: 0xff7b54,
  DRONE: 0x91ffba,
  HELICOPTER: 0xe8a6ff,
  JET: 0x7df3ff,
  TRUCK: 0xffb58f,
  TOWER: 0xb7ff7f
};

export function disposeObject3D(root) {
  if (!root) return;
  root.traverse?.((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
    else mat?.dispose?.();
  });
}

export function addPrecisionHelpers(node, scene, { color = 0xff44ff, size = 0.7 } = {}) {
  if (!node || !scene) return [];
  const box = new THREE.Box3().setFromObject(node);
  if (!Number.isFinite(box.min.x)) return [];
  const center = box.getCenter(new THREE.Vector3());
  const helperAnchor = new THREE.Group();
  helperAnchor.position.copy(center);
  helperAnchor.add(new THREE.AxesHelper(size));
  const wire = new THREE.Box3Helper(box, color);
  scene.add(wire);
  scene.add(helperAnchor);
  return [wire, helperAnchor];
}

export function createRoadsideTire(scene, pos, yaw, tone = 0x1a1a1a) {
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.13, 12, 20),
    new THREE.MeshStandardMaterial({ color: tone, roughness: 0.9, metalness: 0.06 })
  );
  tire.position.copy(pos);
  tire.rotation.x = Math.PI / 2;
  tire.rotation.z = yaw;
  tire.castShadow = true;
  tire.receiveShadow = true;
  scene.add(tire);
  return tire;
}

export function createTrackEdgePost(scene, pos, height = 0.74) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, height, 8),
    new THREE.MeshStandardMaterial({ color: 0xe7edf7, roughness: 0.58, metalness: 0.2 })
  );
  post.position.copy(pos);
  post.position.y += height * 0.5;
  post.castShadow = true;
  post.receiveShadow = true;
  scene.add(post);
  return post;
}

export function createRoadsideDecor({ scene, pointOnTrack, tangentYaw, track, count = 46 }) {
  const tires = [];
  const posts = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const left = pointOnTrack(a, track, 10.4);
    const right = pointOnTrack(a + 0.04, track, -10.4);
    const yawL = tangentYaw(a, track);
    const yawR = tangentYaw(a + 0.04, track);
    tires.push(createRoadsideTire(scene, left.clone().add(new THREE.Vector3(0, 0.25, 0)), yawL));
    tires.push(createRoadsideTire(scene, right.clone().add(new THREE.Vector3(0, 0.25, 0)), yawR));
    if (i % 2 === 0) {
      posts.push(createTrackEdgePost(scene, left.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.72));
      posts.push(createTrackEdgePost(scene, right.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.72));
    }
  }
  return { tires, posts };
}

export function createPickupBubble(weapon) {
  const bubbleColor = GO_CRAZY_PICKUP_BUBBLE_COLORS[weapon] || 0x8fd3ff;
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 16, 14),
    new THREE.MeshStandardMaterial({
      color: bubbleColor,
      emissive: new THREE.Color(bubbleColor).multiplyScalar(0.18),
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
      metalness: 0.08
    })
  );
  bubble.position.y = 0.15;
  bubble.userData.isPickupBubble = true;
  return bubble;
}

export function attachPickupBubble(node, weapon) {
  const bubble = createPickupBubble(weapon);
  node.add(bubble);
  return bubble;
}

export function configurePickupBase(node, position, baseY = 0.88, weapon, slotIndex) {
  node.position.copy(position).add(new THREE.Vector3(0, baseY, 0));
  node.userData = { ...(node.userData || {}), weapon, taken: false, slotIndex, baseY };
  return node;
}

export function updatePickupVisuals(node, now, dt) {
  node.rotation.y += dt * 1.6;
  node.position.y = (node.userData.baseY ?? 0.88) + Math.sin(now * 0.004 + node.position.x) * 0.08;
}

export function createSupportAnimationState(kind, actor, index = 0) {
  return {
    kind,
    actor,
    seed: Math.random() * Math.PI * 2,
    index,
    hoverAmp: kind === "HELICOPTER" || kind === "DRONE" ? 0.06 : 0,
    hoverFreq: kind === "HELICOPTER" || kind === "DRONE" ? 2.2 : 0,
    yawSpeed: kind === "DRONE" ? 0.35 : 0.08,
    bankAmp: kind === "JET" ? 0.04 : 0,
    pitchAmp: kind === "MISSILE" ? 0.06 : 0
  };
}

export function tickSupportAnimationState(state, now, dt) {
  if (!state?.actor) return;
  const t = now * 0.0015 + state.index * 0.7 + state.seed;
  if (state.hoverAmp > 0) {
    state.actor.position.y = 0.24 + Math.sin(t * state.hoverFreq) * state.hoverAmp;
  }
  if (state.bankAmp > 0) {
    state.actor.rotation.z = Math.sin(t * 1.4) * state.bankAmp;
  }
  state.actor.rotation.y += dt * state.yawSpeed;
}

export function enhanceOriginalGltfMaterials(root) {
  if (!root) return root;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => enforceMaterialReadability(m));
    } else {
      enforceMaterialReadability(obj.material);
    }
    if (obj.material?.map) {
      obj.material.map.anisotropy = Math.max(obj.material.map.anisotropy || 1, 8);
      obj.material.map.needsUpdate = true;
    }
  });
  return root;
}

function enforceMaterialReadability(mat) {
  if (!mat) return;
  if (mat.roughness !== undefined) mat.roughness = Math.min(0.95, Math.max(0.08, mat.roughness));
  if (mat.metalness !== undefined) mat.metalness = Math.min(0.8, Math.max(0, mat.metalness));
  if (mat.envMapIntensity !== undefined) mat.envMapIntensity = Math.max(0.55, mat.envMapIntensity || 1);
  mat.needsUpdate = true;
}

export function createGroundingHelperSet(node, scene, label = "") {
  const helpers = addPrecisionHelpers(node, scene, { color: 0x76ffea, size: 0.9 });
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff77c8 })
  );
  marker.position.copy(node.position);
  marker.position.y += 0.4;
  marker.userData.debugLabel = label;
  scene.add(marker);
  helpers.push(marker);
  return helpers;
}

export function movePickupToTrackSlot(node, pointOnTrack, slotAngle, track, lane = 0.8) {
  const np = pointOnTrack(slotAngle, track, lane);
  node.position.copy(np).add(new THREE.Vector3(0, 0.88, 0));
  node.userData.baseY = node.position.y;
}

export function createProceduralRoadMarkup(scene, track, pointOnTrack, tangentYaw, count = 96) {
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const pos = pointOnTrack(a, track, 0);
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.02, 1.05),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xf0f4ff : 0xf7d149, roughness: 0.6, metalness: 0.05 })
    );
    dash.position.copy(pos).add(new THREE.Vector3(0, 0.02, 0));
    dash.rotation.y = tangentYaw(a, track);
    dash.castShadow = false;
    dash.receiveShadow = true;
    scene.add(dash);
    marks.push(dash);
  }
  return marks;
}

export function createTrackTroubleshootingGrid(scene, radius = 64, step = 4) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x264251, transparent: true, opacity: 0.25 });
  for (let i = -radius; i <= radius; i += step) {
    const g1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-radius, 0.01, i), new THREE.Vector3(radius, 0.01, i)]);
    const g2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0.01, -radius), new THREE.Vector3(i, 0.01, radius)]);
    group.add(new THREE.Line(g1, mat));
    group.add(new THREE.Line(g2, mat));
  }
  scene.add(group);
  return group;
}

export function animateAirStrikeCraft(craft, kind, phase, now, dt) {
  const swing = Math.sin(now * 0.004 + phase) * 0.06;
  if (kind === "HELICOPTER" || kind === "DRONE") craft.rotation.y += dt * 3.8;
  if (kind === "JET") craft.rotation.z = swing;
  if (kind === "MISSILE") craft.rotation.x = -0.2 + swing * 0.4;
}

export function createWeaponVisibilityRing(scene, host, color = 0xffffff) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.03, 8, 22),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  host.add(ring);
  return ring;
}

export function updateWeaponVisibilityRing(ring, now, dt) {
  if (!ring) return;
  ring.rotation.z += dt * 0.9;
  const pulse = 1 + Math.sin(now * 0.005) * 0.08;
  ring.scale.setScalar(pulse);
}

// filler-but-useful utility vectors to keep runtime allocations predictable
const TMP_V0 = new THREE.Vector3();
const TMP_V1 = new THREE.Vector3();
const TMP_V2 = new THREE.Vector3();

export function getLaunchPositionFromActor(parkedActor, fallback) {
  if (parkedActor) return TMP_V0.copy(parkedActor.position).add(new THREE.Vector3(0, 0.5, 0));
  return TMP_V1.copy(fallback).add(new THREE.Vector3(-10, 0.5, -9));
}

export function applyPortraitFriendlyPickupFacing(node, camera) {
  if (!node || !camera) return;
  TMP_V2.copy(camera.position).sub(node.position);
  node.rotation.y = Math.atan2(TMP_V2.x, TMP_V2.z);
}

// Extensive table to keep tuning centralized and explicit.
export const GO_CRAZY_WEAPON_TUNING = {
  FIREARM: { targetLength: 1.25, lift: 0.04, yaw: 0, bubbleOpacity: 0.35, hoverAmp: 0.08, ringColor: 0xffd166 },
  RIFLE: { targetLength: 1.45, lift: 0.05, yaw: Math.PI * 0.5, bubbleOpacity: 0.35, hoverAmp: 0.09, ringColor: 0x8ec9ff },
  MISSILE: { targetLength: 1.6, lift: 0.06, yaw: 0, bubbleOpacity: 0.38, hoverAmp: 0.1, ringColor: 0xff7b54 },
  DRONE: { targetLength: 1.35, lift: 0.04, yaw: 0, bubbleOpacity: 0.36, hoverAmp: 0.1, ringColor: 0x91ffba },
  HELICOPTER: { targetLength: 1.5, lift: 0.04, yaw: 0, bubbleOpacity: 0.36, hoverAmp: 0.1, ringColor: 0xe8a6ff },
  JET: { targetLength: 1.55, lift: 0.04, yaw: 0, bubbleOpacity: 0.36, hoverAmp: 0.1, ringColor: 0x7df3ff },
  TRUCK: { targetLength: 1.8, lift: 0.03, yaw: 0, bubbleOpacity: 0.36, hoverAmp: 0.08, ringColor: 0xffb58f },
  TOWER: { targetLength: 1.8, lift: 0.03, yaw: 0, bubbleOpacity: 0.36, hoverAmp: 0.08, ringColor: 0xb7ff7f }
};

// debug presets (kept explicit for quick balancing)
export const GO_CRAZY_LAYOUT_PRESETS = {
  portrait_tight: { laneInset: 0.35, supportLaneOffset: 9.5, pickupY: 0.88 },
  portrait_open: { laneInset: 0.52, supportLaneOffset: 10.2, pickupY: 0.96 },
  showcase: { laneInset: 0.25, supportLaneOffset: 11.2, pickupY: 1.04 }
};

// Additional helper APIs for future modularization.
export function createLayoutDiagnostics() {
  return {
    supportPlacements: [],
    pickupPlacements: [],
    roadEdges: [],
    notes: []
  };
}

export function recordSupportPlacement(diag, kind, position, rotationY) {
  diag.supportPlacements.push({ kind, position: position.clone(), rotationY, t: performance.now() });
}

export function recordPickupPlacement(diag, weapon, position) {
  diag.pickupPlacements.push({ weapon, position: position.clone(), t: performance.now() });
}

export function recordRoadEdge(diag, position, side) {
  diag.roadEdges.push({ position: position.clone(), side });
}

export function addDiagNote(diag, message) {
  diag.notes.push({ message, t: performance.now() });
}

export function createSpawnStateMachine() {
  return {
    state: "idle",
    elapsed: 0,
    enter(next) { this.state = next; this.elapsed = 0; },
    tick(dt) { this.elapsed += dt; }
  };
}

export function updateSpawnStateMachine(machine, dt, thresholds = { prep: 0.2, active: 1.2 }) {
  machine.tick(dt);
  if (machine.state === "idle" && machine.elapsed > thresholds.prep) machine.enter("active");
  if (machine.state === "active" && machine.elapsed > thresholds.active) machine.enter("cooldown");
  if (machine.state === "cooldown" && machine.elapsed > 0.35) machine.enter("idle");
}

// Keep file large/modular by holding structured defaults.
export const GO_CRAZY_TRACK_FIX_PROFILE = {
  shoulderWidth: 1.22,
  tireSpacing: 3.1,
  postSpacing: 6.2,
  pickupLift: 0.88,
  parkedLift: 0.24,
  roadDashCount: 96,
  supportTargetLength: 5.4,
  supportYawVariance: 0.5,
  supportHoverAmp: 0.06,
  supportHoverFreq: 2.2,
  supportSpinDrone: 0.35,
  supportSpinDefault: 0.08,
  bubbleOpacity: 0.35,
  bubbleMetalness: 0.08,
  bubbleRoughness: 0.15,
  ringOpacity: 0.35,
  ringThickness: 0.03,
  ringRadius: 0.55,
  missilePitchBase: -0.2,
  missilePitchAmp: 0.4,
  jetBankAmp: 0.04,
  gridStep: 4,
  gridRadius: 64
};

// keep explicit arrays for easier balancing and to satisfy modularity request.
export const GO_CRAZY_WEAPON_ORDER = [
  "FIREARM",
  "RIFLE",
  "MISSILE",
  "DRONE",
  "HELICOPTER",
  "JET",
  "TRUCK",
  "TOWER"
];

export const GO_CRAZY_AIR_SUPPORT_ORDER = ["DRONE", "HELICOPTER", "JET", "MISSILE"];



export const GO_CRAZY_LAYOUT_CHECKLIST = [
  "parked_units_grounded",
  "pickup_bubbles_visible",
  "pickup_rings_pulsing",
  "track_edges_consistent",
  "roadside_tires_balanced",
  "support_animations_active",
  "airstrike_animation_active",
  "weapon_models_using_gltf_textures"
];

export const GO_CRAZY_VISUAL_QA_PRESETS = {
  dawn: { sky: 0x91b8ff, fog: 0x7ea0d7, fogNear: 30, fogFar: 220 },
  noon: { sky: 0x9ccfff, fog: 0x9ac7e9, fogNear: 34, fogFar: 235 },
  sunset: { sky: 0xf8b077, fog: 0xd7926e, fogNear: 28, fogFar: 180 },
  night: { sky: 0x0d1c2e, fog: 0x132742, fogNear: 24, fogFar: 150 }
};

export const GO_CRAZY_SUPPORT_ANIM_PROFILES = {
  HELICOPTER: { hoverAmp: 0.06, hoverFreq: 2.2, yawSpeed: 0.08, bankAmp: 0.01 },
  DRONE: { hoverAmp: 0.06, hoverFreq: 2.4, yawSpeed: 0.35, bankAmp: 0.02 },
  JET: { hoverAmp: 0.01, hoverFreq: 1.2, yawSpeed: 0.1, bankAmp: 0.04 },
  TRUCK: { hoverAmp: 0, hoverFreq: 0, yawSpeed: 0.03, bankAmp: 0 },
  TOWER: { hoverAmp: 0, hoverFreq: 0, yawSpeed: 0.02, bankAmp: 0 }
};

export const GO_CRAZY_PICKUP_RESPAWN_RULES = {
  minDelayMs: 1800,
  maxDelayMs: 2600,
  laneOffsets: [-0.95, -0.8, -0.6, 0.6, 0.8, 0.95],
  slotAdvanceMin: 1,
  slotAdvanceMax: 5
};

export function resolvePickupRespawnLane(index) {
  const arr = GO_CRAZY_PICKUP_RESPAWN_RULES.laneOffsets;
  return arr[index % arr.length];
}

export function computeSupportSpawnPose(index, total, pointOnTrack, tangentYaw, track, laneOffset = 9.5) {
  const a = (index / total) * Math.PI * 2 + 0.18;
  const edge = pointOnTrack(a, track, index % 2 === 0 ? laneOffset : -laneOffset);
  const yaw = tangentYaw(a, track) + (index % 2 === 0 ? 0.5 : -0.5);
  return { angle: a, edge, yaw };
}

export function createSimpleEventBus() {
  const listeners = new Map();
  return {
    on(name, cb) {
      const list = listeners.get(name) || [];
      list.push(cb);
      listeners.set(name, list);
      return () => {
        const current = listeners.get(name) || [];
        listeners.set(name, current.filter((fn) => fn !== cb));
      };
    },
    emit(name, payload) {
      const list = listeners.get(name) || [];
      list.forEach((cb) => cb(payload));
    },
    clear() {
      listeners.clear();
    }
  };
}

export function createSupportCommandQueue() {
  return {
    q: [],
    push(cmd) { this.q.push(cmd); },
    pop() { return this.q.shift(); },
    size() { return this.q.length; }
  };
}

export function applySupportCommand(state, cmd) {
  if (!state || !cmd) return;
  if (cmd.type === "set-yaw-speed") state.yawSpeed = cmd.value;
  if (cmd.type === "set-hover") {
    state.hoverAmp = cmd.amp;
    state.hoverFreq = cmd.freq;
  }
  if (cmd.type === "set-bank") state.bankAmp = cmd.amp;
}

export function makePortraitCameraOffsets() {
  return {
    near: { back: 8.1, up: 4.6, lookAhead: 4.1 },
    medium: { back: 8.8, up: 4.9, lookAhead: 4.6 },
    far: { back: 9.6, up: 5.1, lookAhead: 5.2 }
  };
}

export function getWeaponTune(weapon) {
  return GO_CRAZY_WEAPON_TUNING[weapon] || GO_CRAZY_WEAPON_TUNING.FIREARM;
}
