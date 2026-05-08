'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MURLAN_CHARACTER_THEMES } from '../../config/murlanCharacterThemes.js';

type AnimName = 'Idle' | 'Walk' | 'Run';
type ShotState = 'aim' | 'runup' | 'keeperAim' | 'aiRunup' | 'flight' | 'var' | 'replay' | 'result';
type KickSpot = 'left' | 'center' | 'right' | 'near16';
type ActorKind = 'kicker' | 'keeper' | 'wall' | 'referee' | 'field';
type ShotPhase = 'userShoot' | 'aiShoot' | 'finished';
type ShotControlState = { power: number; aimX: number; aimY: number };
type TeamKey = 'blue' | 'red';
type Decision = 'GOAL' | 'NO GOAL' | 'SAVE' | 'BLOCKED' | 'MISS';
type ShotFeedback = { title: string; detail: string; quality: number; xg: number };

type ParticleRig = {
  group: THREE.Group;
  particles: THREE.Mesh[];
  velocities: THREE.Vector3[];
  ages: number[];
  maxAge: number;
};

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
  speed: number;
  kickTime: number;
  jumpTime: number;
  diveTime: number;
  diveDelay: number;
  diveDir: number;
  diveHeight: number;
  saveTargetX: number;
  saveTargetZ: number;
  saveTargetY: number;
  wallIndex: number;
  loaded: boolean;
  celebrateTime: number;
};

type BallState = {
  object: THREE.Group;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  knuckleSeed: number;
  flying: boolean;
  curve: number;
  shotAge: number;
  shotDuration: number;
  shotStart: THREE.Vector3;
  shotTarget: THREE.Vector3;
  lastPos: THREE.Vector3;
  lift: number;
  netCaught: boolean;
  netAge: number;
  netVel: THREE.Vector3;
  crossedGoalLine: boolean;
  hitFrame: boolean;
  trail: THREE.Line;
  trailPoints: THREE.Vector3[];
  speedKmh: number;
};

type SwipeState = {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  mode?: 'shot' | 'camera' | 'keeper';
  technique?: string;
  moved?: boolean;
  viewportW?: number;
  viewportH?: number;
};

type NetRig = {
  lines: THREE.Line[];
  shake: number;
  impact: THREE.Vector3;
};

type SeatedSpectator = {
  root: THREE.Group;
  fallback: THREE.Group;
  instance: THREE.Object3D | null;
  bones: Partial<
    Record<
      | 'hips'
      | 'spine'
      | 'head'
      | 'leftUpperArm'
      | 'leftForeArm'
      | 'leftHand'
      | 'rightUpperArm'
      | 'rightForeArm'
      | 'rightHand'
      | 'leftThigh'
      | 'leftCalf'
      | 'rightThigh'
      | 'rightCalf',
      THREE.Bone
    >
  >;
  base: Partial<
    Record<
      | 'hips'
      | 'spine'
      | 'head'
      | 'leftUpperArm'
      | 'leftForeArm'
      | 'leftHand'
      | 'rightUpperArm'
      | 'rightForeArm'
      | 'rightHand'
      | 'leftThigh'
      | 'leftCalf'
      | 'rightThigh'
      | 'rightCalf',
      THREE.Euler
    >
  >;
  wallIndex: number;
};

type StadiumRig = {
  spectators: SeatedSpectator[];
  cheerTime: number;
};

type ReplayFrame = {
  ball: THREE.Vector3;
  quat: THREE.Quaternion;
  cam: THREE.Vector3;
  look: THREE.Vector3;
  keeper: THREE.Vector3;
  keeperRot: THREE.Euler;
  kicker: THREE.Vector3;
  kickerRot: THREE.Euler;
};

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';
const MURLAN_CHARACTER_URLS = MURLAN_CHARACTER_THEMES.map(
  (theme) => theme.modelUrls?.[0] ?? theme.url
).filter(Boolean);
const MURLAN_CHARACTER_COLORS = [
  0x1d69ff, 0xdc2626, 0x16a34a, 0xfacc15, 0x7c3aed, 0xf97316, 0x0891b2
];
const CAMERA_YAW_LIMIT = 0.86;
const CAMERA_DRAG_DEADZONE = 8;
const MIN_KEEPER_SWIPE_PX = 22;
const KEEPER_DIVE_DURATION = 0.62;
const KEEPER_DIVE_REACH_BOOST = 1.16;
const REPLAY_SLOWDOWN = 0.48;
const SPECTATOR_ROWS_FILLED = 6;
const SPECTATORS_PER_ROW_TARGET = 22;
const AMBIENT_FIELD_PLAYER_COUNT = 22;
const SPECTATOR_SCALE = 0.78;
const SPECTATOR_FALLBACK_SCALE = 0.86;
const SPECTATOR_SEAT_Y = 0.09;
const SPECTATOR_SEAT_Z = 0.11;
const DEFAULT_SHOT_CONTROL: ShotControlState = { power: 0.72, aimX: 0, aimY: -0.35 };
const DEFAULT_FEEDBACK: ShotFeedback = {
  title: 'Training ground ready',
  detail: 'Drag the contact point: lower contact adds lift, side contact bends the ball.',
  quality: 0.58,
  xg: 0.31
};
const TEAM_KITS: Record<TeamKey, { primary: number; secondary: number; shorts: number; shoes: number; name: string }> = {
  blue: { primary: 0x1d69ff, secondary: 0xffffff, shorts: 0x102a6b, shoes: 0xffffff, name: 'Blue' },
  red: { primary: 0xdc2626, secondary: 0xfacc15, shorts: 0x7f1d1d, shoes: 0x111827, name: 'Red' }
};
const POLYHAVEN_TEXTURES = {
  // Poly Haven CC0 texture files used as lightweight 1K maps for uniforms/shoes.
  fabricBlue: 'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/terlenka/terlenka_diff_1k.png',
  fabricRed: 'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/fabric_pattern_07/fabric_pattern_07_col_1_1k.png',
  shoeLeather: 'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/leather_white/leather_white_diff_1k.png'
};

const GOAL_RUSH_SOUNDS = {
  crowd: '/assets/sounds/football-crowd-3-69245.mp3',
  whistle: '/assets/sounds/metal-whistle-6121.mp3',
  kick: '/assets/sounds/football-game-sound-effects-359284.mp3',
  net: '/assets/sounds/a-football-hits-the-net-goal-313216.mp3',
  post: '/assets/sounds/frying-pan-over-the-head-89303.mp3',
  victory: '/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3'
};

const FIELD_W = 22.0;
const HALF_H = 36.0;
const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_D = 2.35;
const POST_R = 0.07;
const PENALTY_W = 16.5;
const PENALTY_D = 16.5;
const GOAL_AREA_W = 7.32 + 5.5 * 2;
const GOAL_AREA_D = 5.5;
const PENALTY_SPOT_D = 11.0;
const ARC_R = 9.15;
const WALL_DISTANCE = 9.15;
const BALL_R = 0.11;
const PLAYER_H = 1.82;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const GOAL_LINE_Z = -HALF_H / 2;
const RUNUP_BACK_STEPS = 2.35;
const KICK_STRIKE_TIME = 0.72;
const TMP = new THREE.Vector3();
const QTMP = new THREE.Quaternion();
const SEATED_CHARACTER_TEMPLATE_CACHE = new Map<
  string,
  Promise<THREE.Object3D>
>();

function shuffledCharacterColors() {
  const count = Math.max(7, MURLAN_CHARACTER_THEMES.length || 0);
  const colors = Array.from(
    { length: count },
    (_, index) =>
      MURLAN_CHARACTER_COLORS[index % MURLAN_CHARACTER_COLORS.length]
  );
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}

function shuffledCharacterUrls() {
  const urls = [
    ...new Set(
      MURLAN_CHARACTER_URLS.length ? MURLAN_CHARACTER_URLS : [HUMAN_URL]
    )
  ];
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urls[i], urls[j]] = [urls[j], urls[i]];
  }
  return urls;
}

function makeGoalRushAudio() {
  let enabled = true;
  let started = false;
  let pendingWhistle = true;
  const crowd = new Audio(GOAL_RUSH_SOUNDS.crowd);
  crowd.loop = true;
  crowd.volume = 0.5;

  const playOneShot = (src: string, volume = 1) => {
    if (!enabled || !started) return;
    const sound = new Audio(src);
    sound.volume = volume;
    sound.play().catch(() => {});
  };

  const start = () => {
    if (!enabled || started) return;
    started = true;
    crowd.play().catch(() => {});
    if (pendingWhistle) {
      pendingWhistle = false;
      playOneShot(GOAL_RUSH_SOUNDS.whistle, 0.9);
    }
  };

  return {
    start,
    whistle() {
      if (!enabled) return;
      if (!started) {
        pendingWhistle = true;
        return;
      }
      playOneShot(GOAL_RUSH_SOUNDS.whistle, 0.9);
    },
    kick() {
      playOneShot(GOAL_RUSH_SOUNDS.kick, 0.92);
    },
    net() {
      playOneShot(GOAL_RUSH_SOUNDS.net, 0.95);
    },
    save() {
      playOneShot(GOAL_RUSH_SOUNDS.post, 0.7);
    },
    goal() {
      playOneShot(GOAL_RUSH_SOUNDS.victory, 0.72);
    },
    dispose() {
      enabled = false;
      crowd.pause();
      crowd.src = '';
    }
  };
}

function material(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const TEXTURE_CACHE = new Map<string, THREE.Texture>();

function polyhavenTexture(url: string, repeat = 3) {
  let tex = TEXTURE_CACHE.get(url);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const isRed = url.includes('fabric_pattern_07');
    const isLeather = url.includes('leather');
    const base = isLeather ? '#f8fafc' : isRed ? '#dc2626' : '#1d69ff';
    const line = isLeather ? '#94a3b8' : isRed ? '#facc15' : '#dbeafe';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = isLeather ? 0.18 : 0.28;
    for (let i = -128; i < 256; i += isLeather ? 9 : 12) {
      ctx.strokeStyle = line;
      ctx.lineWidth = isLeather ? 2 : 3;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 128; i += 8) {
      ctx.fillStyle = i % 16 ? '#ffffff' : '#000000';
      ctx.fillRect(0, i, 128, 1);
      ctx.fillRect(i, 0, 1, 128);
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 8;
    TEXTURE_CACHE.set(url, tex);
  }
  return tex;
}

function texturedMaterial(
  color: number,
  textureUrl: string,
  repeat = 3,
  roughness = 0.66,
  metalness = 0.02
) {
  return new THREE.MeshStandardMaterial({
    color,
    map: polyhavenTexture(textureUrl, repeat),
    roughness,
    metalness
  });
}

function kitForTeam(team: TeamKey) {
  return TEAM_KITS[team];
}

function teamTexture(team: TeamKey) {
  return team === 'blue' ? POLYHAVEN_TEXTURES.fabricBlue : POLYHAVEN_TEXTURES.fabricRed;
}

function shadow<T extends THREE.Object3D>(object: T) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return object;
}

function cleanName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBones(model: THREE.Object3D): Bones {
  const bones: Bones = {};
  model.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone) return;
    const n = cleanName(bone.name);
    if (!bones.hips && n.includes('hips')) bones.hips = bone;
    if (!bones.spine && n.includes('spine')) bones.spine = bone;
    if (
      !bones.leftUpLeg &&
      (n.includes('leftupleg') || n.includes('leftthigh'))
    )
      bones.leftUpLeg = bone;
    if (
      !bones.leftLeg &&
      !n.includes('foot') &&
      !n.includes('upleg') &&
      n.includes('leftleg')
    )
      bones.leftLeg = bone;
    if (!bones.leftFoot && n.includes('leftfoot')) bones.leftFoot = bone;
    if (
      !bones.rightUpLeg &&
      (n.includes('rightupleg') || n.includes('rightthigh'))
    )
      bones.rightUpLeg = bone;
    if (
      !bones.rightLeg &&
      !n.includes('foot') &&
      !n.includes('upleg') &&
      n.includes('rightleg')
    )
      bones.rightLeg = bone;
    if (!bones.rightFoot && n.includes('rightfoot')) bones.rightFoot = bone;
    if (!bones.leftArm && n.includes('leftarm')) bones.leftArm = bone;
    if (!bones.rightArm && n.includes('rightarm')) bones.rightArm = bone;
  });
  return bones;
}

function normalizeCharacterPivot(characterRoot: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(characterRoot);
  if (bounds.isEmpty()) return;
  characterRoot.position.y -= bounds.min.y;
}

function findBoneByHints(root: THREE.Object3D, hints: string[] = []) {
  let matched: THREE.Bone | null = null;
  root.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (matched || !bone.isBone) return;
    const name = String(bone.name || '').toLowerCase();
    if (name && hints.some((hint) => name.includes(hint))) matched = bone;
  });
  return matched;
}

function captureBoneRotation(bone: THREE.Bone | null | undefined) {
  return bone ? bone.rotation.clone() : new THREE.Euler();
}

function applyRotationOffset(
  bone: THREE.Bone | null | undefined,
  x = 0,
  y = 0,
  z = 0
) {
  if (!bone) return;
  bone.rotation.x += x;
  bone.rotation.y += y;
  bone.rotation.z += z;
}

function applyMurlanSeatedPose(instance: THREE.Object3D) {
  const bones = {
    hips: findBoneByHints(instance, [
      'hips',
      'pelvis',
      'pelvisjoint',
      'hip_joint'
    ]),
    spine: findBoneByHints(instance, ['spine', 'chest', 'torso']),
    head: findBoneByHints(instance, [
      'head',
      'neck',
      'headjoint',
      'head_joint'
    ]),
    rightUpperArm: findBoneByHints(instance, [
      'rightarm',
      'arm.r',
      'r_upperarm',
      'rightshoulder',
      'armjointr',
      'arm_joint_r_1',
      'arm_joint_r',
      'shoulderr'
    ]),
    rightForeArm: findBoneByHints(instance, [
      'rightforearm',
      'r_forearm',
      'rightlowerarm',
      'forearmr',
      'elbowr',
      'arm_joint_r_2',
      'arm_joint_r_3'
    ]),
    rightHand: findBoneByHints(instance, [
      'righthand',
      'hand.r',
      'r_hand',
      'handjointr',
      'hand_joint_r'
    ]),
    leftUpperArm: findBoneByHints(instance, [
      'leftarm',
      'arm.l',
      'l_upperarm',
      'leftshoulder',
      'armjointl',
      'arm_joint_l_1',
      'arm_joint_l',
      'shoulderl'
    ]),
    leftForeArm: findBoneByHints(instance, [
      'leftforearm',
      'l_forearm',
      'leftlowerarm',
      'forearml',
      'elbowl',
      'arm_joint_l_2',
      'arm_joint_l_3'
    ]),
    leftHand: findBoneByHints(instance, [
      'lefthand',
      'hand.l',
      'l_hand',
      'handjointl',
      'hand_joint_l'
    ]),
    leftThigh: findBoneByHints(instance, [
      'leftupleg',
      'leftthigh',
      'l_thigh',
      'legjointl1',
      'leg_joint_l_1',
      'leg_joint_l'
    ]),
    leftCalf: findBoneByHints(instance, [
      'leftleg',
      'leftcalf',
      'l_calf',
      'legjointl2',
      'leg_joint_l_2',
      'leg_joint_l_3'
    ]),
    rightThigh: findBoneByHints(instance, [
      'rightupleg',
      'rightthigh',
      'r_thigh',
      'legjointr1',
      'leg_joint_r_1',
      'leg_joint_r'
    ]),
    rightCalf: findBoneByHints(instance, [
      'rightleg',
      'rightcalf',
      'r_calf',
      'legjointr2',
      'leg_joint_r_2',
      'leg_joint_r_3'
    ])
  };

  // Exact Murlan Royale seated base pose values so the Free Kick Arena crowd sits
  // the same way as the Murlan table characters.
  applyRotationOffset(bones.hips, THREE.MathUtils.degToRad(-9), 0, 0);
  applyRotationOffset(bones.spine, THREE.MathUtils.degToRad(-3), 0, 0);
  applyRotationOffset(bones.head, THREE.MathUtils.degToRad(2), 0, 0);
  applyRotationOffset(
    bones.leftUpperArm,
    THREE.MathUtils.degToRad(-53),
    THREE.MathUtils.degToRad(-6),
    THREE.MathUtils.degToRad(-2)
  );
  applyRotationOffset(
    bones.leftForeArm,
    THREE.MathUtils.degToRad(40),
    THREE.MathUtils.degToRad(-3),
    THREE.MathUtils.degToRad(-2)
  );
  applyRotationOffset(
    bones.leftHand,
    THREE.MathUtils.degToRad(11),
    THREE.MathUtils.degToRad(-4),
    THREE.MathUtils.degToRad(-2)
  );
  applyRotationOffset(
    bones.rightUpperArm,
    THREE.MathUtils.degToRad(-57),
    THREE.MathUtils.degToRad(6),
    THREE.MathUtils.degToRad(2)
  );
  applyRotationOffset(
    bones.rightForeArm,
    THREE.MathUtils.degToRad(44),
    THREE.MathUtils.degToRad(3),
    THREE.MathUtils.degToRad(2)
  );
  applyRotationOffset(
    bones.rightHand,
    THREE.MathUtils.degToRad(13),
    THREE.MathUtils.degToRad(4),
    THREE.MathUtils.degToRad(2)
  );
  applyRotationOffset(
    bones.leftThigh,
    THREE.MathUtils.degToRad(-90.5),
    THREE.MathUtils.degToRad(9.2),
    THREE.MathUtils.degToRad(2.9)
  );
  applyRotationOffset(
    bones.rightThigh,
    THREE.MathUtils.degToRad(-90.5),
    THREE.MathUtils.degToRad(1.7),
    THREE.MathUtils.degToRad(-1.1)
  );
  applyRotationOffset(
    bones.leftCalf,
    THREE.MathUtils.degToRad(-95.1),
    THREE.MathUtils.degToRad(1.1),
    THREE.MathUtils.degToRad(0.6)
  );
  applyRotationOffset(
    bones.rightCalf,
    THREE.MathUtils.degToRad(-95.1),
    THREE.MathUtils.degToRad(-1.1),
    THREE.MathUtils.degToRad(-0.6)
  );

  return {
    bones,
    base: Object.fromEntries(
      Object.entries(bones).map(([key, bone]) => [
        key,
        captureBoneRotation(bone)
      ])
    )
  };
}

