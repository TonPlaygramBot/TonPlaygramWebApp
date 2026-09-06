import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { DataTexture, HalfFloatType, RGBAFormat } from 'three';
import { models, environments } from './packed';
async function unpack(text: string) {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
export async function loadCharacter(id: string) {
  const model = id.includes('female')
    ? 'athlete-female'
    : id === 'chess-human'
      ? 'chess-human'
      : 'athlete-male';
  return new GLTFLoader()
    .parseAsync(await unpack(models[model]), '')
    .then((g) => g.scene);
}
export async function loadEnvironment(id: string) {
  const hdr = new RGBELoader().parse(
    await unpack(environments[id] || environments.dancingHall)
  );
  const texture = new DataTexture(
    hdr.data,
    hdr.width,
    hdr.height,
    RGBAFormat,
    HalfFloatType
  );
  texture.needsUpdate = true;
  texture.flipY = true;
  return texture;
}
