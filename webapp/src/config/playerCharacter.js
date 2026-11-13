// Reuse the exact playable Turi asset from Tirana Streets in every game.
// Keep the authored face, black outfit, UÇK atlas and proportions intact.
export const TURI_CHARACTER_ID = 'turi';
export const TURI_MODEL_URL = '/assets/tirana-streets/players/turi.glb';
export const TURI_CHARACTER = Object.freeze({
  id: TURI_CHARACTER_ID,
  label: 'Turi',
  name: 'Turi',
  modelUrl: TURI_MODEL_URL,
  modelUrls: Object.freeze([TURI_MODEL_URL]),
  preserveMaterials: true,
  price: 0
});