function normalizeHuman(model: THREE.Object3D, height = PLAYER_H) {
  // Match every playable and crowd human to the same Soldier.glb forward orientation.
  // Some imported human meshes have different bind-pose facings, so keep the mesh but
  // normalize its root transform before applying the shared free-kick behaviour poses.
  model.rotation.set(0, Math.PI, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
}

function enforceActorGrounding(actor: Actor) {
  actor.pos.y = GROUND_Y;
  actor.root.position.y = GROUND_Y;
  actor.root.rotation.x = 0;
  actor.root.rotation.z = 0;
  if (!actor.model) return;
  actor.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(actor.model);
  if (!box.isEmpty() && Number.isFinite(box.min.y))
    actor.model.position.y -= box.min.y;
}

function resetKickerGroundedForShot(
  kicker: Actor,
  runupStart: THREE.Vector3,
  ballPos: THREE.Vector3
) {
  kicker.pos.copy(runupStart).setY(GROUND_Y);
  kicker.root.position.copy(kicker.pos);
  kicker.root.rotation.set(0, Math.atan2(kicker.dir.x, kicker.dir.z), 0);
  kicker.vel.set(0, 0, 0);
  kicker.speed = 0;
  kicker.kickTime = 0;
  kicker.celebrateTime = 0;
  kicker.dir.copy(ballPos.clone().sub(kicker.pos).setY(0).normalize());
  enforceActorGrounding(kicker);
}


function characterSurfaceType(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial) {
  const label = `${cleanName(mesh.name)}${cleanName(mat.name || '')}`;
  const color = mat.color ?? new THREE.Color(0xffffff);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const skinLike =
    label.includes('skin') ||
    label.includes('face') ||
    label.includes('head') ||
    label.includes('hand') ||
    (hsl.h >= 0.03 && hsl.h <= 0.13 && hsl.s >= 0.16 && hsl.l >= 0.42);
  const hairLike =
    label.includes('hair') ||
    label.includes('brow') ||
    (hsl.l < 0.18 && !label.includes('shoe') && !label.includes('boot'));
  const eyeLike = label.includes('eye') || label.includes('pupil');
  const shoeLike = label.includes('shoe') || label.includes('boot') || label.includes('foot');
  if (eyeLike) return 'eye';
  if (skinLike) return 'skin';
  if (hairLike) return 'hair';
  if (shoeLike) return 'shoe';
  return 'cloth';
}

function cloneModelMaterials(model: THREE.Object3D) {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((matRef) => matRef.clone())
      : mesh.material.clone();
  });
}

function tintModel(
  model: THREE.Object3D,
  kind: ActorKind,
  index = 0,
  kitColor?: number,
  team: TeamKey = index % 2 ? 'red' : 'blue'
) {
  const kit = kitForTeam(team);
  const color =
    kind === 'keeper' || kind === 'referee'
      ? new THREE.Color(0x111111)
      : new THREE.Color(kitColor ?? kit.primary);
  const fabricMap = polyhavenTexture(teamTexture(team), 5);
  const shoeMap = polyhavenTexture(POLYHAVEN_TEXTURES.shoeLeather, 4);
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (m.color) {
        const surface = characterSurfaceType(mesh, m);
        if (surface === 'skin') {
          m.color.lerp(new THREE.Color(index % 3 ? 0xd6a06f : 0xf1d6bd), 0.12);
        } else if (surface === 'hair') {
          const hairPalette = [0x111111, 0x2b170f, 0x8b5a2b, 0xd6b37a, 0x64748b];
          m.color.lerp(new THREE.Color(hairPalette[index % hairPalette.length]), 0.42);
        } else if (surface === 'eye') {
          const eyePalette = [0x050505, 0x1e3a8a, 0x166534, 0x78350f];
          m.color.lerp(new THREE.Color(eyePalette[index % eyePalette.length]), 0.45);
        } else if (surface === 'shoe') {
          m.color.lerp(new THREE.Color(kit.shoes), 0.55);
          m.map = shoeMap;
        } else {
          m.color.copy(color);
          m.map = kind === 'referee' ? null : fabricMap;
          if (kind === 'wall') m.color.lerp(new THREE.Color(kit.secondary), 0.16);
          if (kind === 'referee') m.color.lerp(new THREE.Color(0x020617), 0.36);
        }
      }
      m.roughness = Math.max(m.roughness ?? 0.5, 0.62);
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind, index = 0, kitColor?: number, team: TeamKey = index % 2 ? 'red' : 'blue') {
  const group = new THREE.Group();
  const teamKit = kitForTeam(team);
  const kit = kind === 'keeper' || kind === 'referee' ? 0x111111 : (kitColor ?? teamKit.primary);
  const skinPalette = [0xf1d6bd, 0xd6a06f, 0x9a6248, 0x6b3f2a, 0xffdfc4];
  const hairPalette = [0x111111, 0x2b170f, 0x8b5a2b, 0xd6b37a, 0x64748b];
  const eyePalette = [0x050505, 0x1e3a8a, 0x166534, 0x78350f];
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.72, 8, 14),
    texturedMaterial(kit, teamTexture(team), 4)
  );
  torso.name = 'torso';
  torso.position.y = 1.05;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.02),
    material(teamKit.secondary)
  );
  stripe.name = 'stripe';
  stripe.position.set(0, 1.25, -0.16);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 18, 12),
    texturedMaterial(skinPalette[index % skinPalette.length], POLYHAVEN_TEXTURES.fabricBlue, 7)
  );
  head.name = 'head';
  head.position.y = 1.62;
  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.64, 6, 10),
    texturedMaterial(teamKit.shorts, teamTexture(team), 5)
  );
  leftLeg.name = 'leftLeg';
  const rightLeg = leftLeg.clone();
  rightLeg.name = 'rightLeg';
  leftLeg.position.set(-0.09, 0.42, 0);
  rightLeg.position.set(0.09, 0.42, 0);
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, 0.52, 6, 10),
    texturedMaterial(teamKit.primary, teamTexture(team), 4)
  );
  leftArm.name = 'leftArm';
  const rightArm = leftArm.clone();
  rightArm.name = 'rightArm';
  leftArm.position.set(-0.25, 1.05, 0.01);
  rightArm.position.set(0.25, 1.05, 0.01);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.136, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), material(hairPalette[index % hairPalette.length]));
  hair.name = 'hair';
  hair.position.set(0, 1.7, -0.01);
  const eyeMat = material(eyePalette[index % eyePalette.length], 0.38, 0.02);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat);
  leftEye.name = 'leftEye';
  const rightEye = leftEye.clone();
  rightEye.name = 'rightEye';
  leftEye.position.set(-0.045, 1.635, -0.118);
  rightEye.position.set(0.045, 1.635, -0.118);
  const browMat = material(hairPalette[index % hairPalette.length], 0.5, 0.01);
  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.012), browMat);
  leftBrow.name = 'leftEyebrow';
  const rightBrow = leftBrow.clone();
  rightBrow.name = 'rightEyebrow';
  leftBrow.position.set(-0.047, 1.666, -0.123);
  rightBrow.position.set(0.047, 1.666, -0.123);
  leftBrow.rotation.z = -0.12;
  rightBrow.rotation.z = 0.12;
  const shoeMat = texturedMaterial(teamKit.shoes, POLYHAVEN_TEXTURES.shoeLeather, 4, 0.52, 0.05);
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.22), shoeMat);
  leftShoe.name = 'leftShoe';
  const rightShoe = leftShoe.clone();
  rightShoe.name = 'rightShoe';
  leftShoe.position.set(-0.09, 0.08, -0.035);
  rightShoe.position.set(0.09, 0.08, -0.035);
  group.add(
    shadow(torso),
    shadow(stripe),
    shadow(head),
    shadow(leftLeg),
    shadow(rightLeg),
    shadow(leftArm),
    shadow(rightArm),
    shadow(hair),
    shadow(leftEye),
    shadow(rightEye),
    shadow(leftBrow),
    shadow(rightBrow),
    shadow(leftShoe),
    shadow(rightShoe)
  );
  return group;
}

function createActor(
  scene: THREE.Scene,
  loader: GLTFLoader,
  kind: ActorKind,
  pos: THREE.Vector3,
  index = 0,
  kitColor?: number,
  modelUrl = HUMAN_URL,
  team: TeamKey = index % 2 ? 'red' : 'blue'
): Actor {
  const root = new THREE.Group();
  root.position.copy(pos).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(kind, index, kitColor, team);
  root.add(fallback);

  const actor: Actor = {
    kind,
    root,
    model: null,
    fallback,
    mixer: null,
    actions: {},
    current: 'Idle',
    bones: {},
    pos: pos.clone().setY(GROUND_Y),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, -1),
    speed: 0,
    kickTime: 0,
    jumpTime: 0,
    diveTime: 0,
    diveDelay: 0,
    diveDir: 0,
    diveHeight: 1.15,
    saveTargetX: 0,
    saveTargetZ: GOAL_LINE_Z + 0.12,
    saveTargetY: 1.15,
    wallIndex: index,
    loaded: false,
    celebrateTime: 0
  };

  loader.setCrossOrigin('anonymous').load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      cloneModelMaterials(model);
      normalizeHuman(model, kind === 'keeper' ? 1.9 : PLAYER_H);
      tintModel(model, kind, index, kitColor, team);
      shadow(model);
      root.add(model);
      fallback.visible = false;
      actor.model = model;
      actor.bones = findBones(model);
      actor.mixer = new THREE.AnimationMixer(model);

      const clips = new Map(
        gltf.animations.map((clip) => [clip.name.toLowerCase(), clip])
      );
      const aliases: Record<AnimName, string[]> = {
        Idle: ['idle'],
        Walk: ['walk'],
        Run: ['run']
      };
      (Object.keys(aliases) as AnimName[]).forEach((name) => {
        const clip = aliases[name].map((key) => clips.get(key)).find(Boolean);
        if (!clip || !actor.mixer) return;
        const action = actor.mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
        action.play();
        actor.actions[name] = action;
      });
      actor.loaded = true;
    },
    undefined,
    () => {
      if (modelUrl === HUMAN_URL) return;
      loader.setCrossOrigin('anonymous').load(HUMAN_URL, (gltf) => {
        const model = gltf.scene;
        cloneModelMaterials(model);
        normalizeHuman(model, kind === 'keeper' ? 1.9 : PLAYER_H);
        tintModel(model, kind, index, kitColor, team);
        shadow(model);
        root.add(model);
        fallback.visible = false;
        actor.model = model;
        actor.bones = findBones(model);
        actor.mixer = new THREE.AnimationMixer(model);
        const clips = new Map(
          gltf.animations.map((clip) => [clip.name.toLowerCase(), clip])
        );
        const aliases: Record<AnimName, string[]> = {
          Idle: ['idle'],
          Walk: ['walk'],
          Run: ['run']
        };
        (Object.keys(aliases) as AnimName[]).forEach((name) => {
          const clip = aliases[name].map((key) => clips.get(key)).find(Boolean);
          if (!clip || !actor.mixer) return;
          const action = actor.mixer.clipAction(clip);
          action.enabled = true;
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
          action.play();
          actor.actions[name] = action;
        });
        actor.loaded = true;
      });
    }
  );

  return actor;
}


function applyTeamUniform(actor: Actor, team: TeamKey) {
  const kit = kitForTeam(team);
  const color = actor.kind === 'keeper' ? (team === 'blue' ? 0x0f172a : 0x111111) : kit.primary;
  actor.fallback.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const matRef = raw as THREE.MeshStandardMaterial;
      if (!matRef?.color) return;
      const name = cleanName(mesh.name);
      if (name.includes('torso') || name.includes('arm')) {
        matRef.color.set(color);
        matRef.map = polyhavenTexture(teamTexture(team), 4);
      } else if (name.includes('leg')) {
        matRef.color.set(kit.shorts);
        matRef.map = polyhavenTexture(teamTexture(team), 4);
      } else if (name.includes('shoe')) {
        matRef.color.set(kit.shoes);
        matRef.map = polyhavenTexture(POLYHAVEN_TEXTURES.shoeLeather, 4);
      }
      matRef.needsUpdate = true;
    });
  });
  if (actor.model) tintModel(actor.model, actor.kind, actor.wallIndex, color, team);
}

function setAction(actor: Actor, next: AnimName) {
  if (actor.current === next || !actor.actions[next]) return;
  const prev = actor.actions[actor.current];
  const action = actor.actions[next];
  if (prev && action) {
    action.enabled = true;
    action.reset().setEffectiveWeight(1).play();
    prev.crossFadeTo(action, 0.16, false);
  }
  actor.current = next;
}

function updateActorBase(actor: Actor, dt: number) {
  actor.pos.y = GROUND_Y;
  actor.root.position.copy(actor.pos);
  actor.root.rotation.x = 0;
  actor.root.rotation.z = 0;
  if (actor.dir.lengthSq() > 0.001)
    actor.root.rotation.y = Math.atan2(actor.dir.x, actor.dir.z);
  const wanted: AnimName =
    actor.speed > 2.45 ? 'Run' : actor.speed > 0.08 ? 'Walk' : 'Idle';
  setAction(actor, wanted);
  if (actor.actions.Walk)
    actor.actions.Walk.timeScale = THREE.MathUtils.clamp(
      actor.speed / 1.45,
      0.95,
      1.65
    );
  if (actor.actions.Run)
    actor.actions.Run.timeScale = THREE.MathUtils.clamp(
      actor.speed / 2.9,
      0.9,
      1.45
    );
  actor.mixer?.update(dt);
}

function applyKickerPose(kicker: Actor) {
  if (kicker.kickTime <= 0) return;

  const t = 1 - kicker.kickTime / KICK_STRIKE_TIME;
  const plant = THREE.MathUtils.smoothstep(t, 0.18, 0.38);
  const backswing =
    Math.sin(THREE.MathUtils.clamp((t - 0.16) / 0.26, 0, 1) * Math.PI) * 0.72;
  const strike =
    Math.sin(THREE.MathUtils.clamp((t - 0.38) / 0.26, 0, 1) * Math.PI) * 2.45;
  const follow =
    Math.sin(THREE.MathUtils.clamp((t - 0.6) / 0.4, 0, 1) * Math.PI) * 0.9;
  const chestBalance = Math.sin(
    THREE.MathUtils.clamp((t - 0.2) / 0.55, 0, 1) * Math.PI
  );

  const upLeg = kicker.bones.rightUpLeg;
  const lowLeg = kicker.bones.rightLeg;
  const foot = kicker.bones.rightFoot;

  if (kicker.bones.hips) kicker.bones.hips.rotation.x += -0.045 * strike;
  if (kicker.bones.spine) {
    kicker.bones.spine.rotation.x += -0.035 * strike + 0.02 * chestBalance;
    kicker.bones.spine.rotation.y += 0.055 * chestBalance;
  }
  if (kicker.bones.leftArm)
    kicker.bones.leftArm.rotation.z += -0.22 * chestBalance;
  if (kicker.bones.rightArm)
    kicker.bones.rightArm.rotation.z += 0.2 * chestBalance;
  if (kicker.bones.leftUpLeg) kicker.bones.leftUpLeg.rotation.x += 0.18 * plant;
  if (kicker.bones.leftLeg) kicker.bones.leftLeg.rotation.x += -0.08 * plant;
  if (upLeg) upLeg.rotation.x += -backswing + strike + follow;
  if (lowLeg) lowLeg.rotation.x += backswing * 0.65 - strike * 0.88;
  if (foot) foot.rotation.x += -strike * 0.75 - follow * 0.25;
}

function applyWallPose(actor: Actor) {
  if (actor.jumpTime <= 0) return;
  const t = 1 - actor.jumpTime / 0.42;
  const jump = Math.sin(t * Math.PI);
  actor.root.position.y += jump * 0.45;
  if (actor.bones.leftArm) actor.bones.leftArm.rotation.x += -1.2;
  if (actor.bones.rightArm) actor.bones.rightArm.rotation.x += -1.2;
}

function applyKeeperPose(keeper: Actor) {
  if (keeper.diveTime <= 0) {
    // Set posture: knees soft, chest forward, palms ready in front of the shirt.
    if (keeper.bones.spine) keeper.bones.spine.rotation.x += 0.13;
    if (keeper.bones.leftUpLeg) keeper.bones.leftUpLeg.rotation.x += -0.18;
    if (keeper.bones.rightUpLeg) keeper.bones.rightUpLeg.rotation.x += -0.18;
    if (keeper.bones.leftLeg) keeper.bones.leftLeg.rotation.x += 0.24;
    if (keeper.bones.rightLeg) keeper.bones.rightLeg.rotation.x += 0.24;
    if (keeper.bones.leftArm) {
      keeper.bones.leftArm.rotation.x += -0.72;
      keeper.bones.leftArm.rotation.z += -0.34;
    }
    if (keeper.bones.rightArm) {
      keeper.bones.rightArm.rotation.x += -0.72;
      keeper.bones.rightArm.rotation.z += 0.34;
    }
    return;
  }
  const t = 1 - keeper.diveTime / KEEPER_DIVE_DURATION;
  const pushOff = THREE.MathUtils.smoothstep(t, 0.0, 0.16);
  const flight = THREE.MathUtils.smoothstep(t, 0.08, 0.5);
  const recover = THREE.MathUtils.smoothstep(t, 0.78, 1);
  const a = flight * (1 - recover);
  const side = keeper.diveDir || (keeper.saveTargetX < 0 ? -1 : 1);
  const heightBlend = THREE.MathUtils.clamp(
    (keeper.saveTargetY - 0.45) / (GOAL_H - 0.2),
    0,
    1
  );
  keeper.root.rotation.z =
    -side * THREE.MathUtils.lerp(1.05, 1.48, heightBlend) * a;
  keeper.root.rotation.x = -THREE.MathUtils.lerp(0.18, 0.44, heightBlend) * a;
  keeper.root.position.x +=
    side * THREE.MathUtils.lerp(1.55, 2.85, heightBlend) * a * KEEPER_DIVE_REACH_BOOST;
  keeper.root.position.z += -0.24 * pushOff * (1 - recover);
  keeper.root.position.y +=
    keeper.diveHeight *
    THREE.MathUtils.lerp(0.2, 0.62, heightBlend) *
    Math.sin(t * Math.PI) *
    (1 - recover);
  if (keeper.bones.spine) keeper.bones.spine.rotation.x += 0.08 - 0.22 * a;
  if (keeper.bones.leftUpLeg)
    keeper.bones.leftUpLeg.rotation.x += side > 0 ? -0.44 * pushOff : 0.24 * a;
  if (keeper.bones.rightUpLeg)
    keeper.bones.rightUpLeg.rotation.x += side < 0 ? -0.44 * pushOff : 0.24 * a;
  if (keeper.bones.leftLeg)
    keeper.bones.leftLeg.rotation.x += side > 0 ? 0.7 * pushOff : -0.22 * a;
  if (keeper.bones.rightLeg)
    keeper.bones.rightLeg.rotation.x += side < 0 ? 0.7 * pushOff : -0.22 * a;
  const reachX = -side * THREE.MathUtils.lerp(1.1, 1.55, heightBlend) * a * KEEPER_DIVE_REACH_BOOST;
  const reachZ = -side * 0.38 * a;
  if (keeper.bones.leftArm) {
    keeper.bones.leftArm.rotation.x += -1.12 - heightBlend * 0.65;
    keeper.bones.leftArm.rotation.y += reachZ;
    keeper.bones.leftArm.rotation.z += reachX - 0.18;
  }
  if (keeper.bones.rightArm) {
    keeper.bones.rightArm.rotation.x += -1.12 - heightBlend * 0.65;
    keeper.bones.rightArm.rotation.y += reachZ;
    keeper.bones.rightArm.rotation.z += reachX + 0.18;
  }
}

