import * as T from 'three';

// Match identifiable skin slots only. A soldier's body atlas contains clothing,
// metal and skin together, so its authored PBR channels must remain intact.
const skinName = /(?:^|[_ .-])(?:skin|head|face|hand|hands)(?:$|[_ .-])|wolf3d_skin/i;
const nonSkinName = /mask|helmet|glove|eye|lash|brow|teeth|hair|visor/i;
export function isHumanSkinMaterial(material) {
  return skinName.test(material.name || '') && !nonSkinName.test(material.name || '');
}

/** Apply once to a loaded human template, before cloning its skeletons.
 * Geometry, authored tangents and all data textures remain untouched. Copies
 * belong to this preparation, not to any actor; release after removing actors
 * (or supply their containing scene) and before disposing the template. */
export function prepareHumanMaterials(root) {
  const materials = new Map(), textures = new Map(), bindings = [];
  let released = false;
  const colorTexture = source => {
    if (!source) return source;
    let texture = textures.get(source);
    if (!texture) {
      texture = source.clone();
      texture.colorSpace = T.SRGBColorSpace;
      // A small, bounded sampler budget improves oblique faces without forcing
      // larger images or increasing material/geometry draw calls.
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      textures.set(source, texture);
    }
    return texture;
  };
  const prepare = source => {
    if (!source.isMeshStandardMaterial) return source;
    let material = materials.get(source);
    if (material) return material;
    material = source.clone();
    material.map = colorTexture(source.map);
    material.emissiveMap = colorTexture(source.emissiveMap);
    if (isHumanSkinMaterial(source)) {
      material.metalness = 0;
      // Preserve painted roughness variation. The scalar floor applies only
      // to skin without an authored roughness map, avoiding glossy plastic.
      if (!material.roughnessMap) material.roughness = Math.max(.55, source.roughness);
      if (material.normalMap) {
        material.normalScale.x = T.MathUtils.clamp(source.normalScale.x, -.7, .7);
        material.normalScale.y = T.MathUtils.clamp(source.normalScale.y, -.7, .7);
      }
      if (material.isMeshPhysicalMaterial) {
        material.clearcoat = 0;
        material.ior = 1.4;
      }
    }
    material.userData.humanSurfacePrepared = true;
    materials.set(source, material);
    return material;
  };
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const source = mesh.material;
    const prepared = Array.isArray(source) ? source.map(prepare) : prepare(source);
    if (prepared !== source) {
      mesh.material = prepared;
      bindings.push({mesh, source, prepared});
    }
  });
  return instances => {
    if (released) return;
    released = true;
    for (const {mesh, source, prepared} of bindings)
      if (mesh.material === prepared) mesh.material = source;
    if (instances) {
      const sources = new Map([...materials].map(([source, prepared]) => [prepared, source]));
      instances.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(material => sources.get(material) || material)
          : sources.get(mesh.material) || mesh.material;
      });
    }
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    materials.clear(); textures.clear(); bindings.length = 0;
  };
}
