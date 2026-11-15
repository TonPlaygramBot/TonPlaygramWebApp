import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hasVisibleLudoToken } from './ludoTokenPresentation.ts';

// A Beautiful Game by ASWF and Ed Mackey (https://creativecommons.org/licenses/by/4.0/).
// https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame
const ABG_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const ABG_WHITE_PIECES = {
  p: 'Pawn_Body_W1',
  r: 'Castle_W1',
  n: 'Knight_W1',
  b: 'Bishop_W1',
  q: 'Queen_W',
  k: 'King_W'
};

export async function loadLudoChessPieces(loader: GLTFLoader) {
  const pieceNames = new Set(Object.values(ABG_WHITE_PIECES));
  loader.register((parser) => ({
    name: 'LudoChessPieces',
    beforeRoot() {
      // Load one ivory model per piece, including the pawn's glass top.
      // The board, duplicate pieces and dark textures aren't used by Ludo.
      const { nodes, scenes } = parser.json;
      for (const scene of scenes) {
        scene.nodes = scene.nodes.filter((index: number) => pieceNames.has(nodes[index].name));
      }
      return Promise.resolve();
    }
  }));

  for (const url of ABG_MODEL_URLS) {
    try {
      const { scene } = await loader.loadAsync(url);
      const pieces: Record<string, Object3D> = {};
      for (const [type, name] of Object.entries(ABG_WHITE_PIECES)) {
        const piece = scene.getObjectByName(name);
        if (!piece || !hasVisibleLudoToken(piece)) break;
        let hasSourceTexture = false;
        piece.traverse((object) => {
          const mesh = object as Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (materials.some((material: MeshStandardMaterial) => material.map && material.normalMap)) {
            hasSourceTexture = true;
          }
        });
        if (!hasSourceTexture) break;
        pieces[type] = piece;
      }
      if (Object.keys(pieces).length === pieceNames.size) return pieces;
    } catch (error) {
      console.warn('Ludo chess pieces could not be loaded', url, error);
    }
  }
  return null;
}