function createSeatedFallbackSpectator(color: number, team: TeamKey = 'blue') {
  const group = new THREE.Group();
  group.name = 'murlan-seated-fallback';
  group.scale.setScalar(SPECTATOR_FALLBACK_SCALE);
  group.position.set(0, SPECTATOR_SEAT_Y, SPECTATOR_SEAT_Z);

  const teamKit = kitForTeam(team);
  const shirt = texturedMaterial(color, teamTexture(team), 4, 0.72, 0.02);
  const spectatorTone = team === 'blue' ? 0xf1d6bd : 0xd6a06f;
  const spectatorHair = team === 'blue' ? 0x171717 : 0x6b3f2a;
  const spectatorEyes = team === 'blue' ? 0x1e3a8a : 0x166534;
  const skin = material(spectatorTone, 0.7, 0.02);
  const dark = texturedMaterial(teamKit.shorts, teamTexture(team), 4, 0.68, 0.03);
  const sleeve = texturedMaterial(teamKit.primary, teamTexture(team), 4, 0.68, 0.02);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.54, 8, 12),
    shirt
  );
  torso.position.set(0, 0.78, -0.05);
  torso.rotation.x = THREE.MathUtils.degToRad(-9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), skin);
  head.position.set(0, 1.22, -0.1);
  const leftThigh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.42, 6, 10),
    dark
  );
  const rightThigh = leftThigh.clone();
  leftThigh.position.set(-0.085, 0.45, 0.14);
  rightThigh.position.set(0.085, 0.45, 0.14);
  leftThigh.rotation.x = THREE.MathUtils.degToRad(88);
  rightThigh.rotation.x = THREE.MathUtils.degToRad(88);
  const leftCalf = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.052, 0.46, 6, 10),
    dark
  );
  const rightCalf = leftCalf.clone();
  leftCalf.position.set(-0.085, 0.22, 0.34);
  rightCalf.position.set(0.085, 0.22, 0.34);
  leftCalf.rotation.x = THREE.MathUtils.degToRad(8);
  rightCalf.rotation.x = THREE.MathUtils.degToRad(8);
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.04, 0.4, 6, 10),
    sleeve
  );
  leftArm.name = 'leftCheerArm';
  const rightArm = leftArm.clone();
  rightArm.name = 'rightCheerArm';
  leftArm.position.set(-0.22, 0.72, 0.02);
  rightArm.position.set(0.22, 0.72, 0.02);
  leftArm.rotation.set(
    THREE.MathUtils.degToRad(-53),
    THREE.MathUtils.degToRad(-6),
    THREE.MathUtils.degToRad(-8)
  );
  rightArm.rotation.set(
    THREE.MathUtils.degToRad(-57),
    THREE.MathUtils.degToRad(6),
    THREE.MathUtils.degToRad(8)
  );
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.136, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
    material(spectatorHair)
  );
  hair.position.set(0, 1.3, -0.11);
  const eyeMat = material(spectatorEyes, 0.38, 0.02);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMat);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.043, 1.23, -0.213);
  rightEye.position.set(0.043, 1.23, -0.213);
  const browMat = material(spectatorHair, 0.5, 0.01);
  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.007, 0.012), browMat);
  const rightBrow = leftBrow.clone();
  leftBrow.position.set(-0.045, 1.258, -0.217);
  rightBrow.position.set(0.045, 1.258, -0.217);
  leftBrow.rotation.z = -0.1;
  rightBrow.rotation.z = 0.1;
  const shoeMat = texturedMaterial(teamKit.shoes, POLYHAVEN_TEXTURES.shoeLeather, 4, 0.52, 0.05);
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.2), shoeMat);
  const rightShoe = leftShoe.clone();
  leftShoe.position.set(-0.085, 0.08, 0.58);
  rightShoe.position.set(0.085, 0.08, 0.58);
  group.add(
    shadow(torso),
    shadow(head),
    shadow(leftThigh),
    shadow(rightThigh),
    shadow(leftCalf),
    shadow(rightCalf),
    shadow(leftArm),
    shadow(rightArm),
    shadow(hair),
    shadow(leftEye),
    shadow(rightEye),
    shadow(leftBrow),
    shadow(rightBrow),
    shadow(leftShoe),
    shadow(rightShoe)
  );
  return group;
}

function loadSeatedCharacterTemplate(loader: GLTFLoader, modelUrl: string) {
  const cached = SEATED_CHARACTER_TEMPLATE_CACHE.get(modelUrl);
  if (cached) return cached;
  loader.setCrossOrigin('anonymous');
  const promise = new Promise<THREE.Object3D>((resolve, reject) => {
    loader.load(modelUrl, (gltf) => resolve(gltf.scene), undefined, reject);
  });
  SEATED_CHARACTER_TEMPLATE_CACHE.set(modelUrl, promise);
  return promise;
}

function attachMurlanSeatedSpectator(
  chair: THREE.Group,
  loader: GLTFLoader,
  characterTheme: any,
  index: number,
  kitColor: number,
  team: TeamKey
): SeatedSpectator {
  const root = new THREE.Group();
  root.name = `murlan-seated-spectator-${index}`;
  root.position.set(0, SPECTATOR_SEAT_Y, SPECTATOR_SEAT_Z);
  root.scale.setScalar((characterTheme?.scale ?? 1) * SPECTATOR_SCALE);
  root.rotation.set(
    characterTheme?.seatPitch ?? 0,
    characterTheme?.seatYaw ?? 0,
    0
  );

  // A textured fallback appears immediately, then the GLTF supporter inherits the same 50/50 team kit when loaded.
  const fallback = createSeatedFallbackSpectator(kitColor, team);
  fallback.name = 'gltf-seated-supporter-placeholder';
  fallback.visible = true;
  const spectator: SeatedSpectator = {
    root,
    fallback,
    instance: null,
    bones: {},
    base: {},
    wallIndex: index
  };
  chair.add(root);

  const modelUrl =
    characterTheme?.modelUrls?.[0] ?? characterTheme?.url ?? HUMAN_URL;
  loadSeatedCharacterTemplate(loader, modelUrl)
    .then((template) => {
      const instance = cloneSkeleton(template);
      cloneModelMaterials(instance);
      instance.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        mats.forEach((raw) => {
          const matRef = raw as THREE.MeshStandardMaterial;
          if (!matRef) return;
          const surface = characterSurfaceType(mesh, matRef);
          if (surface === 'shoe') {
            matRef.color?.lerp(new THREE.Color(kitForTeam(team).shoes), 0.52);
            matRef.map = polyhavenTexture(POLYHAVEN_TEXTURES.shoeLeather, 4);
          } else if (surface === 'skin') {
            matRef.color?.lerp(new THREE.Color(index % 3 ? 0xd6a06f : 0xf1d6bd), 0.12);
          } else if (surface === 'hair') {
            matRef.color?.lerp(new THREE.Color(index % 2 ? 0x2b170f : 0x111111), 0.2);
          } else if (surface === 'cloth') {
            matRef.color?.set(kitColor);
            matRef.map = polyhavenTexture(teamTexture(team), 5);
          }
          if (matRef?.map) matRef.map.colorSpace = THREE.SRGBColorSpace;
          matRef.needsUpdate = true;
        });
      });
      normalizeCharacterPivot(instance);
      instance.position.y -= 0.09 * 0.75;
      const rig = applyMurlanSeatedPose(instance);
      spectator.instance = instance;
      spectator.bones = rig.bones;
      spectator.base = rig.base;
      root.add(instance);
      fallback.visible = false;
    })
    .catch(() => {
      root.visible = false;
    });

  return spectator;
}

function applySeatedSpectatorPose(spectator: SeatedSpectator, cheerTime = 0) {
  const cheer = cheerTime > 0;
  const phase = performance.now() * 0.008 + spectator.wallIndex * 0.73;
  const wave = Math.sin(phase);
  const standUp = cheer
    ? THREE.MathUtils.smoothstep(cheerTime, 0.34, 0.95) *
      THREE.MathUtils.smoothstep(3.0 - cheerTime, 0.12, 0.5)
    : 0;
  const bounce = Math.abs(wave) * (cheer ? 0.035 : 0.012);
  spectator.root.position.y = SPECTATOR_SEAT_Y + standUp * 0.52 + bounce;
  spectator.root.position.z = SPECTATOR_SEAT_Z - standUp * 0.16;
  spectator.root.rotation.x = (1 - standUp) * 0.04;
  spectator.fallback.position.y = SPECTATOR_SEAT_Y + standUp * 0.52 + bounce;
  spectator.fallback.position.z = SPECTATOR_SEAT_Z - standUp * 0.16;
  spectator.fallback.scale.y = 1 + standUp * 0.18;

  const leftUpperArm = spectator.bones.leftUpperArm;
  const rightUpperArm = spectator.bones.rightUpperArm;
  const leftForeArm = spectator.bones.leftForeArm;
  const rightForeArm = spectator.bones.rightForeArm;
  const leftThigh = spectator.bones.leftThigh;
  const rightThigh = spectator.bones.rightThigh;
  const leftCalf = spectator.bones.leftCalf;
  const rightCalf = spectator.bones.rightCalf;
  const leftBase = spectator.base.leftUpperArm;
  const rightBase = spectator.base.rightUpperArm;
  if (leftUpperArm && leftBase) {
    leftUpperArm.rotation.x = THREE.MathUtils.lerp(
      leftBase.x,
      -2.75 + wave * 0.14,
      standUp
    );
    leftUpperArm.rotation.z = THREE.MathUtils.lerp(
      leftBase.z - Math.abs(wave) * 0.18,
      -0.32 + wave * 0.16,
      standUp
    );
  }
  if (rightUpperArm && rightBase) {
    rightUpperArm.rotation.x = THREE.MathUtils.lerp(
      rightBase.x,
      -2.75 - wave * 0.14,
      standUp
    );
    rightUpperArm.rotation.z = THREE.MathUtils.lerp(
      rightBase.z + Math.abs(wave) * 0.18,
      0.32 + wave * 0.16,
      standUp
    );
  }
  if (leftForeArm && spectator.base.leftForeArm)
    leftForeArm.rotation.x = THREE.MathUtils.lerp(
      spectator.base.leftForeArm.x,
      -0.3 + wave * 0.22,
      standUp
    );
  if (rightForeArm && spectator.base.rightForeArm)
    rightForeArm.rotation.x = THREE.MathUtils.lerp(
      spectator.base.rightForeArm.x,
      -0.3 - wave * 0.22,
      standUp
    );
  if (leftThigh && spectator.base.leftThigh)
    leftThigh.rotation.x = THREE.MathUtils.lerp(
      spectator.base.leftThigh.x,
      -0.18,
      standUp
    );
  if (rightThigh && spectator.base.rightThigh)
    rightThigh.rotation.x = THREE.MathUtils.lerp(
      spectator.base.rightThigh.x,
      -0.18,
      standUp
    );
  if (leftCalf && spectator.base.leftCalf)
    leftCalf.rotation.x = THREE.MathUtils.lerp(
      spectator.base.leftCalf.x,
      0.12,
      standUp
    );
  if (rightCalf && spectator.base.rightCalf)
    rightCalf.rotation.x = THREE.MathUtils.lerp(
      spectator.base.rightCalf.x,
      0.12,
      standUp
    );

  spectator.fallback.children.forEach((child) => {
    if (child.name === 'leftCheerArm')
      child.rotation.set(
        THREE.MathUtils.lerp(
          THREE.MathUtils.degToRad(-53),
          -2.55 + wave * 0.18,
          standUp
        ),
        THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-6), -0.08, standUp),
        THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-8), -0.18, standUp)
      );
    if (child.name === 'rightCheerArm')
      child.rotation.set(
        THREE.MathUtils.lerp(
          THREE.MathUtils.degToRad(-57),
          -2.55 - wave * 0.18,
          standUp
        ),
        THREE.MathUtils.lerp(THREE.MathUtils.degToRad(6), 0.08, standUp),
        THREE.MathUtils.lerp(THREE.MathUtils.degToRad(8), 0.18, standUp)
      );
  });
}

function applyGoalDancePose(kicker: Actor) {
  if (kicker.celebrateTime <= 0) return;
  const t = 1 - kicker.celebrateTime / 2.45;
  const beat = Math.sin(t * Math.PI * 8);
  const sway = Math.sin(t * Math.PI * 4);
  kicker.root.position.y += Math.max(0, Math.abs(beat)) * 0.14;
  kicker.root.rotation.y += sway * 0.18;
  if (kicker.bones.hips) {
    kicker.bones.hips.rotation.y += sway * 0.26;
    kicker.bones.hips.rotation.z += beat * 0.08;
  }
  if (kicker.bones.spine) {
    kicker.bones.spine.rotation.x += 0.12 + Math.abs(beat) * 0.1;
    kicker.bones.spine.rotation.z += -sway * 0.14;
  }
  if (kicker.bones.leftArm) {
    kicker.bones.leftArm.rotation.x += -1.85 + beat * 0.2;
    kicker.bones.leftArm.rotation.z += -0.74 + sway * 0.28;
  }
  if (kicker.bones.rightArm) {
    kicker.bones.rightArm.rotation.x += -1.85 - beat * 0.2;
    kicker.bones.rightArm.rotation.z += 0.74 + sway * 0.28;
  }
  if (kicker.bones.leftUpLeg)
    kicker.bones.leftUpLeg.rotation.x += -0.16 + Math.max(0, beat) * 0.32;
  if (kicker.bones.rightUpLeg)
    kicker.bones.rightUpLeg.rotation.x += -0.16 + Math.max(0, -beat) * 0.32;
  if (kicker.bones.leftLeg) kicker.bones.leftLeg.rotation.x += 0.18;
  if (kicker.bones.rightLeg) kicker.bones.rightLeg.rotation.x += 0.18;
}

function triggerCrowdCheer(stadium: StadiumRig) {
  stadium.cheerTime = 3.0;
}

function updateStadiumCrowd(stadium: StadiumRig, dt: number) {
  if (stadium.cheerTime > 0)
    stadium.cheerTime = Math.max(0, stadium.cheerTime - dt);
  stadium.spectators.forEach((spectator) =>
    applySeatedSpectatorPose(spectator, stadium.cheerTime)
  );
}

function createSoccerBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 5;
  ctx.fillStyle = '#111827';
  for (let y = 34; y < 256; y += 64) {
    for (let x = (y / 64) % 2 ? 32 : 76; x < 512; x += 96) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const px = x + Math.cos(a) * 18;
        const py = y + Math.sin(a) * 18;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20);
        ctx.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function makeBall(scene: THREE.Scene): BallState {
  const object = new THREE.Group();
  const ballMat = new THREE.MeshStandardMaterial({
    map: createSoccerBallTexture(),
    roughness: 0.42,
    metalness: 0.02
  });
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 48, 32),
    ballMat
  );
  object.add(shadow(ball));
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(18 * 3), 3)
  );
  const trail = new THREE.Line(
    trailGeometry,
    new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.74
    })
  );
  scene.add(trail);
  scene.add(object);
  return {
    object,
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    knuckleSeed: Math.random() * 99,
    flying: false,
    curve: 0,
    shotAge: 0,
    shotDuration: 1.05,
    shotStart: new THREE.Vector3(),
    shotTarget: new THREE.Vector3(),
    lastPos: new THREE.Vector3(),
    lift: 1,
    netCaught: false,
    netAge: 0,
    netVel: new THREE.Vector3(),
    crossedGoalLine: false,
    hitFrame: false,
    trail,
    trailPoints: [],
    speedKmh: 0
  };
}

function updateBallTrail(ball: BallState) {
  const attr = ball.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
  const points = ball.trailPoints;
  for (let i = 0; i < attr.count; i++) {
    const source = points[Math.max(0, points.length - 1 - i)] ?? new THREE.Vector3(99, 99, 99);
    attr.setXYZ(i, source.x, source.y, source.z);
  }
  attr.needsUpdate = true;
  ball.trail.visible = points.length > 1;
}

function rememberBallTrail(ball: BallState) {
  if (!ball.flying || ball.netCaught) {
    ball.trailPoints.splice(0, Math.max(0, ball.trailPoints.length - 1));
    updateBallTrail(ball);
    return;
  }
  ball.trailPoints.push(ball.object.position.clone());
  if (ball.trailPoints.length > 18) ball.trailPoints.shift();
  updateBallTrail(ball);
}

