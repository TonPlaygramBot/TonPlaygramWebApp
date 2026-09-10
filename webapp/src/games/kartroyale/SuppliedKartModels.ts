import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FERRARI, BUGGY, BUGGY_RAW } from './suppliedWeaponCatalog.mjs';
export const LOCAL_KART_IDS = ['oobi', 'oodi', 'ooli', 'oopi', 'oozi'];
export const isSuppliedKart = (id: string) =>
  id === 'ferrari' || id === 'buggy';

// These two URLs come from the attachment. The existing local glTF chassis is
// visible while they load, and remains usable if that external source is down.
export async function loadSuppliedKart(id: string): Promise<T.Group> {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/assets/tirana-streets/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  try {
    for (const url of id === 'ferrari' ? [FERRARI] : [BUGGY, BUGGY_RAW]) {
      try {
        const gltf = await new Promise<
          import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
        >((resolve, reject) => {
          let expired = false;
          const timer = setTimeout(() => {
            expired = true;
            reject(Error('Model download timed out'));
          }, 8000);
          loader.load(
            url,
            (g) => {
              clearTimeout(timer);
              if (expired) {
                disposeKartSource(g.scene);
                return;
              }
              resolve(g);
            },
            undefined,
            (e) => {
              clearTimeout(timer);
              reject(e);
            }
          );
        });
        const root = new T.Group(),
          source = gltf.scene;
        source.rotation.y = Math.PI;
        root.add(source);
        root.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(root),
          size = bounds.getSize(new T.Vector3());
        if (
          !Number.isFinite(size.length()) ||
          Math.max(size.x, size.z) < 0.01
        ) {
          disposeKartSource(root);
          throw Error('Empty kart model');
        }
        source.scale.multiplyScalar(2.7 / Math.max(size.x, size.z));
        root.updateMatrixWorld(true);
        const fitted = new T.Box3().setFromObject(root),
          center = fitted.getCenter(new T.Vector3());
        source.position.sub(new T.Vector3(center.x, fitted.min.y, center.z));
        root.updateMatrixWorld(true);
        return root;
      } catch {
        /* Keep the supplied URL fallback order. */
      }
    }
    throw Error('Supplied model unavailable');
  } finally {
    draco.dispose();
  }
}
export function disposeKartSource(root: T.Object3D) {
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometry.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const v of Object.values(m))
          if (v instanceof T.Texture) textures.add(v);
      }
    }
  });
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
