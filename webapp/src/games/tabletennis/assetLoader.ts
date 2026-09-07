import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import {
  ARENAS,
  CHARACTERS,
  SHARED_CHARACTERS,
  SHARED_ARENAS
} from './options';
export async function loadCharacter(id: string) {
  const base = CHARACTERS.find((c) => c.id === id);
  const shared = SHARED_CHARACTERS.find((c) => c.id === id);
  const urls =
    base || id === 'rpm-current' || !shared
      ? [
          `/assets/table-tennis/${base?.model || (id === 'rpm-current' ? 'chess-human' : 'athlete-male')}.glb`
        ]
      : shared.urls;
  for (const url of urls) {
    try {
      return (await new GLTFLoader().loadAsync(url)).scene;
    } catch {
      /* Try the next existing catalog source. */
    }
  }
  throw Error('Character unavailable');
}
export const loadEnvironment = (id: string) => {
  const base = ARENAS.find((a) => a.id === id),
    shared = SHARED_ARENAS.find((a) => a.id === id);
  return new RGBELoader().loadAsync(
    base || !shared
      ? `/assets/table-tennis/${(base || ARENAS[0]).assetId}.hdr`
      : `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${shared.assetId}_2k.hdr`
  );
};
