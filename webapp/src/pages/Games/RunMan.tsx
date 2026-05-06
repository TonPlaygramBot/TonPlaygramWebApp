"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Team = "blue" | "red";
type ActorKind = Team | "robot";
type AnimName = "Idle" | "Walk" | "Run";
type GameState = "playing" | "gameover";
type PickupKind = "diamond" | "weapon";

type Bones = {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  leftUpLeg?: THREE.Bone;
  leftLeg?: THREE.Bone;
  leftFoot?: THREE.Bone;
  rightUpLeg?: THREE.Bone;
  rightLeg?: THREE.Bone;
  rightFoot?: THREE.Bone;
  leftArm?: THREE.Bone;
  rightArm?: THREE.Bone;
};

type Actor = {
  kind: ActorKind;
  root: THREE.Group;
  model: THREE.Object3D | null;
  fallback: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  current: AnimName;
  bones: Bones;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  targetDir: THREE.Vector3;
  speed: number;
  radius: number;
  stun: number;
  health: number;
  ammo: number;
  fireCooldown: number;
  loaded: boolean;
};

type InputState = {
  blueX: number;
  blueY: number;
  redX: number;
  redY: number;
};

type Pickup = {
  kind: PickupKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  taken: boolean;
  value: number;
};

type Bullet = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  owner: Team;
  life: number;
  active: boolean;
};

type MazeCell = 0 | 1;

declare global {
  interface Window {
    __resetRobotMaze?: () => void;
    __fireRobotMaze?: (team: Team) => void;
    __followRobotMaze?: (team: Team) => void;
  }
}

const SOLDIER_URL = "https://threejs.org/examples/models/gltf/Soldier.glb";
const ROBOT_URL = "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb";

const CELL = 0.58;
const ROWS = 17;
const COLS = 17;
const MAZE_W = COLS * CELL;
const MAZE_H = ROWS * CELL;
const PLAYER_RADIUS = 0.16;
const ROBOT_RADIUS = 0.17;
const PICKUP_RADIUS = 0.13;
const PLAYER_SPEED = 1.82;
const ROBOT_SPEED = 1.1;
const BULLET_SPEED = 4.8;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const GAME_TIME = 140;
const TMP = new THREE.Vector3();

const MAZE: MazeCell[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1],
  [1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1],
  [1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function mat(color: number, roughness = 0.78, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow<T extends THREE.Object3D>(o: T) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  return o;
}

function clean(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellToWorld(row: number, col: number) {
  return new THREE.Vector3((col - COLS / 2 + 0.5) * CELL, GROUND_Y, (row - ROWS / 2 + 0.5) * CELL);
}

function worldToCell(pos: THREE.Vector3) {
  const col = Math.floor(pos.x / CELL + COLS / 2);
  const row = Math.floor(pos.z / CELL + ROWS / 2);
  return { row, col };
}

function isWallCell(row: number, col: number) {
  if (row < 0 || col < 0 || row >= ROWS || col >= COLS) return true;
  return MAZE[row][col] === 1;
}

function findBones(model: THREE.Object3D): Bones {
  const b: Bones = {};
  model.traverse((o) => {
    const bone = o as THREE.Bone;
    if (!bone.isBone) return;
    const n = clean(bone.name);
    if (!b.hips && n.includes("hips")) b.hips = bone;
    if (!b.spine && n.includes("spine")) b.spine = bone;
    if (!b.leftUpLeg && (n.includes("leftupleg") || n.includes("leftthigh") || n.includes("lthigh"))) b.leftUpLeg = bone;
    if (!b.rightUpLeg && (n.includes("rightupleg") || n.includes("rightthigh") || n.includes("rthigh"))) b.rightUpLeg = bone;
    if (!b.leftLeg && !n.includes("foot") && !n.includes("upleg") && (n.includes("leftleg") || n.includes("leftcalf") || n.includes("leftshin"))) b.leftLeg = bone;
    if (!b.rightLeg && !n.includes("foot") && !n.includes("upleg") && (n.includes("rightleg") || n.includes("rightcalf") || n.includes("rightshin"))) b.rightLeg = bone;
    if (!b.leftFoot && n.includes("leftfoot")) b.leftFoot = bone;
    if (!b.rightFoot && n.includes("rightfoot")) b.rightFoot = bone;
    if (!b.leftArm && n.includes("leftarm")) b.leftArm = bone;
    if (!b.rightArm && n.includes("rightarm")) b.rightArm = bone;
  });
  return b;
}

function normalizeModel(model: THREE.Object3D, height = 0.62, rotateY = Math.PI) {
  model.rotation.set(0, rotateY, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function tintModel(model: THREE.Object3D, kind: ActorKind) {
  const tint = new THREE.Color(kind === "blue" ? 0x1d69ff : kind === "red" ? 0xd92f2f : 0x84fffb);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (m.color) m.color.lerp(tint, kind === "robot" ? 0.42 : 0.34);
      if (kind === "robot") {
        m.emissive = new THREE.Color(0x004d5d);
        m.emissiveIntensity = 0.22;
      }
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind) {
  const group = new THREE.Group();
  if (kind === "robot") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.12), mat(0x7dd3fc, 0.48, 0.22));
    body.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.13), mat(0xd9f99d, 0.4, 0.18));
    head.position.y = 0.65;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.015), mat(0x00ffcc, 0.25, 0.1));
    eye.position.set(0, 0.66, -0.068);
    group.add(shadow(body), shadow(head), shadow(eye));
    return group;
  }
  const color = kind === "blue" ? 0x1d69ff : 0xd92f2f;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 8, 14), mat(color));
  body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 12), mat(0xf1d6bd));
  head.position.y = 0.67;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.045), mat(0x111827, 0.44, 0.26));
  gun.position.set(0.09, 0.45, -0.09);
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.23, 6, 8), mat(0x171717));
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.04, 0.18, 0);
  rightLeg.position.set(0.04, 0.18, 0);
  group.add(shadow(body), shadow(head), shadow(gun), shadow(leftLeg), shadow(rightLeg));
  return group;
}

