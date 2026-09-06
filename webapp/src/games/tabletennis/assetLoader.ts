import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ARENAS, CHARACTERS } from './options';
export const loadCharacter = (id: string) =>
  new GLTFLoader()
    .loadAsync(
      `/assets/table-tennis/${CHARACTERS.find((c) => c.id === id)?.model || 'athlete-male'}.glb`
    )
    .then((g) => g.scene);
export const loadEnvironment = (id: string) => {
  const a = ARENAS.find((a) => a.id === id) || ARENAS[0];
  return new RGBELoader().loadAsync(`/assets/table-tennis/${a.assetId}.hdr`);
};
