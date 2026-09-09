import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  CFG, HUMAN_URL, createCue, createReferenceHuman,
  cuePoseFromGrip, setCuePose, updateHumanPose,
  type HumanRig, type ShotState
} from './poolRoyalReferenceHuman.ts';
import { refinePoolRoyalBridge, poolRoyalEyeView, type HumanEyeView } from './poolRoyalPlayerPose.ts';
import { posePoolRoyalCue } from './createPoolRoyalCue.ts';
import {
  createCueReachEquipment,
  hideCueReachEquipment,
  poseCueReachEquipment,
  resolveCueReachProfile,
  type CueReachEquipment
} from './cueReachEquipment.ts';

export type PlayerSeat = 'A' | 'B';
export type PlayerFrame = {
  activeSeat: PlayerSeat;
  state: ShotState;
  cueBall: THREE.Vector3;
  aimForward: THREE.Vector3;
  power: number;
  nowMs: number;
  cueBack?: THREE.Vector3;
  cueTip?: THREE.Vector3;
  hidden?: boolean;
};
type Player = {
  seat: PlayerSeat;
  human: HumanRig;
  cue: ReturnType<typeof createCue>;
  initialized: boolean;
  state: ShotState;
  shotBall: THREE.Vector3;
  shotAim: THREE.Vector3;
  headMeshes: THREE.Object3D[];
  reachEquipment: CueReachEquipment;
  cueModel?: THREE.Object3D;
};
type Options = {
  floorY: number;
  clothY: number;
  tableW: number;
  tableL: number;
  /** Per-game visual sizing without changing the shared stance or pose solver. */
  heightScale?: number;
  modelUrl?: string;
  model?: THREE.Object3D;
  onError?: (error: unknown) => void;
};

function disposeResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  skeletons.forEach(skeleton => skeleton.dispose());
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

export function choosePoolRoyalStance(ball: THREE.Vector3, forward: THREE.Vector3, tableW: number, tableL: number) {
  const margin = 0.25 * CFG.humanScale;
  const x = Math.abs(forward.x) > 1e-6
    ? (tableW / 2 + margin + Math.sign(forward.x) * ball.x) / Math.abs(forward.x) : Infinity;
  const z = Math.abs(forward.z) > 1e-6
    ? (tableL / 2 + margin + Math.sign(forward.z) * ball.z) / Math.abs(forward.z) : Infinity;
  return ball.clone().addScaledVector(forward, -Math.max(Math.min(x, z), CFG.desiredShootDistance)).setY(0);
}

/**
 * Keep the planted bridge hand tied to the cue ball and shot line, not to the
 * cue tip's longitudinal pull. A small lateral correction preserves side-spin
 * alignment while the shaft is free to slide through the fingers.
 */
