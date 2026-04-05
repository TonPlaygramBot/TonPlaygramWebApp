import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import { CARD_THEMES } from '../utils/cards3d.js';
import { polyHavenThumb } from './storeThumbnails.js';
import {
  BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS,
  BATTLE_ROYALE_SHARED_HDRI_VARIANTS,
  BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS,
  BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS
} from './battleRoyaleSharedInventory.js';

const reduceLabels = (items) =>
  items.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

const TEXAS_EXTRA_HDRI_VARIANTS = Object.freeze([
  {
    id: 'churchMeetingRoom',
    name: 'Church Meeting Room',
    assetId: 'church_meeting_room',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2860,
    exposure: 1.08,
    environmentIntensity: 1.04,
    backgroundIntensity: 1,
    swatches: ['#374151', '#d1d5db'],
    description: 'Quiet meeting-room ambience with gentle daylight bounce.',
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.9,
    groundResolution: 112,
    arenaScale: 1.24,
    thumbnail: polyHavenThumb('church_meeting_room')
  },
  {
    id: 'warmBar',
    name: 'Warm Bar',
    assetId: 'warm_bar',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2880,
    exposure: 1.11,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.03,
    swatches: ['#7c2d12', '#fbbf24'],
    description: 'Cozy golden bar lighting with rich warm reflections.',
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.27,
    thumbnail: polyHavenThumb('warm_bar')
  },
  {
    id: 'rostockArches',
    name: 'Rostock Arches',
    assetId: 'rostock_arches',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2920,
    exposure: 1.07,
    environmentIntensity: 1.04,
    backgroundIntensity: 0.99,
    swatches: ['#6b7280', '#e5e7eb'],
    description: 'Stone arcade interior with broad natural bounce and depth.',
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.28,
    thumbnail: polyHavenThumb('rostock_arches')
  },
  {
    id: 'vignaioliNight',
    name: 'Vignaioli Night',
    assetId: 'vignaioli_night',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2940,
    exposure: 1.06,
    environmentIntensity: 1.03,
    backgroundIntensity: 0.98,
    swatches: ['#1f2937', '#f59e0b'],
    description: 'Night courtyard mood with subtle practical lights.',
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.27,
    thumbnail: polyHavenThumb('vignaioli_night')
  },
  {
    id: 'stPetersSquareNight',
    name: 'St. Peters Square Night',
    assetId: 'st_peters_square_night',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2960,
    exposure: 1.05,
    environmentIntensity: 1.02,
    backgroundIntensity: 0.97,
    swatches: ['#111827', '#cbd5e1'],
    description: 'Iconic square lit at night with elegant contrast and atmosphere.',
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.3,
    groundResolution: 112,
    arenaScale: 1.29,
    thumbnail: polyHavenThumb('st_peters_square_night')
  },
  {
    id: 'zwingerNight',
    name: 'Zwinger Night',
    assetId: 'zwinger_night',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 2980,
    exposure: 1.05,
    environmentIntensity: 1.02,
    backgroundIntensity: 0.97,
    swatches: ['#0f172a', '#f8fafc'],
    description: 'Historic architecture scene with crisp nighttime highlights.',
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.3,
    groundResolution: 112,
    arenaScale: 1.29,
    thumbnail: polyHavenThumb('zwinger_night')
  },
  {
    id: 'winterEvening',
    name: 'Winter Evening',
    assetId: 'winter_evening',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 3000,
    exposure: 1.04,
    environmentIntensity: 1.01,
    backgroundIntensity: 0.96,
    swatches: ['#0ea5e9', '#e2e8f0'],
    description: 'Cool seasonal evening light with clean snow-lit reflections.',
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26,
    thumbnail: polyHavenThumb('winter_evening')
  },
  {
    id: 'rathaus',
    name: 'Rathaus',
    assetId: 'rathaus',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 3020,
    exposure: 1.06,
    environmentIntensity: 1.03,
    backgroundIntensity: 0.98,
    swatches: ['#334155', '#f1f5f9'],
    description: 'Grand interior hall with balanced practical and ambient fill.',
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.28,
    thumbnail: polyHavenThumb('rathaus')
  },
  {
    id: 'medievalCafe',
    name: 'Medieval Cafe',
    assetId: 'medieval_cafe',
    preferredResolutions: ['8k', '4k', '2k'],
    fallbackResolution: '8k',
    price: 3040,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.01,
    swatches: ['#78350f', '#facc15'],
    description: 'Rustic indoor café with warm lantern ambiance.',
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.25,
    thumbnail: polyHavenThumb('medieval_cafe')
  }
]);

export const TEXAS_HDRI_OPTIONS = [...BATTLE_ROYALE_SHARED_HDRI_VARIANTS, ...TEXAS_EXTRA_HDRI_VARIANTS].map((variant) => ({
  ...variant,
  label: `${variant.name} HDRI`
}));

export const TEXAS_DEFAULT_HDRI_ID = 'dancingHall';

export const TEXAS_TABLE_FINISH_OPTIONS = BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS;

