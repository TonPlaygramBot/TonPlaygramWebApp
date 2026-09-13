import * as THREE from 'three';
import { ROYAL_DICE_ROLL_MS } from './royalDiceMotion';
import { type SnakeHuman, worldPoint, smoothContact } from './snakeHumanInteraction';

export const SNAKE_DICE_REACH_MS = 480;
export const SNAKE_DICE_GRIP_MS = 160;
export const SNAKE_DICE_RELEASE_MS = 1120;
export const SNAKE_DICE_PRESENTATION_MS = SNAKE_DICE_RELEASE_MS + ROYAL_DICE_ROLL_MS;
export const SNAKE_DICE_READ_MS = 750;
const FLIGHT_MS = 760;
const UP = new THREE.Vector3(0, 1, 0);

/** The resting die is authoritative. Reach, close, carry, then release toward the receiver. */
export function createSnakeDiceInteraction(die: THREE.Object3D, destination: THREE.Vector3, {
  human, startedAt, target = null, height = 0.06, reducedMotion = false
}: { human?: SnakeHuman | null; startedAt: number; target?: THREE.Quaternion | null; height?: number; reducedMotion?: boolean }) {
  const parent = die.parent!;
  const pickup = worldPoint(die), initialQ = die.quaternion.clone();
  const landingWorld = parent.localToWorld(destination.clone());
  const palm = human?.arms.right.palm;
  const restPalm = palm ? worldPoint(palm) : pickup.clone();
  const restQ = human?.arms.right.hand.getWorldQuaternion(new THREE.Quaternion());
  const shoulder = human ? worldPoint(human.arms.right.upper) : pickup.clone();
  const direction = landingWorld.clone().sub(shoulder).setY(0).normalize();
  const forward = human ? human.forward.clone().lerp(direction, 0.6).normalize() : direction;
  const handQ = human?.orientation('right', forward, new THREE.Vector3(0, -1, 0));
  const hold = human ? shoulder.clone().addScaledVector(forward, human.unit * 0.32).addScaledVector(UP, -human.unit * 0.3) : pickup.clone();
  const release = human ? shoulder.clone().addScaledVector(forward, human.unit * 0.62).addScaledVector(UP, -human.unit * 0.12) : pickup.clone();
  const flightSeconds = FLIGHT_MS / 1000;
  const gravity = Math.max(9.8, height * 4);
  const velocity = landingWorld.clone().sub(release).divideScalar(flightSeconds).addScaledVector(UP, gravity * flightSeconds / 2);
  const releaseQ = new THREE.Quaternion(), handOffset = new THREE.Quaternion();
  let landing = target?.clone() ?? null;
  let disposed = false, attached = false, released = false;
  const poseAt = (elapsed: number) => {
    if (!human || !palm || !restQ || !handQ) return;
    human.reset();
    const reach = smoothContact(elapsed / SNAKE_DICE_REACH_MS);
    const squeeze = smoothContact((elapsed - SNAKE_DICE_REACH_MS) / SNAKE_DICE_GRIP_MS);
    const lift = smoothContact((elapsed - 640) / 300);
    const handTarget = restPalm.clone().lerp(pickup, reach).lerp(hold, lift);
    if (elapsed >= 940) {
      // Hermite wind-up: zero speed at the hold, exact ballistic speed at release.
      const t = THREE.MathUtils.clamp((elapsed - 940) / 180, 0, 1);
      handTarget.copy(hold).multiplyScalar(2 * t ** 3 - 3 * t ** 2 + 1)
        .addScaledVector(release, -2 * t ** 3 + 3 * t ** 2)
        .addScaledVector(velocity, (t ** 3 - t ** 2) * 0.18);
    }
    human.grip('right', squeeze);
    human.reach('right', handTarget, restQ.clone().slerp(handQ, reach), false);
    if (elapsed >= 640) {
      if (!attached) {
        handOffset.copy(handQ).invert().multiply(parent.getWorldQuaternion(new THREE.Quaternion()).multiply(initialQ));
        attached = true;
      }
      die.position.copy(parent.worldToLocal(worldPoint(palm)));
      die.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(human.arms.right.hand.getWorldQuaternion(new THREE.Quaternion())).multiply(handOffset));
    }
    human.conformDie('right', die, squeeze);
  };
  return {
    setTarget(next: THREE.Quaternion) { landing = next.clone(); },
    dispose() { if (disposed) return; disposed = true; human?.reset(); },
    update(now: number) {
      if (disposed) return true;
      const elapsed = Math.max(0, now - startedAt);
      if (elapsed < SNAKE_DICE_RELEASE_MS) { poseAt(elapsed); return false; }
      if (!released) {
        // Sample the exact release even after dropped frames; integrate from this
        // transform, never from the last rendered frame or an artificial start.
        poseAt(SNAKE_DICE_RELEASE_MS);
        release.copy(worldPoint(die)); releaseQ.copy(die.quaternion);
        velocity.copy(landingWorld).sub(release).divideScalar(flightSeconds).addScaledVector(UP, gravity * flightSeconds / 2);
        released = true;
      }
      const flight = Math.max(0, elapsed - SNAKE_DICE_RELEASE_MS);
      const seconds = Math.min(flight, FLIGHT_MS) / 1000;
      const position = release.clone().addScaledVector(velocity, seconds).addScaledVector(UP, -0.5 * gravity * seconds * seconds);
      if (flight >= FLIGHT_MS) {
        const bounce = THREE.MathUtils.clamp((flight - FLIGHT_MS) / (ROYAL_DICE_ROLL_MS - FLIGHT_MS), 0, 1);
        position.copy(landingWorld).addScaledVector(UP, Math.abs(Math.sin(bounce * Math.PI * 2)) * (1 - bounce) * (reducedMotion ? 0.015 : 0.055));
      }
      die.position.copy(parent.worldToLocal(position));
      const t = THREE.MathUtils.clamp(flight / ROYAL_DICE_ROLL_MS, 0, 1);
      const spin = reducedMotion ? 0 : (t - 0.04 * (1 - Math.exp(-t / 0.04))) * 10;
      die.quaternion.copy(releaseQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin, spin * 1.3, spin * 0.8)));
      if (landing) die.quaternion.slerp(landing, smoothContact((flight - FLIGHT_MS + 80) / (ROYAL_DICE_ROLL_MS - FLIGHT_MS + 80)));
      if (human && palm && handQ && restQ) {
        human.reset();
        const follow = release.clone().addScaledVector(velocity, 0.04);
        const followTime = THREE.MathUtils.clamp(flight / 80, 0, 1);
        const recovery = smoothContact((flight - 80) / 360);
        const handTarget = flight < 80 ? release.clone().lerp(follow, 1 - (1 - followTime) ** 2) : follow.lerp(restPalm, recovery);
        human.grip('right', 1 - smoothContact(flight / 100));
        human.reach('right', handTarget, handQ.clone().slerp(restQ, recovery), false);
        if (recovery >= 1) human.reset();
      }
      if (t >= 1) { die.position.copy(destination); if (landing) die.quaternion.copy(landing); return true; }
      return false;
    }
  };
}
