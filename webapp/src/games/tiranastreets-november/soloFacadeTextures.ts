import * as THREE from 'three';

const assetRoot = '/assets/tirana-streets/environment/';

// Palette order matches CityRenderer.buildBlocks. Existing colours supply
// warm/cool variation independently of the four shared texture allocations.
const paints = [
  { file: 'solo-myslym-facade-concrete-diff.webp', metres: 4, slots: [0, 2, 5] },
  { file: 'solo-racing-facade-modern-concrete.jpg', metres: 2.09, slots: [1, 6] },
  { file: 'solo-racing-facade-light-stucco.jpg', metres: 1.8, slots: [3, 7] },
  // Surface-only crop from JoraK's 2018 Durrës/Mihal Duri photo. This is
  // a representative cool plaster, not a location-specific building wrap.
  { file: 'solo-durres-photo-blue-plaster.webp', metres: [0.82, 1.75], slots: [4] }
] as const;

type FacadeContext = {
  materials: readonly THREE.MeshStandardMaterial[];
  worldTextures: Set<THREE.Texture>;
  maxAnisotropy: number;
  isDisposed: () => boolean;
  load?: (url: string) => Promise<THREE.Texture>;
  applyAfter?: Promise<boolean>;
  budgetMs?: number;
};

export async function loadSoloFacadeTextures({
  materials, worldTextures, maxAnisotropy, isDisposed,
  load = url => new THREE.TextureLoader().loadAsync(url), applyAfter, budgetMs = 2200
}: FacadeContext) {
  if (isDisposed() || !materials.length) return;
  // All families start now. Commit the decoded set in one task, never one
  // material family per frame; a slow or broken image leaves its fallback.
  const decoded: (THREE.Texture | undefined)[] = new Array(paints.length);
  let accepting = true, timer: ReturnType<typeof setTimeout> | undefined;
  const downloads = Promise.allSettled(paints.map(async ({file}, index) => {
    const texture = await load(assetRoot + file);
    if (accepting && !isDisposed()) decoded[index] = texture;
    else texture.dispose();
  }));
  await Promise.race([downloads, new Promise<void>(resolve => { timer = setTimeout(resolve, budgetMs); })]);
  clearTimeout(timer);
  accepting = false;
  const canApply = applyAfter ? await applyAfter.catch(() => false) : true;
  if (!canApply || isDisposed()) {
    decoded.forEach(texture => texture?.dispose());
    return;
  }
  for (const [i, {metres, slots}] of paints.entries()) {
    const texture = decoded[i];
    if (!texture) continue;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = typeof metres === 'number'
      ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
    // The existing city mesh has one UV repeat per five world metres.
    if (typeof metres === 'number') texture.repeat.setScalar(5 / metres);
    else texture.repeat.set(5 / metres[0], 5 / metres[1]);
    texture.anisotropy = Math.max(1, Math.min(4, maxAnisotropy));

    const applicable = slots.flatMap(i => materials[i] ? [materials[i]] : []);
    if (!applicable.length) { texture.dispose(); continue; }
    worldTextures.add(texture);
    for (const material of applicable) {
      const replaced = new Set([material.map, material.normalMap, material.roughnessMap]);
      material.map = texture;
      // Old bump/roughness belonged to a different brick/concrete scan.
      material.normalMap = null;
      material.roughnessMap = null;
      material.roughness = 0.86;
      material.needsUpdate = true;
      for (const previous of replaced) {
        // Baseline clone ownership is recorded by CityRenderer. Do not
        // dispose a texture if a remaining background batch still refers to it.
        if (previous && !materials.some(m =>
          m.map === previous || m.normalMap === previous || m.roughnessMap === previous
        ) && worldTextures.delete(previous)) previous.dispose();
      }
    }
  }
}
