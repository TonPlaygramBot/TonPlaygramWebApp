import * as THREE from 'three';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

/** Hold the local player view through contact, then yield to spectator cameras. */
export class PoolRoyalShotCamera {
  private held: HumanEyeView | null = null;
  private impactAt: number | null = null;
  private broadcast = false;
  private readonly eyeLockBlend: number;

  /** Pool's aiming view reaches the eyes before the orbit reaches its limit. */
  constructor(eyeLockBlend = 0) { this.eyeLockBlend = eyeLockBlend; }

  beginShot(eye: HumanEyeView | null): void {
    this.reset();
    if (eye) this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
  }

  markImpact(now: number): void {
    if (this.impactAt === null) this.impactAt = now;
  }

  resolve({ eye, stroke, shooting, cueBlend, now, excluded = false, aiming = false, localTurn = true }: {
    eye: HumanEyeView | null; stroke: boolean; shooting: boolean;
    cueBlend: number; now: number; excluded?: boolean; aiming?: boolean; localTurn?: boolean;
  }): HumanEyeView | null {
    if (!localTurn) { this.reset(); return null; }
    if (shooting || stroke) {
      if (this.broadcast) return null;
      if (!this.held && eye) {
        this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
      }
      // Production marks the real contact. Support non-animated shots as well.
      if (!stroke && this.impactAt === null) this.markImpact(now);
      if (!stroke && this.impactAt !== null && now - this.impactAt >= 900) {
        this.held = null;
        this.broadcast = true;
        return null;
      }
      // Manual views do not erase the anchor or restart the follow-through clock.
      return excluded ? null : this.held;
    }
    this.reset();
    if (excluded || !eye) return null;
    const weight = (aiming ? 1 : THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1 - this.eyeLockBlend)) * eye.blend;
    return weight > 0 ? { ...eye, blend: weight } : null;
  }

  reset() { this.held = null; this.impactAt = null; this.broadcast = false; }
}
