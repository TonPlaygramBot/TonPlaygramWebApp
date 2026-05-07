'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type WeaponId = 'fps' | 'smg' | 'sniper' | 'shotgun';
type PickupKind = 'health' | 'ammo' | 'weapon' | 'armor';
type BoxDrop = PickupKind | 'none';

type WeaponDef = {
  id: WeaponId;
  name: string;
  slot: string;
  ammo: number;
  damage: number;
  cooldown: number;
  range: number;
  color: number;
  urls: string[];
};

type Actor = {
  id: number;
  name: string;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  hp: number;
  armor: number;
  ammo: number;
  weapon: WeaponDef;
  cooldown: number;
  collapsed: number;
  bleed: number;
  aiThink: number;
  targetCell: { r: number; c: number };
};

type Crate = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  drop: BoxDrop;
};

type Pickup = {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  kind: PickupKind;
  weapon?: WeaponDef;
  amount: number;
  active: boolean;
};

type Bullet = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  active: boolean;
};

type Hud = {
  hp: number;
  armor: number;
  ammo: number;
  weapon: string;
  alive: number;
  fps: number;
  status: string;
};

type MiniDot = {
  x: number;
  y: number;
  color: string;
  size: number;
};

const CELL = 0.72;
const PLAYER_EYE = 0.62;
const PLAYER_RADIUS = 0.16;
const WALK_SPEED = 1.75;
const RUN_SPEED = 3.05;
const LOOK_SENS = 0.0044;
const DT_MAX = 1 / 45;
const BOT_COUNT = 7;
const START_AMMO = 90;
const FPS_GUN_URLS = [
  'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
];
const GLB_URLS = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistol:
    'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb'
};

const WEAPONS: WeaponDef[] = [
  {
    id: 'fps',
    name: 'FPS Rifle',
    slot: 'FPS',
    ammo: 90,
    damage: 22,
    cooldown: 0.115,
    range: 5.7,
    color: 0xfacc15,
    urls: FPS_GUN_URLS
  },
  {
    id: 'smg',
    name: 'MRTK SMG',
    slot: 'SMG',
    ammo: 70,
    damage: 14,
    cooldown: 0.075,
    range: 4.4,
    color: 0x22d3ee,
    urls: [GLB_URLS.mrtk]
  },
  {
    id: 'sniper',
    name: 'AWP Sniper',
    slot: 'AWP',
    ammo: 18,
    damage: 70,
    cooldown: 0.52,
    range: 8.5,
    color: 0x93c5fd,
    urls: [GLB_URLS.awp]
  },
  {
    id: 'shotgun',
    name: 'Short Shotgun',
    slot: 'SHOT',
    ammo: 30,
    damage: 42,
    cooldown: 0.38,
    range: 2.8,
    color: 0xfb923c,
    urls: [GLB_URLS.pistol]
  }
];

const START_WEAPON = WEAPONS[0];
const MAZE = [
  '111111111111111',
  '100000100000001',
  '101110101011101',
  '101000001000101',
  '101011111110101',
  '100010000010001',
  '111010111010111',
  '100000101000001',
  '101110101011101',
  '100010000010001',
  '101011111110101',
  '101000001000101',
  '101110101011101',
  '100000100000001',
  '111111111111111'
];
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const WORLD_W = COLS * CELL;
const WORLD_H = ROWS * CELL;
const TMP = new THREE.Vector3();

function cellToWorld(r: number, c: number) {
  return new THREE.Vector3(
    (c - COLS / 2 + 0.5) * CELL,
    0,
    (r - ROWS / 2 + 0.5) * CELL
  );
}

function worldToCell(pos: THREE.Vector3) {
  return {
    r: THREE.MathUtils.clamp(Math.floor(pos.z / CELL + ROWS / 2), 0, ROWS - 1),
    c: THREE.MathUtils.clamp(Math.floor(pos.x / CELL + COLS / 2), 0, COLS - 1)
  };
}

function isWall(r: number, c: number) {
  return r < 0 || c < 0 || r >= ROWS || c >= COLS || MAZE[r][c] === '1';
}

function yawForward(yaw: number) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
}

function yawRight(yaw: number) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
}

function mat(color: number, roughness = 0.8, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeFallbackGun(weapon: WeaponDef) {
  const group = new THREE.Group();
  const skin = mat(0xc58f65, 0.72, 0.02);
  const dark = mat(0x0f172a, 0.48, 0.35);
  const metal = mat(weapon.color, 0.34, 0.42);
  const leftHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.075, 0.2),
    skin
  );
  const rightHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.08, 0.22),
    skin
  );
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.42), metal);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.34), dark);
  leftHand.position.set(-0.12, -0.08, -0.2);
  rightHand.position.set(0.13, -0.1, -0.1);
  body.position.set(0.04, -0.1, -0.22);
  barrel.position.set(0.04, -0.08, -0.55);
  group.add(leftHand, rightHand, body, barrel);
  return group;
}