function createActor(scene: THREE.Scene, loader: GLTFLoader, kind: ActorKind, start: THREE.Vector3, onLoaded: () => void): Actor {
  const root = new THREE.Group();
  root.position.copy(start).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(kind);
  root.add(fallback);

  const actor: Actor = {
    kind,
    root,
    model: null,
    fallback,
    mixer: null,
    actions: {},
    current: "Idle",
    bones: {},
    pos: start.clone().setY(GROUND_Y),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, 1),
    targetDir: new THREE.Vector3(0, 0, 1),
    speed: 0,
    radius: kind === "robot" ? ROBOT_RADIUS : PLAYER_RADIUS,
    stun: 0,
    health: kind === "robot" ? 2 : 3,
    ammo: 0,
    fireCooldown: 0,
    loaded: false,
  };

  const url = kind === "robot" ? ROBOT_URL : SOLDIER_URL;
  loader.setCrossOrigin("anonymous").load(
    url,
    (gltf) => {
      const model = gltf.scene;
      normalizeModel(model, kind === "robot" ? 0.58 : 0.62, kind === "robot" ? 0 : Math.PI);
      tintModel(model, kind);
      shadow(model);
      root.add(model);
      fallback.visible = false;
      actor.model = model;
      actor.bones = findBones(model);
      actor.mixer = new THREE.AnimationMixer(model);

      const clipByName = new Map(gltf.animations.map((clip) => [clip.name.toLowerCase(), clip]));
      const aliases: Record<AnimName, string[]> = kind === "robot"
        ? { Idle: ["idle"], Walk: ["walking", "walk"], Run: ["running", "run", "walking"] }
        : { Idle: ["idle"], Walk: ["walk", "walking"], Run: ["run", "running"] };

      (Object.keys(aliases) as AnimName[]).forEach((name) => {
        const clip = aliases[name].map((a) => clipByName.get(a)).find(Boolean);
        if (!clip || !actor.mixer) return;
        const action = actor.mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(name === "Idle" ? 1 : 0);
        action.play();
        actor.actions[name] = action;
      });
      actor.loaded = true;
      onLoaded();
    },
    undefined,
    () => {
      actor.loaded = false;
      fallback.visible = true;
      onLoaded();
    }
  );

  return actor;
}

function setAction(actor: Actor, next: AnimName, blend = 0.16) {
  if (actor.current === next || !actor.actions[next]) return;
  const prev = actor.actions[actor.current];
  const nextAction = actor.actions[next];
  if (prev && nextAction) {
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    prev.crossFadeTo(nextAction, blend, false);
    nextAction.play();
  }
  actor.current = next;
}

function updateFallbackWalk(actor: Actor) {
  const meshes = actor.fallback.children.filter((o) => o instanceof THREE.Mesh) as THREE.Mesh[];
  const t = performance.now() * 0.011;
  if (actor.kind === "robot") {
    actor.fallback.rotation.y = Math.sin(t * 0.4) * 0.02;
    return;
  }
  const legs = meshes.slice(-2);
  const s = Math.sin(t) * Math.min(1.2, actor.speed);
  if (legs[0]) legs[0].rotation.x = s * 0.75;
  if (legs[1]) legs[1].rotation.x = -s * 0.75;
}

