import * as THREE from 'three';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

/** Own the shot view across ALL render-camera branches, including AI/action cameras. */
export class PoolRoyalShotCamera {
  private held: HumanEyeView | null = null;
  private lastStrokeAt = -Infinity;
  private readonly eyeLockBlend: number;

  /** Pool's aiming view reaches the eyes before the orbit reaches its limit. */
  constructor(eyeLockBlend = 0) { this.eyeLockBlend = eyeLockBlend; }

  resolve({ eye, stroke, shooting, cueBlend, now, excluded = false, aiming = false }: {
    eye: HumanEyeView | null; stroke: boolean; shooting: boolean;
    cueBlend: number; now: number; excluded?: boolean; aiming?: boolean;
  }): HumanEyeView | null {
    if (excluded) { this.reset(); return null; }
    if (stroke && eye && !this.held) {
      this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
      this.lastStrokeAt = now;
      return this.held;
    }
    // Freeze the address pose for the complete stroke, including its follow-through.
    // Refreshing the pose here made the eyes chase the cue ball after contact.
    if (stroke && this.held) return this.held;
    if (shooting && this.held) {
      const blend = 1 - THREE.MathUtils.smoothstep(now - this.lastStrokeAt, 600, 900);
      if (blend > 0) return { ...this.held, blend };
    }
    if (!shooting) this.reset();
    if (shooting || !eye) return null;
    const weight = (aiming ? 1 : THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1 - this.eyeLockBlend)) * eye.blend;
    return weight > 0 ? { ...eye, blend: weight } : null;
  }

  reset() { this.held = null; this.lastStrokeAt = -Infinity; }
}
