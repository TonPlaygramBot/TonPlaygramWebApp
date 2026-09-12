import * as THREE from 'three';

// The same short, eased table throw used by Ludo Battle Royal and Tavull.
// Elapsed-time rotation keeps the motion identical on 30/60/90 Hz phones.
export const ROYAL_DICE_ROLL_MS = 980;
export const ROYAL_DICE_READ_MS = 320;

export function createRoyalDiceMotion(
  die: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  { startedAt = performance.now(), duration = ROYAL_DICE_ROLL_MS, height = 0.06,
    target = null, reducedMotion = false }: {
    startedAt?: number; duration?: number; height?: number;
    target?: THREE.Quaternion | null; reducedMotion?: boolean;
  } = {}
) {
  const origin = from.clone();
  const destination = to.clone();
  const initial = die.quaternion.clone();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const spin = new THREE.Vector3(1.2 + Math.random() * 0.7, 1.35 + Math.random() * 0.65, 1.05 + Math.random() * 0.75);
  const wobble = new THREE.Vector3((Math.random() - 0.5) * height, 0, (Math.random() - 0.5) * height);
  let landing = target?.clone() ?? null;
  return {
    setTarget(next: THREE.Quaternion) { landing = next.clone(); },
    update(now: number) {
      const t = THREE.MathUtils.clamp((now - startedAt) / Math.max(1, duration), 0, 1);
      const eased = 1 - (1 - t) ** 3;
      die.position.lerpVectors(origin, destination, eased);
      if (!reducedMotion) {
        die.position.addScaledVector(wobble, Math.sin(eased * Math.PI) * 0.45);
        die.position.y += Math.sin(Math.PI * t) * height;
        // Integrate Ludo's decaying spin rate instead of adding per frame.
        const travel = (0.72 * t + 0.07 * (1 - (1 - t) ** 4)) * 12;
        euler.set(spin.x * travel, spin.y * travel, spin.z * travel);
        rotation.setFromEuler(euler);
        die.quaternion.copy(initial).multiply(rotation);
      }
      if (landing) {
        const settle = THREE.MathUtils.smoothstep(t, reducedMotion ? 0 : 0.72, 1);
        die.quaternion.slerp(landing, settle);
      }
      if (t >= 1) {
        die.position.copy(destination);
        if (landing) die.quaternion.copy(landing);
        return true;
      }
      return false;
    }
  };
}
