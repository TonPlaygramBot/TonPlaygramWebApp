import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../../config/chessBattleInventoryConfig.js';
import { POOL_ROYALE_HDRI_VARIANTS } from '../../config/poolRoyaleInventoryConfig.js';
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