function updateActorAnimation(actor: Actor, dt: number) {
  actor.pos.y = GROUND_Y;
  actor.root.position.copy(actor.pos);
  if (actor.targetDir.lengthSq() > 0.001) actor.dir.lerp(actor.targetDir, 1 - Math.pow(0.002, dt)).normalize();
  actor.root.rotation.y = Math.atan2(actor.dir.x, actor.dir.z);

  const next: AnimName = actor.stun > 0 ? "Idle" : actor.speed > 1.2 ? "Run" : actor.speed > 0.06 ? "Walk" : "Idle";
  setAction(actor, next);
  if (actor.actions.Walk) actor.actions.Walk.timeScale = THREE.MathUtils.clamp(actor.speed / 1.0, 0.75, 1.45);
  if (actor.actions.Run) actor.actions.Run.timeScale = THREE.MathUtils.clamp(actor.speed / 1.7, 0.75, 1.55);
  actor.mixer?.update(dt);

  if (actor.kind !== "robot" && actor.ammo > 0) {
    if (actor.bones.spine) actor.bones.spine.rotation.x += -0.04;
    if (actor.bones.rightArm) actor.bones.rightArm.rotation.x += -0.42;
    if (actor.bones.leftArm) actor.bones.leftArm.rotation.x += -0.2;
  }

  updateFallbackWalk(actor);
  actor.stun = Math.max(0, actor.stun - dt);
  actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
}

function clampToMazeBounds(pos: THREE.Vector3) {
  const x = MAZE_W / 2 - CELL * 0.5;
  const z = MAZE_H / 2 - CELL * 0.5;
  pos.x = THREE.MathUtils.clamp(pos.x, -x, x);
  pos.z = THREE.MathUtils.clamp(pos.z, -z, z);
  pos.y = GROUND_Y;
}

function collidesWithMaze(pos: THREE.Vector3, radius: number) {
  const points = [
    [pos.x, pos.z],
    [pos.x + radius, pos.z],
    [pos.x - radius, pos.z],
    [pos.x, pos.z + radius],
    [pos.x, pos.z - radius],
    [pos.x + radius * 0.72, pos.z + radius * 0.72],
    [pos.x - radius * 0.72, pos.z + radius * 0.72],
    [pos.x + radius * 0.72, pos.z - radius * 0.72],
    [pos.x - radius * 0.72, pos.z - radius * 0.72],
  ];
  return points.some(([x, z]) => {
    const col = Math.floor(x / CELL + COLS / 2);
    const row = Math.floor(z / CELL + ROWS / 2);
    return isWallCell(row, col);
  });
}

function tryMoveActor(actor: Actor, dir: THREE.Vector3, speed: number, dt: number) {
  if (actor.stun > 0 || actor.health <= 0) {
    actor.vel.multiplyScalar(Math.pow(0.01, dt));
    actor.speed = 0;
    return;
  }

  if (dir.lengthSq() > 0.001) {
    dir.normalize();
    actor.targetDir.copy(dir);
    actor.vel.lerp(dir.clone().multiplyScalar(speed), 1 - Math.pow(0.006, dt));
  } else {
    actor.vel.multiplyScalar(Math.pow(0.001, dt));
  }

  const old = actor.pos.clone();
  const next = actor.pos.clone().addScaledVector(actor.vel, dt);
  clampToMazeBounds(next);

  const tryX = actor.pos.clone();
  tryX.x = next.x;
  if (!collidesWithMaze(tryX, actor.radius)) actor.pos.x = tryX.x;
  else actor.vel.x = 0;

  const tryZ = actor.pos.clone();
  tryZ.z = next.z;
  if (!collidesWithMaze(tryZ, actor.radius)) actor.pos.z = tryZ.z;
  else actor.vel.z = 0;

  actor.speed = old.distanceTo(actor.pos) / Math.max(dt, 0.0001);
}

function cellNeighbors(row: number, col: number) {
  const dirs = [
    { row: row - 1, col, dir: new THREE.Vector3(0, 0, -1) },
    { row: row + 1, col, dir: new THREE.Vector3(0, 0, 1) },
    { row, col: col - 1, dir: new THREE.Vector3(-1, 0, 0) },
    { row, col: col + 1, dir: new THREE.Vector3(1, 0, 0) },
  ];
  return dirs.filter((d) => !isWallCell(d.row, d.col));
}

