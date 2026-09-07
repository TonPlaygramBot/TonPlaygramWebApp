import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Seat } from './engine';

// Reuse the app's optimized, locally hosted CC0 Quaternius athletes.
export const loadAthlete = (seat: Seat) =>
  new GLTFLoader()
    .loadAsync(
      `/assets/table-tennis/athlete-${seat === 0 ? 'male' : 'female'}.glb`
    )
    .then((gltf) => gltf.scene);