function createParticleRig(scene: THREE.Scene): ParticleRig {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.035, 8, 6);
  const particles = Array.from({ length: 42 }, (_, index) => {
    const mesh = new THREE.Mesh(
      geometry,
      material(index % 3 === 0 ? 0xfacc15 : index % 3 === 1 ? 0xffffff : 0x22c55e, 0.5, 0.02)
    );
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return {
    group,
    particles,
    velocities: particles.map(() => new THREE.Vector3()),
    ages: particles.map(() => 0),
    maxAge: 0.86
  };
}

function burstParticles(rig: ParticleRig, origin: THREE.Vector3, palette: number[], intensity = 1) {
  rig.particles.forEach((particle, index) => {
    const matRef = particle.material as THREE.MeshStandardMaterial;
    matRef.color.set(palette[index % palette.length] ?? 0xffffff);
    particle.position.copy(origin);
    particle.visible = true;
    rig.ages[index] = rig.maxAge * THREE.MathUtils.randFloat(0.58, 1.0);
    rig.velocities[index].set(
      THREE.MathUtils.randFloatSpread(2.5) * intensity,
      THREE.MathUtils.randFloat(1.2, 4.4) * intensity,
      THREE.MathUtils.randFloatSpread(1.3) - 0.7
    );
    particle.scale.setScalar(THREE.MathUtils.randFloat(0.65, 1.45));
  });
}

function updateParticles(rig: ParticleRig, dt: number) {
  rig.particles.forEach((particle, index) => {
    if (!particle.visible) return;
    rig.ages[index] -= dt;
    if (rig.ages[index] <= 0) {
      particle.visible = false;
      return;
    }
    rig.velocities[index].y -= 5.4 * dt;
    particle.position.addScaledVector(rig.velocities[index], dt);
    const fade = THREE.MathUtils.clamp(rig.ages[index] / rig.maxAge, 0, 1);
    particle.scale.setScalar(Math.max(0.08, fade));
  });
}

function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#176f35';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const shade = 80 + Math.floor(Math.random() * 70);
    ctx.strokeStyle = `rgba(${shade}, ${150 + Math.floor(Math.random() * 70)}, ${shade}, .32)`;
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 8 - 4, y + Math.random() * 12 + 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 7.5);
  tex.anisotropy = 8;
  return tex;
}

function createSponsorTexture(label: string, background: string, accent = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 160);
  grad.addColorStop(0, background);
  grad.addColorStop(1, '#07111f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = accent;
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 82);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(0, 0, 512, 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rateShot(ball: BallState, decision: Decision, blocked: boolean, saved: boolean): ShotFeedback {
  const target = ball.shotTarget;
  const cornerDistance = Math.min(
    new THREE.Vector2(target.x - -GOAL_W / 2, target.y - GOAL_H).length(),
    new THREE.Vector2(target.x - GOAL_W / 2, target.y - GOAL_H).length(),
    Math.abs(target.x) + Math.abs(target.y - 0.55) * 0.8
  );
  const cornerScore = THREE.MathUtils.clamp(1 - cornerDistance / 2.65, 0, 1);
  const powerScore = THREE.MathUtils.clamp((ball.speedKmh - 54) / 55, 0, 1);
  const bendScore = THREE.MathUtils.clamp(Math.abs(ball.curve) / 4.1, 0, 1);
  const quality = THREE.MathUtils.clamp(cornerScore * 0.48 + powerScore * 0.32 + bendScore * 0.2, 0.05, 0.99);
  const xg = THREE.MathUtils.clamp(0.16 + cornerScore * 0.36 + powerScore * 0.18 - (blocked ? 0.18 : 0) - (saved ? 0.12 : 0), 0.03, 0.86);
  const title = decision === 'GOAL'
    ? quality > 0.72 ? 'World-class finish' : 'Goal!'
    : decision === 'SAVE'
      ? 'Keeper read it'
      : decision === 'BLOCKED'
        ? 'Wall did its job'
        : 'Close, but off target';
  const detail = decision === 'GOAL'
    ? `Bend ${Math.round(bendScore * 100)} · pace ${Math.round(ball.speedKmh)} km/h · xG ${xg.toFixed(2)}`
    : blocked
      ? 'Try more lift or aim around the outside shoulder of the wall.'
      : saved
        ? 'Hit farther into the corner or add more side contact to wrong-foot the keeper.'
        : 'Lower power/contact for dip if the ball climbs, or raise contact for a driven low shot.';
  return { title, detail, quality, xg };
}

function addFloodlightsAndAtmosphere(scene: THREE.Scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(78, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x071827, side: THREE.BackSide })
  );
  scene.add(sky);
  const mastMat = material(0x94a3b8, 0.45, 0.3);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbdd7ff, emissiveIntensity: 2.7, roughness: 0.25 });
  [
    [-12.5, GOAL_LINE_Z - 8.5],
    [12.5, GOAL_LINE_Z - 8.5],
    [-12.5, 11.5],
    [12.5, 11.5]
  ].forEach(([x, z]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 8.4, 10), mastMat);
    mast.position.set(x, 4.2, z);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.42), lampMat);
    lamp.position.set(x * 0.94, 8.55, z);
    lamp.lookAt(0, 1.2, GOAL_LINE_Z + 3);
    const light = new THREE.SpotLight(0xdbeafe, 2.1, 48, 0.56, 0.62, 1.1);
    light.position.set(x, 8.35, z);
    light.target.position.set(0, 0, GOAL_LINE_Z + 3.5);
    light.castShadow = false;
    scene.add(shadow(mast), lamp, light, light.target);
  });
}

function netPoint(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  u: number,
  v: number
) {
  const bottom = a.clone().lerp(b, u);
  const top = d.clone().lerp(c, u);
  return bottom.lerp(top, v);
}

function addNetLine(
  group: THREE.Group,
  rig: NetRig,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  lineMat: THREE.LineBasicMaterial
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const line = new THREE.Line(geometry, lineMat);
  line.userData.base = [p1.clone(), p2.clone()];
  rig.lines.push(line);
  group.add(line);
}

function makeNetSurface(
  rig: NetRig,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  cols: number,
  rows: number
) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.58
  });
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    addNetLine(
      group,
      rig,
      netPoint(a, b, c, d, u, 0),
      netPoint(a, b, c, d, u, 1),
      lineMat
    );
  }
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    addNetLine(
      group,
      rig,
      netPoint(a, b, c, d, 0, v),
      netPoint(a, b, c, d, 1, v),
      lineMat
    );
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols;
      const u1 = (i + 1) / cols;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      addNetLine(
        group,
        rig,
        netPoint(a, b, c, d, (u0 + u1) / 2, v0),
        netPoint(a, b, c, d, u1, (v0 + v1) / 2),
        lineMat
      );
      addNetLine(
        group,
        rig,
        netPoint(a, b, c, d, u1, (v0 + v1) / 2),
        netPoint(a, b, c, d, (u0 + u1) / 2, v1),
        lineMat
      );
      addNetLine(
        group,
        rig,
        netPoint(a, b, c, d, (u0 + u1) / 2, v1),
        netPoint(a, b, c, d, u0, (v0 + v1) / 2),
        lineMat
      );
      addNetLine(
        group,
        rig,
        netPoint(a, b, c, d, u0, (v0 + v1) / 2),
        netPoint(a, b, c, d, (u0 + u1) / 2, v0),
        lineMat
      );
    }
  }
  return group;
}
function makeCylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  matRef: THREE.Material
) {
  const dir = b.clone().sub(a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      Math.max(0.001, dir.length()),
      18
    ),
    matRef
  );
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  return shadow(mesh);
}
function makeGoal(scene: THREE.Scene, netRig: NetRig) {
  const root = new THREE.Group();
  root.position.z = GOAL_LINE_Z;
  const white = material(0xffffff, 0.4, 0.18);
  const rear = material(0xcbd5e1, 0.46, 0.28);
  const backScale = 0.82;
  const backW = GOAL_W * backScale;
  const backH = GOAL_H * backScale;
  const FL = new THREE.Vector3(-GOAL_W / 2, 0, 0);
  const FR = new THREE.Vector3(GOAL_W / 2, 0, 0);
  const FLT = new THREE.Vector3(-GOAL_W / 2, GOAL_H, 0);
  const FRT = new THREE.Vector3(GOAL_W / 2, GOAL_H, 0);
  const BL = new THREE.Vector3(-backW / 2, 0.03, -GOAL_D);
  const BR = new THREE.Vector3(backW / 2, 0.03, -GOAL_D);
  const BLT = new THREE.Vector3(-backW / 2, backH, -GOAL_D);
  const BRT = new THREE.Vector3(backW / 2, backH, -GOAL_D);
  root.add(
    makeCylinderBetween(FL, FLT, POST_R, white),
    makeCylinderBetween(FR, FRT, POST_R, white),
    makeCylinderBetween(FLT, FRT, POST_R, white),
    makeCylinderBetween(BL, BLT, POST_R * 0.48, rear),
    makeCylinderBetween(BR, BRT, POST_R * 0.48, rear),
    makeCylinderBetween(BLT, BRT, POST_R * 0.48, rear),
    makeCylinderBetween(FLT, BLT, POST_R * 0.42, rear),
    makeCylinderBetween(FRT, BRT, POST_R * 0.42, rear),
    makeCylinderBetween(FL, BL, POST_R * 0.36, rear),
    makeCylinderBetween(FR, BR, POST_R * 0.36, rear)
  );
  root.add(makeNetSurface(netRig, BL, BR, BRT, BLT, 18, 10));
  root.add(makeNetSurface(netRig, FLT, FRT, BRT, BLT, 18, 8));
  root.add(makeNetSurface(netRig, FL, BL, BLT, FLT, 8, 10));
  root.add(makeNetSurface(netRig, FR, BR, BRT, FRT, 8, 10));
  scene.add(root);
}
function triggerNetShake(netRig: NetRig, impact: THREE.Vector3) {
  netRig.shake = 1.35;
  netRig.impact.copy(impact).sub(new THREE.Vector3(0, 0, GOAL_LINE_Z));
}
function updateNetShake(netRig: NetRig, dt: number) {
  if (netRig.shake <= 0) return;
  const time = performance.now() * 0.02;
  const strength = netRig.shake;
  netRig.lines.forEach((line, idx) => {
    const base = line.userData.base as THREE.Vector3[];
    const attr = line.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < 2; i++) {
      const p = base[i];
      const distance = Math.max(0.28, p.distanceTo(netRig.impact));
      const falloff = THREE.MathUtils.clamp(1.65 / distance, 0, 1.4);
      const wave =
        Math.sin(time + idx * 0.37 + i * 1.7) * 0.24 * strength * falloff;
      attr.setXYZ(
        i,
        p.x + wave * 0.36,
        p.y + Math.abs(wave) * 0.28,
        p.z - Math.abs(wave) * 1.45
      );
    }
    attr.needsUpdate = true;
  });
  netRig.shake = Math.max(0, netRig.shake - dt * 1.65);
}
function makeChair(color: number) {
  const chair = new THREE.Group();
  const plastic = material(color, 0.62, 0.02);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.4), plastic);
  seat.position.y = 0.28;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.08), plastic);
  back.position.set(0, 0.55, -0.16);
  const legMat = material(0x334155, 0.45, 0.18);
  const legs = [
    [-0.16, 0.13, -0.12],
    [0.16, 0.13, -0.12],
    [-0.16, 0.13, 0.14],
    [0.16, 0.13, 0.14]
  ].map(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), legMat);
    leg.position.set(x, y, z);
    return leg;
  });
  chair.add(shadow(seat), shadow(back), ...legs.map((leg) => shadow(leg)));
  return chair;
}


function makeReserveBench(team: TeamKey, x: number, z: number, rotationY = 0) {
  const bench = new THREE.Group();
  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY;
  const kit = kitForTeam(team);
  const frameMat = material(0x1f2937, 0.48, 0.28);
  const seatMat = texturedMaterial(kit.primary, teamTexture(team), 5, 0.62, 0.04);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: kit.primary,
    roughness: 0.42,
    metalness: 0.04,
    transparent: true,
    opacity: 0.82
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.68), frameMat);
  base.position.y = 0.16;
  bench.add(shadow(base));
  for (let i = 0; i < 5; i++) {
    const seat = makeChair(i % 2 ? kit.secondary : kit.primary);
    seat.position.set((i - 2) * 0.62, 0.18, 0.02);
    seat.scale.setScalar(0.86);
    bench.add(seat);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.05, 0.08), seatMat);
  back.position.set(0, 0.82, 0.38);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.12, 1.0), canopyMat);
  roof.position.set(0, 1.38, -0.02);
  roof.rotation.x = -0.1;
  bench.add(shadow(back), shadow(roof));
  [-1.72, 1.72].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 10), frameMat);
    post.position.set(px, 0.72, 0.32);
    bench.add(shadow(post));
  });
  return bench;
}

function addPerimeterNetAndLampPosts(scene: THREE.Scene) {
  const fence = new THREE.Group();
  const fenceMat = new THREE.LineBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.32 });
  const postMat = material(0x94a3b8, 0.48, 0.22);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfdbfe, emissiveIntensity: 1.85, roughness: 0.24 });
  const left = -FIELD_W / 2 - 1.35;
  const right = FIELD_W / 2 + 1.35;
  const near = HALF_H / 2 + 1.2;
  const far = GOAL_LINE_Z - GOAL_D - 3.2;
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const x = THREE.MathUtils.lerp(left, right, i / 10);
    posts.push(new THREE.Vector3(x, 0, near), new THREE.Vector3(x, 0, far));
  }
  for (let i = 1; i < 8; i++) {
    const z = THREE.MathUtils.lerp(far, near, i / 8);
    posts.push(new THREE.Vector3(left, 0, z), new THREE.Vector3(right, 0, z));
  }
  posts.forEach((pnt, index) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.05, 8), postMat);
    post.position.set(pnt.x, 1.02, pnt.z);
    fence.add(shadow(post));
    if (index % 5 === 0) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.2), lampMat);
      lamp.position.set(pnt.x, 2.18, pnt.z);
      lamp.lookAt(0, 0.9, GOAL_LINE_Z + 4);
      fence.add(lamp);
    }
  });
  const addFenceLine = (a: THREE.Vector3, b: THREE.Vector3, y: number) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, y, a.z),
      new THREE.Vector3(b.x, y, b.z)
    ]);
    fence.add(new THREE.Line(geometry, fenceMat));
  };
  const addFenceVertical = (x: number, z: number) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.55, z),
      new THREE.Vector3(x, 2.0, z)
    ]);
    fence.add(new THREE.Line(geometry, fenceMat));
  };
  const corners = [
    new THREE.Vector3(left, 0, far),
    new THREE.Vector3(right, 0, far),
    new THREE.Vector3(right, 0, near),
    new THREE.Vector3(left, 0, near)
  ];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let y = 0.55; y <= 2.0; y += 0.36) addFenceLine(a, b, y);
    const segments = i % 2 === 0 ? 22 : 16;
    for (let j = 1; j < segments; j++) {
      const u = j / segments;
      const p1 = a.clone().lerp(b, u);
      addFenceVertical(p1.x, p1.z);
    }
  }
  scene.add(fence);
}


function addSideGrandstands(scene: THREE.Scene) {
  const concrete = material(0x8491a3, 0.9, 0.02);
  const aisleMat = material(0xe2e8f0, 0.78, 0.02);
  const railMat = material(0xf8fafc, 0.38, 0.2);
  const chairColors = [0x1d4ed8, 0xffffff, 0xdc2626];
  const rows = 5;
  const rowDepth = 0.76;
  const rowRise = 0.28;
  [-1, 1].forEach((side) => {
    const stand = new THREE.Group();
    stand.position.set(side * (FIELD_W / 2 + 3.0), 0, 0.5);
    stand.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    for (let row = 0; row < rows; row++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(HALF_H + 2.4, 0.13, rowDepth), concrete);
      tread.position.set(0, 0.16 + row * rowRise, -row * rowDepth);
      stand.add(shadow(tread));
      for (let col = 0; col < 22; col++) {
        if (col === 7 || col === 14) continue;
        const chair = makeChair(chairColors[(row + col) % chairColors.length]);
        chair.position.set(-HALF_H / 2 + 1.5 + col * 1.45, 0.31 + row * rowRise, -row * rowDepth + 0.05);
        chair.scale.setScalar(0.78);
        stand.add(chair);
      }
    }
    [-HALF_H / 2 + 8.8, 0, HALF_H / 2 - 8.8].forEach((x) => {
      for (let row = 0; row < rows; row++) {
        const stair = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, rowDepth * 0.74), aisleMat);
        stair.position.set(x, 0.3 + row * rowRise, -row * rowDepth + 0.02);
        stand.add(shadow(stair));
      }
    });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(HALF_H + 2.8, 0.07, 0.07), railMat);
    rail.position.set(0, 0.88, 0.54);
    stand.add(shadow(rail));
    scene.add(stand);
  });
}

function addCornerStairConnections(scene: THREE.Scene) {
  const cornerMat = material(0x7c8796, 0.88, 0.03);
  const aisleMat = material(0xe2e8f0, 0.78, 0.02);
  const railMat = material(0xf8fafc, 0.38, 0.2);
  const rows = 7;
  const rowDepth = 0.82;
  const rowRise = 0.32;
  const width = 4.4;
  const placements = [
    [-FIELD_W / 2 - 2.0, GOAL_LINE_Z - GOAL_D - 2.2, Math.PI / 9],
    [FIELD_W / 2 + 2.0, GOAL_LINE_Z - GOAL_D - 2.2, -Math.PI / 9],
    [-FIELD_W / 2 - 2.0, HALF_H / 2 + 1.25, Math.PI - Math.PI / 9],
    [FIELD_W / 2 + 2.0, HALF_H / 2 + 1.25, Math.PI + Math.PI / 9]
  ];
  placements.forEach(([x, z, rot]) => {
    const corner = new THREE.Group();
    corner.position.set(x, 0, z);
    corner.rotation.y = rot;
    for (let row = 0; row < rows; row++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, rowDepth), cornerMat);
      tread.position.set(0, 0.18 + row * rowRise, -row * rowDepth);
      const stair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, rowDepth * 0.76), aisleMat);
      stair.position.set(0, 0.32 + row * rowRise, -row * rowDepth + 0.02);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.05), railMat);
      nose.position.set(0, 0.4 + row * rowRise, -row * rowDepth + rowDepth * 0.38);
      corner.add(shadow(tread), shadow(stair), shadow(nose));
    }
    scene.add(corner);
  });
}

