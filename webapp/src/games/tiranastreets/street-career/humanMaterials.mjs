import * as T from 'three';

// Match identifiable skin slots only. A soldier's body atlas contains clothing,
// metal and skin together, so its authored PBR channels must remain intact.
const skinName = /(?:^|[_ .-])(?:skin|head|face|hand|hands)(?:$|[_ .-])|wolf3d_skin/i;
const nonSkinName = /mask|helmet|glove|eye|lash|brow|teeth|hair|visor/i;
const colorSlots = ['map', 'emissiveMap', 'sheenColorMap', 'specularColorMap'];
const dataSlots = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap',
  'alphaMap', 'displacementMap', 'clearcoatMap', 'clearcoatRoughnessMap',
  'clearcoatNormalMap', 'sheenRoughnessMap', 'specularIntensityMap',
  'transmissionMap', 'thicknessMap', 'iridescenceMap', 'iridescenceThicknessMap',
  'anisotropyMap'];
export function isHumanSkinMaterial(material) {
  return skinName.test(material.name || '') && !nonSkinName.test(material.name || '');
}

/** Apply once to a loaded human template, before cloning its skeletons.
 * Geometry, authored tangents and source images remain untouched. Copies
 * belong to this preparation, not to any actor; release after removing actors
 * (or supply their containing scene) and before disposing the template. */
export function prepareHumanMaterials(root, {maxAnisotropy = 4} = {}) {
  const materials = new Map(), textures = new Map(), ownedTextures = new Set(), bindings = [];
  // Use the device capability supplied by the renderer, with a bounded mobile
  // budget. Keep a conservative default for consumers without a renderer.
  const anisotropy = Number.isFinite(maxAnisotropy)
    ? Math.max(1, Math.min(8, Math.floor(maxAnisotropy))) : 4;
  let released = false;
  const surfaceTexture = (source, colorSpace) => {
    if (!source) return source;
    // A glTF image may serve both color and data slots. They require separate
    // texture views, but packed ORM channels must continue sharing one view.
    let variants = textures.get(source);
    if (!variants) { variants = new Map(); textures.set(source, variants); }
    let texture = variants.get(colorSpace);
    if (!texture) {
      texture = source.clone();
      texture.colorSpace = colorSpace;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      variants.set(colorSpace, texture);
      ownedTextures.add(texture);
    }
    return texture;
  };
  const prepare = source => {
    if (!source.isMeshStandardMaterial) return source;
    let material = materials.get(source);
    if (material) return material;
    material = source.clone();
    for (const slot of colorSlots) if (source[slot])
      material[slot] = surfaceTexture(source[slot], T.SRGBColorSpace);
    for (const slot of dataSlots) if (source[slot])
      material[slot] = surfaceTexture(source[slot], T.NoColorSpace);
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
    ownedTextures.forEach(texture => texture.dispose());
    materials.clear(); textures.clear(); ownedTextures.clear(); bindings.length = 0;
  };
}
