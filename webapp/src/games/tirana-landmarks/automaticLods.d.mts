import type { Camera, Object3D } from 'three';
/** Select visible automatic LODs after matrices are updated, before mesh traversal. */
export function updateAutomaticLods(scene: Object3D, camera: Camera): number;
