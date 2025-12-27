export const MURLAN_OUTFIT_THEMES = [
  { id: 'midnight', label: 'Royal Blue', baseColor: '#1f3c88', accentColor: '#f5d547', glow: '#0f172a' },
  { id: 'ember', label: 'Neon Red', baseColor: '#a31621', accentColor: '#ff8e3c', glow: '#22080b' },
  { id: 'glacier', label: 'Ice', baseColor: '#1b8dbf', accentColor: '#9ff0ff', glow: '#082433' },
  { id: 'forest', label: 'Forest', baseColor: '#1b7f4a', accentColor: '#b5f44a', glow: '#071f11' },
  { id: 'royal', label: 'Violet', baseColor: '#6b21a8', accentColor: '#f0abfc', glow: '#220a35' },
  { id: 'onyx', label: 'Onyx', baseColor: '#1f2937', accentColor: '#9ca3af', glow: '#090b10' }
];

const POLYHAVEN_THUMB = (id) => `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=256`;

const BASE_STOOL_THEMES = [
  { id: 'ruby', label: 'Ruby', seatColor: '#8b0000', legColor: '#1f1f1f', price: 0, description: 'Default ruby cushions with noir legs.' },
  { id: 'slate', label: 'Slate', seatColor: '#374151', legColor: '#0f172a', price: 210, description: 'Slate seats with midnight legs.' },
  { id: 'teal', label: 'Teal', seatColor: '#0f766e', legColor: '#082f2a', price: 230, description: 'Teal cushions with deep green support.' },
  { id: 'amber', label: 'Amber', seatColor: '#b45309', legColor: '#2f2410', price: 250, description: 'Amber seats with rich brown legs.' },
  { id: 'violet', label: 'Violet', seatColor: '#7c3aed', legColor: '#2b1059', price: 270, description: 'Violet cushions with twilight framing.' },
  { id: 'frost', label: 'Ice', seatColor: '#1f2937', legColor: '#0f172a', price: 290, description: 'Frosted charcoal seats with dark legs.' },
  { id: 'leather', label: 'Leather', seatColor: '#6a4a32', legColor: '#1a1410', price: 320, description: 'Leather-wrapped seats with dark studio legs.' }
];

const POLYHAVEN_CHAIR_THEMES = [
  { id: 'ArmChair_01', label: 'Arm Chair 01', source: 'polyhaven', assetId: 'ArmChair_01' },
  { id: 'BarberShopChair_01', label: 'Barber Shop Chair 01', source: 'polyhaven', assetId: 'BarberShopChair_01' },
  { id: 'GreenChair_01', label: 'Green Chair 01', source: 'polyhaven', assetId: 'GreenChair_01' },
  { id: 'Rockingchair_01', label: 'Rockingchair 01', source: 'polyhaven', assetId: 'Rockingchair_01' },
  { id: 'SchoolChair_01', label: 'School Chair 01', source: 'polyhaven', assetId: 'SchoolChair_01' },
  { id: 'WoodenChair_01', label: 'Wooden Chair 01', source: 'polyhaven', assetId: 'WoodenChair_01' },
  { id: 'bar_chair_round_01', label: 'Bar Chair Round', source: 'polyhaven', assetId: 'bar_chair_round_01' },
  { id: 'chinese_armchair', label: 'Chinese Armchair', source: 'polyhaven', assetId: 'chinese_armchair' },
  { id: 'dining_chair_02', label: 'Dining Chair 02', source: 'polyhaven', assetId: 'dining_chair_02' },
  { id: 'gallinera_chair', label: 'Gallinera Chair', source: 'polyhaven', assetId: 'gallinera_chair' },
  { id: 'mid_century_lounge_chair', label: 'Mid-Century Lounge', source: 'polyhaven', assetId: 'mid_century_lounge_chair' },
  { id: 'modern_arm_chair_01', label: 'Modern Arm Chair', source: 'polyhaven', assetId: 'modern_arm_chair_01' },
  { id: 'outdoor_table_chair_set_01', label: 'Outdoor Chair Set 01', source: 'polyhaven', assetId: 'outdoor_table_chair_set_01' },
  { id: 'painted_wooden_chair_01', label: 'Painted Wooden Chair 01', source: 'polyhaven', assetId: 'painted_wooden_chair_01' },
  { id: 'painted_wooden_chair_02', label: 'Painted Wooden Chair 02', source: 'polyhaven', assetId: 'painted_wooden_chair_02' },
  { id: 'plastic_monobloc_chair_01', label: 'Plastic Monobloc Chair', source: 'polyhaven', assetId: 'plastic_monobloc_chair_01' },
  { id: 'wheelchair_01', label: 'Wheelchair 01', source: 'polyhaven', assetId: 'wheelchair_01' }
].map((option, index) => ({
  ...option,
  thumbnail: POLYHAVEN_THUMB(option.assetId),
  price: 520 + index * 35,
  description: `${option.label} with preserved original materials.`,
  preserveMaterials: true
}));

export const MURLAN_STOOL_THEMES = [...BASE_STOOL_THEMES, ...POLYHAVEN_CHAIR_THEMES];
