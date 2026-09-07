/**
 * The Canvas fallback has no WebGLRenderer to select automatic LOD levels.
 * Call after world/camera matrices are current and before collecting meshes.
 * THREE.LOD.update retains the engine's distance, zoom and hysteresis semantics.
 * Only visible automatic LODs are updated; ordinary game update hooks are ignored.
 */
export function updateAutomaticLods(scene, camera) {
  let updated = 0;
  scene.traverseVisible((object) => {
    if (object.isLOD === true && object.autoUpdate === true) {
      object.update(camera);
      updated++;
    }
  });
  return updated;
}
