import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const pickHdri = (id, name, price = 450) => {
  const variant = POOL_ROYALE_HDRI_VARIANTS.find((entry) => entry.id === id);
  return {
    id: `bowling-hdri-${id}`,
    type: 'environmentHdri',
    optionId: id,
    name,
    description: variant?.description || `${name} HDRI for Bowling arena.`,
    price,
    thumbnail: variant?.thumbnail || variant?.assetUrl || ''
  };
};

const pickFinish = (optionId, name, price = 320) => ({
  id: `bowling-finish-${optionId}`,
  type: 'tableFinish',
  optionId,
  name,
  description: `${name} floor finish for Bowling lanes.`,
  price
});

export const BOWLING_STORE_ITEMS = Object.freeze([
  pickHdri('dancing_hall_4k', 'Dancing Hall HDRI'),
  pickHdri('sepulchral_chapel_rotunda_4k', 'Sepulchral Chapel Rotunda HDRI'),
  pickHdri('vestibule_4k', 'Vestibule HDRI'),
  pickFinish('rosewood_veneer_01', 'Rosewood Veneer 01'),
  pickFinish('oak_veneer_01', 'Oak Veneer 01'),
  pickFinish('dark_wood', 'Dark Wood'),
  pickFinish('wood_table_001', 'Wood Table 001')
]);

export const BOWLING_OPTION_LABELS = Object.freeze({
  environmentHdri: {
    dancing_hall_4k: 'Dancing Hall HDRI',
    sepulchral_chapel_rotunda_4k: 'Sepulchral Chapel Rotunda HDRI',
    vestibule_4k: 'Vestibule HDRI'
  },
  tableFinish: {
    rosewood_veneer_01: 'Rosewood Veneer 01',
    oak_veneer_01: 'Oak Veneer 01',
    dark_wood: 'Dark Wood',
    wood_table_001: 'Wood Table 001'
  }
});

export const BOWLING_DEFAULT_LOADOUT = Object.freeze({
  environmentHdri: 'dancing_hall_4k',
  tableFinish: 'oak_veneer_01'
});