export function resolvePoolRoyalBridgeAnchor({
  cueBall,
  aimForward,
  cueTip,
  clothY
}: {
  cueBall: THREE.Vector3;
  aimForward: THREE.Vector3;
  cueTip?: THREE.Vector3;
  clothY: number;
}) {
  const forward = aimForward.clone().setY(0);
  if (!Number.isFinite(forward.lengthSq()) || forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  else forward.normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const lateralCueOffset = cueTip
    ? THREE.MathUtils.clamp(cueTip.clone().sub(cueBall).dot(side), -CFG.ballR * 0.82, CFG.ballR * 0.82)
    : 0;
  return cueBall.clone()
    .addScaledVector(forward, -CFG.bridgeHandBackFromBall)
    .addScaledVector(side, CFG.bridgeHandSide + lateralCueOffset)
    .setY(clothY + CFG.bridgePalmTableLift);
}

/** The rear hand grips the rendered cue, so it follows the exact pull/impact path. */
export function resolvePoolRoyalRearGrip(
  cueBack: THREE.Vector3,
  cueTip: THREE.Vector3,
  extensionGripOffset = 0
) {
  const cueAxis = cueTip.clone().sub(cueBack);
  if (!Number.isFinite(cueAxis.lengthSq()) || cueAxis.lengthSq() < 1e-8) return cueBack.clone();
  const cueLength = cueAxis.length();
  cueAxis.divideScalar(cueLength);
  return cueBack.clone()
    .addScaledVector(cueAxis, Math.min(CFG.shootCueGripFromBack, cueLength * 0.45))
    .addScaledVector(cueAxis, -Math.max(0, extensionGripOffset));
}

/**
 * The solver works in the supplied demo's coordinate space. Only a positive,
 * uniform scale and floor translation connect it to Pool Royal. Solving in an
 * unparented scene keeps the host's table/world scale out of bone quaternions.
 * Table-specific reach and bridge corrections preserve handedness and bind matrices.
 */
export class PoolRoyalHumanPlayers {
  readonly group = new THREE.Group();
  readonly players: Player[] = [];
  readonly ready: Promise<boolean>;
  readonly humanHeight: number;
  eyeView: HumanEyeView | null = null;
  private scale = 1;
  get referenceScale() { return this.scale; }
  private readonly solverScene = new THREE.Scene();
  private disposed = false;
  private readonly options: Options;
  private cueAppearance: { body: THREE.Object3D; tip: THREE.Vector3; butt: THREE.Vector3 } | null = null;

  constructor(parent: THREE.Object3D, options: Options) {
    this.options = options;
    const clothHeight = options.clothY - options.floorY;
    if (!(clothHeight > 0) || !(options.tableW > 0) || !(options.tableL > 0)) throw new Error('Character floor and table dimensions must be valid.');
    // Footprint determines body size. A minimum height preserves arm reach on
    // Pool Royal's unusually tall table without reintroducing oversized players.
    const heightScale = Number.isFinite(options.heightScale) && options.heightScale! > 0
      ? options.heightScale!
      : 1;
    this.humanHeight = Math.max(Math.max(options.tableW, options.tableL) * 0.82, clothHeight * 1.8) * heightScale;
    this.group.name = 'PoolRoyalReferencePlayers';
    this.group.position.y = options.floorY;
    parent.add(this.group);
    const load = options.model
      ? Promise.resolve(options.model)
      : new GLTFLoader().loadAsync(options.modelUrl ?? HUMAN_URL).then(gltf => gltf.scene);
    this.ready = load.then(model => {
      if (this.disposed) {
        if (!options.model) disposeResources(model);
        return false;
      }
      for (const seat of ['A', 'B'] as const) {
        // Object3D.clone alone shares bone references between skinned players.
        const human = createReferenceHuman(cloneSkeleton(model));
        if (!human.activeGlb) throw new Error('The reference character skeleton is incomplete.');
        if (!this.players.length) {
          const height = new THREE.Box3().setFromObject(human.modelRoot).getSize(new THREE.Vector3()).y;
          this.scale = this.humanHeight / height;
          this.group.scale.setScalar(this.scale);
        }
        const cue = createCue();
        const reachEquipment = createCueReachEquipment();
        const headMeshes: THREE.Object3D[] = [];
        human.model!.traverse(object => {
          if ((object as THREE.Mesh).isMesh && /^(EyeLeft|EyeRight|Wolf3D_(Head|Teeth|Beard|Headwear))$/.test(object.name)) headMeshes.push(object);
        });
        this.group.add(human.modelRoot, cue.group, reachEquipment.group);
        this.players.push({ seat, human, cue, initialized: false, state: 'idle',
          shotBall: new THREE.Vector3(), shotAim: new THREE.Vector3(), headMeshes, reachEquipment });
      }
      if (this.cueAppearance) this.setCueAppearance(this.cueAppearance.body, this.cueAppearance.tip, this.cueAppearance.butt);
      return true;
    }).catch(error => {
      if (!this.disposed) options.onError?.(error);
      this.dispose();
      return false;
    });
  }

  toReference(point: THREE.Vector3) {
    return point.clone().sub(new THREE.Vector3(0, this.options.floorY, 0))
      .divideScalar(this.referenceScale);
  }

  setFirstPerson(enabled: boolean, seat: PlayerSeat) {
    for (const player of this.players) for (const mesh of player.headMeshes) {
      mesh.visible = !(enabled && player.seat === seat);
    }
  }

  /** Clones share the selected gameplay finish, so switching a cue updates every holder. */
  setCueAppearance(body: THREE.Object3D, tip: THREE.Vector3, butt: THREE.Vector3) {
    this.cueAppearance = { body, tip: tip.clone(), butt: butt.clone() };
    for (const player of this.players) {
      player.cueModel?.removeFromParent();
      player.cueModel = body.clone(true);
      this.group.add(player.cueModel);
    }
  }

  /** Final-camera occlusion check also covers AI action/pocket camera handoffs. */
  updateCameraVisibility(camera: THREE.Camera, target: THREE.Vector3, firstPersonSeat?: PlayerSeat) {
    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    const ray = target.clone().sub(cameraPos);
    const targetDistance = ray.length(); ray.normalize();
    for (const player of this.players) {
      const head = player.human.bones.head!.getWorldPosition(new THREE.Vector3());
      const offset = head.sub(cameraPos), along = offset.dot(ray);
      const scale = this.group.getWorldScale(new THREE.Vector3()).x;
      const radius = CFG.humanScale * 0.15 * scale;
      const blocksView = offset.length() < radius * 5 && along > -radius && along < targetDistance &&
        offset.clone().addScaledVector(ray, -along).length() < radius * 1.2;
      for (const mesh of player.headMeshes) mesh.visible = !(player.seat === firstPersonSeat || blocksView);
    }
  }

  update(dt: number, frame: PlayerFrame) {
    if (this.disposed || !Number.isFinite(dt) || dt < 0) return;
    this.group.visible = !frame.hidden;
    if (frame.hidden) { this.eyeView = null; return; }
    const ball = this.toReference(frame.cueBall);
    const forward = frame.aimForward.clone().setY(0);
    if (!Number.isFinite(forward.lengthSq()) || forward.lengthSq() < 1e-8) return;
    forward.normalize();
    const tableW = this.options.tableW / this.referenceScale;
    const tableL = this.options.tableL / this.referenceScale;
    const clothY = (this.options.clothY - this.options.floorY) / this.referenceScale;
    const power = THREE.MathUtils.clamp(frame.power, 0, 1);
    for (const player of this.players) {
      const active = player.seat === frame.activeSeat;
      const state = active ? frame.state : 'idle';
      const human = player.human;
      if (state === 'striking' && player.state !== 'striking') {
        player.shotBall.copy(ball);
        player.shotAim.copy(forward);
      }
      const aim = state === 'striking' ? player.shotAim.clone() : forward.clone();
      const cueBall = state === 'striking' ? player.shotBall : ball;
      const rootTarget = active
        ? choosePoolRoyalStance(cueBall, aim, tableW, tableL)
        : new THREE.Vector3(
          (player.seat === 'A' ? -1 : 1) * (tableW / 2 + CFG.edgeMargin * 2),
          0, (player.seat === 'A' ? 1 : -1) * tableL * 0.36
        );
      if (!active) aim.copy(rootTarget).negate().setY(0).normalize();
      const yaw = Math.atan2(-aim.x, -aim.z);
      if (!player.initialized) {
        human.root.position.copy(rootTarget);
        human.yaw = yaw;
        player.initialized = true;
      }
      let bridge = resolvePoolRoyalBridgeAnchor({ cueBall, aimForward: aim, clothY });
      const idleRight = rootTarget.clone().add(new THREE.Vector3(
        CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ
      ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const idleLeft = rootTarget.clone().add(new THREE.Vector3(
        -0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale
      ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const idleCue = cuePoseFromGrip(idleRight,
        CFG.idleCueDir.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw),
        CFG.idleCueGripFromBack, this.cueAppearance
          ? this.cueAppearance.tip.distanceTo(this.cueAppearance.butt) / this.referenceScale : CFG.cueLength);
      let back = idleCue.back;
      let tip = idleCue.tip;
      if (state !== 'idle') {
        if (frame.cueBack && frame.cueTip) {
          // Inputs are read from the live cue after its existing stroke update.
          back = this.toReference(frame.cueBack);
          tip = this.toReference(frame.cueTip);
        } else {
          const pull = CFG.pullRange * (1 - Math.pow(1 - power, 3));
          const practice = state === 'dragging'
            ? Math.sin(frame.nowMs * 0.012) * 0.035 * CFG.scale * (0.25 + power * 0.75) : 0;
          const strikeT = THREE.MathUtils.clamp(human.strikeClock / CFG.strikeTime, 0, 1);
          const gap = state === 'dragging' ? CFG.idleGap + pull + practice
            : THREE.MathUtils.lerp(CFG.idleGap + pull, CFG.contactGap, 1 - Math.pow(1 - strikeT, 3));
          tip = cueBall.clone().addScaledVector(aim, -(CFG.ballR + gap));
          back = bridge.clone().addScaledVector(aim, 0.014 * CFG.scale)
            .add(new THREE.Vector3(0, CFG.bridgeCueLift, 0))
            .addScaledVector(aim, -(CFG.cueLength - CFG.bridgeDist - CFG.ballR - gap))
            .add(new THREE.Vector3(0, 0.024 * CFG.scale, 0));
        }
      }
      bridge = resolvePoolRoyalBridgeAnchor({ cueBall, aimForward: aim, cueTip: tip, clothY });
      const reachProfile = resolveCueReachProfile({
        cueBall,
        aimForward: aim,
        tableW,
        tableL
      });
      const reachPose = active && state !== 'idle'
        ? poseCueReachEquipment(player.reachEquipment, {
          cueBack: back,
          cueTip: tip,
          cueBall,
          aimForward: aim,
          rootTarget,
          clothY,
          profile: reachProfile,
          scale: CFG.scale
        })
        : null;
      if (!reachPose) hideCueReachEquipment(player.reachEquipment);
      const supportMode = reachPose ? 'mechanical-rest' : 'hand';
      if (reachPose) bridge = reachPose.restGrip;
      const rearGripOffset = reachPose ? reachProfile.extensionLength * 0.32 : 0;
      const rearGrip = state === 'idle' ? undefined : resolvePoolRoyalRearGrip(back, tip, rearGripOffset);
      this.solverScene.add(human.modelRoot);
      this.solverScene.updateMatrixWorld(true);
      updateHumanPose(human, Math.min(dt, 0.033), state, rootTarget, aim, bridge,
        idleRight, idleLeft, back, tip, active ? power : 0, clothY, supportMode,
        reachPose?.restDirection, rearGripOffset, rearGrip);
      if (!reachPose) refinePoolRoyalBridge(human, bridge, aim, clothY);
      this.group.add(human.modelRoot);
      setCuePose(player.cue, back, tip);
      // While aiming, the gameplay cue is the visible cue; the parked player
      // continues to hold the original upright reference cue.
      player.cue.group.visible = state === 'idle' || !(frame.cueBack && frame.cueTip);
      if (player.cueModel && this.cueAppearance) {
        posePoolRoyalCue(player.cueModel, back, tip, this.cueAppearance.tip, this.cueAppearance.butt);
        player.cueModel.visible = player.cue.group.visible;
        player.cue.group.visible = false;
      }
      player.state = state;
    }
    const shooter = this.players.find(player => player.seat === frame.activeSeat);
    this.eyeView = shooter && frame.state !== 'idle'
      ? poolRoyalEyeView(shooter.human, this.group, frame.cueBall, forward,
        Math.max(0.01, frame.cueBall.y - this.options.clothY)) : null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.eyeView = null;
    // The gameplay cue owns shared geometry/materials; do not dispose its copies here.
    for (const player of this.players) player.cueModel?.removeFromParent();
    this.cueAppearance = null;
    disposeResources(this.group);
    this.group.removeFromParent();
    this.group.clear();
    this.solverScene.clear();
    this.players.length = 0;
  }
}