function makeBillboardsAndStands(
  scene: THREE.Scene,
  loader: GLTFLoader
): StadiumRig {
  const boardGroup = new THREE.Group();
  const zBoard = GOAL_LINE_Z - GOAL_D - 0.75;
  const boardColors = [
    0x2563eb, 0xef4444, 0x16a34a, 0xfacc15, 0x7c3aed, 0x0ea5e9
  ];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 3.15;
    const sponsorLabels = ['MURLAN', 'TON PLAY', 'FREE KICK', 'ARENA', 'SKILL+', 'GOAL CAM'];
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 0.82, 0.08),
      new THREE.MeshStandardMaterial({
        map: createSponsorTexture(sponsorLabels[i] ?? 'ARENA', `#${boardColors[i].toString(16).padStart(6, '0')}`),
        roughness: 0.45,
        metalness: 0.02,
        emissive: boardColors[i],
        emissiveIntensity: 0.08
      })
    );
    board.position.set(x, 0.55, zBoard);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 0.08, 0.1),
      material(0xffffff, 0.55, 0.02)
    );
    top.position.set(x, 1.0, zBoard + 0.01);
    const textBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.12, 0.105),
      material(0xffffff, 0.55, 0.02)
    );
    textBar.position.set(x, 0.55, zBoard + 0.015);
    boardGroup.add(shadow(board), shadow(top), shadow(textBar));
  }
  scene.add(boardGroup);

  const stands = new THREE.Group();
  stands.position.z = GOAL_LINE_Z - GOAL_D - 2.2;
  const concrete = material(0x8c99a8, 0.9, 0.02);
  const riserMat = material(0x64748b, 0.85, 0.03);
  const aisleMat = material(0xe2e8f0, 0.78, 0.02);
  const railMat = material(0xf8fafc, 0.38, 0.2);
  const rows = 7;
  const rowDepth = 0.86;
  const rowRise = 0.34;
  const width = FIELD_W + 5.2;
  const stairXs = [-6.35, 0, 6.35];

  for (let row = 0; row < rows; row++) {
    const z = -row * rowDepth;
    const y = 0.18 + row * rowRise;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.16, rowDepth),
      concrete
    );
    tread.position.set(0, y, z);
    const riser = new THREE.Mesh(
      new THREE.BoxGeometry(width, rowRise, 0.08),
      riserMat
    );
    riser.position.set(0, y - 0.03, z + rowDepth * 0.46);
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.045, 0.07),
      railMat
    );
    lip.position.set(0, y + 0.12, z + rowDepth * 0.46);
    stands.add(shadow(tread), shadow(riser), shadow(lip));
  }

  stairXs.forEach((x) => {
    for (let row = 0; row < rows; row++) {
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.11, rowDepth * 0.78),
        aisleMat
      );
      stair.position.set(x, 0.32 + row * rowRise, -row * rowDepth + 0.02);
      stands.add(shadow(stair));
      const nose = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.035, 0.05),
        material(0xffffff, 0.72, 0.01)
      );
      nose.position.set(
        x,
        0.4 + row * rowRise,
        -row * rowDepth + rowDepth * 0.38
      );
      stands.add(shadow(nose));
    }
    const railPostCount = rows + 1;
    for (let i = 0; i < railPostCount; i++) {
      const postZ = -i * rowDepth + rowDepth * 0.28;
      const postY = 0.65 + i * rowRise;
      [-0.46, 0.46].forEach((side) => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10),
          railMat
        );
        post.position.set(x + side, postY, postZ);
        stands.add(shadow(post));
      });
    }
    [-0.46, 0.46].forEach((side) => {
      const rail = makeCylinderBetween(
        new THREE.Vector3(x + side, 0.86, rowDepth * 0.3),
        new THREE.Vector3(
          x + side,
          0.86 + rows * rowRise,
          -(rows - 1) * rowDepth + rowDepth * 0.25
        ),
        0.022,
        railMat
      );
      stands.add(rail);
    });
  });

  const chairColors = [0x1d4ed8, 0xffffff];
  const spectators: SeatedSpectator[] = [];
  let characterIndex = 0;
  for (let row = 0; row < rows; row++) {
    let rowSpectators = 0;
    for (let col = 0; col < 26; col++) {
      const x = (col - 12.5) * 0.78;
      if (stairXs.some((aisleX) => Math.abs(x - aisleX) < 0.58)) continue;
      const localZ = -row * rowDepth + 0.04;
      const z = stands.position.z + localZ;
      const y = 0.38 + row * rowRise;
      const chair = makeChair(chairColors[(row + col) % chairColors.length]);
      chair.position.set(x, y, localZ);
      chair.rotation.y = 0;
      stands.add(chair);

      const shouldSeatHuman =
        row < SPECTATOR_ROWS_FILLED &&
        rowSpectators < SPECTATORS_PER_ROW_TARGET;
      if (shouldSeatHuman) {
        const supporterTeam: TeamKey = characterIndex % 2 === 0 ? 'blue' : 'red';
        const kit = kitForTeam(supporterTeam).primary;
        const characterTheme = MURLAN_CHARACTER_THEMES[
          characterIndex % Math.max(1, MURLAN_CHARACTER_THEMES.length)
        ] ?? { url: HUMAN_URL, scale: 1 };
        spectators.push(
          attachMurlanSeatedSpectator(
            chair,
            loader,
            characterTheme,
            characterIndex,
            kit,
            supporterTeam
          )
        );
        characterIndex += 1;
        rowSpectators += 1;
      }
    }
  }

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.9, rows * rowRise + 1.2, 0.28),
    material(0x475569, 0.72, 0.06)
  );
  backWall.position.set(
    0,
    1.08 + rows * rowRise,
    -(rows - 1) * rowDepth - 0.62
  );
  stands.add(shadow(backWall));

  const frontRail = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, 0.08, 0.08),
    railMat
  );
  frontRail.position.set(0, 1.05, 0.62);
  stands.add(shadow(frontRail));
  [-width / 2 - 0.22, width / 2 + 0.22].forEach((x) => {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, rows * rowRise + 0.7, rows * rowDepth + 0.8),
      material(0x5b6472, 0.82, 0.04)
    );
    sideWall.position.set(
      x,
      0.72 + rows * rowRise * 0.5,
      -((rows - 1) * rowDepth) / 2
    );
    stands.add(shadow(sideWall));
  });

  scene.add(stands);
  return { spectators, cheerTime: 0 };
}

function addLine(
  scene: THREE.Scene,
  points: THREE.Vector3[],
  color = 0xffffff,
  opacity = 0.9
) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, 0.018, p.z))
    ),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  scene.add(line);
  return line;
}
function addRect(
  scene: THREE.Scene,
  left: number,
  right: number,
  frontZ: number,
  backZ: number
) {
  addLine(scene, [
    new THREE.Vector3(left, 0, frontZ),
    new THREE.Vector3(left, 0, backZ),
    new THREE.Vector3(right, 0, backZ),
    new THREE.Vector3(right, 0, frontZ)
  ]);
}
function makeHalfField(
  scene: THREE.Scene,
  netRig: NetRig,
  loader: GLTFLoader
): StadiumRig {
  const grassTexture = createGrassTexture();
  const grassA = new THREE.MeshStandardMaterial({ color: 0x1d7d39, map: grassTexture, roughness: 0.96 });
  const grassB = new THREE.MeshStandardMaterial({ color: 0x16692e, map: grassTexture, roughness: 0.96 });
  for (let i = 0; i < 10; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W, HALF_H / 10),
      i % 2 ? grassA : grassB
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.z = -HALF_H / 2 + HALF_H / 20 + (i * HALF_H) / 10;
    stripe.receiveShadow = true;
    scene.add(stripe);
  }
  const w = FIELD_W / 2;
  const h = HALF_H / 2;
  addLine(scene, [
    new THREE.Vector3(-w, 0, -h),
    new THREE.Vector3(w, 0, -h),
    new THREE.Vector3(w, 0, h),
    new THREE.Vector3(-w, 0, h),
    new THREE.Vector3(-w, 0, -h)
  ]);
  addLine(scene, [new THREE.Vector3(-w, 0, h), new THREE.Vector3(w, 0, h)]);
  const centerCirclePts = new THREE.EllipseCurve(0, h, 3.2, 3.2, Math.PI, Math.PI * 2)
    .getPoints(72)
    .map((p) => new THREE.Vector3(p.x, 0, p.y));
  addLine(scene, centerCirclePts, 0xffffff, 0.72);
  [
    [-w, -h, 0, Math.PI / 2],
    [w, -h, Math.PI / 2, Math.PI],
    [-w, h, -Math.PI / 2, 0],
    [w, h, Math.PI, Math.PI * 1.5]
  ].forEach(([cx, cz, start, end]) => {
    const arc = new THREE.EllipseCurve(cx, cz, 0.9, 0.9, start, end)
      .getPoints(24)
      .map((p) => new THREE.Vector3(p.x, 0, p.y));
    addLine(scene, arc, 0xffffff, 0.82);
  });
  addRect(scene, -PENALTY_W / 2, PENALTY_W / 2, -h, -h + PENALTY_D);
  addRect(scene, -GOAL_AREA_W / 2, GOAL_AREA_W / 2, -h, -h + GOAL_AREA_D);
  const penaltySpot = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  penaltySpot.rotation.x = -Math.PI / 2;
  penaltySpot.position.set(0, 0.022, -h + PENALTY_SPOT_D);
  scene.add(penaltySpot);
  const boxTopZ = -h + PENALTY_D;
  const spotZ = -h + PENALTY_SPOT_D;
  const theta = Math.acos((boxTopZ - spotZ) / ARC_R);
  const arcPts = new THREE.EllipseCurve(
    0,
    spotZ,
    ARC_R,
    ARC_R,
    theta,
    Math.PI - theta
  )
    .getPoints(96)
    .map((p) => new THREE.Vector3(p.x, 0, p.y));
  addLine(scene, arcPts);
  makeGoal(scene, netRig);
  scene.add(makeReserveBench('blue', -FIELD_W / 2 - 2.25, GOAL_LINE_Z + 11.8, Math.PI / 2));
  scene.add(makeReserveBench('red', FIELD_W / 2 + 2.25, GOAL_LINE_Z + 11.8, -Math.PI / 2));
  addPerimeterNetAndLampPosts(scene);
  addSideGrandstands(scene);
  addCornerStairConnections(scene);
  return makeBillboardsAndStands(scene, loader);
}

function makeAimLine(scene: THREE.Scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(34 * 3), 3)
  );
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xfff200,
      transparent: true,
      opacity: 0.95
    })
  );
  scene.add(line);
  return line;
}
function shotPoint(
  start: THREE.Vector3,
  target: THREE.Vector3,
  curve: number,
  lift: number,
  t: number
) {
  const p = start.clone().lerp(target, t);
  p.x += curve * Math.sin(t * Math.PI);
  p.y = BALL_R + lift * Math.sin(t * Math.PI) + (target.y - BALL_R) * t;
  return p;
}
function swipeToShot(ballPos: THREE.Vector3, swipe: SwipeState) {
  const dx = swipe.endX - swipe.startX;
  const dy = swipe.startY - swipe.endY;
  const screenScale = THREE.MathUtils.clamp(
    (swipe.viewportW ?? 390) / 390,
    0.82,
    1.35
  );
  const heightScale = THREE.MathUtils.clamp(
    (swipe.viewportH ?? 780) / 780,
    0.82,
    1.35
  );
  const swipeLen = Math.hypot(dx / screenScale, dy / heightScale);
  const power = THREE.MathUtils.clamp(swipeLen / 142, 0.42, 1.92);
  const normalizedDx = dx / (46 * screenScale);
  const normalizedDy = dy / (106 * heightScale);

  // Screen swipe is the source of truth: left/right moves the shot left/right,
  // upward distance lifts the ball, and total swipe length controls speed/power.
  const targetX = THREE.MathUtils.clamp(
    normalizedDx,
    -GOAL_W / 2 - 1.15,
    GOAL_W / 2 + 1.15
  );
  const targetY = THREE.MathUtils.clamp(
    0.24 + normalizedDy,
    BALL_R,
    GOAL_H + 2.0
  );
  const onFrame =
    Math.abs(targetX) > GOAL_W / 2 - 0.34 || targetY > GOAL_H - 0.08;
  const inMouth =
    Math.abs(targetX) <= GOAL_W / 2 - BALL_R * 1.4 &&
    targetY >= BALL_R &&
    targetY <= GOAL_H - BALL_R * 0.3;
  const targetDepth =
    inMouth && !onFrame ? GOAL_LINE_Z - GOAL_D + 0.32 : GOAL_LINE_Z - 0.12;
  const target = new THREE.Vector3(targetX, targetY, targetDepth);
  const curve = THREE.MathUtils.clamp(
    (dx / (96 * screenScale)) * power,
    -4.9,
    4.9
  );
  const lift = THREE.MathUtils.clamp(
    0.18 + normalizedDy * 1.04 + power * 0.18,
    0.28,
    GOAL_H + 2.75
  );
  const distance = ballPos.distanceTo(target);
  const duration = THREE.MathUtils.clamp(
    distance / (17.2 + power * 12.6),
    0.62,
    1.42
  );
  return { target, curve, lift, power, duration };
}

function makeSwipeForTarget(
  targetX: number,
  targetY: number,
  viewportW = 390,
  viewportH = 780,
  powerBoost = 1
): SwipeState {
  const screenScale = THREE.MathUtils.clamp(viewportW / 390, 0.82, 1.35);
  const heightScale = THREE.MathUtils.clamp(viewportH / 780, 0.82, 1.35);
  const startX = viewportW * 0.5;
  const startY = viewportH * 0.72;
  const endX = startX + targetX * 46 * screenScale;
  const endY = startY - Math.max(0.2, targetY - 0.24) * 106 * heightScale - powerBoost * 36;
  return {
    active: false,
    startX,
    startY,
    endX,
    endY,
    mode: 'shot',
    moved: true,
    viewportW,
    viewportH
  };
}


function controlToShotSwipe(
  control: ShotControlState,
  viewportW = 390,
  viewportH = 780
): SwipeState {
  const aimX = THREE.MathUtils.clamp(control.aimX, -1, 1);
  const aimY = THREE.MathUtils.clamp(control.aimY, -1, 1);
  const power = THREE.MathUtils.clamp(control.power, 0.2, 1);
  const targetX = THREE.MathUtils.clamp(
    aimX * (GOAL_W / 2 + 0.82),
    -GOAL_W / 2 - 1.15,
    GOAL_W / 2 + 1.15
  );
  const verticalStrike = (1 - aimY) * 0.5; // lower contact gets under the ball.
  const targetY = THREE.MathUtils.clamp(
    0.42 + verticalStrike * (GOAL_H + 1.1) + power * 0.44,
    BALL_R,
    GOAL_H + 2.0
  );
  const swipe = makeSwipeForTarget(
    targetX,
    targetY,
    viewportW,
    viewportH,
    THREE.MathUtils.lerp(0.15, 1.55, power)
  );
  const sideSpin = -aimX * THREE.MathUtils.lerp(10, 58, power);
  swipe.startX = viewportW * 0.5;
  swipe.endX += sideSpin;
  return swipe;
}

const AI_SHOT_TECHNIQUES = Object.freeze([
  Object.freeze({ name: 'whipped top-left curl', x: -GOAL_W / 2 + 0.34, y: GOAL_H - 0.22, power: 1.28, spin: -54 }),
  Object.freeze({ name: 'whipped top-right curl', x: GOAL_W / 2 - 0.34, y: GOAL_H - 0.22, power: 1.28, spin: 54 }),
  Object.freeze({ name: 'driven bottom-left skidder', x: -GOAL_W / 2 + 0.48, y: 0.42, power: 0.92, spin: -24 }),
  Object.freeze({ name: 'driven bottom-right skidder', x: GOAL_W / 2 - 0.48, y: 0.42, power: 0.92, spin: 24 }),
  Object.freeze({ name: 'dipping central knuckle', x: 0.15, y: GOAL_H - 0.36, power: 1.48, spin: THREE.MathUtils.randFloatSpread(18) })
]);

function randomAiShotSwipe(viewportW = 390, viewportH = 780, ballPos = new THREE.Vector3(0, BALL_R, GOAL_LINE_Z + 23), spot: KickSpot = 'center') {
  const goalSideBias = ballPos.x > 1.2 ? -1 : ballPos.x < -1.2 ? 1 : Math.random() > 0.5 ? 1 : -1;
  const wallAware = AI_SHOT_TECHNIQUES.filter((tech) => {
    if (spot === 'near16') return tech.y > 1.65 || tech.y < 0.65;
    if (ballPos.x < -1.2) return tech.x >= -0.15 || tech.x < -GOAL_W / 2 + 0.6;
    if (ballPos.x > 1.2) return tech.x <= 0.15 || tech.x > GOAL_W / 2 - 0.6;
    return true;
  });
  const technique = wallAware[Math.floor(Math.random() * wallAware.length)] ?? AI_SHOT_TECHNIQUES[0];
  const cornerNoiseX = THREE.MathUtils.randFloatSpread(0.22);
  const cornerNoiseY = THREE.MathUtils.randFloatSpread(0.14);
  const targetX = THREE.MathUtils.clamp(
    technique.x + cornerNoiseX,
    -GOAL_W / 2 + 0.24,
    GOAL_W / 2 - 0.24
  );
  const targetY = THREE.MathUtils.clamp(technique.y + cornerNoiseY, 0.32, GOAL_H - 0.14);
  const swipe = makeSwipeForTarget(targetX, targetY, viewportW, viewportH, technique.power);
  // AI now varies shot technique: extra end-point spin creates visible curve while keeping
  // the final aim tucked inside top/bottom corners rather than random central shots.
  const spinDirection = Math.sign(technique.spin || goalSideBias) || goalSideBias;
  swipe.endX += technique.spin + spinDirection * THREE.MathUtils.randFloat(6, 18);
  swipe.endY += technique.y < 0.75 ? THREE.MathUtils.randFloat(10, 24) : -THREE.MathUtils.randFloat(4, 18);
  swipe.technique = technique.name;
  return swipe;
}

