import * as THREE from 'three';
import {
  createCheckersHumanActor,
  setCheckersHumanView,
  idleCheckersHuman,
  disposeCheckersHuman,
  updateCheckersHumanMove,
  PHYSICAL_MOVE_DURATION_MS
} from '../checkers/checkersHumanActors.ts';
import type {
  CheckersHumanActor,
  CheckersHumanMove
} from '../checkers/checkersHumanActors.ts';
import { applySeatedBoardPose } from '../chess/seatedHumanRig.ts';
import { applyHandGrip } from '../chess/anatomicalHand.ts';
import {
  palmMarker,
  solveArm,
  world,
  smooth
} from '../../utils/ludoHumanMotion.ts';
import {
  createRoyalDiceMotion,
  ROYAL_DICE_ROLL_MS,
  ROYAL_DICE_READ_MS
} from '../../utils/royalDiceMotion.ts';
import {
  BACKGAMMON_ARENA,
  BACKGAMMON_PLAY_SCALE,
  BACKGAMMON_PLAY_Y_OFFSET,
  backgammonWorldPoint
} from './arenaLayout.ts';

// Rig dimensions remain in board-local units; the root uses the same uniform
// conversion as the board, checker meshes and dice.
export const BACKGAMMON_HUMAN_HEIGHT = 5.6;
export const BACKGAMMON_SEAT_Y =
  (BACKGAMMON_ARENA.seatY - BACKGAMMON_PLAY_Y_OFFSET) / BACKGAMMON_PLAY_SCALE;
export const BACKGAMMON_DICE_PICKUP_MS = 1340;
export type BackgammonActor = CheckersHumanActor & {
  palm: THREE.Object3D | null;
};
export function createBackgammonActor(
  template: THREE.Object3D,
  seat: 'bottom' | 'top'
): BackgammonActor {
  const entry = createCheckersHumanActor(template, {
    seat,
    distance:
      (seat === 'bottom'
        ? BACKGAMMON_ARENA.playerChairDistance
        : BACKGAMMON_ARENA.opponentChairDistance) / BACKGAMMON_PLAY_SCALE,
    seatY: BACKGAMMON_SEAT_Y,
    height: BACKGAMMON_HUMAN_HEIGHT
  });
  entry.root.position.z *= BACKGAMMON_PLAY_SCALE;
  entry.root.position.y = BACKGAMMON_PLAY_Y_OFFSET;
  entry.root.scale.setScalar(BACKGAMMON_PLAY_SCALE);
  entry.root.updateMatrixWorld(true);
  entry.root.name = `backgammon-human-${seat}`;
  return { ...entry, palm: palmMarker(entry.rig, 'right') };
}
export {
  setCheckersHumanView as setBackgammonView,
  idleCheckersHuman as idleBackgammonActor,
  disposeCheckersHuman as disposeBackgammonActor
};

export function updateBackgammonChecker(
  entry: BackgammonActor | undefined,
  action: CheckersHumanMove,
  progress: number
) {
  return updateCheckersHumanMove(entry, action, progress, 0.24);
}
export { PHYSICAL_MOVE_DURATION_MS };

