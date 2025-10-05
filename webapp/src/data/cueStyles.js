import * as THREE from 'three';

const BASE_WOOD_STYLES = [
  { id: 'heritage-maple', label: 'Heritage Maple', woodColor: 0xcaa472, accentColor: 0x3a2f27 },
  { id: 'burnt-walnut', label: 'Burnt Walnut', woodColor: 0xb17d56, accentColor: 0x2b1d16 },
  { id: 'rich-mahogany', label: 'Rich Mahogany', woodColor: 0x8d5a34, accentColor: 0x3c2514 },
  { id: 'blonde-ash', label: 'Blonde Ash', woodColor: 0xd7b17e, accentColor: 0x403326 },
  { id: 'amber-oak', label: 'Amber Oak', woodColor: 0x9b633b, accentColor: 0x2f1e13 },
  { id: 'desert-beech', label: 'Desert Beech', woodColor: 0xdeb887, accentColor: 0x473120 },
  { id: 'espresso-ebony', label: 'Espresso Ebony', woodColor: 0x6e3b1f, accentColor: 0x211108 },
  { id: 'satin-chestnut', label: 'Satin Chestnut', woodColor: 0xa47551, accentColor: 0x34251a }
];

const withDefaults = (style, overrides) => ({
  tipColor: 0xffffff,
  tipTextureColor: '#1b3f75',
  tipCapColor: 0x1f3f73,
  jointColor: 0xcd7f32,
  ...style,
  ...overrides
});

export const SNOOKER_CUE_STYLES = BASE_WOOD_STYLES.map((style, index) =>
  withDefaults(style, {
    id: `snooker-${style.id}`,
    tipColor: 0xf5f5f5,
    tipTextureColor: '#ede6d7',
    tipCapColor: 0xcd7f32,
    jointColor: 0xcd7f32,
    accentColor: style.accentColor ?? 0x2a1c10,
    order: index
  })
);

export const POOL_CUE_STYLES = BASE_WOOD_STYLES.map((style, index) =>
  withDefaults(style, {
    id: `pool-${style.id}`,
    tipColor: 0x1f3f73,
    tipTextureColor: '#1b3f75',
    tipCapColor: 0x1f3f73,
    jointColor: 0xcd7f32,
    accentColor: style.accentColor ?? 0x1a1a1a,
    order: index
  })
);

export const DEFAULT_SNOOKER_CUE_STYLE_ID = SNOOKER_CUE_STYLES[0].id;
export const DEFAULT_POOL_CUE_STYLE_ID = POOL_CUE_STYLES[0].id;

export const getCueStyleById = (id, list = []) => {
  if (!id) return list[0] ?? null;
  return list.find((style) => style.id === id) ?? list[0] ?? null;
};

export const toCueStylePalette = (styles) =>
  styles.map((style) => ({
    id: style.id,
    label: style.label,
    woodColor: new THREE.Color(style.woodColor),
    accentColor: new THREE.Color(style.accentColor ?? 0x222222)
  }));
