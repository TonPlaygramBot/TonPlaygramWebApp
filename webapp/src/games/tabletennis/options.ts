import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../../config/chessBattleInventoryConfig.js';
import { POOL_ROYALE_HDRI_VARIANTS } from '../../config/poolRoyaleInventoryConfig.js';
import {
  getChessBattleInventory,
  isChessOptionUnlocked
} from '../../utils/chessBattleInventory.js';
export const CHESS_CHARACTER = CHESS_HUMAN_CHARACTER_OPTIONS.find(
  (c: { id: string }) => c.id === 'rpm-current'
);
export const CHARACTERS = [
  {
    id: 'chess-human',
    name: 'Chess veteran',
    description: 'Your Chess Battle Royal human',
    color: '#c69264',
    model: 'chess-human'
  },
  {
    id: 'athlete-male',
    name: 'Adrian',
    description: 'Athletic human · teal kit',
    color: '#2ec4b6',
    model: 'athlete-male'
  },
  {
    id: 'athlete-female',
    name: 'Maya',
    description: 'Athletic human · coral kit',
    color: '#ff795f',
    model: 'athlete-female'
  },
  {
    id: 'athlete-male-gold',
    name: 'Luca',
    description: 'Athletic human · gold kit',
    color: '#f6bc54',
    model: 'athlete-male'
  },
  {
    id: 'athlete-female-violet',
    name: 'Nadia',
    description: 'Athletic human · violet kit',
    color: '#b195ff',
    model: 'athlete-female'
  }
];
export const ARENAS = ['dancingHall', 'colorfulStudio', 'neonPhotostudio'].map(
  (id) => {
    const a = POOL_ROYALE_HDRI_VARIANTS.find(
      (a: { id: string }) => a.id === id
    )!;
    return { id: a.id, name: a.name, assetId: a.assetId };
  }
);
export const SHARED_CHARACTERS = CHESS_HUMAN_CHARACTER_OPTIONS.map((c) => ({
  id: c.id,
  name: c.label,
  description: 'Shared human character',
  color: '#c69264',
  model: c.id === 'rpm-current' ? 'chess-human' : c.id,
  urls: c.modelUrls
}));
export const SHARED_ARENAS = POOL_ROYALE_HDRI_VARIANTS.map((a) => ({
  id: a.id,
  name: a.name,
  assetId: a.assetId
}));
export type AppearanceChoices = {
  characters: typeof CHARACTERS;
  arenas: typeof ARENAS;
};
/** Preserve the solo game's owned cosmetics when moving to the shared runtime. */
export function ownedAppearance(): AppearanceChoices {
  const inventory = getChessBattleInventory();
  return {
    characters: [
      ...CHARACTERS,
      ...SHARED_CHARACTERS.filter((c) =>
        isChessOptionUnlocked('humanCharacter', c.id, inventory)
      )
    ],
    arenas: [
      ...ARENAS,
      ...SHARED_ARENAS.filter(
        (a) =>
          !ARENAS.some((base) => base.id === a.id) &&
          isChessOptionUnlocked('environmentHdri', a.id, inventory)
      )
    ]
  };
}
