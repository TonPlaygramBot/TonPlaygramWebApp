import * as THREE from 'three';
import { createRoyalDiceMotion, ROYAL_DICE_ROLL_MS } from './royalDiceMotion';
import { type SnakeHuman, worldPoint, smoothContact } from './snakeHumanInteraction';

export const SNAKE_DICE_REACH_MS = 480;
export const SNAKE_DICE_GRIP_MS = 160;
export const SNAKE_DICE_RELEASE_MS = 1120;
export const SNAKE_DICE_PRESENTATION_MS = SNAKE_DICE_RELEASE_MS + ROYAL_DICE_ROLL_MS;

/** The die owns its resting position; the hand must reach it before it can move. */
export function createSnakeDiceInteraction(die: THREE.Object3D, destination: THREE.Vector3, {
  human, startedAt, target = null, height = 0.06, reducedMotion = false
}: { human?: SnakeHuman | null; startedAt: number; target?: THREE.Quaternion | null; height?: number; reducedMotion?: boolean }) {
  const pickup = worldPoint(die), initialPosition = die.position.clone(), initialQ = die.quaternion.clone();
  const palm = human?.arms.right.palm;
  const restPalm = palm ? worldPoint(palm) : pickup.clone();
  const restQ = human?.arms.right.hand.getWorldQuaternion(new THREE.Quaternion());
  const handQ = human?.orientation('right', human.forward, new THREE.Vector3(0, -1, 0));
  const shoulder = human ? worldPoint(human.arms.right.upper) : pickup.clone();
  const hold = human ? shoulder.clone().addScaledVector(human.forward, human.unit * 0.4).add(new THREE.Vector3(0, -human.unit * 0.25, 0)) : pickup.clone();
  const release = human ? shoulder.clone().addScaledVector(human.forward, human.unit * 0.62).add(new THREE.Vector3(0, -human.unit * 0.12, 0)) : pickup.clone();
  let motion: ReturnType<typeof createRoyalDiceMotion> | null = null;
  let landing = target?.clone() ?? null;
  let disposed = false, attached = false;
  const handOffset = new THREE.Quaternion();
  const poseAt = (elapsed: number) => {
    if (!human || !palm || !restQ || !handQ) return;
    human.reset();
    const reach = smoothContact(elapsed / SNAKE_DICE_REACH_MS);
    const squeeze = smoothContact((elapsed - SNAKE_DICE_REACH_MS) / SNAKE_DICE_GRIP_MS);
    const lift = smoothContact((elapsed - SNAKE_DICE_REACH_MS - SNAKE_DICE_GRIP_MS) / 300);
    const toss = smoothContact((elapsed - 940) / (SNAKE_DICE_RELEASE_MS - 940));
    const handTarget = restPalm.clone().lerp(pickup, reach).lerp(hold, lift).lerp(release, toss);
    human.grip('right', squeeze * (1 - smoothContact((elapsed - SNAKE_DICE_RELEASE_MS) / 140)));
    human.reach('right', handTarget, restQ.clone().slerp(handQ, reach));
    if (elapsed >= SNAKE_DICE_REACH_MS + SNAKE_DICE_GRIP_MS) {
      if (!attached) {
        handOffset.copy(handQ).invert().multiply(die.parent!.getWorldQuaternion(new THREE.Quaternion()).multiply(initialQ));
        attached = true;
      }
      die.position.copy(die.parent!.worldToLocal(worldPoint(palm)));
      die.quaternion.copy(die.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(human.arms.right.hand.getWorldQuaternion(new THREE.Quaternion())).multiply(handOffset));
    }
  };
  return {
    setTarget(next: THREE.Quaternion) { landing = next.clone(); motion?.setTarget(next); },
    dispose() { if (disposed) return; disposed = true; human?.reset(); },
    update(now: number) {
      if (disposed) return true;
      const elapsed = Math.max(0, now - startedAt);
      if (elapsed < SNAKE_DICE_RELEASE_MS) { poseAt(elapsed); return false; }
      if (!motion) {
        // Evaluate the exact release pose even when a phone drops that frame.
        poseAt(SNAKE_DICE_RELEASE_MS);
        if (!human) die.position.copy(initialPosition);
        motion = createRoyalDiceMotion(die, die.position, destination, {
          startedAt: startedAt + SNAKE_DICE_RELEASE_MS, target: landing, height, reducedMotion
        });
      }
      const done = motion.update(now);
      if (human && palm && handQ && restQ) {
        human.reset();
        const recovery = smoothContact((elapsed - SNAKE_DICE_RELEASE_MS) / 440);
        human.reach('right', release.clone().lerp(restPalm, recovery), handQ.clone().slerp(restQ, recovery));
        if (recovery >= 1) human.reset();
      }
      return done;
    }
  };
}
