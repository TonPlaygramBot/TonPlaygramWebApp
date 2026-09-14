/** Visual motion review. The production game remains DominoRoyalArena.jsx. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createRestoredSeatedHumanActor,
  applySeatedHumanPose,
  applySeatedHumanReachPose,
  applySeatedHumanHandTargets
} from '../src/pages/Games/shared/seatedHumanActors.js';
import * as P from './domino-royal-motion-helpers';
import { createProductionDominoMotion, type ProductionDominoMotionEnvironment } from './domino-royal-production-motion';
import { fitDominoReviewCamera, type DominoReviewView } from './domino-royal-review-camera';

declare const __DOMINO_REVIEW_MODEL_GZIP__: string;
type MotionKind = 'hold' | 'place' | 'draw' | 'knock' | 'opening';
type ReviewState = { kind: MotionKind; playing: boolean; progress: number; phase: string; count: number; sound: boolean; view: DominoReviewView; ready: boolean };
type Engine = { select: (kind: MotionKind) => void; count: (n: number) => void; togglePlay: () => void; seek: (progress: number) => void; view: (view: DominoReviewView) => void; mute: () => void; dispose: () => void };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SIZES = [7, 8, 10, 14, 21];

async function embeddedAvatar() {
  const bytes = Uint8Array.from(atob(__DOMINO_REVIEW_MODEL_GZIP__), (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(stream).arrayBuffer();
  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    // Decode embedded textures through image elements, avoiding even blob fetches.
    loader.register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'DOMINO_EMBEDDED_TEXTURES' };
    });
    loader.parse(data, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function buildReview(host: HTMLDivElement, update: (state: ReviewState) => void): Engine {
  let view: DominoReviewView = 'hands', dirty = true;
  let kind: MotionKind = 'hold';
  let cameraPoints: THREE.Vector3[] = [];
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07100f');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xe7eee8, 0x34453a, 1.8));
  const key = new THREE.DirectionalLight(0xffeed2, 3.2);
  key.position.set(2, 8, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, far: 22 });
  key.shadow.bias = -0.001; scene.add(key);
  const rimLight = new THREE.DirectionalLight(0x96cfc7, 1.8);
  rimLight.position.set(-4, 4, -3); scene.add(rimLight);
  const camera = new THREE.PerspectiveCamera(P.CAMERA_FOV, 1, P.CAMERA_NEAR, P.CAMERA_FAR);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    fitDominoReviewCamera(camera, view, width / Math.max(1, height), { kind, sourceSeat: 1, activePoints: cameraPoints });
    dirty = true;
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  const wood = new THREE.MeshStandardMaterial({ color: '#352619', roughness: 0.4, metalness: 0.12 });
  const gold = new THREE.MeshStandardMaterial({ color: '#b59959', roughness: 0.35, metalness: 0.72 });
  const green = new THREE.MeshStandardMaterial({ color: '#174838', roughness: 0.96 });
  const chairFabric = new THREE.MeshStandardMaterial({ color: '#23463a', roughness: 0.9 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  // Same production octagon, cloth radius, rail height and chair anchors.
  const top = mesh(new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS, P.TABLE_TOP_DEPTH, 8), wood, 0, P.CLOTH_TOP - P.TABLE_TOP_DEPTH / 2, 0);
  top.rotation.y = Math.PI / 8; top.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  const felt = mesh(new THREE.CylinderGeometry(P.CLOTH_RADIUS, P.CLOTH_RADIUS, 0.014, 8), green, 0, P.CLOTH_TOP + 0.006, 0);
  felt.rotation.y = Math.PI / 8;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(P.TABLE_INNER_RADIUS, 0.018, 5, 8), gold);
  rail.rotation.set(Math.PI / 2, 0, Math.PI / 8); rail.position.y = P.CLOTH_TOP + 0.015; rail.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR; scene.add(rail);
  mesh(new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS * .34, P.TABLE_OUTER_RADIUS * .48, P.TABLE_HEIGHT * .58, 24), wood, 0, P.TABLE_BASE_Y - P.TABLE_HEIGHT * .29, 0);
  const floor = mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#0c211b', roughness: 1 }), 0, -2.15, 0); floor.rotation.x = -Math.PI / 2;
  const chairs: THREE.Group[] = [];
  const actors: Array<any> = [];
  for (let seat = 0; seat < 4; seat++) {
    const chair = new THREE.Group(); chair.position.copy(P.seatBasisForIndex(seat).position); chair.lookAt(V()); scene.add(chair); chairs.push(chair);
    mesh(new RoundedBoxGeometry(P.SEAT_WIDTH, P.SEAT_THICKNESS, P.SEAT_DEPTH, 2, .06), chairFabric, 0, P.STOOL_HEIGHT - P.SEAT_THICKNESS / 2, 0, chair);
    mesh(new RoundedBoxGeometry(P.SEAT_WIDTH, P.BACK_HEIGHT, P.BACK_THICKNESS, 2, .05), chairFabric, 0, P.STOOL_HEIGHT + P.BACK_HEIGHT / 2, -P.SEAT_DEPTH * .45, chair);
    [-1, 1].forEach((side) => mesh(new RoundedBoxGeometry(P.ARM_THICKNESS, P.ARM_THICKNESS, P.ARM_DEPTH, 2, .03), gold, side * P.SEAT_WIDTH * .49, P.STOOL_HEIGHT + P.ARM_HEIGHT, 0, chair));
  }
  const pieces = new THREE.Group(); scene.add(pieces);
  const bodyGeometry = new RoundedBoxGeometry(1, 2, .22, 3, .06);
  const faceGeometry = new THREE.PlaneGeometry(.9, 1.9);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#f7f0d8', roughness: .35, metalness: .04 });
  const faceMaterials: THREE.MeshStandardMaterial[] = [];
  const flatScale = V(P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .016 / .22, P.DOMINO_WORLD_SCALE * .1);
  const uprightScale = V(P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .1, P.DOMINO_WORLD_SCALE * .016 / .22);
  const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const backQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const pipLayouts = [[], [[0, 0]], [[-.23, -.23], [.23, .23]], [[-.23, -.23], [0, 0], [.23, .23]], [[-.23, -.23], [.23, -.23], [-.23, .23], [.23, .23]], [[-.23, -.23], [.23, -.23], [0, 0], [-.23, .23], [.23, .23]], [[-.23, -.26], [.23, -.26], [-.23, 0], [.23, 0], [-.23, .26], [.23, .26]]];
  function faceMaterial(a: number, b: number) {
    const index = a * 7 + b;
    if (faceMaterials[index]) return faceMaterials[index];
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f4efdc'; ctx.fillRect(0, 0, 96, 192);
    ctx.strokeStyle = '#bba46b'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 92, 188); ctx.beginPath(); ctx.moveTo(5, 96); ctx.lineTo(91, 96); ctx.stroke();
    ctx.fillStyle = '#17281d';
    [a, b].forEach((value, half) => pipLayouts[value].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(48 + x * 96, 48 + half * 96 + y * 96, 7, 0, Math.PI * 2); ctx.fill(); }));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return (faceMaterials[index] = new THREE.MeshStandardMaterial({ map: texture, roughness: .48 }));
  }
  const set: Array<[number, number]> = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) set.push([a, b]);
  function tile(a: number, b: number, { flat = false, faceUp = true } = {}) {
    const root = new THREE.Group(); const body = new THREE.Mesh(bodyGeometry, bodyMaterial); body.castShadow = true; body.receiveShadow = true; root.add(body);
    if (faceUp) { const face = new THREE.Mesh(faceGeometry, faceMaterial(a, b)); face.position.z = .111; root.add(face); }
    root.scale.copy(flat ? flatScale : uprightScale); if (flat) root.rotation.x = -Math.PI / 2;
    root.userData.val = [a, b]; pieces.add(root); return root;
  }
  let count = 7, stopped = false, frame = 0, sound = true, ready = false;
  let playing = false, elapsed = 0, simulated = 0, lastFrame = 0, silence = false;
  let audio: AudioContext | null = null, currentPhase = 'Loading the original avatar…';
  let openingSeed: Array<any> | null = null, dealCursor = 0;
  const players = Array.from({ length: 4 }, () => ({ hand: [] as any[] }));
  const segments: any[] = [];
  const env: ProductionDominoMotionEnvironment = {
    piecesG: pieces, players, chairs, seatedHumanActors: actors, N: 4, human: 0,
    DOMINO_SEATED_HUMANS: { applySeatedHumanPose, applySeatedHumanReachPose, applySeatedHumanHandTargets },
    makeDomino: tile, renderHands, renderChain,
    SFX: { place: knock, pass: knock, drawTile: () => {} },
    setStatus: () => {}, showPassBubble: () => {}, nextTurn: () => {}, flushPendingDominoState: () => {}
  };
  const motion = createProductionDominoMotion(env);
  const actionDuration = (travelDuration: number) => motion.sampleDominoActionProgress(0, travelDuration).totalDuration;
  const dealDuration = () => actionDuration(P.OPENING_DEAL_ANIM_DURATION);
  const duration = () => kind === 'hold' ? 1 : kind === 'place' ? actionDuration(P.PLACE_ANIM_DURATION) : kind === 'draw' ? actionDuration(P.DRAW_ANIM_DURATION) : kind === 'knock' ? P.KNOCK_DURATION : P.OPENING_SHUFFLE_ANIM_DURATION + 28 * dealDuration();
  const report = () => update({ kind, playing, progress: Math.min(1, elapsed / duration()), phase: currentPhase, count, sound, view, ready });
  function renderHands() {
    env.activeHandMeshes!.forEach((root) => root.removeFromParent()); env.activeHandMeshes!.clear();
    players.forEach((player, seat) => {
      const hand = env.openingSequence?.handSlots?.[seat] || player.hand;
      hand.forEach((held: any, index: number) => {
        held.mesh = null; if (held.inTransit || held.openingPending) return;
        const root = tile(held.a, held.b, { flat: false, faceUp: seat === 0 });
        root.position.copy(P.computeHandSlotPosition(seat, index, hand.length));
        const [x, z] = P.layoutSeat(P.getVisualSeatIndex(seat)); root.rotation.set(0, seat === 0 ? 0 : Math.atan2(-x, -z), 0);
        root.scale.multiplyScalar(P.getDominoHandScale(seat, hand.length));
        root.userData = { tile: held, owner: seat }; held.mesh = root; env.activeHandMeshes!.add(root);
      });
    });
  }
  function renderChain() {
    segments.forEach((segment) => {
      segment.mesh?.removeFromParent(); if (segment.animating) return;
      const root = tile(segment.tile.a, segment.tile.b, { flat: true, faceUp: true });
      root.position.set(segment.x, P.CHAIN_TILE_Y, segment.z); motion.orientDominoFlat(root, segment.rot); segment.mesh = root;
    });
  }
  function resetPieces() {
    pieces.clear(); segments.splice(0); players.forEach((player) => player.hand.splice(0));
    env.openingSequence = null; env.placementAnimations!.splice(0); env.drawAnimations!.splice(0); env.knockAnimations!.splice(0);
    env.activeHandMeshes!.clear(); env.dominoHandContacts!.clear(); env.dominoMotionTime = 0;
    for (let seat = 0; seat < 4; seat++) {
      const size = seat === 0 ? count : 7;
      for (let i = 0; i < size; i++) { const [a, b] = set[(i * 3 + seat * 7) % set.length]; players[seat].hand.push({ a, b }); }
    }
    renderHands(); for (let seat = 0; seat < 4; seat++) motion.poseDominoHands(seat);
  }
  function setupPlace() {
    const sourceSeat = 1, held = players[sourceSeat].hand.splice(3, 1)[0], root = held.mesh;
    env.activeHandMeshes!.delete(root); held.mesh = null;
    const start = root.position.clone(), startQuat = root.quaternion.clone(), startScale = root.scale.clone();
    renderHands(); root.userData.animating = true;
    const segment = { tile: held, x: 0, z: 0, rot: 0, animating: true, mesh: null }; segments.push(segment);
    const orient = new THREE.Object3D(); motion.orientDominoFlat(orient, segment.rot);
    const anim: any = { mesh: root, tile: held, sourceSeat, segment, start, startQuat, startScale, end: V(segment.x, P.CHAIN_TILE_Y, segment.z), endQuat: orient.quaternion.clone(), endScale: flatScale.clone(), startTime: 0, duration: P.PLACE_ANIM_DURATION, arc: P.PLACE_ANIM_ARC };
    anim.humanReachProfile = motion.getDominoHumanReachProfile(anim); env.placementAnimations!.push(anim);
  }
  function setupDraw() {
    const held = { a: 2, b: 6 }; players[1].hand.push(held);
    const start = V(0, P.CLOTH_TOP + .006, .45 * P.CLOTH_RADIUS);
    motion.spawnDrawAnimation(start, 1, held); env.drawAnimations![0].startTime = 0;
  }
  function setupOpening() {
    pieces.clear(); env.activeHandMeshes!.clear(); players.forEach((player) => player.hand.splice(0));
    env.boneyard = set.map(([a, b]) => ({ a, b }));
    motion.spawnOpeningShuffleAnimation(); const sequence = env.openingSequence;
    sequence.phase = 'shuffle'; sequence.startTime = 0; sequence.lastShuffleTime = 0;
    if (!openingSeed) openingSeed = sequence.tiles.map((entry: any) => ({ a: entry.tile.a, b: entry.tile.b, yaw: entry.yaw, spin: entry.spin, home: entry.home.toArray() }));
    sequence.tiles.forEach((entry: any, index: number) => {
      const initial = openingSeed![index]; entry.tile = { a: initial.a, b: initial.b, openingPending: true }; entry.yaw = initial.yaw; entry.spin = initial.spin; entry.home.fromArray(initial.home); entry.mesh.position.copy(entry.home); entry.velocity.set(0, 0, 0); motion.orientDominoFaceDown(entry.mesh, entry.yaw);
      players[index % 4].hand.push(entry.tile);
    });
    sequence.handSlots = players.map((player) => [...player.hand]); dealCursor = 0;
  }
  function resetMotion() {
    elapsed = 0; simulated = 0; resetPieces();
    if (kind === 'place') setupPlace();
    else if (kind === 'draw') setupDraw();
    else if (kind === 'knock') env.knockAnimations!.push({ sourceSeat: 1, startTime: 0, impactPlayed: false, remote: true });
    else if (kind === 'opening') setupOpening();
    evaluate(0); dirty = true;
  }
  function phaseAt(time: number) {
    if (kind === 'hold') return 'Both hands supporting the rack';
    if (kind === 'opening') return time < P.OPENING_SHUFFLE_ANIM_DURATION ? 'Mixing · palm contact and sliding tiles' : time >= duration() ? 'All players have seven dominoes' : `Random draw · ${Math.min(28, Math.floor((time - P.OPENING_SHUFFLE_ANIM_DURATION) / dealDuration()) + 1)} / 28`;
    const t = kind === 'place' || kind === 'draw'
      ? motion.sampleDominoActionProgress(time, kind === 'place' ? P.PLACE_ANIM_DURATION : P.DRAW_ANIM_DURATION).handT
      : time / duration();
    if (kind === 'knock') return t < P.KNOCK_CONTACT_PHASE ? 'Raise the right hand' : t < .76 ? 'Knock · sound at contact' : 'Return to the rack';
    return t < P.PLACE_ANIM_PICK_HOLD ? 'Reach' : t < P.PLACE_ANIM_LIFT_END ? 'Pick up and lift' : t < P.PLACE_ANIM_CARRY_END ? 'Carry · fingers holding the sides' : t < P.PLACE_ANIM_LOWER_END ? 'Lower onto the surface' : 'Release and return';
  }
  function evaluate(time: number) {
    // A scrub lands on an exact endpoint while RAF normally crosses it. Decimal
    // deal durations can lose a few ulps during elapsed-time subtraction; sample
    // just past that boundary so the unchanged production controller completes.
    const sampleEnd = (anim: any) => {
      if (!anim) return time;
      const end = anim.startTime + actionDuration(anim.duration || P.PLACE_ANIM_DURATION);
      return Math.abs(time - end) < 1e-7 ? time + 1e-7 : time;
    };
    env.dominoMotionTime = time;
    motion.updateDominoIdleHands();
    if (kind === 'place') motion.updatePlacementAnimations(sampleEnd(env.placementAnimations![0]));
    else if (kind === 'draw') motion.updateDrawAnimations(sampleEnd(env.drawAnimations![0]));
    else if (kind === 'knock') motion.updateKnockAnimations(time);
    else if (kind === 'opening') {
      const sequence = env.openingSequence;
      if (sequence && time <= P.OPENING_SHUFFLE_ANIM_DURATION) {
        const t = Math.min(1, time / P.OPENING_SHUFFLE_ANIM_DURATION); motion.updateDominoShuffleTiles(sequence, t, time); motion.poseDominoShuffleHands(sequence, t);
      } else if (sequence) {
        if (sequence.phase === 'shuffle') { motion.updateDominoShuffleTiles(sequence, 1, P.OPENING_SHUFFLE_ANIM_DURATION); motion.poseDominoShuffleHands(sequence, 1); }
        sequence.phase = 'deal';
        while (dealCursor < 28 || env.drawAnimations!.length) {
          if (!env.drawAnimations!.length) {
            const entry = sequence.tiles[dealCursor], seat = dealCursor % 4;
            motion.spawnDrawAnimation(entry.mesh.getWorldPosition(V()), seat, entry.tile, { mesh: entry.mesh, opening: true });
            env.drawAnimations![0].startTime = P.OPENING_SHUFFLE_ANIM_DURATION + dealCursor * dealDuration(); dealCursor++;
          }
          const active = env.drawAnimations![0]; motion.updateDrawAnimations(sampleEnd(active));
          if (env.drawAnimations!.length || time < active.startTime + actionDuration(active.duration)) break;
        }
        if (dealCursor === 28 && !env.drawAnimations!.length) { env.openingSequence = null; renderHands(); for (let seat = 0; seat < 4; seat++) motion.poseDominoHands(seat); }
      }
    }
    // Keep actual fingers, wrists and supporting arm in frame throughout the
    // selected action; the complete tile travel above provides stable framing.
    cameraPoints = [];
    const rig = actors[1]?.rig;
    for (const key of ['leftHand', 'rightHand', 'leftForeArm', 'rightForeArm']) {
      const bone = rig?.[key];
      if (!bone) continue;
      bone.traverse((part: THREE.Object3D) => {
        const point = part.getWorldPosition(V());
        for (const sign of [-1, 1]) for (const axis of ['x', 'y', 'z'] as const) {
          const padded = point.clone(); padded[axis] += sign * .08; cameraPoints.push(padded);
        }
      });
    }
    fitDominoReviewCamera(camera, view, camera.aspect, { kind, sourceSeat: 1, activePoints: cameraPoints });
    currentPhase = phaseAt(time); simulated = time; dirty = true;
  }
  function seek(progress: number) {
    const target = Math.max(0, Math.min(1, progress)) * duration(); playing = false; silence = true;
    resetMotion();
    if (kind === 'opening') {
      const step = 1000 / 60, shuffleEnd = P.OPENING_SHUFFLE_ANIM_DURATION;
      for (let time = step; time < Math.min(target, shuffleEnd); time += step) evaluate(time);
      if (target >= shuffleEnd) {
        evaluate(shuffleEnd);
        // Draw transforms and IK are analytic; seed every draw at t=0, then
        // inspect its endpoint. Only the collision shuffle needs time steps.
        for (let index = 0; index < 28; index++) {
          const start = shuffleEnd + index * dealDuration();
          if (target <= start) break;
          evaluate(Math.min(target, start + .0001));
          evaluate(Math.min(target, start + dealDuration()));
          if (target <= start + dealDuration()) break;
        }
      }
    }
    evaluate(target); elapsed = target; silence = false; report();
  }
  function unlockAudio() { if (!audio) audio = new AudioContext(); void audio.resume(); }
  function knock() {
    if (!sound || !audio || silence || !playing) return;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .36), audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) { const t = i / audio.sampleRate, strike = Math.exp(-t * 72), body = Math.exp(-t * 14); data[i] = (Math.sin((i + 11) * .22) * strike * .52 + (((Math.sin(i * 12.9898) * 43758.5453) % 1) - .5) * strike * .24 + Math.sin(2 * Math.PI * 128 * t) * body * .46 + Math.sin(2 * Math.PI * 188 * t) * Math.exp(-t * 9.5) * .28 + Math.sin(2 * Math.PI * 64 * t) * Math.exp(-t * 7.5) * .32) * .88; }
    const source = audio.createBufferSource(), gain = audio.createGain(); source.buffer = buffer; gain.gain.value = .5; source.connect(gain).connect(audio.destination); source.start();
  }
  function animate(now: number) {
    if (stopped) return;
    frame = requestAnimationFrame(animate);
    if (ready && playing) {
      elapsed = Math.min(duration(), elapsed + Math.min(50, Math.max(0, now - lastFrame)));
      evaluate(elapsed); if (elapsed >= duration()) playing = false; report();
    }
    lastFrame = now;
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }
  frame = requestAnimationFrame(animate);
  embeddedAvatar().then((template) => {
    if (stopped) return;
    const bounds = new THREE.Box3().setFromObject(template), center = bounds.getCenter(V()); template.position.x -= center.x; template.position.z -= center.z; template.position.y -= bounds.min.y;
    template.traverse((object: any) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false; } });
    for (let seat = 0; seat < 4; seat++) actors[seat] = createRestoredSeatedHumanActor(template, chairs[seat], { targetHeight: P.LEGACY_DOMINO_HUMAN_HEIGHT, seatHeight: P.STOOL_HEIGHT, supportsArmrest: true });
    ready = true; resetMotion(); report();
  }).catch((error) => { console.error(error); currentPhase = 'Avatar could not load'; report(); });
  return {
    select: (next) => { kind = next; playing = false; if (kind === 'opening') { count = 7; view = 'table'; } else view = 'hands'; resetMotion(); report(); },
    count: (next) => { count = next; kind = 'hold'; playing = false; view = 'table'; resize(); resetMotion(); report(); },
    togglePlay: () => { if (kind === 'hold') return; unlockAudio(); if (elapsed >= duration()) resetMotion(); playing = !playing; lastFrame = performance.now(); report(); },
    seek,
    view: (next) => { view = next; resize(); report(); },
    mute: () => { sound = !sound; if (sound) unlockAudio(); report(); },
    dispose: () => { stopped = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); renderer.dispose(); pmrem.dispose(); environment.dispose(); void audio?.close(); scene.traverse((object: any) => { object.geometry?.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach((material: any) => { material?.map?.dispose(); material?.dispose(); }); }); renderer.domElement.remove(); }
  };
}

function MotionReview() {
  const host = useRef<HTMLDivElement>(null), engine = useRef<Engine | null>(null);
  const [state, setState] = useState<ReviewState>({ kind: 'hold', playing: false, progress: 0, phase: 'Loading the original avatar…', count: 7, sound: true, view: 'hands', ready: false });
  useEffect(() => {
    try { engine.current = buildReview(host.current!, setState); }
    catch (error) { console.error(error); setState((previous) => ({ ...previous, phase: 'WebGL is unavailable in this preview' })); }
    return () => engine.current?.dispose();
  }, []);
  return <main className="motion-review">
    <header><div><strong>DOMINO ROYAL</strong><small>Hands review</small></div><div className="review-top-actions"><button type="button" aria-label={state.sound ? 'Mute preview' : 'Unmute preview'} onClick={() => engine.current?.mute()}>{state.sound ? 'Sound on' : 'Muted'}</button><button type="button" aria-pressed={state.view === 'table'} onClick={() => engine.current?.view(state.view === 'hands' ? 'table' : 'hands')}>{state.view === 'hands' ? 'Table view' : 'Hands view'}</button></div></header>
    <div className="motion-stage" ref={host} role="img" aria-label="Original Domino Royal character showing both rack supports and finger contact during the selected motion" />
    <footer>
      <p role="status" aria-live="polite">{state.phase}</p>
      <div className="motion-selection"><label htmlFor="domino-reviewed-motion">Motion</label><select id="domino-reviewed-motion" value={state.kind} disabled={!state.ready} onChange={(event) => engine.current?.select(event.target.value as MotionKind)}><option value="hold">Hold the rack</option><option value="place">Pick + place</option><option value="draw">Draw from table</option><option value="knock">Knock / pass</option><option value="opening">Opening</option></select><button type="button" disabled={!state.ready || state.kind === 'hold'} onClick={() => engine.current?.togglePlay()}>{state.playing ? 'Pause' : 'Play'}</button></div>
      <div className="motion-scrub"><label htmlFor="domino-reviewed-progress">{Math.round(state.progress * 100)}%</label><input id="domino-reviewed-progress" type="range" min="0" max="1000" value={Math.round(state.progress * 1000)} disabled={!state.ready || state.kind === 'hold'} aria-label="Inspect animation progress" onChange={(event) => engine.current?.seek(Number(event.target.value) / 1000)} /></div>
      <div className="hand-options" role="group" aria-label="Dominoes in your hand"><span>Your hand</span>{SIZES.map((n) => <button type="button" key={n} disabled={!state.ready} aria-pressed={state.count === n} onClick={() => engine.current?.count(n)}>{n}</button>)}</div>
    </footer>
  </main>;
}
createRoot(document.getElementById('domino-royal-hands-reviewed-root')!).render(<MotionReview />);
