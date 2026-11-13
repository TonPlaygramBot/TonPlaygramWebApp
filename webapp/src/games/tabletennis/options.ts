import {
  TURI_CHARACTER_ID,
  TURI_MODEL_URL
} from '../../config/playerCharacter.js';
import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../../config/chessBattleInventoryConfig.js';
import {
  getChessBattleInventory,
  isChessOptionUnlocked
} from '../../utils/chessBattleInventory.js';
export const CHESS_CHARACTER = CHESS_HUMAN_CHARACTER_OPTIONS.find(
  (c: { id: string }) => c.id === 'rpm-current'
);
export type CharacterOption = {
  id: string;
  name: string;
  description: string;
  color: string;
  model: string;
  urls?: readonly string[];
};
export const CHARACTERS: CharacterOption[] = [
  {
    id: TURI_CHARACTER_ID,
    name: 'Turi',
    description: 'Tirana Streets player · original black UÇK outfit',
    color: '#17191d',
    model: TURI_CHARACTER_ID,
    urls: [TURI_MODEL_URL]
  },
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
// Keep legacy ids so saved choices and existing online room metadata still resolve.
export const ARENAS = [
  {
    id: 'dancingHall',
    name: 'Royal Centre Court',
    assetId: 'royal',
    color: '#37d5bc'
  },
  {
    id: 'colorfulStudio',
    name: 'Continental Arena',
    assetId: 'continental',
    color: '#ffb34b'
  },
  {
    id: 'neonPhotostudio',
    name: 'Masters Night Arena',
    assetId: 'masters',
    color: '#ab92ff'
  }
];
export const SHARED_CHARACTERS = CHESS_HUMAN_CHARACTER_OPTIONS.map((c) => ({
  id: c.id,
  name: c.label,
  description: 'Shared human character',
  color: '#c69264',
  model: c.id === 'rpm-current' ? 'chess-human' : c.id,
  urls: c.modelUrls
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
      ...SHARED_CHARACTERS.filter(
        (c) =>
          !CHARACTERS.some((base) => base.id === c.id) &&
          isChessOptionUnlocked('humanCharacter', c.id, inventory)
      )
    ],
    arenas: ARENAS
  };
}
