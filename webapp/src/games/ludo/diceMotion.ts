import * as THREE from 'three';
import { world, setWorldPose, palmMarker, solveArm, savePose, blendPose, type Rig } from './characterContact';
export const DICE_RELEASE_MS = 1100;
export type ReleasePose = { position: THREE.Vector3; quaternion: THREE.Quaternion };
type Entry = { actor: THREE.Object3D; rig: Rig };

// Historical seated wind-up/release; only the arm/torso reach toward the real die.
export function createDiceGesture(entry: Entry, dice: THREE.Object3D, applyPose: (mode: string, grip: number) => void,
  options: { startMs: number; isCurrent: () => boolean; onRelease: (pose: ReleasePose | null) => void }) {
  const { actor, rig } = entry, palm = palmMarker(rig, 'right');
  actor.updateWorldMatrix(true, true);
  const pickup = world(dice), pickupQ = dice.getWorldQuaternion(new THREE.Quaternion());
  const original = savePose(rig), originalHand = world(palm);
  applyPose('gripDice', 1); actor.updateWorldMatrix(true, true);
  solveArm(rig, 'right', palm, pickup, undefined, true);
  const grip = savePose(rig);
  applyPose('windUp', 1); const windup = savePose(rig);
  applyPose('release', 0); const release = savePose(rig);
  applyPose('idle', 0); const idle = savePose(rig);
  blendPose(rig, original, original, 1);
  let released = false, finished = false;
  return {
    get finished() { return finished; },
    cancel() { if (!released) options.onRelease(null); released = true; finished = true; },
    update(now: number) {
      if (finished) return;
      if (!options.isCurrent()) { this.cancel(); return; }
      const elapsed = Math.max(0, now-options.startMs);
      if (elapsed < 320) {
        blendPose(rig, original, grip, elapsed/320);
        solveArm(rig, 'right', palm, originalHand.clone().lerp(pickup, THREE.MathUtils.smoothstep(elapsed,0,320)), undefined, true);
      } else if (elapsed < 540) {
        blendPose(rig, grip, grip, 1); actor.updateWorldMatrix(true, true);
        setWorldPose(dice, world(palm), pickupQ.clone().slerp(palm.getWorldQuaternion(new THREE.Quaternion()), THREE.MathUtils.smoothstep(elapsed,320,440)));
      } else if (elapsed < DICE_RELEASE_MS) {
        if (elapsed < 840) blendPose(rig, grip, windup, (elapsed-540)/300);
        else blendPose(rig, windup, release, (elapsed-840)/260);
        actor.updateWorldMatrix(true, true);
        setWorldPose(dice, world(palm), palm.getWorldQuaternion(new THREE.Quaternion()));
      } else {
        if (!released) {
          // Sample the exact release even when a low-FPS frame skips the boundary.
          blendPose(rig, release, release, 1); actor.updateWorldMatrix(true, true);
          const pose = { position: world(palm), quaternion: palm.getWorldQuaternion(new THREE.Quaternion()) };
          setWorldPose(dice, pose.position, pose.quaternion); released = true; options.onRelease(pose);
        }
        blendPose(rig, release, idle, (elapsed-DICE_RELEASE_MS)/520);
        if (elapsed >= DICE_RELEASE_MS+520) finished = true;
      }
      actor.updateWorldMatrix(true, true);
    }
  };
}
export function applyDiceFlight(dice: THREE.Object3D, start: ReleasePose, endWorld: THREE.Vector3, t: number, lift: number) {
  const position = start.position.clone().lerp(endWorld, 1-Math.pow(1-t, 2));
  position.y += Math.sin(t*Math.PI)*lift*(1-.3*t);
  const tumble = new THREE.Quaternion().setFromEuler(new THREE.Euler(t*5*Math.PI,t*3*Math.PI,t*4*Math.PI));
  setWorldPose(dice, position, start.quaternion.clone().multiply(tumble));
}
