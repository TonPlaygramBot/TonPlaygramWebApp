import {
  TURI_CHARACTER_ID,
  TURI_MODEL_URL
} from '../../../config/playerCharacter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { models } from './packed';
async function unpack(text: string) {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
export async function loadCharacter(id: string) {
  if (id === TURI_CHARACTER_ID)
    return (await new GLTFLoader().loadAsync(TURI_MODEL_URL)).scene;
  const model = id.includes('female')
    ? 'athlete-female'
    : id === 'chess-human'
      ? 'chess-human'
      : 'athlete-male';
  return new GLTFLoader()
    .parseAsync(await unpack(models[model]), '')
    .then((g) => g.scene);
}
