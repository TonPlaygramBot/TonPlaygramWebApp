import * as THREE from 'three';
import type { HumanEyeView } from './poolRoyalPlayerPose.ts';

/** Screen coordinates: dragging down lowers the view; dragging up stands up. */
export function royalCameraBlendFromDrag(blend: number, deltaY: number, height: number): number {
  const travel = THREE.MathUtils.clamp(height * 0.4 || 240, 120, 360);
  return THREE.MathUtils.clamp(blend - deltaY / travel, 0, 1);
}

/** Freeze the selected standing/intermediate/cue view, not just the raw eye pose. */
export function captureRoyalPlayerView(
  camera: THREE.PerspectiveCamera | null,
  target: THREE.Vector3 | null,
  world: THREE.Object3D,
  fallback: HumanEyeView | null
): HumanEyeView | null {
  if (!camera || !target) return fallback;
  return {
    position: world.worldToLocal(camera.getWorldPosition(new THREE.Vector3())),
    target: world.worldToLocal(target.clone()),
    blend: 1,
    fov: camera.fov,
    zoom: camera.zoom
  };
}
