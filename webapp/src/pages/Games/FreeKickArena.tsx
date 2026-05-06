'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MURLAN_CHARACTER_THEMES } from '../../config/murlanCharacterThemes.js';

type AnimName = 'Idle' | 'Walk' | 'Run';
type ShotState = 'aim' | 'runup' | 'flight' | 'var' | 'replay' | 'result';
type KickSpot = 'left' | 'center' | 'right' | 'near16';
type ActorKind = 'kicker' | 'keeper' | 'wall';
type Decision = 'GOAL' | 'NO GOAL' | 'SAVE' | 'BLOCKED' | 'MISS';

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
};

type SwipeState = {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  mode?: 'shot' | 'camera';
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
const CAMERA_YAW_STEP = 0.22;
const CAMERA_YAW_LIMIT = 0.7;
const CAMERA_HEIGHT_LIMIT = 0.72;
const SPECTATOR_ROWS_FILLED = 5;
const SPECTATORS_PER_ROW_TARGET = 18;
const SPECTATOR_SCALE = 0.66;
const SPECTATOR_FALLBACK_SCALE = 0.74;
const SPECTATOR_SEAT_Y = 0.17;
const SPECTATOR_SEAT_Z = 0.14;
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
const KEEPER_SAVE_CHANCE = 0.56;
const KEEPER_WRONG_READ_CHANCE = 0.26;
const KEEPER_LATERAL_RESPONSE = 0.12;
const KEEPER_BODY_REACH = 0.52;
const KEEPER_GLOVE_REACH = 1.05;
const KEEPER_SECOND_GLOVE_REACH = 0.76;
const KEEPER_HIGH_GLOVE_REACH = BALL_R + 0.24;
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

function tintModel(
  model: THREE.Object3D,
  kind: ActorKind,
  index = 0,
  kitColor?: number
) {
  const color =
    kind === 'keeper'
      ? new THREE.Color(0x111111)
      : new THREE.Color(kitColor ?? (kind === 'kicker' ? 0x1d69ff : 0xfacc15));
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (m.color) {
        m.color.lerp(color, 0.36);
        if (kind === 'wall')
          m.color.lerp(new THREE.Color(index % 2 ? 0x174ea6 : 0xfacc15), 0.18);
      }
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind, index = 0, kitColor?: number) {
  const group = new THREE.Group();
  const kit =
    kind === 'keeper'
      ? 0x111111
      : (kitColor ?? (kind === 'kicker' ? 0x1d69ff : 0xfacc15));
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.72, 8, 14),
    material(kit)
  );
  torso.name = 'torso';
  torso.position.y = 1.05;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.02),
    material(kind === 'wall' ? 0x174ea6 : 0xffffff)
  );
  stripe.name = 'stripe';
  stripe.position.set(0, 1.25, -0.16);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 18, 12),
    material(0xf1d6bd)
  );
  head.name = 'head';
  head.position.y = 1.62;
  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.64, 6, 10),
    material(0x202020)
  );
  leftLeg.name = 'leftLeg';
  const rightLeg = leftLeg.clone();
  rightLeg.name = 'rightLeg';
  leftLeg.position.set(-0.09, 0.42, 0);
  rightLeg.position.set(0.09, 0.42, 0);
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, 0.52, 6, 10),
    material(0xdddddd)
  );
  leftArm.name = 'leftArm';
  const rightArm = leftArm.clone();
  rightArm.name = 'rightArm';
  leftArm.position.set(-0.25, 1.05, 0.01);
  rightArm.position.set(0.25, 1.05, 0.01);
  group.add(
    shadow(torso),
    shadow(stripe),
    shadow(head),
    shadow(leftLeg),
    shadow(rightLeg),
    shadow(leftArm),
    shadow(rightArm)
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
  modelUrl = HUMAN_URL
): Actor {
  const root = new THREE.Group();
  root.position.copy(pos).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(kind, index, kitColor);
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
    saveTargetY: 1.15,
    wallIndex: index,
    loaded: false,
    celebrateTime: 0
  };

  loader.setCrossOrigin('anonymous').load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model, kind === 'keeper' ? 1.9 : PLAYER_H);
      tintModel(model, kind, index, kitColor);
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
        normalizeHuman(model, kind === 'keeper' ? 1.9 : PLAYER_H);
        tintModel(model, kind, index, kitColor);
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
    actor.kind === 'kicker' && actor.kickTime > 0
      ? 'Idle'
      : actor.speed > 2.45
        ? 'Run'
        : actor.speed > 0.08
          ? 'Walk'
          : 'Idle';
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