function setKeeperDiveFromSwipe(keeper: Actor, swipe: SwipeState) {
  const dx = swipe.endX - swipe.startX;
  const dy = swipe.startY - swipe.endY;
  const distance = Math.hypot(dx, dy);
  if (distance < MIN_KEEPER_SWIPE_PX) return false;
  const side = dx < -12 ? -1 : dx > 12 ? 1 : 0;
  const height = THREE.MathUtils.clamp(0.58 + Math.max(0, dy) / 150, 0.62, 1.95);
  keeper.diveDir = side;
  keeper.saveTargetX = THREE.MathUtils.clamp((dx / Math.max(1, swipe.viewportW ?? 390)) * GOAL_W, -2.9, 2.9);
  keeper.saveTargetY = height;
  keeper.saveTargetZ = GOAL_LINE_Z + 0.1;
  keeper.diveHeight = height;
  keeper.diveDelay = 0;
  keeper.diveTime = KEEPER_DIVE_DURATION;
  return true;
}

function setAimCurve(
  line: THREE.Line,
  ballPos: THREE.Vector3,
  swipe: SwipeState
) {
  const attr = (line.geometry as THREE.BufferGeometry).getAttribute(
    'position'
  ) as THREE.BufferAttribute;
  const shot = swipeToShot(ballPos, swipe);
  for (let i = 0; i < attr.count; i++) {
    const t = i / (attr.count - 1);
    const p = shotPoint(ballPos, shot.target, shot.curve, shot.lift, t);
    attr.setXYZ(i, p.x, p.y + 0.08, p.z);
  }
  attr.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
function hideAimLine(line: THREE.Line) {
  const attr = (line.geometry as THREE.BufferGeometry).getAttribute(
    'position'
  ) as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) attr.setXYZ(i, 99, 99, 99);
  attr.needsUpdate = true;
}
function freeKickPosition(spot: KickSpot) {
  if (spot === 'left')
    return new THREE.Vector3(-4.6, BALL_R, GOAL_LINE_Z + 24.5);
  if (spot === 'right')
    return new THREE.Vector3(4.6, BALL_R, GOAL_LINE_Z + 24.5);
  if (spot === 'near16')
    return new THREE.Vector3(0.7, BALL_R, GOAL_LINE_Z + 18.8);
  return new THREE.Vector3(0, BALL_R, GOAL_LINE_Z + 23.0);
}
function wallCountForSpot(spot: KickSpot) {
  if (spot === 'left' || spot === 'right') return 3;
  if (spot === 'near16') return 5;
  return 4;
}
function randomKickSpot(previous?: KickSpot): KickSpot {
  const spots: KickSpot[] = ['left', 'center', 'right', 'near16'];
  const pool = previous ? spots.filter((s) => s !== previous) : spots;
  return pool[Math.floor(Math.random() * pool.length)] ?? 'center';
}
function wallCenterForBall(ballPos: THREE.Vector3) {
  const goalCenter = new THREE.Vector3(0, 0, GOAL_LINE_Z);
  const toGoal = goalCenter.sub(ballPos).setY(0).normalize();
  return ballPos.clone().addScaledVector(toGoal, WALL_DISTANCE).setY(0);
}
function placeWall(wall: Actor[], spot: KickSpot, ballPos: THREE.Vector3) {
  const count = wallCountForSpot(spot);
  const center = wallCenterForBall(ballPos);
  const toBall = ballPos.clone().sub(center).setY(0).normalize();
  const side = new THREE.Vector3(toBall.z, 0, -toBall.x).normalize();
  wall.forEach((actor, i) => {
    actor.root.visible = i < count;
    const offset = i - (count - 1) / 2;
    actor.pos
      .copy(center)
      .addScaledVector(side, offset * 0.62)
      .setY(0);
    actor.dir.copy(ballPos.clone().sub(actor.pos).setY(0).normalize());
    actor.vel.set(0, 0, 0);
    actor.speed = 0;
    actor.jumpTime = 0;
  });
}

function ambientPlayerPosition(index: number) {
  const formation = [
    [-8.4, -11.2], [-4.2, -10.8], [0, -11.4], [4.2, -10.8], [8.4, -11.2],
    [-7.2, -3.9], [-2.3, -4.7], [2.3, -4.7], [7.2, -3.9], [-3.2, 4.0], [3.2, 4.0],
    [-8.4, 13.7], [-4.2, 13.1], [0, 13.9], [4.2, 13.1], [8.4, 13.7],
    [-7.2, 7.3], [-2.3, 8.2], [2.3, 8.2], [7.2, 7.3], [-3.2, -0.4], [3.2, -0.4]
  ];
  const [x, z] = formation[index % formation.length];
  return new THREE.Vector3(x, GROUND_Y, z);
}

function createAmbientMatchActors(
  scene: THREE.Scene,
  loader: GLTFLoader,
  modelUrlForIndex: (index: number) => string
) {
  const actors = Array.from({ length: AMBIENT_FIELD_PLAYER_COUNT }, (_, index) => {
    const team: TeamKey = index < AMBIENT_FIELD_PLAYER_COUNT / 2 ? 'blue' : 'red';
    const actor = createActor(
      scene,
      loader,
      'field',
      ambientPlayerPosition(index),
      40 + index,
      kitForTeam(team).primary,
      modelUrlForIndex(index + 9),
      team
    );
    actor.dir.set(index < AMBIENT_FIELD_PLAYER_COUNT / 2 ? 0.12 : -0.12, 0, index < AMBIENT_FIELD_PLAYER_COUNT / 2 ? -1 : 1).normalize();
    actor.root.scale.setScalar(0.92);
    return actor;
  });
  const referee = createActor(
    scene,
    loader,
    'referee',
    new THREE.Vector3(-1.35, GROUND_Y, GOAL_LINE_Z + 15.2),
    99,
    0x111111,
    modelUrlForIndex(31),
    'blue'
  );
  referee.dir.set(0.15, 0, -1).normalize();
  referee.root.scale.setScalar(0.96);
  return { fieldPlayers: actors, referee };
}

function updateAmbientMatchActors(fieldPlayers: Actor[], referee: Actor, dt: number, cheerTime = 0) {
  const now = performance.now() * 0.001;
  fieldPlayers.forEach((actor, index) => {
    const base = ambientPlayerPosition(index);
    actor.pos.x = base.x + Math.sin(now * 0.55 + index) * 0.1;
    actor.pos.z = base.z + Math.cos(now * 0.45 + index * 0.7) * 0.08;
    actor.speed = cheerTime > 0 ? 0.45 : 0.04;
    actor.dir.set(Math.sin(now * 0.4 + index) * 0.2, 0, index < fieldPlayers.length / 2 ? -1 : 1).normalize();
    updateActorBase(actor, dt);
    if (cheerTime > 0 && actor.bones.leftArm && actor.bones.rightArm) {
      const wave = Math.sin(now * 9 + index) * 0.35;
      actor.bones.leftArm.rotation.x += -0.45 + wave;
      actor.bones.rightArm.rotation.x += -0.45 - wave;
    }
  });
  referee.pos.x = -1.35 + Math.sin(now * 0.35) * 0.18;
  referee.pos.z = GOAL_LINE_Z + 15.2 + Math.cos(now * 0.3) * 0.12;
  referee.speed = 0.05;
  referee.dir.set(0.15, 0, -1).normalize();
  updateActorBase(referee, dt);
  if (referee.bones.leftArm) referee.bones.leftArm.rotation.x += -0.28;
  if (referee.bones.rightArm) referee.bones.rightArm.rotation.x += -0.18;
}

function resetShot(
  ball: BallState,
  kicker: Actor,
  keeper: Actor,
  wall: Actor[],
  spot: KickSpot
) {
  const ballPos = freeKickPosition(spot);
  ball.object.position.copy(ballPos);
  ball.vel.set(0, 0, 0);
  ball.spin.set(0, 0, 0);
  ball.curve = 0;
  ball.shotAge = 0;
  ball.shotDuration = 1.05;
  ball.lift = 1;
  ball.flying = false;
  ball.netCaught = false;
  ball.netAge = 0;
  ball.netVel.set(0, 0, 0);
  ball.crossedGoalLine = false;
  ball.hitFrame = false;
  ball.trailPoints.length = 0;
  ball.speedKmh = 0;
  updateBallTrail(ball);
  ball.shotStart.copy(ballPos);
  ball.shotTarget.set(0, BALL_R, GOAL_LINE_Z);
  ball.lastPos.copy(ballPos);
  ball.knuckleSeed = Math.random() * 100;

  const toGoal = new THREE.Vector3(0, 0, GOAL_LINE_Z)
    .sub(ballPos)
    .setY(0)
    .normalize();
  const runupStart = ballPos
    .clone()
    .addScaledVector(toGoal, -RUNUP_BACK_STEPS)
    .add(new THREE.Vector3(-0.42, -BALL_R, 0))
    .setY(0);
  kicker.dir.copy(ballPos.clone().sub(runupStart).setY(0).normalize());
  resetKickerGroundedForShot(kicker, runupStart, ballPos);

  keeper.pos.set(0, 0, GOAL_LINE_Z + 0.36);
  keeper.dir.set(0, 0, 1);
  keeper.vel.set(0, 0, 0);
  keeper.speed = 0;
  keeper.diveTime = 0;
  keeper.diveDelay = 0;
  keeper.diveDir = 0;
  keeper.diveHeight = 1.15;
  keeper.saveTargetX = 0;
  keeper.saveTargetZ = GOAL_LINE_Z + 0.12;
  keeper.saveTargetY = 1.15;

  placeWall(wall, spot, ballPos);
}

function predictShotResult(ballPos: THREE.Vector3, swipe: SwipeState) {
  const shot = swipeToShot(ballPos, swipe);
  const final = shotPoint(ballPos, shot.target, shot.curve, shot.lift, 1);
  let goalLine = final.clone();
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const p = shotPoint(ballPos, shot.target, shot.curve, shot.lift, t);
    if (p.z <= GOAL_LINE_Z) {
      goalLine = p;
      break;
    }
  }
  return { shot, final, goalLine };
}

function beginRunup(
  kicker: Actor,
  wall: Actor[],
  keeper: Actor,
  ball: BallState,
  swipe: SwipeState
) {
  kicker.kickTime = 0;
  wall.forEach((w) => (w.jumpTime = 0));

  const { goalLine } = predictShotResult(ball.object.position, swipe);
  keeper.saveTargetX = THREE.MathUtils.clamp(
    goalLine.x,
    -GOAL_W / 2 + 0.28,
    GOAL_W / 2 - 0.28
  );
  keeper.saveTargetY = THREE.MathUtils.clamp(goalLine.y, 0.35, GOAL_H + 0.15);
  keeper.saveTargetZ = THREE.MathUtils.clamp(
    goalLine.z + 0.28,
    GOAL_LINE_Z - 0.18,
    GOAL_LINE_Z + 0.5
  );

  const targetSide =
    keeper.saveTargetX < -0.28 ? -1 : keeper.saveTargetX > 0.28 ? 1 : 0;
  const quality = Math.random();
  keeper.diveDir =
    quality < 0.08 ? -targetSide || (Math.random() > 0.5 ? 1 : -1) : targetSide;
  keeper.diveHeight =
    keeper.saveTargetY < 0.8 ? 0.62 : keeper.saveTargetY > 1.7 ? 1.78 : 1.18;
  keeper.diveDelay = quality > 0.7 ? 0.035 : quality > 0.25 ? 0.07 : 0.11;
  keeper.diveTime = 0;
}

function shootBall(ball: BallState, swipe: SwipeState) {
  const shot = swipeToShot(ball.object.position, swipe);
  ball.curve = shot.curve;
  ball.lift = shot.lift;
  ball.shotAge = 0;
  ball.shotDuration = shot.duration;
  ball.shotStart.copy(ball.object.position);
  ball.shotTarget.copy(shot.target);
  ball.lastPos.copy(ball.object.position);
  ball.netCaught = false;
  ball.netAge = 0;
  ball.netVel.set(0, 0, 0);
  ball.crossedGoalLine = false;
  ball.hitFrame = false;
  ball.spin.set(
    shot.curve * 0.2,
    shot.curve * 22.0 * shot.power,
    -shot.curve * 12.0 * shot.power
  );
  ball.speedKmh = ball.shotStart.distanceTo(ball.shotTarget) / Math.max(0.001, ball.shotDuration) * 3.6;
  ball.flying = true;
}

function rollBall(ball: BallState, move: THREE.Vector3, dt: number) {
  const dist = move.length();
  if (dist > 0.0001) {
    const rollAxis = new THREE.Vector3(move.z, 0, -move.x).normalize();
    const rollAngle = dist / BALL_R;
    QTMP.setFromAxisAngle(rollAxis, rollAngle);
    ball.object.quaternion.premultiply(QTMP);
  }
  const curveSpin = Math.abs(ball.curve) * 0.08 + 0.04;
  QTMP.setFromAxisAngle(
    new THREE.Vector3(0, Math.sign(ball.curve || 1), 0),
    curveSpin * Math.max(1, dt * 60)
  );
  ball.object.quaternion.premultiply(QTMP);
}

function updateBall(ball: BallState, dt: number) {
  if (ball.netCaught) {
    ball.netAge += dt;
    ball.netVel.y -= 1.2 * dt;
    ball.netVel.multiplyScalar(Math.pow(0.82, dt * 60));
    const prev = ball.object.position.clone();
    ball.object.position.addScaledVector(ball.netVel, dt);
    ball.object.position.z = THREE.MathUtils.clamp(
      ball.object.position.z,
      GOAL_LINE_Z - GOAL_D + 0.18,
      GOAL_LINE_Z - 0.18
    );
    ball.object.position.y = Math.max(BALL_R, ball.object.position.y);
    rollBall(ball, ball.object.position.clone().sub(prev), dt);
    if (ball.netAge > 1.15 || ball.netVel.length() < 0.04) ball.flying = false;
    ball.lastPos.copy(ball.object.position);
    return;
  }
  if (!ball.flying) return;

  const prev = ball.object.position.clone();
  ball.shotAge += dt;

  if (ball.shotAge <= ball.shotDuration) {
    const t = THREE.MathUtils.clamp(ball.shotAge / ball.shotDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 1.25);
    const next = shotPoint(
      ball.shotStart,
      ball.shotTarget,
      ball.curve,
      ball.lift,
      eased
    );
    ball.vel.copy(next).sub(prev).divideScalar(Math.max(0.0001, dt));
    ball.object.position.copy(next);
  } else {
    const knuckle =
      Math.sin(ball.shotAge * 12 + ball.knuckleSeed) *
      Math.abs(ball.curve) *
      0.22;
    ball.vel.x += (knuckle - ball.vel.x * 0.025) * dt;
    ball.vel.y -= 8.6 * dt;
    ball.vel.multiplyScalar(Math.pow(0.992, dt * 60));
    ball.object.position.addScaledVector(ball.vel, dt);

    if (ball.object.position.y <= BALL_R) {
      ball.object.position.y = BALL_R;
      if (Math.abs(ball.vel.y) > 0.9) ball.vel.y = -ball.vel.y * 0.34;
      else ball.vel.y = 0;
      ball.vel.x *= Math.pow(0.9, dt * 60);
      ball.vel.z *= Math.pow(0.9, dt * 60);
    }
  }

  rollBall(ball, ball.object.position.clone().sub(prev), dt);
  rememberBallTrail(ball);
  ball.lastPos.copy(prev);

  if (ball.object.position.y <= BALL_R + 0.01 && ball.vel.length() < 0.18)
    ball.flying = false;
  if (
    ball.object.position.z < GOAL_LINE_Z - GOAL_D - 5.5 ||
    Math.abs(ball.object.position.x) > FIELD_W * 0.85 ||
    ball.object.position.y > GOAL_H + 8
  )
    ball.flying = false;
}

function segmentDistanceToBall(
  a: THREE.Vector3,
  b: THREE.Vector3,
  p: THREE.Vector3
) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(
    p.clone().sub(a).dot(ab) / Math.max(0.0001, ab.lengthSq()),
    0,
    1
  );
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

