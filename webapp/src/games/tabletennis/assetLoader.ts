import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHARACTERS, SHARED_CHARACTERS } from './options';
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