export const TEXAS_CHAIR_THEME_OPTIONS = BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS;
export const TEXAS_TABLE_THEME_OPTIONS = BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS;

const DEFAULT_HDRI_INDEX = Math.max(0, TEXAS_HDRI_OPTIONS.findIndex((variant) => variant.id === TEXAS_DEFAULT_HDRI_ID));

export const TEXAS_HOLDEM_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: [TEXAS_TABLE_FINISH_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairTheme: [TEXAS_CHAIR_THEME_OPTIONS[0]?.id],
  tableTheme: [
    TEXAS_TABLE_THEME_OPTIONS[0]?.id,
    TEXAS_TABLE_THEME_OPTIONS.find((option) => option.id === 'diamondEdge')?.id,
    TEXAS_TABLE_THEME_OPTIONS.find((option) => option.id === 'ovalTable')?.id
  ].filter(Boolean),
  tableShape: [TABLE_SHAPE_OPTIONS[0]?.id],
  cards: [CARD_THEMES[0]?.id],
  environmentHdri: [TEXAS_DEFAULT_HDRI_ID]
});

export const TEXAS_HOLDEM_OPTION_LABELS = Object.freeze({
  tableFinish: Object.freeze(reduceLabels(TEXAS_TABLE_FINISH_OPTIONS)),
  tableCloth: Object.freeze(reduceLabels(TABLE_CLOTH_OPTIONS)),
  tableBase: Object.freeze(reduceLabels(TABLE_BASE_OPTIONS)),
  chairTheme: Object.freeze(reduceLabels(TEXAS_CHAIR_THEME_OPTIONS)),
  tableTheme: Object.freeze(reduceLabels(TEXAS_TABLE_THEME_OPTIONS)),
  tableShape: Object.freeze(reduceLabels(TABLE_SHAPE_OPTIONS)),
  cards: Object.freeze(reduceLabels(CARD_THEMES)),
  environmentHdri: Object.freeze(
    TEXAS_HDRI_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const TEXAS_HOLDEM_STORE_ITEMS = [
  ...TEXAS_TABLE_FINISH_OPTIONS.map((option) => ({
    id: `texas-finish-${option.id}`,
    type: 'tableFinish',
    optionId: option.id,
    name: `${option.label} Finish`,
    price: option.price,
    description: option.description,
    swatches: option.swatches,
    thumbnail: option.thumbnail
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 35,
    description: "Swap in a premium felt tone for your poker table.",
    thumbnail: option.thumbnail
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 420 + idx * 35,
    description: 'Upgrade the pedestal finish beneath your Hold\'em surface.',
    thumbnail: option.thumbnail
  })),
  ...TEXAS_CHAIR_THEME_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-chair-${option.id}`,
    type: 'chairTheme',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 340 + idx * 30,
    description: option.description || 'Unlock a premium lounge chair model from Murlan Royale.',
    thumbnail: option.thumbnail
  })),
  ...TEXAS_TABLE_THEME_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-table-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 980 + idx * 45,
    description: option.description || `${option.label} table model from the Murlan Royale set.`,
    thumbnail: option.thumbnail
  })),
  ...TEXAS_HDRI_OPTIONS.map((variant, idx) => ({
    id: `texas-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: variant.label,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Poly Haven HDRI environment used in Murlan Royale.',
    swatches: variant.swatches,
    thumbnail: variant.thumbnail
  })),
  ...TABLE_SHAPE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-shape-${option.id}`,
    type: 'tableShape',
    optionId: option.id,
    name: option.label,
    price: 680 + idx * 80,
    description: 'Change the poker table silhouette.',
    thumbnail: option.thumbnail
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `texas-card-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Cards`,
    price: 460 + idx * 35,
    description: 'Add a fresh premium deck style to the arena.',
    thumbnail: option.thumbnail
  }))
];

export const TEXAS_HOLDEM_DEFAULT_LOADOUT = [
  {
    type: 'tableFinish',
    optionId: TEXAS_TABLE_FINISH_OPTIONS[0]?.id,
    label: TEXAS_TABLE_FINISH_OPTIONS[0]?.label
  },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairTheme', optionId: TEXAS_CHAIR_THEME_OPTIONS[0]?.id, label: TEXAS_CHAIR_THEME_OPTIONS[0]?.label },
  { type: 'tableTheme', optionId: TEXAS_TABLE_THEME_OPTIONS[0]?.id, label: TEXAS_TABLE_THEME_OPTIONS[0]?.label },
  { type: 'tableShape', optionId: TABLE_SHAPE_OPTIONS[0]?.id, label: TABLE_SHAPE_OPTIONS[0]?.label },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: `${CARD_THEMES[0]?.label} Cards` },
  {
    type: 'environmentHdri',
    optionId: TEXAS_DEFAULT_HDRI_ID,
    label: TEXAS_HOLDEM_OPTION_LABELS.environmentHdri?.[TEXAS_DEFAULT_HDRI_ID] || TEXAS_HDRI_OPTIONS[DEFAULT_HDRI_INDEX]?.label
  }
];
