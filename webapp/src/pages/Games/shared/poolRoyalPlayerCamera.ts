import * as THREE from 'three';
import { SnookerRoyalShotCamera } from '../snookerRoyalShotCamera.ts';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

export const POOL_ROYAL_PLAYER_FOV = 66;

type PlayerViewState = Omit<Parameters<SnookerRoyalShotCamera['resolve']>[0], 'cueBlend'>;

/** The game's player view and its preview share an exact eye view, independent of orbit zoom. */
export class PoolRoyalPlayerCamera extends SnookerRoyalShotCamera {
  override resolve(state: PlayerViewState): HumanEyeView | null {
    // Keep Snooker's shot/follow-through ownership, but match the sample's
    // full player view even when orbit controls or a new turn reset the blend.
    return super.resolve({ ...state, cueBlend: 0 });
  }
}

/** Apply the same pose and lens in production and the playable camera preview. */
export function applyPoolRoyalPlayerView(camera: THREE.PerspectiveCamera, eye: HumanEyeView): THREE.Vector3 {
  camera.position.copy(eye.position);
  camera.up.set(0, 1, 0);
  camera.fov = POOL_ROYAL_PLAYER_FOV;
  camera.zoom = 1;
  camera.filmOffset = 0;
  if (camera.view?.enabled) camera.clearViewOffset();
  camera.lookAt(eye.target);
  // Preserve the viewport aspect and scene-specific near/far clipping planes.
  camera.updateProjectionMatrix();
  return eye.target.clone();
}