function chooseRobotDir(robot: Actor, blue: Actor, red: Actor) {
  const target = robot.pos.distanceTo(blue.pos) < robot.pos.distanceTo(red.pos) ? blue : red;
  const c = worldToCell(robot.pos);
  const t = worldToCell(target.pos);
  const neighbors = cellNeighbors(c.row, c.col);
  if (!neighbors.length) return new THREE.Vector3();

  let best = neighbors[0];
  let bestScore = Infinity;
  for (const n of neighbors) {
    const dist = Math.abs(n.row - t.row) + Math.abs(n.col - t.col);
    const world = cellToWorld(n.row, n.col);
    const score = dist + world.distanceTo(target.pos) * 0.28 + Math.random() * 0.22;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best.dir.clone();
}

function makeMaze(scene: THREE.Scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_W + 1.1, MAZE_H + 1.1), mat(0x080b16, 0.9, 0));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.12, emissive: 0x061122, emissiveIntensity: 0.25 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.1, emissive: 0x0b2344, emissiveIntensity: 0.22 });
  const pathMat = mat(0x172033, 0.92, 0.02);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = cellToWorld(r, c);
      if (MAZE[r][c] === 1) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.96, 0.62, CELL * 0.96), wallMat);
        wall.position.set(p.x, 0.31, p.z);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.98, 0.055, CELL * 0.98), topMat);
        cap.position.set(p.x, 0.645, p.z);
        scene.add(shadow(wall), shadow(cap));
      } else {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.9, 0.018, CELL * 0.9), pathMat);
        tile.position.set(p.x, 0.004, p.z);
        tile.receiveShadow = true;
        scene.add(tile);
      }
    }
  }

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(MAZE_W + 0.2, 0.06, MAZE_H + 0.2)),
    new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 })
  );
  border.position.y = 0.04;
  scene.add(border);
}

function makeDiamond(color: number, value = 1) {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(value > 1 ? 0.13 : 0.095, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.25, emissive: color, emissiveIntensity: 0.28 })
  );
  mesh.rotation.y = Math.PI / 4;
  group.add(shadow(mesh));
  const glow = new THREE.PointLight(color, value > 1 ? 0.6 : 0.35, 1.1);
  glow.position.y = 0.18;
  group.add(glow);
  return group;
}

function makeWeaponPickup() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.075), mat(0xf97316, 0.4, 0.3));
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.035), mat(0x111827, 0.35, 0.4));
  barrel.position.x = 0.16;
  const glow = new THREE.PointLight(0xf97316, 0.65, 1.1);
  glow.position.y = 0.2;
  group.add(shadow(body), shadow(barrel), glow);
  group.rotation.y = Math.PI / 4;
  return group;
}

function createPickups(scene: THREE.Scene) {
  const pickups: Pickup[] = [];
  const weaponCells = new Set(["3,3", "3,13", "13,3", "13,13", "8,8", "5,8"]);

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (MAZE[r][c] === 1) continue;
      const startSpot = (r === 1 && c === 1) || (r === 15 && c === 15) || (r === 8 && c === 8);
      if (startSpot) continue;

      const key = `${r},${c}`;
      if (weaponCells.has(key)) {
        const group = makeWeaponPickup();
        const pos = cellToWorld(r, c).setY(0.25);
        group.position.copy(pos);
        scene.add(group);
        pickups.push({ kind: "weapon", group, pos: pos.clone(), taken: false, value: 8 });
      } else {
        const special = (r + c) % 8 === 0;
        const group = makeDiamond(special ? 0xffd166 : 0x63e6ff, special ? 3 : 1);
        const pos = cellToWorld(r, c).setY(special ? 0.25 : 0.2);
        group.position.copy(pos);
        scene.add(group);
        pickups.push({ kind: "diamond", group, pos: pos.clone(), taken: false, value: special ? 3 : 1 });
      }
    }
  }
  return pickups;
}

function resetPickups(pickups: Pickup[]) {
  pickups.forEach((d) => {
    d.taken = false;
    d.group.visible = true;
  });
}

function collectPickups(actor: Actor, pickups: Pickup[]) {
  let score = 0;
  let ammo = 0;
  pickups.forEach((p) => {
    if (p.taken) return;
    TMP.copy(p.pos).sub(actor.pos).setY(0);
    if (TMP.length() < actor.radius + PICKUP_RADIUS) {
      p.taken = true;
      p.group.visible = false;
      if (p.kind === "diamond") score += p.value;
      else ammo += p.value;
    }
  });
  actor.ammo += ammo;
  return { score, ammo };
}