function keeperSaveCheck(keeper: Actor, ball: BallState, dt: number) {
  if (!ball.flying || ball.netCaught) return false;
  if (keeper.diveDelay > 0) {
    keeper.diveDelay = Math.max(0, keeper.diveDelay - dt);
    if (keeper.diveDelay <= 0) keeper.diveTime = KEEPER_DIVE_DURATION;
  }

  const reaction = Math.max(0, 1 - keeper.diveDelay * 5.2);
  const targetStep = THREE.MathUtils.clamp(
    keeper.saveTargetX * 0.55 + keeper.diveDir * 0.72,
    -2.25,
    2.25
  );
  keeper.pos.x = THREE.MathUtils.lerp(
    keeper.pos.x,
    targetStep,
    0.24 * reaction + 0.07
  );
  keeper.pos.z = THREE.MathUtils.lerp(
    keeper.pos.z,
    keeper.saveTargetZ,
    0.11 * reaction + 0.04
  );

  const nearGoal =
    ball.object.position.z < GOAL_LINE_Z + 2.35 &&
    ball.object.position.z > GOAL_LINE_Z - 0.95;
  if (!nearGoal) return false;

  const side =
    keeper.diveDir || (ball.object.position.x < keeper.pos.x ? -1 : 1);
  const heightBlend = THREE.MathUtils.clamp(
    (keeper.saveTargetY - 0.45) / (GOAL_H - 0.2),
    0,
    1
  );
  const bodyCenter = keeper.pos.clone().add(new THREE.Vector3(0, 1.02, 0.03));
  const lowGlove = keeper.pos
    .clone()
    .add(
      new THREE.Vector3(
        side * 1.0,
        Math.max(0.42, keeper.diveHeight - 0.28),
        -0.05
      )
    );
  const leadHand = keeper.pos
    .clone()
    .add(
      new THREE.Vector3(
        side * THREE.MathUtils.lerp(1.25, 2.25, heightBlend),
        keeper.diveHeight + heightBlend * 0.38,
        -0.1
      )
    );
  const topHand = leadHand
    .clone()
    .add(new THREE.Vector3(-side * 0.22, 0.16, 0.03));
  const trailingHand = leadHand
    .clone()
    .add(new THREE.Vector3(-side * 0.44, -0.08, 0.05));
  const bodyReach = 0.58;
  const lowReach = 0.48;
  const handReach =
    keeper.diveDir === 0 ? 0.78 : THREE.MathUtils.lerp(0.72, 0.92, heightBlend);
  const handCorridor = segmentDistanceToBall(
    trailingHand,
    topHand,
    ball.object.position
  );

  if (
    bodyCenter.distanceTo(ball.object.position) < bodyReach ||
    lowGlove.distanceTo(ball.object.position) < lowReach ||
    leadHand.distanceTo(ball.object.position) < handReach ||
    handCorridor < BALL_R + 0.34
  ) {
    const catchable =
      ball.vel.length() < 22 ||
      leadHand.distanceTo(ball.object.position) < handReach * 0.72 ||
      bodyCenter.distanceTo(ball.object.position) < bodyReach * 0.85;
    if (catchable) {
      ball.object.position.copy(leadHand.lerp(ball.object.position, 0.18));
      ball.vel.set(0, 0, 0);
      ball.flying = false;
    } else {
      const push = ball.object.position
        .clone()
        .sub(leadHand)
        .setY(0)
        .normalize();
      if (push.lengthSq() < 0.001) push.set(side, 0, 0.25).normalize();
      ball.vel.set(
        push.x * 6.3,
        Math.max(1.2, ball.vel.y * 0.16 + 1.5),
        Math.max(1.4, Math.abs(ball.vel.z) * 0.24)
      );
      ball.object.position.addScaledVector(push, BALL_R * 1.4);
      ball.shotAge = ball.shotDuration + 0.01;
    }
    return true;
  }
  return false;
}

function wallBlockCheck(wall: Actor[], ball: BallState) {
  if (!ball.flying || ball.netCaught) return false;
  for (const actor of wall) {
    if (!actor.root.visible) continue;
    const chest = actor.pos.clone().setY(actor.jumpTime > 0 ? 1.55 : 1.15);
    if (chest.distanceTo(ball.object.position) < 0.55) {
      ball.flying = false;
      return true;
    }
  }
  return false;
}

function markGoalCrossing(ball: BallState) {
  if (ball.crossedGoalLine || ball.hitFrame) return false;
  const prev = ball.lastPos;
  const curr = ball.object.position;
  const crossed = prev.z > GOAL_LINE_Z && curr.z <= GOAL_LINE_Z;
  if (!crossed) return false;
  const ratio = (prev.z - GOAL_LINE_Z) / Math.max(0.0001, prev.z - curr.z);
  const x = THREE.MathUtils.lerp(prev.x, curr.x, ratio);
  const y = THREE.MathUtils.lerp(prev.y, curr.y, ratio);
  ball.crossedGoalLine =
    Math.abs(x) <= GOAL_W / 2 - BALL_R &&
    y >= BALL_R &&
    y <= GOAL_H - BALL_R * 0.25;
  return ball.crossedGoalLine;
}

function reflectFromGoalFrame(ball: BallState) {
  if (!ball.flying || ball.netCaught || ball.hitFrame) return false;
  const p = ball.object.position;
  if (p.z > GOAL_LINE_Z + 0.22 || p.z < GOAL_LINE_Z - 0.35) return false;
  const radius = BALL_R + POST_R * 1.25;
  const candidates = [
    [
      new THREE.Vector3(-GOAL_W / 2, 0, GOAL_LINE_Z),
      new THREE.Vector3(-GOAL_W / 2, GOAL_H, GOAL_LINE_Z)
    ],
    [
      new THREE.Vector3(GOAL_W / 2, 0, GOAL_LINE_Z),
      new THREE.Vector3(GOAL_W / 2, GOAL_H, GOAL_LINE_Z)
    ],
    [
      new THREE.Vector3(-GOAL_W / 2, GOAL_H, GOAL_LINE_Z),
      new THREE.Vector3(GOAL_W / 2, GOAL_H, GOAL_LINE_Z)
    ]
  ];
  for (const [a, b] of candidates) {
    const ab = b.clone().sub(a);
    const t = THREE.MathUtils.clamp(
      p.clone().sub(a).dot(ab) / Math.max(0.0001, ab.lengthSq()),
      0,
      1
    );
    const closest = a.clone().addScaledVector(ab, t);
    if (closest.distanceTo(p) <= radius) {
      const normal = p.clone().sub(closest).normalize();
      if (normal.lengthSq() < 0.001) normal.set(0, 0, 1);
      ball.object.position
        .copy(closest)
        .addScaledVector(normal, radius + 0.015);
      ball.vel.reflect(normal).multiplyScalar(0.72);
      ball.vel.z = Math.max(ball.vel.z, 1.1);
      ball.hitFrame = true;
      ball.shotAge = ball.shotDuration + 0.01;
      return true;
    }
  }
  return false;
}

function netCatchCheck(ball: BallState, netRig: NetRig) {
  if (!ball.flying || ball.netCaught || !ball.crossedGoalLine) return false;
  const p = ball.object.position;
  const inGoalDepth = p.z <= GOAL_LINE_Z - GOAL_D + 0.2;
  const stillInsideGoal =
    Math.abs(p.x) <= GOAL_W / 2 + 0.35 && p.y <= GOAL_H + 0.32;
  if (inGoalDepth && stillInsideGoal) {
    catchBallInNet(ball, netRig);
    return true;
  }
  return false;
}

function decideShot(
  ball: BallState,
  blocked: boolean,
  saved: boolean
): Decision {
  if (blocked) return 'BLOCKED';
  if (saved) return 'SAVE';
  return ball.crossedGoalLine || ball.netCaught ? 'GOAL' : 'NO GOAL';
}

function catchBallInNet(ball: BallState, netRig: NetRig) {
  ball.netCaught = true;
  ball.netAge = 0;
  ball.flying = true;
  ball.netVel.copy(ball.vel).multiplyScalar(0.12);
  ball.netVel.z = Math.min(ball.netVel.z, -0.45);
  ball.netVel.y *= 0.18;
  triggerNetShake(netRig, ball.object.position.clone());
}

function cameraFrameForShot(kicker: Actor, cameraYaw = 0) {
  const goalLook = new THREE.Vector3(0, 1.34, GOAL_LINE_Z + 0.4);
  const toGoal = goalLook.clone().sub(kicker.pos).setY(0).normalize();
  const baseBehind = kicker.pos
    .clone()
    .addScaledVector(toGoal, -5.9)
    .add(new THREE.Vector3(0, 2.05, 0));
  const offset = baseBehind
    .clone()
    .sub(kicker.pos)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw * 0.45);
  const position = kicker.pos.clone().add(offset);
  const lookPoint = new THREE.Vector3(
    kicker.pos.x * 0.18,
    1.2,
    THREE.MathUtils.lerp(kicker.pos.z, GOAL_LINE_Z + 0.25, 0.72)
  );
  return { position, lookPoint };
}


function cameraFrameForKeeper(keeper: Actor, ball: BallState, cameraYaw = 0) {
  const goalCenter = new THREE.Vector3(0, 1.18, GOAL_LINE_Z + 0.24);
  const incoming = ball.object.position
    .clone()
    .lerp(new THREE.Vector3(0, 1.15, GOAL_LINE_Z + 6.8), 0.32);
  const baseBehindKeeper = new THREE.Vector3(
    0,
    2.05,
    GOAL_LINE_Z - GOAL_D - 2.05
  );
  const sideOffset = new THREE.Vector3(cameraYaw * 0.8, 0, 0);
  return {
    position: baseBehindKeeper.add(sideOffset),
    lookPoint: incoming.lerp(goalCenter, ball.flying ? 0.18 : 0.42)
  };
}

function placeCameraForNextShot(
  camera: THREE.PerspectiveCamera,
  kicker: Actor,
  cameraYaw = 0
) {
  const frame = cameraFrameForShot(kicker, cameraYaw);
  camera.position.copy(frame.position);
  camera.lookAt(frame.lookPoint);
}

