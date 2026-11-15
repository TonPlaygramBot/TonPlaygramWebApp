import * as THREE from 'three';
import type { HumanEyeView } from './shared/poolRoyalPlayerPose.ts';
import { PoolRoyalShotCamera } from './shared/poolRoyalShotCamera.ts';

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

/** Use Pool Royal's contact hold and broadcast handoff with Snooker's cue-line fallback. */
export class SnookerRoyalShotCamera extends PoolRoyalShotCamera {
  beginShot(eye: HumanEyeView | null, fallback?: HumanEyeView): void {
    super.beginShot(eye ?? fallback ?? null);
  }

  resolve(options: Omit<Parameters<PoolRoyalShotCamera['resolve']>[0], 'now'> & {
    now?: number;
    impactPending?: boolean;
  }): HumanEyeView | null {
    return super.resolve({ ...options, now: options.now ?? performance.now() });
  }
}
