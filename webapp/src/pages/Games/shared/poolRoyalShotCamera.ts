import * as THREE from 'three';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

/** Own the shot view across ALL render-camera branches, including AI/action cameras. */
export class PoolRoyalShotCamera {
  private held: HumanEyeView | null = null;
  private lastStrokeAt = -Infinity;

  resolve({ eye, stroke, shooting, cueBlend, now, excluded = false }: {
    eye: HumanEyeView | null; stroke: boolean; shooting: boolean;
    cueBlend: number; now: number; excluded?: boolean;
  }): HumanEyeView | null {
    if (excluded) { this.reset(); return null; }
    if (stroke && eye) {
      this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
      this.lastStrokeAt = now;
      return this.held;
    }
    if (shooting && this.held) {
      // Follow the animated player's eyes during follow-through; never hold a
      // stale world position while their head moves away from it.
      if (eye) {
        this.held.position.copy(eye.position);
        this.held.target.copy(eye.target);
      }
      const blend = 1 - THREE.MathUtils.smoothstep(now - this.lastStrokeAt, 600, 900);
      if (blend > 0) return { ...this.held, blend };
    }
    if (!shooting) this.reset();
    if (shooting || !eye) return null;
    const weight = cueBlend <= 0.72 ? 1 : THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 0.28);
    return weight > 0 ? { ...eye, blend: weight } : null;
  }

  reset() { this.held = null; this.lastStrokeAt = -Infinity; }
}
