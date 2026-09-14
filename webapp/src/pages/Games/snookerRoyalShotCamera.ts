import * as THREE from 'three';
import type { HumanEyeView } from './shared/poolRoyalPlayerPose.ts';

/** Keep the shooter at the table while the balls travel away from the cue. */
export class SnookerRoyalShotCamera {
  private held: HumanEyeView | null = null;

  get isHoldingShot(): boolean { return this.held !== null; }

  beginShot(eye: HumanEyeView | null, fallback: HumanEyeView): void {
    this.hold(eye ?? fallback);
  }

  private hold(eye: HumanEyeView): HumanEyeView {
    this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
    return this.held;
  }

  resolve({ eye, stroke, shooting, impactPending, cueBlend, excluded = false }: {
    eye: HumanEyeView | null;
    stroke: boolean;
    shooting: boolean;
    impactPending: boolean;
    cueBlend: number;
    excluded?: boolean;
  }): HumanEyeView | null {
    // An explicit overhead/replay/gallery view temporarily owns rendering, but
    // must not discard the shot anchor if the user returns before balls stop.
    if (!shooting && !stroke) this.reset();
    if (excluded) return null;
    if (shooting || stroke) {
      // Follow the original eye animation up to impact only. After impact the
      // rig is driven by the moving ball, so neither eye nor target may update.
      if (eye && (!this.held || impactPending)) this.hold(eye);
      return this.held;
    }
    if (!eye) return null;
    const blend = THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1) * eye.blend;
    return blend > 0 ? { ...eye, blend } : null;
  }

  reset(): void { this.held = null; }
}
