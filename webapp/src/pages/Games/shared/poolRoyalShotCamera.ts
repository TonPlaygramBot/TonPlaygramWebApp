import * as THREE from 'three';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

/** Own the shot view across ALL render-camera branches, including AI/action cameras. */
export class PoolRoyalShotCamera {
  private readonly followPlayerEyes: boolean;

  constructor(followPlayerEyes = false) { this.followPlayerEyes = followPlayerEyes; }

  private held: HumanEyeView | null = null;
  private lastStrokeAt = -Infinity;

  resolve({ eye, stroke, shooting, cueBlend, now, excluded = false }: {
    eye: HumanEyeView | null; stroke: boolean; shooting: boolean;
    cueBlend: number; now: number; excluded?: boolean;
  }): HumanEyeView | null {
    if (excluded) { this.reset(); return null; }
    // Pool Royal opts into continuous eye attachment. Other games retain their
    // existing shot hold and broadcast handoff until explicitly enabled.
    if (this.followPlayerEyes) return eye
      ? { position: eye.position.clone(), target: eye.target.clone(), blend: 1 } : null;
    if (stroke && eye) {
      this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
      this.lastStrokeAt = now;
      return this.held;
    }
    if (shooting && this.held) {
      const blend = 1 - THREE.MathUtils.smoothstep(now - this.lastStrokeAt, 600, 900);
      if (blend > 0) return { ...this.held, blend };
    }
    if (!shooting) this.reset();
    if (shooting || !eye) return null;
    const weight = THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1) * eye.blend;
    return weight > 0 ? { ...eye, blend: weight } : null;
  }

  reset() { this.held = null; this.lastStrokeAt = -Infinity; }
}
