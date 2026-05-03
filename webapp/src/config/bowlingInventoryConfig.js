import { polyHavenThumb } from './storeThumbnails.js';

const makeItem = (type, optionId, name, price, preview) => ({
  id: `bowling-${type}-${optionId}`,
  slug: 'bowling',
  type,
  optionId,
  name,
  price,
  preview,
  rarity: 'rare'
});

export const BOWLING_DEFAULT_LOADOUT = {
  environmentHdri: 'dancingHall',
  floorFinish: 'oakVeneer01'
};

export const BOWLING_OPTION_LABELS = {
  environmentHdri: {
    dancingHall: 'Dancing Hall HDRI',
    sepulchralChapelRotunda: 'Sepulchral Chapel Rotunda HDRI',
    vestibule: 'Vestibule HDRI'
  },
  floorFinish: {
    rosewoodVeneer01: 'Rosewood Veneer 01',
    oakVeneer01: 'Oak Veneer 01',
    darkWood: 'Dark Wood',
    woodTable001: 'Wood Table 001'
  }
};

export const BOWLING_STORE_ITEMS = [
  makeItem('environmentHdri', 'dancingHall', 'Dancing Hall HDRI', 700, polyHavenThumb('dancing_hall')),
  makeItem('environmentHdri', 'sepulchralChapelRotunda', 'Sepulchral Chapel Rotunda HDRI', 700, polyHavenThumb('sepulchral_chapel_rotunda')),
  makeItem('environmentHdri', 'vestibule', 'Vestibule HDRI', 700, polyHavenThumb('vestibule')),
  makeItem('floorFinish', 'rosewoodVeneer01', 'Rosewood Veneer 01', 450, polyHavenThumb('rosewood_veneer_01')),
  makeItem('floorFinish', 'oakVeneer01', 'Oak Veneer 01', 450, polyHavenThumb('oak_veneer_01')),
  makeItem('floorFinish', 'darkWood', 'Dark Wood', 450, polyHavenThumb('dark_wood')),
  makeItem('floorFinish', 'woodTable001', 'Wood Table 001', 450, polyHavenThumb('wood_table_001'))
];
