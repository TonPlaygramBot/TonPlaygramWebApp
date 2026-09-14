import * as THREE from 'three';
import type { HumanEyeView } from './shared/poolRoyalPlayerPose.ts';

export const SNOOKER_PLAYER_FOLLOW_THROUGH_MS = 900;

/** A safe address view while the character is still loading or settling. */
export function snookerRoyalFallbackEye(ball: THREE.Vector3, forward: THREE.Vector3,
  cueLength: number, ballRadius: number): HumanEyeView {
  const direction = forward.clone().setY(0).normalize();
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  return {
    position: ball.clone().addScaledVector(direction, -cueLength * .7)
      .add(new THREE.Vector3(0, ballRadius * 4, 0)),
    target: ball.clone().addScaledVector(direction, ballRadius * 5),
    blend: 1
  };
}

/** Player address → fixed follow-through → broadcast, once per shot. */
export class SnookerRoyalShotCamera {
  private held: HumanEyeView | null = null;
  private impactAt: number | null = null;
  private broadcast = false;

  get isHoldingShot(): boolean { return this.held !== null; }
  get isBroadcasting(): boolean { return this.broadcast; }

  beginShot(eye: HumanEyeView | null, fallback: HumanEyeView): void {
    this.reset();
    this.hold(eye ?? fallback);
  }

  /** Called at visible tip contact, before ball physics or the rig can move. */
  markImpact(now: number, eye: HumanEyeView | null = null): void {
    if (this.impactAt !== null || this.broadcast) return;
    if (eye) this.hold(eye);
    this.impactAt = now;
  }

  private hold(eye: HumanEyeView): HumanEyeView {
    this.held = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
    return this.held;
  }

  resolve({ eye, stroke, shooting, impactPending, cueBlend, now = performance.now(), excluded = false }: {
    eye: HumanEyeView | null;
    stroke: boolean;
    shooting: boolean;
    impactPending: boolean;
    cueBlend: number;
    now?: number;
    excluded?: boolean;
  }): HumanEyeView | null {
    if (!shooting && !stroke) this.reset();
    if (shooting || stroke) {
      if (this.broadcast) return null;
      if (this.impactAt === null) {
        if (impactPending) {
          if (eye) this.hold(eye);
        } else {
          // Also support a missing rig or a shot without stroke animation.
          if (!this.held && eye) this.hold(eye);
          this.markImpact(now);
        }
      }
      if (this.impactAt !== null && !stroke && now - this.impactAt >= SNOOKER_PLAYER_FOLLOW_THROUGH_MS) {
        this.held = null;
        this.broadcast = true;
        return null;
      }
      // Explicit views override rendering without pausing the shot clock.
      return excluded ? null : this.held;
    }
    if (excluded) return null;
    if (!eye) return null;
    const blend = THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1) * eye.blend;
    return blend > 0 ? { ...eye, blend } : null;
  }

  reset(): void { this.held = null; this.impactAt = null; this.broadcast = false; }
}