function groundActorToPitch(actor: Actor) {
  if (!actor.root.visible) return;
  actor.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(actor.root);
  if (bounds.isEmpty()) return;
  const correction = GROUND_Y - bounds.min.y;
  if (Number.isFinite(correction) && Math.abs(correction) > 0.001)
    actor.root.position.y += correction;
}

function applyKickerPose(kicker: Actor) {
  if (kicker.kickTime <= 0) return;

  const t = 1 - kicker.kickTime / 0.72;
  const plant = THREE.MathUtils.smoothstep(t, 0.12, 0.32);
  const backswing =
    Math.sin(THREE.MathUtils.clamp((t - 0.12) / 0.28, 0, 1) * Math.PI) * 0.62;
  const strike =
    Math.sin(THREE.MathUtils.clamp((t - 0.36) / 0.28, 0, 1) * Math.PI) * 2.18;
  const follow =
    Math.sin(THREE.MathUtils.clamp((t - 0.58) / 0.4, 0, 1) * Math.PI) * 0.72;
  const chestBalance = Math.sin(
    THREE.MathUtils.clamp((t - 0.2) / 0.55, 0, 1) * Math.PI
  );

  const plantUpLeg = kicker.bones.leftUpLeg;
  const plantLowLeg = kicker.bones.leftLeg;
  const plantFoot = kicker.bones.leftFoot;
  const shootUpLeg = kicker.bones.rightUpLeg;
  const shootLowLeg = kicker.bones.rightLeg;
  const shootFoot = kicker.bones.rightFoot;

  // Keep the shooter visually grounded: no body hop, the left leg stays planted,
  // and only the right kicking leg/foot lift forward through contact.
  kicker.root.position.y = GROUND_Y;
  if (kicker.bones.hips) {
    kicker.bones.hips.rotation.x += -0.025 * strike + 0.035 * plant;
    kicker.bones.hips.rotation.z += -0.035 * chestBalance;
  }
  if (kicker.bones.spine) {
    kicker.bones.spine.rotation.x += -0.025 * strike + 0.025 * chestBalance;
    kicker.bones.spine.rotation.y += 0.045 * chestBalance;
    kicker.bones.spine.rotation.z += 0.025 * chestBalance;
  }
  if (kicker.bones.leftArm)
    kicker.bones.leftArm.rotation.z += -0.2 * chestBalance - 0.08 * plant;
  if (kicker.bones.rightArm)
    kicker.bones.rightArm.rotation.z += 0.18 * chestBalance + 0.06 * plant;
  if (plantUpLeg) plantUpLeg.rotation.x += 0.08 * plant;
  if (plantLowLeg) plantLowLeg.rotation.x += -0.035 * plant;
  if (plantFoot) plantFoot.rotation.x += 0.04 * plant;
  if (shootUpLeg) shootUpLeg.rotation.x += -backswing + strike + follow;
  if (shootLowLeg) shootLowLeg.rotation.x += backswing * 0.5 - strike * 0.78;
  if (shootFoot) shootFoot.rotation.x += -strike * 0.68 - follow * 0.22;

  groundActorToPitch(kicker);
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
  const side = keeper.diveDir || 0;
  if (keeper.diveTime <= 0) {
    if (keeper.bones.spine)
      keeper.bones.spine.rotation.x += THREE.MathUtils.degToRad(5);
    if (keeper.bones.hips)
      keeper.bones.hips.rotation.x += THREE.MathUtils.degToRad(-4);
    if (keeper.bones.leftArm) {
      keeper.bones.leftArm.rotation.x += THREE.MathUtils.degToRad(-28);
      keeper.bones.leftArm.rotation.z += THREE.MathUtils.degToRad(-16);
    }
    if (keeper.bones.rightArm) {
      keeper.bones.rightArm.rotation.x += THREE.MathUtils.degToRad(-28);
      keeper.bones.rightArm.rotation.z += THREE.MathUtils.degToRad(16);
    }
    if (keeper.bones.leftUpLeg)
      keeper.bones.leftUpLeg.rotation.x += THREE.MathUtils.degToRad(-10);
    if (keeper.bones.rightUpLeg)
      keeper.bones.rightUpLeg.rotation.x += THREE.MathUtils.degToRad(-10);
    return;
  }

  // Built from goalkeeper technique references: set stance, weight forward, first step
  // toward the ball, hands leading, then catch/parry with extended gloves.
  const t = 1 - keeper.diveTime / 0.95;
  const load = Math.sin(THREE.MathUtils.clamp(t / 0.22, 0, 1) * Math.PI);
  const spring = THREE.MathUtils.smoothstep(t, 0.12, 0.58);
  const recover = THREE.MathUtils.smoothstep(t, 0.82, 1);
  const a = spring * (1 - recover);
  const high = THREE.MathUtils.clamp((keeper.diveHeight - 0.7) / 1.15, 0, 1);
  const low = 1 - high;
  keeper.root.rotation.z = -side * THREE.MathUtils.lerp(1.02, 1.48, high) * a;
  keeper.root.rotation.x =
    -0.18 * load - THREE.MathUtils.lerp(0.28, 0.14, high) * a;
  keeper.root.position.x += side * THREE.MathUtils.lerp(2.05, 2.95, high) * a;
  keeper.root.position.y +=
    (0.1 * load + keeper.diveHeight * 0.68 * Math.sin(t * Math.PI)) *
    (1 - recover);

  if (keeper.bones.spine) {
    keeper.bones.spine.rotation.x += -0.12 * load + 0.18 * a;
    keeper.bones.spine.rotation.z += -side * 0.28 * a;
  }
  if (keeper.bones.hips) keeper.bones.hips.rotation.z += side * 0.18 * a;
  if (keeper.bones.leftUpLeg)
    keeper.bones.leftUpLeg.rotation.x +=
      -0.22 * load + (side > 0 ? -0.1 : 0.22) * a;
  if (keeper.bones.rightUpLeg)
    keeper.bones.rightUpLeg.rotation.x +=
      -0.22 * load + (side < 0 ? -0.1 : 0.22) * a;
  if (keeper.bones.leftLeg)
    keeper.bones.leftLeg.rotation.x += 0.24 * load + low * 0.18 * a;
  if (keeper.bones.rightLeg)
    keeper.bones.rightLeg.rotation.x += 0.24 * load + low * 0.18 * a;

  const leadLeft = side <= 0;
  const reachX = THREE.MathUtils.degToRad(-118 - high * 22);
  const reachZ = THREE.MathUtils.degToRad(leadLeft ? -72 : 72);
  if (keeper.bones.leftArm) {
    keeper.bones.leftArm.rotation.x += reachX * a - 0.42 * load;
    keeper.bones.leftArm.rotation.z +=
      (leadLeft ? reachZ : reachZ * 0.58) * a - 0.2 * load;
  }
  if (keeper.bones.rightArm) {
    keeper.bones.rightArm.rotation.x += reachX * a - 0.42 * load;
    keeper.bones.rightArm.rotation.z +=
      (leadLeft ? reachZ * 0.58 : reachZ) * a + 0.2 * load;
  }
}