function loadFirstModel(
  loader: GLTFLoader,
  urls: string[],
  onLoad: (model: THREE.Object3D) => void
) {
  let i = 0;
  const load = () => {
    const url = urls[i++];
    if (!url) return;
    loader
      .setCrossOrigin('anonymous')
      .load(url, (gltf) => onLoad(gltf.scene), undefined, load);
  };
  load();
}

function fitModel(model: THREE.Object3D, height: number) {
  model.scale.setScalar(1);
  model.rotation.set(0, Math.PI, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y -= box2.min.y - center.y;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });
  return model;
}

function makeHumanoid(color: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.105, 0.36, 5, 8),
    mat(color)
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    mat(0xd1a27a)
  );
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.035, 0.28),
    mat(0x111827, 0.5, 0.25)
  );
  body.position.y = 0.34;
  head.position.y = 0.63;
  gun.position.set(0.09, 0.42, 0.12);
  group.add(body, head, gun);
  return group;
}

function makePickup(kind: PickupKind, weapon?: WeaponDef) {
  const group = new THREE.Group();
  const color =
    kind === 'health'
      ? 0x22c55e
      : kind === 'ammo'
        ? 0xfacc15
        : kind === 'armor'
          ? 0x38bdf8
          : (weapon?.color ?? 0xe879f9);
  const geo =
    kind === 'weapon'
      ? new THREE.BoxGeometry(0.26, 0.055, 0.12)
      : new THREE.OctahedronGeometry(0.095, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
      roughness: 0.38,
      metalness: 0.18
    })
  );
  group.add(mesh, new THREE.PointLight(color, 0.45, 1.1));
  return group;
}

function makeCrate(drop: BoxDrop) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.34, 0.44),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.92,
      metalness: 0.01
    })
  );
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.drop = drop;
  return mesh;
}

function openCells() {
  const cells: { r: number; c: number }[] = [];
  for (let r = 1; r < ROWS - 1; r += 1) {
    for (let c = 1; c < COLS - 1; c += 1)
      if (!isWall(r, c)) cells.push({ r, c });
  }
  return cells;
}

function collides(pos: THREE.Vector3, crates: Crate[], radius = PLAYER_RADIUS) {
  const c = worldToCell(pos);
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (isWall(c.r + dr, c.c + dc)) {
        const wp = cellToWorld(c.r + dr, c.c + dc);
        if (
          Math.abs(pos.x - wp.x) < CELL * 0.5 + radius &&
          Math.abs(pos.z - wp.z) < CELL * 0.5 + radius
        )
          return true;
      }
    }
  }
  return crates.some(
    (crate) => crate.alive && crate.pos.distanceTo(pos) < 0.34 + radius
  );
}

