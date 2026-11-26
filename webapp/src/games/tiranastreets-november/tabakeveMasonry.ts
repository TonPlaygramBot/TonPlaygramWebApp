import * as T from 'three';

export const TABAKEVE_MASONRY_URL = '/assets/tirana-streets/environment/ura-tabakeve-masonry-2018.webp';
const BRIDGE_NAME = 'Ura e Tabakëve:authored-stone-pedestrian-bridge';

/** Replace only the two existing sidewall material slots. The bridge deck's
 * procedural paving, arch rims, geometry and collision stay with their owners. */
export function mountTabakeveMasonry(
  bridge: T.Group,
  load = (url: string) => new T.TextureLoader().loadAsync(url)
) {
  const sidewalls = bridge.children.filter((part): part is T.Mesh<T.ShapeGeometry,T.MeshStandardMaterial> =>
    part instanceof T.Mesh && part.geometry.type === 'ShapeGeometry' && part.material instanceof T.MeshStandardMaterial);
  if (bridge.name !== BRIDGE_NAME || sidewalls.length !== 2 || sidewalls[0].material !== sidewalls[1].material)
    return { ready: Promise.resolve(false), dispose: () => {} };

  const fallback = sidewalls[0].material;
  let closed = false, authored: T.MeshStandardMaterial | undefined;
  const ready = (async () => {
    let texture: T.Texture;
    try { texture = await load(TABAKEVE_MASONRY_URL); } catch { return false; }
    if (closed || sidewalls.some(wall => wall.parent !== bridge || wall.material !== fallback)) {
      texture.dispose();
      return false;
    }
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.MirroredRepeatWrapping;
    texture.anisotropy = 2;
    authored = fallback.clone();
    authored.name = 'Ura e Tabakëve · photo masonry';
    authored.map = texture;
    authored.color.set(0xf0e8d9);
    authored.roughness = .96;
    sidewalls.forEach(wall => { wall.material = authored!; });
    return true;
  })();

  return { ready, dispose: () => {
    if (closed) return;
    closed = true;
    if (!authored) return;
    sidewalls.forEach(wall => { if (wall.material === authored) wall.material = fallback; });
    authored.map?.dispose();
    authored.dispose();
    authored = undefined;
  } };
}
