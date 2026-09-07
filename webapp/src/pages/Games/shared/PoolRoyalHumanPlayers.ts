import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  CFG, HUMAN_URL, chooseHumanEdgePosition, createCue, createReferenceHuman,
  cuePoseFromGrip, setCuePose, updateHumanPose,
  type HumanRig, type ShotState
} from './poolRoyalReferenceHuman.ts';

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
};
type Options = {
  floorY: number;
  clothY: number;
  tableW: number;
  tableL: number;
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

/**
 * The solver works in the supplied demo's coordinate space. Only a positive,
 * uniform scale and floor translation connect it to Pool Royal. Solving in an
 * unparented scene keeps the host's table/world scale out of bone quaternions.
 * No camera-relative flips, facing heuristics, or bind-pose edits are applied.
 */
export class PoolRoyalHumanPlayers {
  readonly group = new THREE.Group();
  readonly players: Player[] = [];
  readonly ready: Promise<boolean>;
  readonly referenceScale: number;
  private readonly solverScene = new THREE.Scene();
  private disposed = false;
  private readonly options: Options;

  constructor(parent: THREE.Object3D, options: Options) {
    this.options = options;
    this.referenceScale = (options.clothY - options.floorY) / CFG.tableTopY;
    if (!(this.referenceScale > 0)) throw new Error('Character floor must be below the cloth.');
    this.group.name = 'PoolRoyalReferencePlayers';
    this.group.position.y = options.floorY;
    this.group.scale.setScalar(this.referenceScale);
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
        const cue = createCue();
        this.group.add(human.modelRoot, cue.group);
        this.players.push({ seat, human, cue, initialized: false, state: 'idle',
          shotBall: new THREE.Vector3(), shotAim: new THREE.Vector3() });
      }
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

  update(dt: number, frame: PlayerFrame) {
    if (this.disposed || !Number.isFinite(dt) || dt < 0) return;
    this.group.visible = !frame.hidden;
    if (frame.hidden) return;
    const ball = this.toReference(frame.cueBall);
    const forward = frame.aimForward.clone().setY(0);
    if (!Number.isFinite(forward.lengthSq()) || forward.lengthSq() < 1e-8) return;
    forward.normalize();
    const tableW = this.options.tableW / this.referenceScale;
    const tableL = this.options.tableL / this.referenceScale;
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
        ? chooseHumanEdgePosition(cueBall, aim, tableW, tableL)
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
      const side = new THREE.Vector3(aim.z, 0, -aim.x).normalize();
      const bridge = cueBall.clone().addScaledVector(aim, -CFG.bridgeHandBackFromBall)
        .addScaledVector(side, CFG.bridgeHandSide)
        .setY(CFG.tableTopY + CFG.bridgePalmTableLift);
      const idleRight = rootTarget.clone().add(new THREE.Vector3(
        CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ
      ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const idleLeft = rootTarget.clone().add(new THREE.Vector3(
        -0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale
      ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const idleCue = cuePoseFromGrip(idleRight,
        CFG.idleCueDir.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw),
        CFG.idleCueGripFromBack);
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
      this.solverScene.add(human.modelRoot);
      this.solverScene.updateMatrixWorld(true);
      updateHumanPose(human, Math.min(dt, 0.033), state, rootTarget, aim, bridge,
        idleRight, idleLeft, back, tip, active ? power : 0);
      this.group.add(human.modelRoot);
      setCuePose(player.cue, back, tip);
      // While aiming, the gameplay cue is the visible cue; the parked player
      // continues to hold the original upright reference cue.
      player.cue.group.visible = state === 'idle' || !(frame.cueBack && frame.cueTip);
      player.state = state;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    disposeResources(this.group);
    this.group.removeFromParent();
    this.group.clear();
    this.solverScene.clear();
    this.players.length = 0;
  }
}
