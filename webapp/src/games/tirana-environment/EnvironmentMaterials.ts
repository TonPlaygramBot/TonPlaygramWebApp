import * as T from 'three';

/** One owner per layer; asynchronous image completions cannot resurrect a scene. */
export class EnvironmentMaterials {
  private textures = new Set<T.Texture>();
  private materials = new Set<T.MeshStandardMaterial>();
  private cache = new Map<string, T.Texture>();
  private dead = false;
  constructor(private loadTextures = true) {}

  create(asset: string, color: T.ColorRepresentation = 0xffffff, legacy = false) {
    const material = new T.MeshStandardMaterial({color, roughness: .95});
    material.name = `Tirana PBR:${asset}`;
    this.materials.add(material);
    this.apply(material, asset, legacy);
    return material;
  }

  apply(material: T.MeshStandardMaterial, asset: string, legacy = false) {
    material.userData.environmentSurface = true;
    material.normalScale.set(.35, .35);
    if (!this.loadTextures || this.dead) return;
    const base = `/assets/tirana-streets/${legacy ? 'materials' : 'environment'}/`;
    for (const [suffix, key] of [['diff', 'map'], ['nor_gl', 'normalMap'], ['rough', 'roughnessMap']] as const) {
      const url = `${base}${asset}-${suffix}.jpg`;
      let texture = this.cache.get(url);
      if (!texture) {
        texture = new T.TextureLoader().load(url, loaded => {
          if (this.dead) loaded.dispose();
        }, undefined, () => { if (!this.dead) material.userData.textureError = url; });
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.anisotropy = 4;
        if (key === 'map') texture.colorSpace = T.SRGBColorSpace;
        this.cache.set(url, texture);
        this.textures.add(texture);
      }
      material[key] = texture;
    }
    material.needsUpdate = true;
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.textures.forEach(t => t.dispose());
    this.materials.forEach(m => m.dispose());
    this.textures.clear(); this.materials.clear(); this.cache.clear();
  }
}
