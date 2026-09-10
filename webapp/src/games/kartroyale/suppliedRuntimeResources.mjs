// The supplied demo now mounts/unmounts inside the app and on RESTART. Dispose
// shared GLTF resources once per teardown, including instanced track furniture.
export function disposeRacingResources(...roots) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const visit = object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
    if (object.isMaterial) materials.add(object);
    if (object.isInstancedMesh) object.dispose();
  };
  for (const root of roots) {
    if (root?.traverse) root.traverse(visit);
    else if (root) visit(root);
  }
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  geometries.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
}