export default function RunMan() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveBaseRef = useRef<HTMLDivElement | null>(null);
  const moveKnobRef = useRef<HTMLDivElement | null>(null);
  const fireTouchRef = useRef<number | null>(null);
  const inputRef = useRef({
    moveX: 0,
    moveY: 0,
    yaw: 0,
    pitch: -0.03,
    firing: false,
    reloading: 0,
    recoil: 0
  });
  const lookRef = useRef<{
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const moveRef = useRef<number | null>(null);
  const [hud, setHud] = useState<Hud>({
    hp: 100,
    armor: 0,
    ammo: START_AMMO,
    weapon: START_WEAPON.slot,
    alive: BOT_COUNT + 1,
    fps: 60,
    status: 'The Maze Battle Royal loading…'
  });
  const [slots, setSlots] = useState<WeaponDef[]>([START_WEAPON, WEAPONS[1]]);
  const [miniDots, setMiniDots] = useState<MiniDot[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x060913, 1);
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x060913, 4.8, 11.5);
    const camera = new THREE.PerspectiveCamera(67, 1, 0.03, 30);
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.55));
    const playerLight = new THREE.PointLight(0x8bd3ff, 1.4, 4.5);
    camera.add(playerLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W + 1.2, WORLD_H + 1.2),
      mat(0x172033, 0.88, 0.02)
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const wallGeo = new THREE.BoxGeometry(CELL * 0.98, 0.9, CELL * 0.98);
    const wallCount = MAZE.join('')
      .split('')
      .filter((v) => v === '1').length;
    const walls = new THREE.InstancedMesh(
      wallGeo,
      mat(0x243044, 0.74, 0.03),
      wallCount
    );
    let wallIndex = 0;
    const wallMatrix = new THREE.Matrix4();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!isWall(r, c)) continue;
        const p = cellToWorld(r, c);
        wallMatrix.makeTranslation(p.x, 0.45, p.z);
        walls.setMatrixAt(wallIndex++, wallMatrix);
      }
    }
    walls.instanceMatrix.needsUpdate = true;
    scene.add(walls);

    const cells = openCells();
    const crates: Crate[] = [];
    const crateDrops: BoxDrop[] = [
      'health',
      'ammo',
      'weapon',
      'armor',
      'none',
      'ammo',
      'health',
      'weapon'
    ];
    const crateCells = cells
      .filter(
        (cell) => (cell.r + cell.c) % 4 === 0 && !(cell.r > 11 && cell.c < 3)
      )
      .slice(0, 22);
    crateCells.forEach((cell, i) => {
      const pos = cellToWorld(cell.r, cell.c);
      const mesh = makeCrate(crateDrops[i % crateDrops.length]);
      mesh.position.set(pos.x, 0.17, pos.z);
      scene.add(mesh);
      crates.push({ mesh, pos, hp: 44, alive: true, drop: mesh.userData.drop });
    });

    const pickups: Pickup[] = [];
    const spawnPickup = (
      pos: THREE.Vector3,
      kind: PickupKind,
      weapon?: WeaponDef,
      amount = 1
    ) => {
      const mesh = makePickup(kind, weapon);
      mesh.position.copy(pos).setY(0.24);
      scene.add(mesh);
      pickups.push({
        mesh,
        pos: pos.clone(),
        kind,
        weapon,
        amount,
        active: true
      });
    };
    spawnPickup(cellToWorld(1, 3), 'weapon', WEAPONS[2], WEAPONS[2].ammo);
    spawnPickup(cellToWorld(13, 11), 'weapon', WEAPONS[3], WEAPONS[3].ammo);
    spawnPickup(cellToWorld(7, 1), 'health', undefined, 35);
    spawnPickup(cellToWorld(7, 13), 'ammo', undefined, 45);

    const actors: Actor[] = [];
    const playerMesh = new THREE.Group();
    scene.add(playerMesh);
    actors.push({
      id: 0,
      name: 'You',
      mesh: playerMesh,
      pos: cellToWorld(13, 1),
      vel: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, -1),
      hp: 100,
      armor: 0,
      ammo: START_AMMO,
      weapon: START_WEAPON,
      cooldown: 0,
      collapsed: 0,
      bleed: 0,
      aiThink: 0,
      targetCell: { r: 1, c: 13 }
    });
    const botStarts = [
      cellToWorld(1, 13),
      cellToWorld(1, 1),
      cellToWorld(13, 13),
      cellToWorld(7, 7),
      cellToWorld(3, 7),
      cellToWorld(11, 7),
      cellToWorld(7, 3)
    ];
    botStarts.forEach((pos, i) => {
      const mesh = makeHumanoid(i % 2 ? 0xd92f2f : 0xf97316);
      scene.add(mesh);
      actors.push({
        id: i + 1,
        name: `Raider ${i + 1}`,
        mesh,
        pos: pos.clone(),
        vel: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, 1),
        hp: 68,
        armor: i % 3 ? 0 : 25,
        ammo: 60,
        weapon: WEAPONS[i % WEAPONS.length],
        cooldown: Math.random() * 0.5,
        collapsed: 0,
        bleed: 0,
        aiThink: 0,
        targetCell: worldToCell(actors[0].pos)
      });
    });
    const player = actors[0];

    const bullets: Bullet[] = Array.from({ length: 40 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      mesh.visible = false;
      scene.add(mesh);
      return {
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        active: false
      };
    });
    const bloodPool = Array.from({ length: 34 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xb91c1c })
      );
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });
    let bloodCursor = 0;

    const loader = new GLTFLoader();
    const viewModel = new THREE.Group();
    viewModel.position.set(0.22, -0.19, -0.5);
    camera.add(viewModel);

    const setViewWeapon = (weapon: WeaponDef) => {
      viewModel.clear();
      const fallback = makeFallbackGun(weapon);
      viewModel.add(fallback);
      loadFirstModel(loader, weapon.urls, (source) => {
        if (player.weapon.id !== weapon.id) return;
        viewModel.clear();
        const hands = makeFallbackGun(weapon);
        hands.position.set(0.02, -0.035, 0.07);
        const model = fitModel(
          source.clone(true),
          weapon.id === 'fps' ? 0.31 : 0.24
        );
        model.rotation.set(-0.07, Math.PI, 0.02);
        model.position.set(0.06, -0.13, -0.34);
        viewModel.add(hands, model);
      });
    };
    setViewWeapon(START_WEAPON);

    const swapTo = (weapon: WeaponDef) => {
      player.weapon = weapon;
      player.ammo = Math.max(player.ammo, Math.min(weapon.ammo, 24));
      inputRef.current.reloading = 0.28;
      setViewWeapon(weapon);
      setHud((h) => ({
        ...h,
        weapon: weapon.slot,
        ammo: player.ammo,
        status: `Quick swap: ${weapon.name}`
      }));
    };
    (window as unknown as { __mazeSwap?: (id: WeaponId) => void }).__mazeSwap =
      (id) => {
        const weapon =
          slots.find((w) => w.id === id) ?? WEAPONS.find((w) => w.id === id);
        if (weapon) swapTo(weapon);
      };

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(1.45, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const emitBlood = (pos: THREE.Vector3, count = 4) => {
      for (let i = 0; i < count; i += 1) {
        const mesh = bloodPool[bloodCursor++ % bloodPool.length];
        mesh.position
          .copy(pos)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.18,
              0.18 + Math.random() * 0.14,
              (Math.random() - 0.5) * 0.18
            )
          );
        mesh.visible = true;
      }
    };

    const breakCrate = (crate: Crate) => {
      if (!crate.alive) return;
      crate.alive = false;
      crate.mesh.visible = false;
      const pos = crate.pos.clone();
      if (crate.drop === 'health') spawnPickup(pos, 'health', undefined, 35);
      if (crate.drop === 'ammo') spawnPickup(pos, 'ammo', undefined, 40);
      if (crate.drop === 'armor') spawnPickup(pos, 'armor', undefined, 30);
      if (crate.drop === 'weapon')
        spawnPickup(
          pos,
          'weapon',
          WEAPONS[1 + Math.floor(Math.random() * (WEAPONS.length - 1))],
          45
        );
      setHud((h) => ({
        ...h,
        status:
          crate.drop === 'none'
            ? 'Wooden box broken.'
            : `Wooden box dropped ${crate.drop}!`
      }));
    };

    const damageAt = (
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      weapon: WeaponDef,
      owner: Actor
    ) => {
      let hitDistance = weapon.range;
      let hitActor: Actor | null = null;
      for (const actor of actors) {
        if (actor.id === owner.id || actor.hp <= 0) continue;
        TMP.copy(actor.pos).sub(origin);
        const forwardDistance = TMP.dot(dir);
        if (forwardDistance < 0.15 || forwardDistance > hitDistance) continue;
        const side = TMP.addScaledVector(dir, -forwardDistance).length();
        if (side < 0.24) {
          hitDistance = forwardDistance;
          hitActor = actor;
        }
      }
      let hitCrate: Crate | null = null;
      for (const crate of crates) {
        if (!crate.alive) continue;
        TMP.copy(crate.pos).sub(origin);
        const forwardDistance = TMP.dot(dir);
        if (forwardDistance < 0.15 || forwardDistance > hitDistance) continue;
        const side = TMP.addScaledVector(dir, -forwardDistance).length();
        if (side < 0.32) {
          hitDistance = forwardDistance;
          hitCrate = crate;
          hitActor = null;
        }
      }
      if (hitActor) {
        const armorBlock = Math.min(
          hitActor.armor,
          Math.ceil(weapon.damage * 0.45)
        );
        hitActor.armor -= armorBlock;
        hitActor.hp = Math.max(0, hitActor.hp - (weapon.damage - armorBlock));
        hitActor.bleed = 0.5;
        emitBlood(hitActor.pos.clone().setY(0.36), hitActor.hp <= 0 ? 8 : 4);
        if (hitActor.hp <= 0) {
          hitActor.collapsed = 1;
          hitActor.mesh.rotation.x = -Math.PI / 2;
          hitActor.mesh.position.y = 0.08;
          setHud((h) => ({
            ...h,
            status: `${owner.name} collapsed ${hitActor.name}.`
          }));
        }
      }
      if (hitCrate) {
        hitCrate.hp -= weapon.damage;
        hitCrate.mesh.rotation.y += 0.18;
        if (hitCrate.hp <= 0) breakCrate(hitCrate);
      }
      const bullet = bullets.find((b) => !b.active);
      if (bullet) {
        bullet.active = true;
        bullet.life = 0.08;
        bullet.pos
          .copy(origin)
          .addScaledVector(dir, Math.min(hitDistance, 0.55));
        bullet.vel.copy(dir).multiplyScalar(10);
        bullet.mesh.position.copy(bullet.pos).setY(origin.y);
        bullet.mesh.visible = true;
      }
    };

    const shoot = (owner: Actor, dir: THREE.Vector3) => {
      if (owner.cooldown > 0 || owner.ammo <= 0 || owner.hp <= 0) return;
      owner.ammo -= 1;
      owner.cooldown = owner.weapon.cooldown;
      if (owner.id === 0) inputRef.current.recoil = 0.12;
      const muzzle = owner.pos
        .clone()
        .add(new THREE.Vector3(0, owner.id === 0 ? PLAYER_EYE : 0.45, 0))
        .addScaledVector(dir, 0.2);
      damageAt(muzzle, dir.clone().normalize(), owner.weapon, owner);
      if (owner.id === 0)
        setHud((h) => ({
          ...h,
          ammo: owner.ammo,
          weapon: owner.weapon.slot,
          status: `Fired ${owner.weapon.slot}`
        }));
    };

    const melee = (mode: 'punch' | 'kick') => {
      const dir = yawForward(inputRef.current.yaw);
      let didHit = false;
      crates.forEach((crate) => {
        if (!crate.alive) return;
        TMP.copy(crate.pos).sub(player.pos);
        if (
          TMP.length() < (mode === 'kick' ? 0.72 : 0.55) &&
          TMP.normalize().dot(dir) > 0.35
        ) {
          crate.hp -= mode === 'kick' ? 28 : 18;
          crate.mesh.rotation.y += mode === 'kick' ? 0.32 : 0.18;
          didHit = true;
          if (crate.hp <= 0) breakCrate(crate);
        }
      });
      inputRef.current.recoil = mode === 'kick' ? 0.2 : 0.12;
      if (didHit)
        setHud((h) => ({ ...h, status: `Wooden box hit with ${mode}.` }));
    };
    (
      window as unknown as { __mazeMelee?: (mode: 'punch' | 'kick') => void }
    ).__mazeMelee = melee;

    let frame = 0;
    let last = performance.now();
    let hudTimer = 0;
    let fpsSmooth = 60;

    const moveActor = (
      actor: Actor,
      dir: THREE.Vector3,
      speed: number,
      dt: number
    ) => {
      if (actor.hp <= 0) return;
      if (dir.lengthSq() > 0.001) {
        dir.normalize();
        actor.dir.lerp(dir, 1 - Math.pow(0.004, dt)).normalize();
        actor.vel.lerp(dir.multiplyScalar(speed), 1 - Math.pow(0.004, dt));
      } else {
        actor.vel.multiplyScalar(Math.pow(0.0008, dt));
      }
      const next = actor.pos.clone().addScaledVector(actor.vel, dt);
      const old = actor.pos.clone();
      const xTry = actor.pos.clone();
      xTry.x = next.x;
      if (!collides(xTry, crates)) actor.pos.x = xTry.x;
      const zTry = actor.pos.clone();
      zTry.z = next.z;
      if (!collides(zTry, crates)) actor.pos.z = zTry.z;
      actor.mesh.position.copy(actor.pos);
      if (actor.id !== 0) {
        actor.mesh.rotation.y = Math.atan2(actor.dir.x, actor.dir.z);
        actor.mesh.position.y = 0;
        if (actor.pos.distanceTo(old) > 0.002)
          actor.mesh.position.y +=
            Math.sin(performance.now() * 0.014 + actor.id) * 0.018;
      }
    };

    const updatePickups = (dt: number) => {
      pickups.forEach((pickup) => {
        if (!pickup.active) return;
        pickup.mesh.rotation.y += dt * 2.2;
        pickup.mesh.position.y =
          0.24 + Math.sin(performance.now() * 0.004 + pickup.pos.x) * 0.025;
        if (pickup.pos.distanceTo(player.pos) < 0.44) {
          pickup.active = false;
          pickup.mesh.visible = false;
          if (pickup.kind === 'health')
            player.hp = Math.min(100, player.hp + pickup.amount);
          if (pickup.kind === 'armor')
            player.armor = Math.min(80, player.armor + pickup.amount);
          if (pickup.kind === 'ammo') player.ammo += pickup.amount;
          if (pickup.kind === 'weapon' && pickup.weapon) {
            setSlots((current) =>
              [
                pickup.weapon!,
                ...current.filter((w) => w.id !== pickup.weapon!.id)
              ].slice(0, 4)
            );
            swapTo(pickup.weapon);
          }
          setHud((h) => ({
            ...h,
            hp: player.hp,
            armor: player.armor,
            ammo: player.ammo,
            weapon: player.weapon.slot,
            status:
              pickup.kind === 'weapon'
                ? `Picked ${pickup.weapon?.name}`
                : `Picked ${pickup.kind} +${pickup.amount}`
          }));
        }
      });
    };

    const updateBots = (dt: number) => {
      const pc = worldToCell(player.pos);
      actors.slice(1).forEach((bot) => {
        if (bot.hp <= 0) return;
        bot.aiThink -= dt;
        if (bot.aiThink <= 0) {
          bot.aiThink = 0.28 + Math.random() * 0.18;
          bot.targetCell =
            Math.random() < 0.74
              ? pc
              : cells[Math.floor(Math.random() * cells.length)];
        }
        const bc = worldToCell(bot.pos);
        const options = [
          { r: bc.r - 1, c: bc.c },
          { r: bc.r + 1, c: bc.c },
          { r: bc.r, c: bc.c - 1 },
          { r: bc.r, c: bc.c + 1 }
        ].filter((cell) => !isWall(cell.r, cell.c));
        const best = options.reduce(
          (winner, cell) =>
            Math.abs(cell.r - bot.targetCell.r) +
              Math.abs(cell.c - bot.targetCell.c) <
            Math.abs(winner.r - bot.targetCell.r) +
              Math.abs(winner.c - bot.targetCell.c)
              ? cell
              : winner,
          options[0] ?? bc
        );
        const move = cellToWorld(best.r, best.c).sub(bot.pos).setY(0);
        moveActor(bot, move, 1.55, dt);
        bot.cooldown = Math.max(0, bot.cooldown - dt);
        if (
          bot.pos.distanceTo(player.pos) < bot.weapon.range &&
          Math.random() < dt * 0.85
        )
          shoot(bot, player.pos.clone().sub(bot.pos).setY(0).normalize());
      });
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      fpsSmooth = fpsSmooth * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;

      const forward = yawForward(inputRef.current.yaw);
      const right = yawRight(inputRef.current.yaw);
      const move = forward
        .multiplyScalar(-inputRef.current.moveY)
        .add(right.multiplyScalar(inputRef.current.moveX));
      const movePower = Math.min(
        1,
        Math.hypot(inputRef.current.moveX, inputRef.current.moveY)
      );
      moveActor(
        player,
        move,
        THREE.MathUtils.lerp(WALK_SPEED, RUN_SPEED, movePower),
        dt
      );
      player.dir.copy(yawForward(inputRef.current.yaw));
      player.cooldown = Math.max(0, player.cooldown - dt);
      inputRef.current.reloading = Math.max(0, inputRef.current.reloading - dt);
      inputRef.current.recoil = Math.max(0, inputRef.current.recoil - dt * 1.8);
      if (inputRef.current.firing) shoot(player, player.dir.clone());

      updateBots(dt);
      updatePickups(dt);

      bullets.forEach((bullet) => {
        if (!bullet.active) return;
        bullet.life -= dt;
        bullet.pos.addScaledVector(bullet.vel, dt);
        bullet.mesh.position.copy(bullet.pos);
        if (bullet.life <= 0) {
          bullet.active = false;
          bullet.mesh.visible = false;
        }
      });
      bloodPool.forEach((mesh) => {
        if (!mesh.visible) return;
        mesh.position.y = Math.max(0.018, mesh.position.y - dt * 0.42);
      });

      const camPos = player.pos
        .clone()
        .add(new THREE.Vector3(0, PLAYER_EYE, 0));
      const pitchLift =
        Math.sin(inputRef.current.pitch) * 1.1 + inputRef.current.recoil * 0.45;
      camera.position.copy(camPos);
      camera.lookAt(
        camPos
          .clone()
          .addScaledVector(player.dir, 1.7)
          .add(new THREE.Vector3(0, pitchLift, 0))
      );
      viewModel.position.y =
        -0.19 -
        inputRef.current.reloading * 0.22 +
        Math.sin(now * 0.011) * movePower * 0.012;
      viewModel.position.z = -0.5 + inputRef.current.recoil * 0.35;
      viewModel.rotation.x = -0.04 - inputRef.current.recoil * 0.55;

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.22;
        const alive = actors.filter((actor) => actor.hp > 0).length;
        setHud((h) => ({
          ...h,
          hp: Math.max(0, Math.round(player.hp)),
          armor: Math.round(player.armor),
          ammo: player.ammo,
          weapon: player.weapon.slot,
          alive,
          fps: Math.round(fpsSmooth)
        }));
        const dots: MiniDot[] = [];
        dots.push({
          x: (player.pos.x / WORLD_W + 0.5) * 100,
          y: (player.pos.z / WORLD_H + 0.5) * 100,
          color: '#38bdf8',
          size: 7
        });
        actors.slice(1).forEach((actor) => {
          if (actor.hp > 0)
            dots.push({
              x: (actor.pos.x / WORLD_W + 0.5) * 100,
              y: (actor.pos.z / WORLD_H + 0.5) * 100,
              color: '#f87171',
              size: 5
            });
        });
        pickups.forEach((pickup) => {
          if (pickup.active)
            dots.push({
              x: (pickup.pos.x / WORLD_W + 0.5) * 100,
              y: (pickup.pos.z / WORLD_H + 0.5) * 100,
              color: pickup.kind === 'health' ? '#22c55e' : '#facc15',
              size: 4
            });
        });
        setMiniDots(dots);
      }

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      delete (window as unknown as { __mazeSwap?: unknown }).__mazeSwap;
      delete (window as unknown as { __mazeMelee?: unknown }).__mazeMelee;
      renderer.dispose();
    };
  }, []);

  const updateStick = (clientX: number, clientY: number) => {
    const base = moveBaseRef.current;
    const knob = moveKnobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = rect.width * 0.42;
    const dist = Math.min(max, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    const power = dist < max * 0.09 ? 0 : dist / max;
    inputRef.current.moveX = Math.cos(angle) * power;
    inputRef.current.moveY = Math.sin(angle) * power;
  };

  const stopStick = () => {
    moveRef.current = null;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    if (moveKnobRef.current)
      moveKnobRef.current.style.transform = 'translate(0px, 0px)';
  };

  const beginLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lookRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const look = lookRef.current;
    if (!look || look.id !== e.pointerId) return;
    const dx = e.clientX - look.x;
    const dy = e.clientY - look.y;
    look.x = e.clientX;
    look.y = e.clientY;
    if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) > 7)
      look.moved = true;
    inputRef.current.yaw -= dx * LOOK_SENS;
    inputRef.current.pitch = THREE.MathUtils.clamp(
      inputRef.current.pitch - dy * LOOK_SENS * 0.72,
      -0.42,
      0.38
    );
  };

  const endLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (lookRef.current?.id === e.pointerId) lookRef.current = null;
  };

  const swapWeapon = (id: WeaponId) =>
    (
      window as unknown as { __mazeSwap?: (weaponId: WeaponId) => void }
    ).__mazeSwap?.(id);
  const melee = (mode: 'punch' | 'kick') =>
    (
      window as unknown as { __mazeMelee?: (mode: 'punch' | 'kick') => void }
    ).__mazeMelee?.(mode);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#050816',
        touchAction: 'none',
        userSelect: 'none',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={beginLook}
          onPointerMove={moveLook}
          onPointerUp={endLook}
          onPointerCancel={() => {
            lookRef.current = null;
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none'
          }}
        />
      </div>

      <div
        style={{
          position: 'fixed',
          top: 8,
          left: 10,
          right: 10,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 8,
          color: '#fff',
          pointerEvents: 'none',
          textShadow: '0 2px 8px #000'
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950 }}>
          THE MAZE BATTLE ROYAL
        </div>
        <div style={{ fontSize: 11, fontWeight: 900 }}>
          FPS {hud.fps} · 👥 {hud.alive}/8
        </div>
        <div
          style={{
            gridColumn: '1 / 3',
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background: 'rgba(239,68,68,0.25)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${hud.hp}%`,
                height: '100%',
                background: '#ef4444'
              }}
            />
          </div>
          <div
            style={{
              flex: 0.7,
              height: 8,
              borderRadius: 999,
              background: 'rgba(56,189,248,0.2)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, hud.armor)}%`,
                height: '100%',
                background: '#38bdf8'
              }}
            />
          </div>
          <div style={{ fontSize: 11, fontWeight: 950 }}>AMMO {hud.ammo}</div>
        </div>
        <div
          style={{
            gridColumn: '1 / 3',
            textAlign: 'center',
            fontSize: 10.5,
            fontWeight: 800,
            color: '#dbeafe'
          }}
        >
          {hud.status}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          right: 12,
          top: 82,
          width: 116,
          height: 116,
          borderRadius: 16,
          border: '1px solid rgba(147,197,253,0.35)',
          background: 'rgba(15,23,42,0.68)',
          overflow: 'hidden',
          pointerEvents: 'none',
          boxShadow: '0 10px 26px rgba(0,0,0,0.35)'
        }}
      >
        {MAZE.map((row, r) =>
          row
            .split('')
            .map(
              (cell, c) =>
                cell === '1' && (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      position: 'absolute',
                      left: `${(c / COLS) * 100}%`,
                      top: `${(r / ROWS) * 100}%`,
                      width: `${100 / COLS}%`,
                      height: `${100 / ROWS}%`,
                      background: 'rgba(148,163,184,0.42)'
                    }}
                  />
                )
            )
        )}
        {miniDots.map((dot, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size,
              height: dot.size,
              transform: 'translate(-50%, -50%)',
              borderRadius: 99,
              background: dot.color,
              boxShadow: `0 0 8px ${dot.color}`
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: 20,
          height: 20,
          transform: 'translate(-50%, -50%)',
          border: '2px solid rgba(255,255,255,0.82)',
          borderRadius: 999,
          pointerEvents: 'none',
          boxShadow: '0 0 18px rgba(250,204,21,0.65)'
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 20,
          bottom: 28,
          width: 158,
          height: 158,
          borderRadius: 999,
          background:
            'radial-gradient(circle, rgba(59,130,246,0.24), rgba(15,23,42,0.38))',
          border: '1px solid rgba(147,197,253,0.52)',
          boxShadow: '0 18px 34px rgba(0,0,0,0.36)',
          pointerEvents: 'auto'
        }}
        ref={moveBaseRef}
        onPointerDown={(e) => {
          moveRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (moveRef.current === e.pointerId)
            updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={stopStick}
        onPointerCancel={stopStick}
      >
        <div
          ref={moveKnobRef}
          style={{
            position: 'absolute',
            left: 48,
            top: 48,
            width: 62,
            height: 62,
            borderRadius: 999,
            background: 'linear-gradient(160deg, #dbeafe, #60a5fa)',
            boxShadow: '0 8px 18px rgba(0,0,0,0.38)',
            transition: 'transform 38ms linear'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -18,
            color: '#bfdbfe',
            fontSize: 10,
            fontWeight: 950,
            textAlign: 'center',
            textShadow: '0 2px 8px #000'
          }}
        >
          WALK / RUN
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 7,
          pointerEvents: 'auto'
        }}
      >
        {slots.map((weapon) => (
          <button
            key={weapon.id}
            onClick={() => swapWeapon(weapon.id)}
            style={{
              border: `1px solid ${hud.weapon === weapon.slot ? 'rgba(250,204,21,0.95)' : 'rgba(255,255,255,0.28)'}`,
              borderRadius: 13,
              background:
                hud.weapon === weapon.slot
                  ? 'rgba(180,83,9,0.88)'
                  : 'rgba(15,23,42,0.82)',
              color: '#fff',
              minWidth: 50,
              padding: '8px 7px',
              fontSize: 10,
              fontWeight: 950,
              boxShadow: '0 8px 18px rgba(0,0,0,0.32)'
            }}
          >
            {weapon.slot}
          </button>
        ))}
      </div>

      <button
        onPointerDown={(e) => {
          fireTouchRef.current = e.pointerId;
          inputRef.current.firing = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={() => {
          fireTouchRef.current = null;
          inputRef.current.firing = false;
        }}
        onPointerCancel={() => {
          fireTouchRef.current = null;
          inputRef.current.firing = false;
        }}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 78,
          width: 104,
          height: 104,
          borderRadius: 999,
          border: '1px solid rgba(252,211,77,0.7)',
          color: '#fff',
          background:
            'radial-gradient(circle, rgba(248,113,113,0.92), rgba(180,83,9,0.84))',
          fontWeight: 1000,
          fontSize: 16,
          pointerEvents: 'auto',
          boxShadow: '0 18px 34px rgba(0,0,0,0.4)'
        }}
      >
        FIRE
      </button>
      <button
        onClick={() => melee('punch')}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 198,
          width: 58,
          height: 58,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff',
          background: 'rgba(15,23,42,0.82)',
          fontWeight: 950,
          pointerEvents: 'auto'
        }}
      >
        PUNCH
      </button>
      <button
        onClick={() => melee('kick')}
        style={{
          position: 'fixed',
          right: 88,
          bottom: 196,
          width: 54,
          height: 54,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff',
          background: 'rgba(15,23,42,0.82)',
          fontWeight: 950,
          pointerEvents: 'auto'
        }}
      >
        KICK
      </button>
    </div>
  );
}
