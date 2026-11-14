import * as THREE from 'three';
import type { HumanEyeView } from './shared/poolRoyalPlayerPose.ts';

export const SNOOKER_PLAYER_FOLLOW_THROUGH_MS = 900;
export const SNOOKER_PLAYER_SHOT_FOV = 66;
export const SNOOKER_CUE_BALL_SCREEN_Y = -0.28;

/** A cue-line player view, independent of orbit cameras and character assets. */
export function snookerRoyalFallbackEye(ball: THREE.Vector3, forward: THREE.Vector3,
  cueLength: number, ballRadius: number): HumanEyeView {
  const direction = forward.clone().setY(0).normalize();
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  const distance = Math.max(cueLength * .7, ballRadius * 8);
  const height = ballRadius * 4;
  const position = ball.clone().addScaledVector(direction, -distance);
  position.y += height;
  // Keep the ball at 64% down the phone display, leaving room for the cue
  // below and the shot ahead. Changing aim never introduces a lateral offset.
  const framingAngle = Math.atan(-SNOOKER_CUE_BALL_SCREEN_Y *
    Math.tan(THREE.MathUtils.degToRad(SNOOKER_PLAYER_SHOT_FOV / 2)));
  const pitch = Math.atan2(-height, distance) + framingAngle;
  const gaze = direction.clone().multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch));
  return {
    position,
    target: position.clone().addScaledVector(gaze, Math.hypot(distance, height)),
    blend: 1,
    fov: SNOOKER_PLAYER_SHOT_FOV,
    zoom: 1
  };
}

/** Hold the player's cue-line viewpoint until every ball has stopped. */
export class SnookerRoyalShotCamera {
  private held: HumanEyeView | null = null;
  private impactAt: number | null = null;
  private broadcast = false;
  private strokeAnchored = false;

  get isHoldingShot(): boolean { return this.held !== null; }
  get isBroadcasting(): boolean { return this.broadcast; }

  beginShot(eye: HumanEyeView | null, fallback: HumanEyeView): void {
    this.reset();
    this.hold(eye ?? fallback);
    this.strokeAnchored = true;
  }

  /** Called at visible tip contact, before ball physics or the rig can move. */
  markImpact(now: number, eye: HumanEyeView | null = null): void {
    if (this.impactAt !== null || this.broadcast) return;
    if (eye && !this.strokeAnchored) this.hold(eye);
    this.impactAt = now;
  }

  private hold(eye: HumanEyeView): HumanEyeView {
    this.held = { ...eye, position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
    return this.held;
  }

  resolve({ eye, stroke, shooting, impactPending, cueBlend, now = performance.now(), excluded = false, localTurn = true }: {
    eye: HumanEyeView | null;
    stroke: boolean;
    shooting: boolean;
    impactPending: boolean;
    cueBlend: number;
    now?: number;
    excluded?: boolean;
    localTurn?: boolean;
  }): HumanEyeView | null {
    if (!localTurn) { this.reset(); return null; }
    if (!shooting && !stroke) this.reset();
    if (shooting || stroke) {
      if (this.broadcast) return null;
      if (this.impactAt === null) {
        if (impactPending) {
          // A stroke starts from a snapshot of the settled address view. The
          // character's backswing must not pull the player's head backwards.
          if (eye && !this.strokeAnchored) this.hold(eye);
        } else {
          // Also support a missing rig or a shot without stroke animation.
          if (!this.held && eye) this.hold(eye);
          this.markImpact(now);
        }
      }
      // A timer must not switch a live player shot to side or pocket tracking.
      // The caller releases this snapshot when both stroke and shooting end.
      // Explicit views override rendering without losing the shot's anchor.
      return excluded ? null : this.held;
    }
    if (excluded) return null;
    if (!eye) return null;
    const blend = THREE.MathUtils.smoothstep(1 - cueBlend, 0.06, 1) * eye.blend;
    return blend > 0 ? { ...eye, blend } : null;
  }

  reset(): void {
    this.held = null;
    this.impactAt = null;
    this.broadcast = false;
    this.strokeAnchored = false;
  }
}