export default function FreeKickGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swipeRef = useRef<SwipeState>({
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  });
  const skipReplayRef = useRef(false);
  const shotControlRef = useRef<ShotControlState>({ ...DEFAULT_SHOT_CONTROL });
  const [shotControl, setShotControl] = useState<ShotControlState>({ ...DEFAULT_SHOT_CONTROL });
  const [replaySkippable, setReplaySkippable] = useState(false);
  const [hud, setHud] = useState({
    goals: 0,
    aiGoals: 0,
    userShots: 0,
    aiShots: 0,
    phase: 'userShoot' as ShotPhase,
    spot: 'center' as KickSpot,
    state: 'You shoot first: set power, choose ball contact, then tap KICK',
    feedback: DEFAULT_FEEDBACK
  });
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x07110b, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07110b, 0.025);
    addFloodlightsAndAtmosphere(scene);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 140);
    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const netRig: NetRig = { lines: [], shake: 0, impact: new THREE.Vector3() };
    const particles = createParticleRig(scene);
    const loader = new GLTFLoader();
    const stadium = makeHalfField(scene, netRig, loader);
    const aimLine = makeAimLine(scene);
    hideAimLine(aimLine);
    const ball = makeBall(scene);
    const audio = makeGoalRushAudio();
    const playerCharacterUrls = shuffledCharacterUrls();
    const actorModelUrl = (index: number) =>
      playerCharacterUrls[index % playerCharacterUrls.length] ?? HUMAN_URL;
    const kicker = createActor(
      scene,
      loader,
      'kicker',
      new THREE.Vector3(0, 0, 6),
      0,
      kitForTeam('blue').primary,
      actorModelUrl(0),
      'blue'
    );
    const keeper = createActor(
      scene,
      loader,
      'keeper',
      new THREE.Vector3(0, 0, GOAL_LINE_Z + 0.36),
      0,
      kitForTeam('red').primary,
      actorModelUrl(1),
      'red'
    );
    const wall = Array.from({ length: 5 }, (_, i) =>
      createActor(
        scene,
        loader,
        'wall',
        new THREE.Vector3(0, 0, 0),
        i,
        kitForTeam('red').primary,
        actorModelUrl(i + 2),
        'red'
      )
    );
    const { fieldPlayers, referee } = createAmbientMatchActors(scene, loader, actorModelUrl);
    let spot: KickSpot = 'center';
    let state: ShotState = 'aim';
    let resultTimer = 0;
    let varTimer = 0;
    let replayIndex = 0;
    let replayClock = 0;
    let pendingDecision: Decision = 'NO GOAL';
    let shotBlocked = false;
    let shotSaved = false;
    let shotFinalized = false;
    let netTriggered = false;
    let goalReplayAwarded = false;
    let cameraYaw = 0;
    const replayFrames: ReplayFrame[] = [];
    let match = { phase: 'userShoot' as ShotPhase, userShots: 0, aiShots: 0, userGoals: 0, aiGoals: 0 };
    let aiShotTimer = 0;
    let activeShooter: 'user' | 'ai' = 'user';
    let attemptRecorded = false;
    const syncHudScore = (stateText: string) => {
      setHud((h) => ({
        ...h,
        goals: match.userGoals,
        aiGoals: match.aiGoals,
        userShots: match.userShots,
        aiShots: match.aiShots,
        phase: match.phase,
        state: stateText
      }));
    };
    const configureActorsForPhase = () => {
      if (match.phase === 'aiShoot') {
        applyTeamUniform(kicker, 'red');
        applyTeamUniform(keeper, 'blue');
        wall.forEach((w) => applyTeamUniform(w, 'blue'));
      } else {
        applyTeamUniform(kicker, 'blue');
        applyTeamUniform(keeper, 'red');
        wall.forEach((w) => applyTeamUniform(w, 'red'));
      }
    };
    const recordAttempt = (decision: Decision) => {
      if (attemptRecorded) return;
      attemptRecorded = true;
      const feedback = rateShot(ball, decision, shotBlocked, shotSaved);
      setHud((h) => ({ ...h, feedback }));
      if (activeShooter === 'user') {
        match.userShots += 1;
        if (decision === 'GOAL') match.userGoals += 1;
        if (match.userShots >= 5) match.phase = 'aiShoot';
      } else {
        match.aiShots += 1;
        if (decision === 'GOAL') match.aiGoals += 1;
        if (match.aiShots >= 5) match.phase = 'finished';
      }
    };
    const nextStatusText = () => {
      if (match.phase === 'finished') {
        const verdict = match.userGoals === match.aiGoals ? 'DRAW' : match.userGoals > match.aiGoals ? 'YOU WIN' : 'AI WINS';
        return `${verdict} · ${match.userGoals}-${match.aiGoals} after 5 shots each`;
      }
      if (match.phase === 'aiShoot') return `AI turn ${match.aiShots + 1}/5 · camera is behind the goal, swipe to dive`;
      return `Your shot ${match.userShots + 1}/5 · pull the power slider and release to shoot`;
    };
    spot = randomKickSpot();
    configureActorsForPhase();
    resetShot(ball, kicker, keeper, wall, spot);
    placeCameraForNextShot(camera, kicker, cameraYaw);
    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    const startUserKickFromControls = () => {
      audio.start();
      if (state !== 'aim' || match.phase !== 'userShoot') {
        setHud((h) => ({ ...h, state: 'Wait for your next free kick before shooting' }));
        return;
      }
      const rect = host.getBoundingClientRect();
      const controlSwipe = controlToShotSwipe(
        shotControlRef.current,
        rect.width,
        rect.height
      );
      swipeRef.current = controlSwipe;
      activeShooter = 'user';
      beginRunup(kicker, wall, keeper, ball, controlSwipe);
      hideAimLine(aimLine);
      shotBlocked = false;
      shotSaved = false;
      shotFinalized = false;
      netTriggered = false;
      goalReplayAwarded = false;
      replayFrames.length = 0;
      state = 'runup';
      setHud((h) => ({
        ...h,
        state: `Shot ${match.userShots + 1}/5: controlled run-up · ${Math.round(shotControlRef.current.power * 100)}% power`
      }));
    };
    const previewControlledShot = () => {
      if (state !== 'aim' || match.phase !== 'userShoot') return;
      const rect = host.getBoundingClientRect();
      const previewSwipe = controlToShotSwipe(
        shotControlRef.current,
        rect.width,
        rect.height
      );
      setAimCurve(aimLine, ball.object.position, previewSwipe);
    };
    const onControlsChanged = () => previewControlledShot();
    const onKickRequested = () => startUserKickFromControls();
    window.addEventListener('free-kick-controls-changed', onControlsChanged);
    window.addEventListener('free-kick-kick', onKickRequested);
    const onDown = (e: PointerEvent) => {
      audio.start();
      const rect = host.getBoundingClientRect();
      swipeRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
        mode: state === 'keeperAim' || (state === 'flight' && activeShooter === 'ai') ? 'keeper' : 'camera',
        moved: false,
        viewportW: rect.width,
        viewportH: rect.height
      };
      if (state === 'aim' && match.phase === 'userShoot') previewControlledShot();
    };
    const onMove = (e: PointerEvent) => {
      if (!swipeRef.current.active) return;
      const totalDx = e.clientX - swipeRef.current.startX;
      const totalDy = e.clientY - swipeRef.current.startY;
      const moved = Math.hypot(totalDx, totalDy) > CAMERA_DRAG_DEADZONE;
      if (moved) swipeRef.current.moved = true;
      if (swipeRef.current.mode === 'keeper') {
        swipeRef.current.endX = e.clientX;
        swipeRef.current.endY = e.clientY;
        if (setKeeperDiveFromSwipe(keeper, swipeRef.current))
          setHud((h) => ({ ...h, state: 'Keeper committed — dive tracks your swipe' }));
        return;
      }
      swipeRef.current.mode = 'camera';
      const dx = e.clientX - swipeRef.current.endX;
      cameraYaw = THREE.MathUtils.clamp(
        cameraYaw + dx / 420,
        -CAMERA_YAW_LIMIT,
        CAMERA_YAW_LIMIT
      );
      swipeRef.current.endX = e.clientX;
      swipeRef.current.endY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (!swipeRef.current.active) return;
      if (swipeRef.current.mode === 'keeper') {
        swipeRef.current.endX = e.clientX;
        swipeRef.current.endY = e.clientY;
        setKeeperDiveFromSwipe(keeper, swipeRef.current);
      }
      swipeRef.current.active = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    const recordReplayFrame = (look: THREE.Vector3) => {
      if (replayFrames.length > 220) replayFrames.shift();
      replayFrames.push({
        ball: ball.object.position.clone(),
        quat: ball.object.quaternion.clone(),
        cam: camera.position.clone(),
        look: look.clone(),
        keeper: keeper.root.position.clone(),
        keeperRot: keeper.root.rotation.clone(),
        kicker: kicker.root.position.clone(),
        kickerRot: kicker.root.rotation.clone()
      });
    };
    let last = performance.now();
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      if (
        state === 'aim' &&
        match.phase === 'userShoot' &&
        swipeRef.current.active &&
        swipeRef.current.mode === 'shot'
      )
        setAimCurve(aimLine, ball.object.position, swipeRef.current);
      if (state === 'keeperAim') {
        aiShotTimer -= dt;
        if (aiShotTimer <= 0) {
          activeShooter = 'ai';
          swipeRef.current = randomAiShotSwipe(host.clientWidth, host.clientHeight, ball.object.position, spot);
          kicker.kickTime = 0;
          wall.forEach((w) => (w.jumpTime = 0));
          state = 'aiRunup';
          setHud((h) => ({ ...h, state: `AI ${swipeRef.current.technique ?? 'free kick'} ${match.aiShots + 1}/5 — swipe where to jump` }));
        }
      }
      if (state === 'aim' && match.phase === 'aiShoot') {
        state = 'keeperAim';
        aiShotTimer = 0.85;
        setHud((h) => ({ ...h, state: `You are goalkeeper: swipe left/right/up to dive` }));
      }
      if (state === 'runup' || state === 'aiRunup') {
        const strikeSpot = ball.object.position
          .clone()
          .add(new THREE.Vector3(-0.24, -BALL_R, 0.42))
          .setY(0);
        TMP.copy(strikeSpot).sub(kicker.pos).setY(0);
        if (TMP.length() > 0.055 && kicker.kickTime <= 0) {
          kicker.dir.copy(TMP.clone().normalize());
          kicker.vel.copy(kicker.dir).multiplyScalar(4.05);
          kicker.pos.addScaledVector(kicker.vel, dt);
          kicker.pos.y = GROUND_Y;
          kicker.root.position.y = GROUND_Y;
          kicker.speed = kicker.vel.length();
        } else {
          kicker.speed = 0;
          kicker.dir.copy(
            ball.object.position.clone().sub(kicker.pos).setY(0).normalize()
          );
          if (kicker.kickTime <= 0) {
            kicker.kickTime = KICK_STRIKE_TIME;
            wall.forEach((w) => (w.jumpTime = 0.42));
          }
        }
        if (kicker.kickTime > 0 && kicker.kickTime < 0.34 && !ball.flying) {
          replayFrames.length = 0;
          recordReplayFrame(new THREE.Vector3(0, 1.22, GOAL_LINE_Z + 0.25));
          shootBall(ball, swipeRef.current);
          audio.kick();
          state = 'flight';
          setHud((h) => ({
            ...h,
            state: activeShooter === 'ai' ? 'AI strike — swipe to save!' : 'Grounded right-foot strike · recording replay'
          }));
        }
      } else {
        kicker.speed = 0;
      }
      updateBall(ball, dt);
      updateNetShake(netRig, dt);
      updateParticles(particles, dt);
      if (state === 'flight') {
        if (!shotBlocked && wallBlockCheck(wall, ball)) {
          shotBlocked = true;
          shotFinalized = true;
          pendingDecision = 'BLOCKED';
          audio.save();
          burstParticles(particles, ball.object.position, [0xfacc15, 0xffffff, 0xef4444], 0.72);
          state = 'result';
          resultTimer = 0.38;
          recordAttempt('BLOCKED');
          syncHudScore('BLOCKED · next kick');
        }
        if (!shotFinalized && !shotSaved && keeperSaveCheck(keeper, ball, dt)) {
          shotSaved = true;
          shotFinalized = true;
          pendingDecision = 'SAVE';
          ball.flying = false;
          audio.save();
          burstParticles(particles, ball.object.position, [0x93c5fd, 0xffffff, 0x22c55e], 0.88);
          state = 'result';
          resultTimer = 0.42;
          recordAttempt('SAVE');
          syncHudScore(activeShooter === 'ai' ? 'YOU SAVED IT · next kick' : 'SAVE · next kick');
        }
        if (!shotFinalized && markGoalCrossing(ball))
          setHud((h) => ({
            ...h,
            state: 'Ball crossed line · still travelling'
          }));
        if (
          !shotFinalized &&
          !shotBlocked &&
          !shotSaved &&
          reflectFromGoalFrame(ball)
        ) {
          audio.save();
          burstParticles(particles, ball.object.position, [0xffffff, 0xfacc15, 0x94a3b8], 0.55);
          setHud((h) => ({ ...h, state: 'Off the frame · ball still live' }));
        }
        if (
          !shotFinalized &&
          !netTriggered &&
          !shotBlocked &&
          !shotSaved &&
          netCatchCheck(ball, netRig)
        ) {
          netTriggered = true;
          audio.net();
          burstParticles(particles, ball.object.position, [0x22c55e, 0xffffff, 0xfacc15], 1.12);
          setHud((h) => ({ ...h, state: 'Net contact · checking VAR' }));
        }
        if (!ball.flying && !shotFinalized) {
          shotFinalized = true;
          pendingDecision = decideShot(ball, shotBlocked, shotSaved);
          if (pendingDecision === 'GOAL') {
            varTimer = 1.05;
            state = 'var';
            setHud((h) => ({ ...h, state: 'VAR CHECK: ball crossed line' }));
          } else {
            state = 'result';
            resultTimer = 0.45;
            recordAttempt(pendingDecision);
            syncHudScore(`${pendingDecision} · next kick`);
          }
        }
      }
      if (state === 'var') {
        varTimer -= dt;
        if (varTimer <= 0) {
          state = pendingDecision === 'GOAL' ? 'replay' : 'result';
          replayIndex = 0;
          replayClock = 0;
          skipReplayRef.current = false;
          setReplaySkippable(pendingDecision === 'GOAL');
          setHud((h) => ({
            ...h,
            state:
              pendingDecision === 'GOAL'
                ? `SLOW REPLAY: ${pendingDecision}`
                : `${pendingDecision} · next free kick`
          }));
        }
      }
      if (state === 'replay') {
        if (skipReplayRef.current) replayIndex = replayFrames.length;
        replayClock += dt * REPLAY_SLOWDOWN;
        replayIndex = Math.max(replayIndex, Math.floor(replayClock * 30));
        const frameData =
          replayFrames[Math.min(replayFrames.length - 1, replayIndex)];
        if (frameData) {
          ball.object.position.copy(frameData.ball);
          ball.object.quaternion.copy(frameData.quat);
          keeper.root.position.copy(frameData.keeper);
          keeper.root.rotation.copy(frameData.keeperRot);
          kicker.root.position.copy(frameData.kicker);
          kicker.root.rotation.copy(frameData.kickerRot);
          const orbitPhase = replayIndex * 0.045;
          const dynamicOffset = new THREE.Vector3(
            Math.sin(orbitPhase) * 0.85,
            0.25 + Math.sin(orbitPhase * 0.7) * 0.18,
            Math.cos(orbitPhase) * 0.65
          );
          const replayCam = frameData.cam.clone().lerp(
            frameData.ball
              .clone()
              .add(new THREE.Vector3(0, 1.25, 3.9))
              .add(dynamicOffset),
            0.42
          );
          const replayLook = frameData.look
            .clone()
            .lerp(
              frameData.ball.clone().add(new THREE.Vector3(0, 0.28, 0)),
              0.52
            );
          camera.position.copy(replayCam);
          camera.lookAt(replayLook);
        }
        if (
          replayIndex >= replayFrames.length - 1 ||
          replayFrames.length === 0
        ) {
          state = 'result';
          setReplaySkippable(false);
          resultTimer = pendingDecision === 'GOAL' ? 2.65 : 1.05;
          if (pendingDecision === 'GOAL' && !goalReplayAwarded) {
            goalReplayAwarded = true;
            audio.goal();
            triggerCrowdCheer(stadium);
            burstParticles(particles, ball.object.position, [0x22c55e, 0xfacc15, 0xffffff, 0x60a5fa], 1.35);
            kicker.celebrateTime = 2.45;
            recordAttempt('GOAL');
            syncHudScore(
              skipReplayRef.current
                ? 'Replay skipped · GOAL confirmed'
                : activeShooter === 'ai'
                  ? 'AI GOAL confirmed'
                  : 'VAR: GOAL confirmed'
            );
          } else if (pendingDecision !== 'GOAL') {
            recordAttempt(pendingDecision);
            syncHudScore(`VAR: ${pendingDecision}`);
          }
        }
      }
      if (state === 'result') {
        resultTimer -= dt;
        if (resultTimer <= 0) {
          setReplaySkippable(false);
          skipReplayRef.current = false;
          if (match.phase === 'finished') {
            state = 'result';
            resultTimer = 999;
            syncHudScore(nextStatusText());
            return;
          }
          configureActorsForPhase();
          state = 'aim';
          attemptRecorded = false;
          activeShooter = match.phase === 'aiShoot' ? 'ai' : 'user';
          shotBlocked = false;
          shotSaved = false;
          shotFinalized = false;
          netTriggered = false;
          goalReplayAwarded = false;
          replayFrames.length = 0;
          spot = randomKickSpot(spot);
          cameraYaw = 0;
          resetShot(ball, kicker, keeper, wall, spot);
          placeCameraForNextShot(camera, kicker, cameraYaw);
          syncHudScore(nextStatusText());
        }
      }
      if (state !== 'replay') {
        updateActorBase(kicker, dt);
        applyKickerPose(kicker);
        applyGoalDancePose(kicker);
        updateActorBase(keeper, dt);
        applyKeeperPose(keeper);
        wall.forEach((w) => {
          updateActorBase(w, dt);
          applyWallPose(w);
          if (w.jumpTime > 0) w.jumpTime = Math.max(0, w.jumpTime - dt);
        });
        updateAmbientMatchActors(fieldPlayers, referee, dt, stadium.cheerTime);
        if (kicker.kickTime > 0)
          kicker.kickTime = Math.max(0, kicker.kickTime - dt);
        if (keeper.diveTime > 0)
          keeper.diveTime = Math.max(0, keeper.diveTime - dt);
        if (kicker.celebrateTime > 0)
          kicker.celebrateTime = Math.max(0, kicker.celebrateTime - dt);
        updateStadiumCrowd(stadium, dt);
      }
      let lookPoint = new THREE.Vector3(0, 1.22, GOAL_LINE_Z + 0.25);
      if (state !== 'replay') {
        if (match.phase === 'aiShoot' && (state === 'aim' || state === 'aiRunup' || state === 'flight' || state === 'var')) {
          const keeperFrame = cameraFrameForKeeper(keeper, ball, cameraYaw);
          lookPoint.copy(keeperFrame.lookPoint);
          camera.position.lerp(keeperFrame.position, ball.flying ? 0.18 : 0.14);
          camera.lookAt(lookPoint);
        } else if (ball.flying || state === 'var') {
          const toGoal = new THREE.Vector3(0, 0, GOAL_LINE_Z)
            .sub(ball.object.position)
            .setY(0)
            .normalize();
          const followOffset = toGoal
            .clone()
            .multiplyScalar(-4.3)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw * 0.55);
          const followPos = ball.object.position
            .clone()
            .add(followOffset)
            .add(new THREE.Vector3(0, 1.55, 0));
          camera.position.lerp(followPos, 0.11);
          lookPoint = ball.object.position
            .clone()
            .addScaledVector(toGoal, 6.0)
            .add(new THREE.Vector3(0, 0.55, 0));
          camera.lookAt(lookPoint);
        } else {
          const shotFrame = cameraFrameForShot(kicker, cameraYaw);
          lookPoint.copy(shotFrame.lookPoint);
          camera.position.lerp(shotFrame.position, 0.18);
          camera.lookAt(lookPoint);
        }
        if (state === 'flight' || state === 'var') recordReplayFrame(lookPoint);
      }
      renderer.render(scene, camera);
    };
    loop();
    (window as any).__setFreeKickSpot = (next: KickSpot) => {
      audio.whistle();
      spot = next;
      state = 'aim';
      hideAimLine(aimLine);
      replayFrames.length = 0;
      resetShot(ball, kicker, keeper, wall, spot);
      placeCameraForNextShot(camera, kicker, cameraYaw);
      setHud((h) => ({
        ...h,
        spot,
        state: `Free kick ${next}: wall ${wallCountForSpot(next)} at 9.15m`
      }));
    };
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('free-kick-controls-changed', onControlsChanged);
      window.removeEventListener('free-kick-kick', onKickRequested);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      audio.dispose();
      renderer.dispose();
    };
  }, []);


  const updateShotControl = (patch: Partial<ShotControlState>) => {
    setShotControl((current) => {
      const next = { ...current, ...patch };
      shotControlRef.current = next;
      window.dispatchEvent(new Event('free-kick-controls-changed'));
      return next;
    });
  };
  const requestControlledKick = () => {
    window.dispatchEvent(new Event('free-kick-kick'));
  };
  const shotAimPercentX = `${(shotControl.aimX + 1) * 50}%`;
  const shotAimPercentY = `${(1 - (shotControl.aimY + 1) * 0.5) * 100}%`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#07110b',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none'
      }}
    >
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas
          ref={canvasRef}
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
          left: 0,
          right: 0,
          top: 0,
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          color: 'white',
          fontFamily: 'system-ui,sans-serif',
          textShadow: '0 2px 8px #000'
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          YOU {hud.goals}/{hud.userShots} · AI {hud.aiGoals}/{hud.aiShots}
        </div>
        <div
          style={{
            fontSize: 11,
            maxWidth: 220,
            textAlign: 'right',
            lineHeight: 1.25
          }}
        >
          {hud.state}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 14,
          top: 54,
          color: 'white',
          fontFamily: 'system-ui,sans-serif',
          fontSize: 11,
          lineHeight: 1.3,
          maxWidth: 300,
          pointerEvents: 'none',
          textShadow: '0 2px 8px #000'
        }}
      >
        User takes 5 shots first, then AI takes 5. Pull the power slider upward and release to shoot; set foot contact on the ball under the slider. During AI shots, the camera sits behind the goal and swipes dive the keeper in the same screen direction.
      </div>

      <div
        style={{
          position: 'fixed',
          left: 14,
          right: 86,
          bottom: 18,
          maxWidth: 430,
          padding: '12px 14px',
          color: 'white',
          fontFamily: 'system-ui,sans-serif',
          pointerEvents: 'none',
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(2,6,23,.74), rgba(15,23,42,.46))',
          border: '1px solid rgba(255,255,255,.18)',
          boxShadow: '0 18px 44px rgba(0,0,0,.38)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.02em' }}>{hud.feedback.title}</div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#fde68a' }}>xG {hud.feedback.xg.toFixed(2)}</div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.28, color: 'rgba(255,255,255,.86)' }}>
          {hud.feedback.detail}
        </div>
        <div style={{ marginTop: 9, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.round(hud.feedback.quality * 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #ef4444, #facc15, #22c55e)',
              boxShadow: '0 0 16px rgba(250,204,21,.62)'
            }}
          />
        </div>
      </div>

      {hud.phase === 'userShoot' && (
        <>
          <div
            aria-label="Shot power slider"
            style={{
              position: 'fixed',
              right: 4,
              top: '12%',
              bottom: '46%',
              width: 64,
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto'
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: 7,
                top: 0,
                bottom: 0,
                width: 38,
                borderRadius: 999,
                background: 'linear-gradient(180deg, rgba(239,68,68,.92), rgba(250,204,21,.92), rgba(34,197,94,.92))',
                border: '1px solid rgba(255,255,255,.58)',
                boxShadow: '0 12px 30px rgba(0,0,0,.5)'
              }}
            />
            <input
              aria-label="Power"
              type="range"
              min={20}
              max={100}
              value={Math.round(shotControl.power * 100)}
              onChange={(event) =>
                updateShotControl({ power: Number(event.currentTarget.value) / 100 })
              }
              onPointerUp={requestControlledKick}
              onKeyUp={(event) => {
                if (event.key === 'Enter' || event.key === ' ') requestControlledKick();
              }}
              style={{
                width: '38vh',
                maxWidth: 360,
                transform: 'rotate(-90deg)',
                accentColor: '#facc15',
                filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.55))'
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 8,
                bottom: -28,
                color: 'white',
                fontFamily: 'system-ui,sans-serif',
                fontSize: 12,
                fontWeight: 900,
                textShadow: '0 2px 8px #000'
              }}
            >
              {Math.round(shotControl.power * 100)}%
            </div>
          </div>

          <div
            style={{
              position: 'fixed',
              right: 10,
              top: '56%',
              zIndex: 4,
              width: 138,
              color: 'white',
              fontFamily: 'system-ui,sans-serif',
              textShadow: '0 2px 8px #000',
              pointerEvents: 'auto'
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                marginBottom: 6,
                textAlign: 'center'
              }}
            >
              BALL + SHOE
            </div>
            <div
              role="slider"
              aria-label="Ball contact spin controller"
              aria-valuetext={`x ${shotControl.aimX.toFixed(2)}, y ${shotControl.aimY.toFixed(2)}`}
              onPointerDown={(event) => {
                const target = event.currentTarget;
                target.setPointerCapture(event.pointerId);
                const rect = target.getBoundingClientRect();
                const updateFromPointer = (clientX: number, clientY: number) => {
                  updateShotControl({
                    aimX: THREE.MathUtils.clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
                    aimY: THREE.MathUtils.clamp(1 - ((clientY - rect.top) / rect.height) * 2, -1, 1)
                  });
                };
                updateFromPointer(event.clientX, event.clientY);
                const move = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX, moveEvent.clientY);
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
              style={{
                position: 'relative',
                width: 112,
                height: 112,
                margin: '0 auto',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 50% 50%, #f8fafc 0 38%, transparent 39%), conic-gradient(from 18deg, #111827 0 12%, #f8fafc 12% 24%, #111827 24% 36%, #f8fafc 36% 48%, #111827 48% 60%, #f8fafc 60% 72%, #111827 72% 84%, #f8fafc 84% 100%)',
                border: '3px solid rgba(255,255,255,.9)',
                boxShadow: '0 14px 28px rgba(0,0,0,.48), inset 0 0 18px rgba(0,0,0,.28)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: shotAimPercentX,
                  top: shotAimPercentY,
                  transform: 'translate(-50%, -50%)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#facc15',
                  border: '3px solid #111827',
                  boxShadow: '0 0 0 2px rgba(255,255,255,.85)'
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: -26,
                  bottom: -5,
                  fontSize: 44,
                  transform: `rotate(${shotControl.aimX * 20 - shotControl.aimY * 10}deg)`,
                  filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.5))'
                }}
              >
                🦶
              </div>
            </div>
          </div>
        </>
      )}
      {replaySkippable && (
        <button
          aria-label="Skip goal replay"
          onClick={() => {
            skipReplayRef.current = true;
            setReplaySkippable(false);
          }}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 92,
            width: 52,
            height: 52,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,.72)',
            background: 'rgba(15,23,42,.74)',
            color: 'white',
            fontSize: 24,
            fontWeight: 900,
            boxShadow: '0 10px 24px rgba(0,0,0,.42)',
            zIndex: 5
          }}
        >
          ⏭
        </button>
      )}
    </div>
  );
}