// Ludo's phases (550 ms reach, 170 ms close, 360 ms windup, 260 ms release)
// use the real palm effector. Both dice retain a fixed palm-local transform
// until release, then the shared elapsed-time flight owns the result.
export function createBackgammonDiceAction(
  actor: BackgammonActor | undefined,
  dice: THREE.Object3D[],
  targets: THREE.Vector3[],
  quaternions: THREE.Quaternion[],
  startedAt: number
) {
  const origins = dice.map((die) => die.getWorldPosition(new THREE.Vector3()));
  const pickup = origins
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .divideScalar(dice.length);
  const restPalm = actor?.palm ? world(actor.palm) : pickup.clone();
  const direction = actor?.seat === 'top' ? 1 : -1;
  const windup = pickup
    .clone()
    .add(
      new THREE.Vector3(
        0.05 * direction,
        0.4,
        -0.24 * direction
      ).multiplyScalar(BACKGAMMON_PLAY_SCALE)
    );
  const release = pickup
    .clone()
    .add(
      new THREE.Vector3(0, 0.24, 0.18 * direction).multiplyScalar(
        BACKGAMMON_PLAY_SCALE
      )
    );
  let attachments:
    | { position: THREE.Vector3; quaternion: THREE.Quaternion }[]
    | null = null;
  let flights: ReturnType<typeof createRoyalDiceMotion>[] | null = null;
  return {
    update(now: number) {
      const ms = Math.max(0, now - startedAt);
      if (ms < BACKGAMMON_DICE_PICKUP_MS) {
        const grip = smooth((ms - 550) / 170) * (1 - smooth((ms - 1160) / 180));
        const reach = smooth(ms / 550);
        if (actor?.palm) {
          applySeatedBoardPose(actor.rig, 'reachPiece', reach, grip, {
            forwardReach: 0.5,
            sideReach: 0
          });
          applyHandGrip(actor.rig, 'right', grip * 0.8);
          let target = restPalm.clone().lerp(pickup, reach);
          if (ms >= 720 && ms < 1080)
            target = pickup.clone().lerp(windup, smooth((ms - 720) / 360));
          else if (ms >= 1080)
            target = windup.clone().lerp(release, smooth((ms - 1080) / 260));
          solveArm(actor.rig, 'right', actor.palm, target, undefined, true);
          actor.root.updateMatrixWorld(true);
          if (ms >= 550 && !attachments)
            attachments = dice.map((die, index) => ({
              position: actor.palm!.worldToLocal(origins[index].clone()),
              quaternion: actor
                .palm!.getWorldQuaternion(new THREE.Quaternion())
                .invert()
                .multiply(die.getWorldQuaternion(new THREE.Quaternion()))
            }));
          if (ms >= 720) {
            dice.forEach((die, index) => {
              const attachment = attachments![index];
              die.position.copy(
                die.parent!.worldToLocal(
                  actor.palm!.localToWorld(attachment.position.clone())
                )
              );
              die.quaternion.copy(
                die
                  .parent!.getWorldQuaternion(new THREE.Quaternion())
                  .invert()
                  .multiply(
                    actor.palm!.getWorldQuaternion(new THREE.Quaternion())
                  )
                  .multiply(attachment.quaternion)
              );
            });
          }
        }
        return false;
      }
      if (!flights)
        flights = dice.map((die, i) =>
          createRoyalDiceMotion(die, die.position.clone(), targets[i], {
            startedAt: startedAt + BACKGAMMON_DICE_PICKUP_MS,
            target: quaternions[i],
            height: 0.22
          })
        );
      if (actor) {
        const retract = 1 - smooth((ms - BACKGAMMON_DICE_PICKUP_MS) / 360);
        applySeatedBoardPose(actor.rig, 'reachPiece', retract, 0);
      }
      flights.forEach((flight) => flight.update(now));
      return (
        ms >=
        BACKGAMMON_DICE_PICKUP_MS + ROYAL_DICE_ROLL_MS + ROYAL_DICE_READ_MS
      );
    }
  };
}

// A fixed bottom seat, as in Chess/Checkers. Resize changes only the lens;
// it never swaps screen directions or rotates the board underneath a tap.
export function applyBackgammonCamera(
  camera: THREE.PerspectiveCamera,
  mode: '2d' | '3d',
  target: THREE.Vector3,
  surfaceY = BACKGAMMON_ARENA.tableHeight
) {
  camera.position.copy(
    backgammonWorldPoint(
      0,
      mode === '2d' ? 7 : 3.6,
      mode === '2d' ? 0.001 : 2.75,
      surfaceY
    )
  );
  target.copy(
    backgammonWorldPoint(0, mode === '2d' ? 1.35 : 1.85, 0, surfaceY)
  );
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const inverse = camera.matrixWorldInverse;
  // Include every board edge and the opponent's upper body in portrait.
  const points = [-1.42, 1.42].flatMap((x) =>
    [-1.04, 1.04].map((z) => backgammonWorldPoint(x, 1.42, z, surfaceY))
  );
  if (mode === '3d') points.push(backgammonWorldPoint(0, 3.2, -1.48));
  let tanHalf = Math.tan(THREE.MathUtils.degToRad(25));
  for (const p of points) {
    p.applyMatrix4(inverse);
    const depth = Math.max(0.01, -p.z);
    tanHalf = Math.max(
      tanHalf,
      Math.abs(p.y) / depth / 0.76,
      Math.abs(p.x) / depth / Math.max(0.1, camera.aspect) / 0.88
    );
  }
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
  camera.updateProjectionMatrix();
}
