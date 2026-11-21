import type { Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D } from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHESS_TOKEN_MODEL_PATH } from './chessTokenModelPath.js';
import { hasVisibleLudoToken } from './ludoTokenPresentation.ts';

// A Beautiful Game by ASWF and Ed Mackey (CC BY 4.0).
// Start with the same-origin, texture-complete subset of the frozen Khronos model.
// https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame
const ABG_MODEL_URLS = [
  CHESS_TOKEN_MODEL_PATH,
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const ABG_WHITE_PIECES = {
  p: 'Pawn_Body_W1',
  r: 'Castle_W1',
  n: 'Knight_W1',
  b: 'Bishop_W1',
  q: 'Queen_W',
  k: 'King_W'
};

// Tint the opaque seat-colored body; keep the authored pawn glass unchanged.
export function colorChessTokenMaterial(material: MeshPhysicalMaterial, color: Color) {
  if (!material?.color || material.transmission > 0) return;
  material.color.copy(color);
}

export async function loadChessBattleRoyalTokenPieces(loader: GLTFLoader) {
  const pieceNames = new Set(Object.values(ABG_WHITE_PIECES));
  loader.register((parser) => ({
    name: 'ChessBattleRoyalTokenPieces',
    beforeRoot() {
      // Load one ivory model per piece, including the pawn's glass top.
      // The board, duplicate pieces and dark textures aren't needed by the tabletop tokens.
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
        piece.userData.chessTokenAsset = { model: 'A Beautiful Game', root: name };
        pieces[type] = piece;
      }
      if (Object.keys(pieces).length === pieceNames.size) return pieces;
    } catch (error) {
      console.warn('Chess Battle Royal token pieces could not be loaded', url, error);
    }
  }
  return null;
}

// Kept for consumers of the existing Ludo token loader.
export const loadLudoChessPieces = loadChessBattleRoyalTokenPieces;