function resetActors(blue: Actor, red: Actor, robots: Actor[]) {
  blue.pos.copy(cellToWorld(15, 1));
  red.pos.copy(cellToWorld(1, 15));
  blue.vel.set(0, 0, 0);
  red.vel.set(0, 0, 0);
  blue.dir.set(1, 0, 0);
  red.dir.set(-1, 0, 0);
  blue.targetDir.copy(blue.dir);
  red.targetDir.copy(red.dir);
  blue.stun = 0;
  red.stun = 0;
  blue.health = 3;
  red.health = 3;
  blue.ammo = 0;
  red.ammo = 0;

  const starts = [cellToWorld(8, 8), cellToWorld(1, 8), cellToWorld(15, 8), cellToWorld(8, 1)];
  robots.forEach((c, i) => {
    c.pos.copy(starts[i % starts.length]);
    c.vel.set(0, 0, 0);
    c.dir.set(0, 0, i % 2 ? 1 : -1);
    c.targetDir.copy(c.dir);
    c.stun = 0;
    c.health = 2;
    c.root.visible = true;
  });
}

function makeMiniMap(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.set(0, 0.025, 0);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.18 });
  for (let c = 0; c <= COLS; c++) {
    const x = (c - COLS / 2) * CELL;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, -MAZE_H / 2), new THREE.Vector3(x, 0, MAZE_H / 2)]), lineMat));
  }
  for (let r = 0; r <= ROWS; r++) {
    const z = (r - ROWS / 2) * CELL;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-MAZE_W / 2, 0, z), new THREE.Vector3(MAZE_W / 2, 0, z)]), lineMat));
  }
  scene.add(group);
}

function makePortal(scene: THREE.Scene, row: number, col: number, color: number) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 32), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55 }));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const light = new THREE.PointLight(color, 0.8, 1.4);
  light.position.y = 0.25;
  g.add(light);
  g.position.copy(cellToWorld(row, col)).setY(0.08);
  scene.add(g);
}

function makeBullet(scene: THREE.Scene, owner: Team, pos: THREE.Vector3, dir: THREE.Vector3): Bullet {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 8),
    new THREE.MeshStandardMaterial({ color: owner === "blue" ? 0x93c5fd : 0xfca5a5, emissive: owner === "blue" ? 0x1d69ff : 0xd92f2f, emissiveIntensity: 0.8 })
  );
  mesh.position.copy(pos).setY(0.38);
  scene.add(mesh);
  return { mesh, pos: mesh.position.clone(), vel: dir.clone().normalize().multiplyScalar(BULLET_SPEED), owner, life: 1.3, active: true };
}

function updateBullets(bullets: Bullet[], dt: number, blue: Actor, red: Actor, robots: Actor[], setStatus: (s: string) => void) {
  bullets.forEach((b) => {
    if (!b.active) return;
    b.life -= dt;
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);

    if (b.life <= 0 || collidesWithMaze(b.pos, 0.035)) {
      b.active = false;
      b.mesh.visible = false;
      return;
    }

    const enemy = b.owner === "blue" ? red : blue;
    if (enemy.health > 0 && b.pos.distanceTo(enemy.pos.clone().setY(0.38)) < enemy.radius + 0.08) {
      enemy.health -= 1;
      enemy.stun = 1.0;
      enemy.pos.copy(b.owner === "blue" ? cellToWorld(1, 15) : cellToWorld(15, 1));
      b.active = false;
      b.mesh.visible = false;
      setStatus(`${b.owner === "blue" ? "Blue" : "Red"} hit enemy soldier!`);
      return;
    }

    for (const r of robots) {
      if (r.health <= 0 || !r.root.visible) continue;
      if (b.pos.distanceTo(r.pos.clone().setY(0.36)) < r.radius + 0.09) {
        r.health -= 1;
        r.stun = 0.8;
        b.active = false;
        b.mesh.visible = false;
        setStatus(`${b.owner === "blue" ? "Blue" : "Red"} hit robot!`);
        if (r.health <= 0) {
          r.root.visible = false;
          r.pos.set(99, 0, 99);
          setStatus("Robot destroyed +5 bonus!");
        }
        return;
      }
    }
  });
}

