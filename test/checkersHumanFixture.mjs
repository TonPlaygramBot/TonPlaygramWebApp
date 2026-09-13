import fs from 'node:fs/promises';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

// Geometry and skinning are parsed from the real bundled Chess character.
// Texture decoding is irrelevant to these world-space contact tests.
export async function loadCheckersHumanTemplate() {
  const bytes = await fs.readFile(new URL('../webapp/public/assets/table-tennis/chess-human.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'geometry-test-textures', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  // Match the shared model library's root normalization before arena fitting.
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.position.x -= (bounds.min.x + bounds.max.x) / 2;
  gltf.scene.position.z -= (bounds.min.z + bounds.max.z) / 2;
  gltf.scene.position.y -= bounds.min.y;
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}