function createSeatedFallbackSpectator(color: number) {
  const group = new THREE.Group();
  group.name = 'murlan-seated-fallback';
  group.scale.setScalar(SPECTATOR_FALLBACK_SCALE);
  group.position.set(0, SPECTATOR_SEAT_Y, SPECTATOR_SEAT_Z);

  const shirt = material(color, 0.72, 0.02);
  const skin = material(0xf1d6bd, 0.7, 0.02);
  const dark = material(0x171717, 0.68, 0.03);
  const sleeve = material(0xe5e7eb, 0.68, 0.02);
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
  const rightArm = leftArm.clone();
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
  group.add(
    shadow(torso),
    shadow(head),
    shadow(leftThigh),
    shadow(rightThigh),
    shadow(leftCalf),
    shadow(rightCalf),
    shadow(leftArm),
    shadow(rightArm)
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
  kitColor: number
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

  const fallback = createSeatedFallbackSpectator(kitColor);
  const spectator: SeatedSpectator = {
    root,
    fallback,
    instance: null,
    bones: {},
    base: {},
    wallIndex: index
  };
  chair.add(root, fallback);

  const modelUrl =
    characterTheme?.modelUrls?.[0] ?? characterTheme?.url ?? HUMAN_URL;
  loadSeatedCharacterTemplate(loader, modelUrl)
    .then((template) => {
      const instance = cloneSkeleton(template);
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
          if (matRef?.map) matRef.map.colorSpace = THREE.SRGBColorSpace;
          if (matRef) matRef.needsUpdate = true;
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
      fallback.visible = true;
    });

  return spectator;
}

function applySeatedSpectatorPose(spectator: SeatedSpectator, cheerTime = 0) {
  const cheer = cheerTime > 0;
  const phase = performance.now() * 0.006 + spectator.wallIndex * 0.73;
  const wave = Math.sin(phase) * (cheer ? 1 : 0.25);
  const stand = cheer ? THREE.MathUtils.smoothstep(cheerTime, 0.35, 1.1) : 0;
  const bounce = Math.abs(wave) * (cheer ? 0.035 : 0.015);
  spectator.root.position.y = SPECTATOR_SEAT_Y + stand * 0.42 + bounce;
  spectator.fallback.position.y = SPECTATOR_SEAT_Y + stand * 0.42 + bounce;
  spectator.root.rotation.x = (1 - stand) * 0.02;
  spectator.fallback.rotation.x = -stand * 0.08;

  const setBone = (
    key: keyof SeatedSpectator['bones'],
    x = 0,
    y = 0,
    z = 0
  ) => {
    const bone = spectator.bones[key];
    const base = spectator.base[key];
    if (!bone || !base) return;
    bone.rotation.set(base.x + x, base.y + y, base.z + z);
  };

  const armLift = stand * THREE.MathUtils.degToRad(-128);
  const armSpread = stand * THREE.MathUtils.degToRad(24);
  const foreWave = stand * Math.sin(phase * 2.6) * 0.42;
  setBone('leftUpperArm', armLift, 0, -Math.abs(wave) * 0.28 - armSpread);
  setBone('rightUpperArm', armLift, 0, Math.abs(wave) * 0.28 + armSpread);
  setBone('leftForeArm', stand * THREE.MathUtils.degToRad(-32), 0, foreWave);
  setBone('rightForeArm', stand * THREE.MathUtils.degToRad(-32), 0, -foreWave);
  setBone('leftHand', 0, 0, foreWave * 0.5);
  setBone('rightHand', 0, 0, -foreWave * 0.5);
  setBone('spine', stand * THREE.MathUtils.degToRad(10), 0, wave * 0.045);
  setBone('hips', stand * THREE.MathUtils.degToRad(8), 0, 0);
  setBone('leftThigh', stand * THREE.MathUtils.degToRad(82), 0, 0);
  setBone('rightThigh', stand * THREE.MathUtils.degToRad(82), 0, 0);
  setBone('leftCalf', stand * THREE.MathUtils.degToRad(74), 0, 0);
  setBone('rightCalf', stand * THREE.MathUtils.degToRad(74), 0, 0);
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
  stadium.cheerTime = 3.8;
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
    hitFrame: false
  };
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
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 0.82, 0.08),
      material(boardColors[i], 0.5, 0.02)
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
        const kit =
          MURLAN_CHARACTER_COLORS[
            characterIndex % MURLAN_CHARACTER_COLORS.length
          ];
        const characterTheme = MURLAN_CHARACTER_THEMES[
          characterIndex % Math.max(1, MURLAN_CHARACTER_THEMES.length)
        ] ?? { url: HUMAN_URL, scale: 1 };
        spectators.push(
          attachMurlanSeatedSpectator(
            chair,
            loader,
            characterTheme,
            characterIndex,
            kit
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
  const grassA = material(0x1d7d39, 0.95, 0);
  const grassB = material(0x16692e, 0.95, 0);
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
  const targetX = THREE.MathUtils.clamp(
    dx / 50,
    -GOAL_W / 2 + 0.2,
    GOAL_W / 2 - 0.2
  );
  const targetY = THREE.MathUtils.clamp(0.45 + dy / 115, 0.22, GOAL_H + 1.3);
  const onFrame =
    Math.abs(targetX) > GOAL_W / 2 - 0.34 || targetY > GOAL_H - 0.08;
  const inMouth =
    Math.abs(targetX) <= GOAL_W / 2 - BALL_R * 1.4 &&
    targetY >= BALL_R &&
    targetY <= GOAL_H - BALL_R * 0.3;
  const targetDepth =
    inMouth && !onFrame ? GOAL_LINE_Z - GOAL_D + 0.32 : GOAL_LINE_Z - 0.12;
  const target = new THREE.Vector3(targetX, targetY, targetDepth);
  const curve = THREE.MathUtils.clamp(dx / 80, -6.0, 6.0);
  const lift = THREE.MathUtils.clamp(dy / 90, 0.35, GOAL_H + 2.4);
  const power = THREE.MathUtils.clamp(Math.hypot(dx, dy) / 150, 0.48, 1.72);
  const distance = ballPos.distanceTo(target);
  const duration = THREE.MathUtils.clamp(
    distance / (18.7 + power * 10.4),
    0.72,
    1.34
  );
  return { target, curve, lift, power, duration };
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
  kicker.pos.copy(runupStart);
  kicker.dir.copy(ballPos.clone().sub(kicker.pos).setY(0).normalize());
  kicker.vel.set(0, 0, 0);
  kicker.speed = 0;
  kicker.kickTime = 0;

  keeper.pos.set(0, 0, GOAL_LINE_Z + 0.36);
  keeper.dir.set(0, 0, 1);
  keeper.vel.set(0, 0, 0);
  keeper.speed = 0;
  keeper.diveTime = 0;
  keeper.diveDelay = 0;
  keeper.diveDir = 0;
  keeper.diveHeight = 1.15;
  keeper.saveTargetX = 0;
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
  wall.forEach((w) => (w.jumpTime = 0.42));

  const { goalLine } = predictShotResult(ball.object.position, swipe);
  keeper.saveTargetX = THREE.MathUtils.clamp(
    goalLine.x,
    -GOAL_W / 2 + 0.28,
    GOAL_W / 2 - 0.28
  );
  keeper.saveTargetY = THREE.MathUtils.clamp(goalLine.y, 0.35, GOAL_H + 0.15);

  const targetSide =
    keeper.saveTargetX < -0.28 ? -1 : keeper.saveTargetX > 0.28 ? 1 : 0;
  const quality = Math.random();
  const forcedError = quality > KEEPER_SAVE_CHANCE;
  const wrongRead = quality < KEEPER_WRONG_READ_CHANCE;
  keeper.diveDir = forcedError
    ? 0
    : wrongRead
      ? -targetSide || (Math.random() > 0.5 ? 1 : -1)
      : targetSide;
  keeper.diveHeight = forcedError
    ? 1.05
    : keeper.saveTargetY < 0.8
      ? 0.56
      : keeper.saveTargetY > 1.7
        ? 1.58
        : 1.08;
  keeper.diveDelay = forcedError ? 0.24 : quality > 0.42 ? 0.12 : 0.18;
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
  ball.spin.set(shot.curve * 0.2, shot.curve * 22.0, -shot.curve * 12.0);
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
    if (keeper.diveDelay <= 0) keeper.diveTime = 0.95;
  }

  const reaction = Math.max(0, 1 - keeper.diveDelay * 4.1);
  const targetStep = THREE.MathUtils.clamp(
    keeper.saveTargetX * 0.42 + keeper.diveDir * 0.62,
    -1.42,
    1.42
  );
  keeper.pos.x = THREE.MathUtils.lerp(
    keeper.pos.x,
    targetStep,
    KEEPER_LATERAL_RESPONSE * reaction + 0.035
  );

  const nearGoal =
    ball.object.position.z < GOAL_LINE_Z + 1.85 &&
    ball.object.position.z > GOAL_LINE_Z - 0.75;
  if (!nearGoal) return false;

  const side =
    keeper.diveDir || (ball.object.position.x < keeper.pos.x ? -1 : 1);
  const bodyCenter = keeper.pos.clone().add(new THREE.Vector3(0, 1.05, 0));
  const gloveCenter = keeper.pos
    .clone()
    .add(new THREE.Vector3(side * 1.34, keeper.diveHeight, -0.04));
  const secondGlove = keeper.pos
    .clone()
    .add(
      new THREE.Vector3(
        side * 0.98,
        THREE.MathUtils.lerp(0.72, keeper.diveHeight + 0.14, 0.62),
        -0.02
      )
    );
  const highGlove = keeper.pos
    .clone()
    .add(new THREE.Vector3(side * 1.66, keeper.diveHeight + 0.18, -0.04));
  const bodyReach = KEEPER_BODY_REACH;
  const gloveReach =
    keeper.diveDir === 0 ? KEEPER_GLOVE_REACH * 0.58 : KEEPER_GLOVE_REACH;

  if (
    bodyCenter.distanceTo(ball.object.position) < bodyReach ||
    gloveCenter.distanceTo(ball.object.position) < gloveReach ||
    secondGlove.distanceTo(ball.object.position) < KEEPER_SECOND_GLOVE_REACH ||
    segmentDistanceToBall(gloveCenter, highGlove, ball.object.position) <
      KEEPER_HIGH_GLOVE_REACH
  ) {
    const push = ball.object.position
      .clone()
      .sub(gloveCenter)
      .setY(0)
      .normalize();
    if (push.lengthSq() < 0.001)
      push
        .set(keeper.diveDir || (ball.object.position.x < 0 ? -1 : 1), 0, 0.25)
        .normalize();
    ball.vel.set(
      push.x * 5.6,
      Math.max(1.25, ball.vel.y * 0.18 + 1.7),
      Math.max(1.35, Math.abs(ball.vel.z) * 0.24)
    );
    ball.object.position.addScaledVector(push, BALL_R * 1.2);
    ball.shotAge = ball.shotDuration + 0.01;
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

function randomKickSpot(): KickSpot {
  const spots: KickSpot[] = ['left', 'center', 'right', 'near16'];
  return spots[Math.floor(Math.random() * spots.length)];
}

function placeCameraForNextShot(
  camera: THREE.PerspectiveCamera,
  kicker: Actor,
  cameraYaw = 0,
  cameraHeight = 0
) {
  const lookPoint = new THREE.Vector3(
    0,
    1.22 + cameraHeight * 0.35,
    GOAL_LINE_Z + 0.25
  );
  const behindOffset = new THREE.Vector3(
    kicker.pos.x * 0.45,
    0,
    kicker.pos.z + 2.85
  )
    .sub(new THREE.Vector3(lookPoint.x, 0, lookPoint.z))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  camera.position.set(
    lookPoint.x + behindOffset.x,
    1.22 + cameraHeight,
    lookPoint.z + behindOffset.z
  );
  camera.lookAt(lookPoint);
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
  const [hud, setHud] = useState({
    goals: 0,
    saves: 0,
    spot: 'center' as KickSpot,
    state: 'Swipe to aim and shoot'
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
    scene.fog = new THREE.Fog(0x07110b, 18, 58);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 140);
    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const netRig: NetRig = { lines: [], shake: 0, impact: new THREE.Vector3() };
    const loader = new GLTFLoader();
    const stadium = makeHalfField(scene, netRig, loader);
    const aimLine = makeAimLine(scene);
    hideAimLine(aimLine);
    const ball = makeBall(scene);
    const audio = makeGoalRushAudio();
    const characterColors = shuffledCharacterColors();
    const characterUrls = shuffledCharacterUrls();
    const actorKitColor = (index: number) =>
      characterColors[index % characterColors.length];
    const actorModelUrl = (index: number) =>
      characterUrls[index % characterUrls.length] ?? HUMAN_URL;
    const kicker = createActor(
      scene,
      loader,
      'kicker',
      new THREE.Vector3(0, 0, 6),
      0,
      actorKitColor(0),
      actorModelUrl(0)
    );
    const keeper = createActor(
      scene,
      loader,
      'keeper',
      new THREE.Vector3(0, 0, GOAL_LINE_Z + 0.36),
      0,
      actorKitColor(1),
      actorModelUrl(1)
    );
    const wall = Array.from({ length: 5 }, (_, i) =>
      createActor(
        scene,
        loader,
        'wall',
        new THREE.Vector3(0, 0, 0),
        i,
        actorKitColor(i + 2),
        actorModelUrl(i + 2)
      )
    );
    let spot: KickSpot = randomKickSpot();
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
    let strikeCommitted = false;
    let cameraYaw = 0;
    let cameraHeight = 0;
    const replayFrames: ReplayFrame[] = [];
    let score = { goals: 0, saves: 0 };
    resetShot(ball, kicker, keeper, wall, spot);
    placeCameraForNextShot(camera, kicker, cameraYaw, cameraHeight);
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
    const onDown = (e: PointerEvent) => {
      audio.start();
      const rect = host.getBoundingClientRect();
      const cameraZone =
        state !== 'aim' ||
        e.clientY - rect.top < rect.height * 0.5 ||
        e.clientX - rect.left > rect.width * 0.72;
      swipeRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
        mode: cameraZone ? 'camera' : 'shot'
      };
      if (!cameraZone && state === 'aim')
        setAimCurve(aimLine, ball.object.position, swipeRef.current);
    };
    const onMove = (e: PointerEvent) => {
      if (!swipeRef.current.active) return;
      if (swipeRef.current.mode === 'camera') {
        const dx = e.clientX - swipeRef.current.endX;
        const dy = e.clientY - swipeRef.current.endY;
        cameraYaw = THREE.MathUtils.clamp(
          cameraYaw + dx / 420,
          -CAMERA_YAW_LIMIT,
          CAMERA_YAW_LIMIT
        );
        cameraHeight = THREE.MathUtils.clamp(
          cameraHeight - dy / 520,
          -CAMERA_HEIGHT_LIMIT * 0.55,
          CAMERA_HEIGHT_LIMIT
        );
        swipeRef.current.endX = e.clientX;
        swipeRef.current.endY = e.clientY;
        return;
      }
      if (state !== 'aim') return;
      swipeRef.current.endX = e.clientX;
      swipeRef.current.endY = e.clientY;
      setAimCurve(aimLine, ball.object.position, swipeRef.current);
    };
    const onUp = (e: PointerEvent) => {
      if (!swipeRef.current.active) return;
      if (swipeRef.current.mode === 'camera' || state !== 'aim') {
        swipeRef.current.active = false;
        return;
      }
      swipeRef.current.endX = e.clientX;
      swipeRef.current.endY = e.clientY;
      swipeRef.current.active = false;
      hideAimLine(aimLine);
      beginRunup(kicker, wall, keeper, ball, swipeRef.current);
      shotBlocked = false;
      shotSaved = false;
      shotFinalized = false;
      netTriggered = false;
      strikeCommitted = false;
      replayFrames.length = 0;
      state = 'runup';
      setHud((h) => ({ ...h, state: '2-step run-up...' }));
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
        swipeRef.current.active &&
        swipeRef.current.mode === 'shot'
      )
        setAimCurve(aimLine, ball.object.position, swipeRef.current);
      if (state === 'runup') {
        const strikeSpot = ball.object.position
          .clone()
          .add(new THREE.Vector3(-0.24, -BALL_R, 0.42))
          .setY(0);
        TMP.copy(strikeSpot).sub(kicker.pos).setY(0);
        if (!strikeCommitted && TMP.length() > 0.055) {
          kicker.dir.copy(TMP.clone().normalize());
          kicker.vel.copy(kicker.dir).multiplyScalar(3.15);
          kicker.pos.addScaledVector(kicker.vel, dt);
          kicker.speed = kicker.vel.length();
        } else {
          kicker.speed = 0;
          if (!strikeCommitted) {
            strikeCommitted = true;
            kicker.kickTime = 0.72;
          }
        }
        if (strikeCommitted && kicker.kickTime < 0.34 && !ball.flying) {
          replayFrames.length = 0;
          recordReplayFrame(new THREE.Vector3(0, 1.22, GOAL_LINE_Z + 0.25));
          shootBall(ball, swipeRef.current);
          audio.kick();
          state = 'flight';
          setHud((h) => ({
            ...h,
            state: 'Right-foot strike · recording replay'
          }));
        }
      } else {
        kicker.speed = 0;
      }
      updateBall(ball, dt);
      updateNetShake(netRig, dt);
      if (state === 'flight') {
        if (!shotBlocked && wallBlockCheck(wall, ball)) {
          shotBlocked = true;
          shotFinalized = true;
          pendingDecision = 'BLOCKED';
          audio.save();
          state = 'result';
          resultTimer = 0.38;
          score.saves += 1;
          setHud((h) => ({
            ...h,
            saves: score.saves,
            state: 'BLOCKED · next free kick'
          }));
        }
        if (!shotFinalized && !shotSaved && keeperSaveCheck(keeper, ball, dt)) {
          shotSaved = true;
          shotFinalized = true;
          pendingDecision = 'SAVE';
          ball.flying = false;
          audio.save();
          state = 'result';
          resultTimer = 0.42;
          score.saves += 1;
          setHud((h) => ({
            ...h,
            saves: score.saves,
            state: 'SAVE · next free kick'
          }));
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
            score.saves += 1;
            setHud((h) => ({
              ...h,
              saves: score.saves,
              state: `${pendingDecision} · next free kick`
            }));
          }
        }
      }
      if (state === 'var') {
        varTimer -= dt;
        if (varTimer <= 0) {
          state = 'replay';
          replayIndex = 0;
          replayClock = 0;
          setHud((h) => ({ ...h, state: `SLOW REPLAY: ${pendingDecision}` }));
        }
      }
      if (state === 'replay') {
        replayClock += dt * 0.48;
        replayIndex = Math.floor(replayClock * 30);
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
          resultTimer = pendingDecision === 'GOAL' ? 2.65 : 1.05;
          if (pendingDecision === 'GOAL') {
            audio.goal();
            triggerCrowdCheer(stadium);
            kicker.celebrateTime = 2.45;
            score.goals += 1;
            setHud((h) => ({
              ...h,
              goals: score.goals,
              state: 'VAR: GOAL confirmed'
            }));
          } else {
            score.saves += 1;
            setHud((h) => ({
              ...h,
              saves: score.saves,
              state: `VAR: ${pendingDecision}`
            }));
          }
        }
      }
      if (state === 'result') {
        resultTimer -= dt;
        if (resultTimer <= 0) {
          state = 'aim';
          shotBlocked = false;
          shotSaved = false;
          shotFinalized = false;
          netTriggered = false;
          strikeCommitted = false;
          replayFrames.length = 0;
          spot = randomKickSpot();
          resetShot(ball, kicker, keeper, wall, spot);
          placeCameraForNextShot(camera, kicker, cameraYaw, cameraHeight);
          setHud((h) => ({
            ...h,
            spot,
            state: `Random free kick ${spot} · swipe lower screen to shoot`
          }));
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
        if (ball.flying || state === 'var') {
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
          lookPoint.set(0, 1.22, GOAL_LINE_Z + 0.25);
          const behindOffset = new THREE.Vector3(
            kicker.pos.x * 0.45,
            0,
            kicker.pos.z + 2.85
          )
            .sub(new THREE.Vector3(lookPoint.x, 0, lookPoint.z))
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
          const behind = new THREE.Vector3(
            lookPoint.x + behindOffset.x,
            1.22 + cameraHeight,
            lookPoint.z + behindOffset.z
          );
          camera.position.lerp(behind, 0.18);
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
      placeCameraForNextShot(camera, kicker, cameraYaw, cameraHeight);
      setHud((h) => ({
        ...h,
        spot,
        state: `Free kick ${next}: wall ${wallCountForSpot(next)} at 9.15m`
      }));
    };
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      audio.dispose();
      renderer.dispose();
    };
  }, []);

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
          GOALS {hud.goals} · SAVES {hud.saves}
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
        Lower screen: precise shot swipe. Top/right screen: precise camera
        pan/height. Spots rotate randomly.
      </div>
    </div>
  );
}