export default function RunMan() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blueBase = useRef<HTMLDivElement | null>(null);
  const blueKnob = useRef<HTMLDivElement | null>(null);
  const redBase = useRef<HTMLDivElement | null>(null);
  const redKnob = useRef<HTMLDivElement | null>(null);
  const blueTouch = useRef<number | null>(null);
  const redTouch = useRef<number | null>(null);
  const input = useRef<InputState>({ blueX: 0, blueY: 0, redX: 0, redY: 0 });
  const [hud, setHud] = useState({ blue: 0, red: 0, blueAmmo: 0, redAmmo: 0, blueHp: 3, redHp: 3, time: GAME_TIME, status: "Loading soldiers + robots…" });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x020617, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x020617, 7, 18);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 70);
    camera.position.set(0, 5.2, 4.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.54));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const cyanLight = new THREE.PointLight(0x00e5ff, 1.4, 11);
    cyanLight.position.set(0, 2.2, 0);
    scene.add(cyanLight);

    makeMaze(scene);
    makeMiniMap(scene);
    makePortal(scene, 1, 1, 0x1d69ff);
    makePortal(scene, 15, 15, 0xd92f2f);
    const pickups = createPickups(scene);
    const bullets: Bullet[] = [];

    const loader = new GLTFLoader();
    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 6) setHud((h) => ({ ...h, status: "Soldiers collect diamonds and weapons. Robots chase both players." }));
    };

    const blue = createActor(scene, loader, "blue", cellToWorld(15, 1), onLoaded);
    const red = createActor(scene, loader, "red", cellToWorld(1, 15), onLoaded);
    const robots = [
      createActor(scene, loader, "robot", cellToWorld(8, 8), onLoaded),
      createActor(scene, loader, "robot", cellToWorld(1, 8), onLoaded),
      createActor(scene, loader, "robot", cellToWorld(15, 8), onLoaded),
      createActor(scene, loader, "robot", cellToWorld(8, 1), onLoaded),
    ];

    let blueScore = 0;
    let redScore = 0;
    let gameTime = GAME_TIME;
    let state: GameState = "playing";
    let robotThink = 0;
    let cameraTarget: Team = "blue";
    let frame = 0;
    let last = performance.now();

    const setStatus = (status: string) => setHud((h) => ({ ...h, status, blue: blueScore, red: redScore, blueAmmo: blue.ammo, redAmmo: red.ammo, blueHp: blue.health, redHp: red.health, time: Math.ceil(gameTime) }));

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const resetGame = () => {
      blueScore = 0;
      redScore = 0;
      gameTime = GAME_TIME;
      state = "playing";
      resetPickups(pickups);
      bullets.forEach((b) => { b.active = false; b.mesh.visible = false; });
      resetActors(blue, red, robots);
      setHud({ blue: 0, red: 0, blueAmmo: 0, redAmmo: 0, blueHp: 3, redHp: 3, time: GAME_TIME, status: "New round. Find weapons and diamonds." });
    };
    window.__resetRobotMaze = resetGame;
    window.__fireRobotMaze = (team: Team) => {
      if (state !== "playing") return;
      const actor = team === "blue" ? blue : red;
      if (actor.ammo <= 0 || actor.fireCooldown > 0 || actor.health <= 0) {
        setStatus(`${team === "blue" ? "Blue" : "Red"} needs weapon ammo!`);
        return;
      }
      actor.ammo -= 1;
      actor.fireCooldown = 0.28;
      const muzzle = actor.pos.clone().addScaledVector(actor.dir, 0.22).setY(0.38);
      bullets.push(makeBullet(scene, team, muzzle, actor.dir));
      setStatus(`${team === "blue" ? "Blue" : "Red"} fired!`);
    };
    window.__followRobotMaze = (team: Team) => {
      cameraTarget = team;
      setStatus(`Camera following ${team === "blue" ? "Blue" : "Red"}`);
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;

      pickups.forEach((d, i) => {
        if (!d.taken) {
          d.group.rotation.y += dt * (1.7 + (i % 5) * 0.12);
          d.group.position.y = d.pos.y + Math.sin(now * 0.004 + i) * 0.035;
        }
      });

      if (state === "playing") {
        gameTime = Math.max(0, gameTime - dt);
        const blueDir = new THREE.Vector3(input.current.blueX, 0, input.current.blueY);
        const redDir = new THREE.Vector3(input.current.redX, 0, input.current.redY);

        tryMoveActor(blue, blueDir, PLAYER_SPEED, dt);
        tryMoveActor(red, redDir, PLAYER_SPEED, dt);

        robotThink -= dt;
        if (robotThink <= 0) {
          robotThink = 0.25;
          robots.forEach((r) => {
            if (r.health > 0) r.targetDir.copy(chooseRobotDir(r, blue, red));
          });
        }
        robots.forEach((r, i) => {
          if (r.health <= 0) return;
          const speed = ROBOT_SPEED + i * 0.035 + Math.min(0.22, (GAME_TIME - gameTime) / GAME_TIME * 0.22);
          tryMoveActor(r, r.targetDir.clone(), speed, dt);
        });

        const bGain = collectPickups(blue, pickups);
        const rGain = collectPickups(red, pickups);
        if (bGain.score || bGain.ammo || rGain.score || rGain.ammo) {
          blueScore += bGain.score;
          redScore += rGain.score;
          const msg = bGain.ammo ? `Blue weapon +${bGain.ammo} ammo` : rGain.ammo ? `Red weapon +${rGain.ammo} ammo` : bGain.score ? `Blue +${bGain.score}` : `Red +${rGain.score}`;
          setHud((h) => ({ ...h, blue: blueScore, red: redScore, blueAmmo: blue.ammo, redAmmo: red.ammo, blueHp: blue.health, redHp: red.health, time: Math.ceil(gameTime), status: msg }));
        }

        updateBullets(bullets, dt, blue, red, robots, setStatus);

        robots.forEach((r) => {
          if (r.health <= 0) return;
          TMP.copy(r.pos).sub(blue.pos).setY(0);
          if (TMP.length() < r.radius + blue.radius && blue.stun <= 0) {
            blue.health -= 1;
            blue.stun = 1.25;
            blue.pos.copy(cellToWorld(15, 1));
            setStatus("Blue hit by robot!");
          }
          TMP.copy(r.pos).sub(red.pos).setY(0);
          if (TMP.length() < r.radius + red.radius && red.stun <= 0) {
            red.health -= 1;
            red.stun = 1.25;
            red.pos.copy(cellToWorld(1, 15));
            setStatus("Red hit by robot!");
          }
        });

        if (blue.health <= 0 || red.health <= 0 || pickups.every((d) => d.taken) || gameTime <= 0) {
          state = "gameover";
          const status = blueScore === redScore ? "Draw!" : blueScore > redScore ? "Blue wins!" : "Red wins!";
          setHud({ blue: blueScore, red: redScore, blueAmmo: blue.ammo, redAmmo: red.ammo, blueHp: Math.max(0, blue.health), redHp: Math.max(0, red.health), time: 0, status });
        } else if (Math.ceil(gameTime) % 5 === 0) {
          setHud((h) => ({ ...h, time: Math.ceil(gameTime), blueAmmo: blue.ammo, redAmmo: red.ammo, blueHp: blue.health, redHp: red.health }));
        }
      }

      updateActorAnimation(blue, dt);
      updateActorAnimation(red, dt);
      robots.forEach((r) => updateActorAnimation(r, dt));

      const follow = cameraTarget === "blue" ? blue : red;
      const behind = follow.pos.clone().addScaledVector(follow.dir, -2.15).add(new THREE.Vector3(0, 3.35, 0));
      const ahead = follow.pos.clone().addScaledVector(follow.dir, 2.3).add(new THREE.Vector3(0, 0.25, 0));
      camera.position.lerp(behind, 1 - Math.pow(0.004, dt));
      camera.lookAt(ahead);

      renderer.render(scene, camera);
    };

    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      delete window.__resetRobotMaze;
      delete window.__fireRobotMaze;
      delete window.__followRobotMaze;
      renderer.dispose();
    };
  }, []);

  const updateStick = (which: Team, clientX: number, clientY: number) => {
    const base = which === "blue" ? blueBase.current : redBase.current;
    const knob = which === "blue" ? blueKnob.current : redKnob.current;
    if (!base || !knob) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = r.width * 0.36;
    const len = Math.min(max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    if (which === "blue") {
      input.current.blueX = x / max;
      input.current.blueY = y / max;
    } else {
      input.current.redX = x / max;
      input.current.redY = y / max;
    }
  };

  const endStick = (which: Team) => {
    if (which === "blue") {
      blueTouch.current = null;
      input.current.blueX = 0;
      input.current.blueY = 0;
      if (blueKnob.current) blueKnob.current.style.transform = "translate(0px,0px)";
    } else {
      redTouch.current = null;
      input.current.redX = 0;
      input.current.redY = 0;
      if (redKnob.current) redKnob.current.style.transform = "translate(0px,0px)";
    }
  };

  const resetGame = () => window.__resetRobotMaze?.();
  const fire = (team: Team) => window.__fireRobotMaze?.(team);
  const follow = (team: Team) => window.__followRobotMaze?.(team);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#020617", overflow: "hidden", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, top: 0, padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, pointerEvents: "none", color: "white", fontFamily: "system-ui,sans-serif", textShadow: "0 2px 8px #000" }}>
        <div style={{ fontWeight: 950, fontSize: 12, lineHeight: 1.25 }}>BLUE {hud.blue} · HP {hud.blueHp} · AMMO {hud.blueAmmo}</div>
        <div style={{ fontSize: 12, fontWeight: 900 }}>⏱ {hud.time}s</div>
        <div style={{ fontWeight: 950, fontSize: 12, lineHeight: 1.25, textAlign: "right" }}>RED {hud.red} · HP {hud.redHp} · AMMO {hud.redAmmo}</div>
        <div style={{ gridColumn: "1 / 4", fontSize: 11, textAlign: "center", lineHeight: 1.2 }}>{hud.status}</div>
      </div>

      <button onClick={resetGame} style={{ position: "fixed", right: 14, top: 64, border: "1px solid rgba(255,255,255,0.28)", color: "white", background: "rgba(15,23,42,0.82)", borderRadius: 14, padding: "8px 12px", fontWeight: 900, pointerEvents: "auto" }}>Reset</button>

      <button onClick={() => follow("blue")} style={{ position: "fixed", left: 14, top: 64, border: "1px solid rgba(147,197,253,0.38)", color: "white", background: "rgba(29,105,255,0.45)", borderRadius: 14, padding: "8px 10px", fontWeight: 900, pointerEvents: "auto" }}>Cam Blue</button>
      <button onClick={() => follow("red")} style={{ position: "fixed", left: 105, top: 64, border: "1px solid rgba(252,165,165,0.38)", color: "white", background: "rgba(217,47,47,0.45)", borderRadius: 14, padding: "8px 10px", fontWeight: 900, pointerEvents: "auto" }}>Cam Red</button>

      <button onClick={() => fire("blue")} style={{ position: "fixed", left: 36, bottom: 168, width: 86, height: 46, border: "1px solid rgba(147,197,253,0.48)", borderRadius: 18, color: "white", background: "rgba(29,105,255,0.72)", fontWeight: 950, pointerEvents: "auto", boxShadow: "0 12px 24px rgba(0,0,0,0.35)" }}>FIRE</button>
      <button onClick={() => fire("red")} style={{ position: "fixed", right: 36, bottom: 168, width: 86, height: 46, border: "1px solid rgba(252,165,165,0.48)", borderRadius: 18, color: "white", background: "rgba(217,47,47,0.72)", fontWeight: 950, pointerEvents: "auto", boxShadow: "0 12px 24px rgba(0,0,0,0.35)" }}>FIRE</button>

      <div style={{ position: "fixed", left: 12, bottom: 14, color: "#93c5fd", fontFamily: "system-ui,sans-serif", fontSize: 11, fontWeight: 900, textShadow: "0 2px 8px #000" }}>BLUE SOLDIER</div>
      <div
        ref={blueBase}
        onPointerDown={(e) => { blueTouch.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); updateStick("blue", e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (blueTouch.current === e.pointerId) updateStick("blue", e.clientX, e.clientY); }}
        onPointerUp={() => endStick("blue")}
        onPointerCancel={() => endStick("blue")}
        style={{ position: "fixed", left: 22, bottom: 34, width: 124, height: 124, borderRadius: 999, background: "rgba(29,105,255,0.2)", border: "1px solid rgba(147,197,253,0.45)", pointerEvents: "auto", display: "grid", placeItems: "center", boxShadow: "0 18px 34px rgba(0,0,0,0.35)" }}
      >
        <div ref={blueKnob} style={{ width: 54, height: 54, borderRadius: 999, background: "rgba(147,197,253,0.94)", boxShadow: "0 8px 18px rgba(0,0,0,0.35)", transition: "transform 70ms linear" }} />
      </div>

      <div style={{ position: "fixed", right: 12, bottom: 14, color: "#fca5a5", fontFamily: "system-ui,sans-serif", fontSize: 11, fontWeight: 900, textShadow: "0 2px 8px #000" }}>RED SOLDIER</div>
      <div
        ref={redBase}
        onPointerDown={(e) => { redTouch.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); updateStick("red", e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (redTouch.current === e.pointerId) updateStick("red", e.clientX, e.clientY); }}
        onPointerUp={() => endStick("red")}
        onPointerCancel={() => endStick("red")}
        style={{ position: "fixed", right: 22, bottom: 34, width: 124, height: 124, borderRadius: 999, background: "rgba(217,47,47,0.2)", border: "1px solid rgba(252,165,165,0.45)", pointerEvents: "auto", display: "grid", placeItems: "center", boxShadow: "0 18px 34px rgba(0,0,0,0.35)" }}
      >
        <div ref={redKnob} style={{ width: 54, height: 54, borderRadius: 999, background: "rgba(252,165,165,0.94)", boxShadow: "0 8px 18px rgba(0,0,0,0.35)", transition: "transform 70ms linear" }} />
      </div>
    </div>
  );
}
