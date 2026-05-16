import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as OpenSourceDeck from '@letele/playing-cards';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { applyTableMaterials, createMurlanStyleTable, TABLE_SHAPE_OPTIONS } from '../../utils/murlanTable.js';
import { CARD_THEMES } from '../../utils/cards3d.js';
import { makeTonplaygramCardBackTexture } from '../../utils/cards3d.js';
import { createCardGeometry } from '../../utils/cards3d.js';
import { chatBeep, bombSound } from '../../assets/coreSoundData.js';
import {
  getMurlanInventory,
  isMurlanOptionUnlocked,
  murlanAccountId
} from '../../utils/murlanInventory.js';
import {
  ComboType,
  DEFAULT_CONFIG as BASE_CONFIG,
  aiChooseAction,
  canBeat,
  detectCombo,
  sortHand
} from '../../../../lib/murlan.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import InfoPopup from '../../components/InfoPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import { MURLAN_OUTFIT_THEMES as OUTFIT_THEMES } from '../../config/murlanThemes.js';
import {
  BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS as STOOL_THEMES,
  BATTLE_ROYALE_SHARED_HDRI_VARIANTS as MURLAN_HDRI_OPTIONS,
  BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS as MURLAN_TABLE_CLOTHS,
  BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS as MURLAN_TABLE_FINISHES,
  BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS as TABLE_THEMES
} from '../../config/battleRoyaleSharedInventory.js';
import { MURLAN_CHARACTER_THEMES } from '../../config/murlanCharacterThemes.js';
import { giftSounds } from '../../utils/giftSounds.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import {
  getSpeechSupport,
  getSpeechSynthesis,
  onSpeechSupportChange,
  primeSpeechSynthesis,
  speakCommentaryLines
} from '../../utils/textToSpeech.js';
import {
  buildMurlanCommentaryLine,
  MURLAN_ROYALE_SPEAKERS,
  resolveMurlanLanguageKey
} from '../../utils/murlanRoyaleCommentary.js';

const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['4k', '2k']);
const HDRI_RESOLUTION_LADDER = Object.freeze(['8k', '4k', '2k', '1k']);
const DEFAULT_HDRI_ID = 'neonPhotostudio';
const DEFAULT_HDRI_INDEX = Math.max(
  0,
  MURLAN_HDRI_OPTIONS.findIndex((variant) => variant.id === DEFAULT_HDRI_ID)
);
const DEFAULT_HDRI_VARIANT = MURLAN_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? MURLAN_HDRI_OPTIONS[0] ?? null;
const resolveHdriVariant = (index) => {
  const max = MURLAN_HDRI_OPTIONS.length - 1;
  const idx = Number.isFinite(index) ? Math.min(Math.max(Math.round(index), 0), max) : DEFAULT_HDRI_INDEX;
  return MURLAN_HDRI_OPTIONS[idx] ?? MURLAN_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? MURLAN_HDRI_OPTIONS[0];
};

const DEFAULT_TABLE_FINISH_ID = 'peelingPaintWeathered';
const DEFAULT_TABLE_CLOTH_ID = 'emerald';
const DEFAULT_STOOL_ID = 'dining_chair_02';
const DEFAULT_TABLE_SHAPE_ID = 'classicOctagon';
const DEFAULT_TABLE_FINISH_INDEX = Math.max(0, MURLAN_TABLE_FINISHES.findIndex((option) => option.id === DEFAULT_TABLE_FINISH_ID));
const DEFAULT_TABLE_CLOTH_INDEX = Math.max(0, MURLAN_TABLE_CLOTHS.findIndex((option) => option.id === DEFAULT_TABLE_CLOTH_ID));
const DEFAULT_STOOL_INDEX = Math.max(0, STOOL_THEMES.findIndex((option) => option.id === DEFAULT_STOOL_ID));
const DEFAULT_TABLE_SHAPE_INDEX = Math.max(0, TABLE_SHAPE_OPTIONS.findIndex((option) => option.id === DEFAULT_TABLE_SHAPE_ID));
const TABLE_SHAPES_WITH_SURFACE_CUSTOMIZATION = new Set(['classicOctagon', 'diamondEdge', 'grandOval']);
const resolveTableFinish = (index) => {
  const max = MURLAN_TABLE_FINISHES.length - 1;
  const idx = Number.isFinite(index) ? Math.min(Math.max(Math.round(index), 0), max) : DEFAULT_TABLE_FINISH_INDEX;
  return MURLAN_TABLE_FINISHES[idx] ?? MURLAN_TABLE_FINISHES[DEFAULT_TABLE_FINISH_INDEX] ?? null;
};
const resolveTableCloth = (index) => {
  const max = MURLAN_TABLE_CLOTHS.length - 1;
  const idx = Number.isFinite(index) ? Math.min(Math.max(Math.round(index), 0), max) : DEFAULT_TABLE_CLOTH_INDEX;
  return MURLAN_TABLE_CLOTHS[idx] ?? MURLAN_TABLE_CLOTHS[DEFAULT_TABLE_CLOTH_INDEX] ?? null;
};

const DEFAULT_FRAME_RATE_ID = 'fhd60';

const MODEL_SCALE = 0.75;
const CHARACTER_PROPORTION_SCALE = 1.82;
const ENABLE_3D_HUMAN_CHARACTERS = true;
const ARENA_GROWTH = 1.45; // expanded arena footprint for wider walkways
const CHAIR_SIZE_SCALE = 1.24;
const CHAIR_HEIGHT_TRIM_SCALE = 0.96;
const ARENA_PROP_SCALE = 1;
const HUMAN_CHARACTER_EXTRA_OUTWARD_OFFSET = 0.62; // nudge seated humans just a bit closer to the table on portrait mobile framing.
const HUMAN_CHARACTER_EXTRA_LOWER_OFFSET = 0.18; // seat humans lower so hips/legs rest properly on the chair cushion.
const SHOW_CHARACTER_HELD_CARD_HELPERS = false;
const HUMAN_CARD_HAND_DEBUG_HELPERS =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).get('showHandHelpers') === '1' ||
    window.localStorage?.getItem('murlanShowHandHelpers') === '1');

const MURLAN_CHARACTER_TEXTURE_LOADER = new THREE.TextureLoader();
MURLAN_CHARACTER_TEXTURE_LOADER.setCrossOrigin?.('anonymous');
const MURLAN_CHARACTER_TEXTURE_CACHE = new Map();
const makePolyhavenTextureMaterial = (assetId, { label = assetId, tint = 0xffffff, colorSuffix = 'diff', normalScale = 0.28 } = {}) => ({
  source: `Poly Haven ${label} 1k glTF CC0`,
  gltf: `https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/${assetId}/${assetId}_1k.gltf`,
  color: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${assetId}/${assetId}_${colorSuffix}_1k.jpg`,
  normal: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${assetId}/${assetId}_nor_gl_1k.jpg`,
  roughness: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${assetId}/${assetId}_rough_1k.jpg`,
  tint,
  normalScale
});

const MURLAN_CHARACTER_CLOTH_MATERIALS = Object.freeze({
  shirtCotton: makePolyhavenTextureMaterial('cotton_jersey', { label: 'cotton_jersey shirt fabric', tint: 0xe7edf4, normalScale: 0.22 }),
  tshirtPique: makePolyhavenTextureMaterial('waffle_pique_cotton', { label: 'waffle_pique_cotton t-shirt fabric', tint: 0xd7e8ff, normalScale: 0.24 }),
  denim: makePolyhavenTextureMaterial('denim_fabric', { label: 'denim_fabric jeans', tint: 0x314d86, normalScale: 0.34 }),
  darkDenim: makePolyhavenTextureMaterial('denim_fabric_05', { label: 'denim_fabric_05 dark jeans', tint: 0x22365f, normalScale: 0.34 }),
  jacketSuede: makePolyhavenTextureMaterial('scuba_suede', { label: 'scuba_suede jacket', tint: 0x6a4a38, normalScale: 0.3 }),
  jacketLeather: makePolyhavenTextureMaterial('fabric_leather_01', { label: 'fabric_leather_01 jacket', tint: 0x111827, normalScale: 0.32 }),
  dressJacquard: makePolyhavenTextureMaterial('floral_jacquard', { label: 'floral_jacquard dress', tint: 0x7c3f88, normalScale: 0.26 }),
  tieHerringbone: makePolyhavenTextureMaterial('poly_wool_herringbone', { label: 'poly_wool_herringbone tie', tint: 0xc9a24f, normalScale: 0.22 }),
  hatBoucle: makePolyhavenTextureMaterial('wool_boucle', { label: 'wool_boucle hat', tint: 0x2f3542, normalScale: 0.24 }),
  shoeLeather: makePolyhavenTextureMaterial('leather_white', { label: 'leather_white shoes', tint: 0xf4f1ea, normalScale: 0.28 }),
  shoeDarkLeather: makePolyhavenTextureMaterial('fabric_leather_01', { label: 'fabric_leather_01 dark shoes', tint: 0x1f2937, normalScale: 0.28 }),
  accessoryCanvas: makePolyhavenTextureMaterial('hessian_230', { label: 'hessian_230 accessories', tint: 0xb88852, normalScale: 0.25 }),
  jewelryLeather: makePolyhavenTextureMaterial('quatrefoil_jacquard_fabric', { label: 'quatrefoil_jacquard_fabric jewelry straps', tint: 0xd7b56d, normalScale: 0.2 }),
  watchStrap: makePolyhavenTextureMaterial('fabric_leather_02', { label: 'fabric_leather_02 watch strap', tint: 0x111827, normalScale: 0.23 }),
  check: makePolyhavenTextureMaterial('gingham_check', { label: 'gingham_check shirt', tint: 0x9f3651, normalScale: 0.25 }),
  fleece: makePolyhavenTextureMaterial('knitted_fleece', { label: 'knitted_fleece hoodie', tint: 0x4b5563, normalScale: 0.28 }),
  picnic: makePolyhavenTextureMaterial('fabric_pattern_07', { label: 'fabric_pattern_07 statement fabric', colorSuffix: 'col_1', tint: 0xc44f42, normalScale: 0.25 })
});

const MURLAN_CHARACTER_BODY_DETAIL_MATERIALS = Object.freeze({
  skin: {
    source: 'three.js LeePerrySmith open-source glTF face normal map',
    normal: 'https://threejs.org/examples/models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg',
    repeat: 1.35,
    normalScale: 0.045
  },
  hair: {
    ...makePolyhavenTextureMaterial('faux_fur_geometric', { label: 'faux_fur_geometric hair fiber detail', tint: 0xffffff, normalScale: 0.18 }),
    repeat: 2.8
  }
});

function hashMurlanCharacterRosterSeed(input) {
  const text = String(input ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function hasMurlanCharacterModelSource(theme) {
  return Boolean(theme && (theme.url || (Array.isArray(theme.modelUrls) && theme.modelUrls.length)));
}

function isPreferredMurlanAiCharacterTheme(theme) {
  const id = theme?.id || '';
  return hasMurlanCharacterModelSource(theme) && (id === 'rpm-current' || /^rpm-/.test(id) || /^sketchfab-/.test(id));
}

function buildSeatCharacterThemeRoster(baseTheme, players = [], humanSeatIndex = 0, rosterSeed = 0) {
  const availableThemes = MURLAN_CHARACTER_THEMES.filter(hasMurlanCharacterModelSource);
  if (!availableThemes.length) return [];

  const selectedTheme = baseTheme || availableThemes[0];
  const selectedId = selectedTheme?.id;
  const usedThemeIds = new Set(selectedId ? [selectedId] : []);
  const playerSignature = players
    .map((player, index) => `${index}:${player?.name || ''}:${player?.avatar || ''}:${player?.isHuman ? 'h' : 'ai'}`)
    .join('|');
  const aiPlayerCount = players.filter((player, index) => !(player?.isHuman || index === humanSeatIndex)).length;
  const preferredAiThemes = availableThemes.filter((theme) => theme.id !== selectedId && isPreferredMurlanAiCharacterTheme(theme));
  const aiThemePool = preferredAiThemes.length >= aiPlayerCount
    ? preferredAiThemes
    : availableThemes.filter((theme) => theme.id !== selectedId);
  const shuffledAiThemes = (aiThemePool.length ? aiThemePool : availableThemes)
    .map((theme, index) => ({
      theme,
      order: hashMurlanCharacterRosterSeed(`${rosterSeed}|${playerSignature}|${index}|${theme.id}`)
    }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.theme);

  let aiThemeIndex = 0;
  return players.map((player, index) => {
    if (player?.isHuman || index === humanSeatIndex) {
      return selectedTheme;
    }

    let nextTheme = shuffledAiThemes[aiThemeIndex % Math.max(shuffledAiThemes.length, 1)] || selectedTheme;
    aiThemeIndex += 1;
    if (usedThemeIds.has(nextTheme.id)) {
      const unusedTheme = shuffledAiThemes.find((theme) => !usedThemeIds.has(theme.id));
      if (unusedTheme) nextTheme = unusedTheme;
    }
    if (nextTheme?.id) usedThemeIds.add(nextTheme.id);
    return nextTheme;
  });
}

function characterThemeRosterSignature(roster = []) {
  return roster.map((theme) => theme?.id || 'none').join('|');
}

function resolveLoadedSeatCharacterTheme({
  seatTheme,
  selectedTheme,
  templatesById,
  fallbackThemes = [],
  player = null,
  seatIndex = 0,
  humanSeatIndex = 0
}) {
  const template = seatTheme?.id ? templatesById.get(seatTheme.id) : null;
  if (template) return { theme: seatTheme, template };

  const isSelectedHumanSeat = Boolean(player?.isHuman || seatIndex === humanSeatIndex);
  if (isSelectedHumanSeat && seatTheme?.id === selectedTheme?.id) {
    console.warn('Selected Murlan character model is unavailable; not substituting another character', {
      characterId: seatTheme?.id,
      modelUrls: seatTheme?.modelUrls || (seatTheme?.url ? [seatTheme.url] : [])
    });
    return null;
  }

  const fallbackTheme = fallbackThemes.find((theme) => theme?.id && theme.id !== selectedTheme?.id && templatesById.has(theme.id)) ||
    fallbackThemes.find((theme) => theme?.id && templatesById.has(theme.id));
  if (!fallbackTheme) return null;
  return { theme: fallbackTheme, template: templatesById.get(fallbackTheme.id) };
}

const MURLAN_CHARACTER_CLOTH_COMBOS = Object.freeze({
  royalDenim: {
    shirt: { material: 'shirtCotton', tint: 0xe7edf4, repeat: 4.1 },
    tshirt: { material: 'tshirtPique', tint: 0xd7e8ff, repeat: 4.8 },
    jeans: { material: 'denim', tint: 0x2f5f9f, repeat: 4.6 },
    pants: { material: 'darkDenim', tint: 0x233a68, repeat: 4.5 },
    jacket: { material: 'jacketLeather', tint: 0x172033, repeat: 3.5 },
    dress: { material: 'dressJacquard', tint: 0x5d4b88, repeat: 3.1 },
    tie: { material: 'tieHerringbone', tint: 0xd6a84b, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0x1f2937, repeat: 4.0 },
    shoes: { material: 'shoeLeather', tint: 0xf4f1ea, repeat: 2.8 },
    accessory: { material: 'accessoryCanvas', tint: 0xc18a52, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xe4c976, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xf2d675, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  formalHitman: {
    shirt: { material: 'shirtCotton', tint: 0xf8fafc, repeat: 4.2 },
    tshirt: { material: 'shirtCotton', tint: 0xf8fafc, repeat: 4.4 },
    jeans: { material: 'shoeDarkLeather', tint: 0x111827, repeat: 3.8 },
    pants: { material: 'shoeDarkLeather', tint: 0x111827, repeat: 3.8 },
    jacket: { material: 'jacketLeather', tint: 0x15171c, repeat: 3.2 },
    dress: { material: 'jacketLeather', tint: 0x15171c, repeat: 3.0 },
    tie: { material: 'tieHerringbone', tint: 0x8b0f16, repeat: 5.8 },
    hat: { material: 'hatBoucle', tint: 0x111827, repeat: 4.0 },
    shoes: { material: 'shoeDarkLeather', tint: 0x0b0f14, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0x9ca3af, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xd1d5db, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xd1d5db, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  leatherPortrait: {
    shirt: { material: 'shirtCotton', tint: 0xe5e7eb, repeat: 4.1 },
    tshirt: { material: 'tshirtPique', tint: 0x111827, repeat: 4.5 },
    jeans: { material: 'darkDenim', tint: 0x1f2937, repeat: 4.4 },
    pants: { material: 'darkDenim', tint: 0x202938, repeat: 4.2 },
    jacket: { material: 'jacketLeather', tint: 0x2d2018, repeat: 3.1 },
    dress: { material: 'jacketLeather', tint: 0x2d2018, repeat: 3.0 },
    tie: { material: 'tieHerringbone', tint: 0x9f6b3f, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0x1f2937, repeat: 4.0 },
    shoes: { material: 'shoeDarkLeather', tint: 0x111827, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xb45309, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xd6a84b, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xd6a84b, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  suedeGentleman: {
    shirt: { material: 'shirtCotton', tint: 0xf5efe6, repeat: 4.2 },
    tshirt: { material: 'shirtCotton', tint: 0xf5efe6, repeat: 4.4 },
    jeans: { material: 'denim', tint: 0x263b5f, repeat: 4.4 },
    pants: { material: 'jacketSuede', tint: 0x6b4a34, repeat: 3.6 },
    jacket: { material: 'jacketSuede', tint: 0x8a6042, repeat: 3.0 },
    dress: { material: 'jacketSuede', tint: 0x8a6042, repeat: 3.0 },
    tie: { material: 'tieHerringbone', tint: 0xd1a66a, repeat: 5.3 },
    hat: { material: 'hatBoucle', tint: 0x3c2a1d, repeat: 4.0 },
    shoes: { material: 'shoeLeather', tint: 0x2a1c15, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xc9a46a, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xe5c07b, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xe5c07b, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x3a2418, repeat: 4.6 }
  },
  hibiscusPortrait: {
    shirt: { material: 'shirtCotton', tint: 0xfff1f2, repeat: 4.2 },
    tshirt: { material: 'tshirtPique', tint: 0xfef2f2, repeat: 4.5 },
    jeans: { material: 'denim', tint: 0x385f8f, repeat: 4.4 },
    pants: { material: 'denim', tint: 0x385f8f, repeat: 4.4 },
    jacket: { material: 'jacketSuede', tint: 0x9f1239, repeat: 3.2 },
    dress: { material: 'picnic', tint: 0xdb2777, repeat: 3.4 },
    tie: { material: 'tieHerringbone', tint: 0xf97316, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0xbe123c, repeat: 4.0 },
    shoes: { material: 'shoeLeather', tint: 0x431407, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xef4444, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xfacc15, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xfacc15, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x431407, repeat: 4.6 }
  },
  casualConfidence: {
    shirt: { material: 'shirtCotton', tint: 0xdbeafe, repeat: 4.2 },
    tshirt: { material: 'tshirtPique', tint: 0xf8fafc, repeat: 4.6 },
    jeans: { material: 'denim', tint: 0x2f5f9f, repeat: 4.6 },
    pants: { material: 'darkDenim', tint: 0x1e3a5f, repeat: 4.5 },
    jacket: { material: 'jacketSuede', tint: 0x334155, repeat: 3.4 },
    dress: { material: 'dressJacquard', tint: 0x475569, repeat: 3.1 },
    tie: { material: 'tieHerringbone', tint: 0x38bdf8, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0x0f172a, repeat: 4.0 },
    shoes: { material: 'shoeDarkLeather', tint: 0x0f172a, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0x60a5fa, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xe2e8f0, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xe2e8f0, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  casinoCheck: {
    shirt: { material: 'check', tint: 0xb7375d, repeat: 3.8 },
    tshirt: { material: 'shirtCotton', tint: 0xf8fafc, repeat: 4.4 },
    jeans: { material: 'darkDenim', tint: 0x243e70, repeat: 4.4 },
    pants: { material: 'denim', tint: 0x243e70, repeat: 4.6 },
    jacket: { material: 'jacketSuede', tint: 0x5b4032, repeat: 3.4 },
    dress: { material: 'picnic', tint: 0xbb3f4d, repeat: 3.4 },
    tie: { material: 'tieHerringbone', tint: 0xf4d7a1, repeat: 5.4 },
    hat: { material: 'hatBoucle', tint: 0x3f1f2c, repeat: 4.0 },
    shoes: { material: 'shoeDarkLeather', tint: 0x111827, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xf4d7a1, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xffd166, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xffd166, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x26151a, repeat: 4.5 }
  },
  linenStreet: {
    shirt: { material: 'accessoryCanvas', tint: 0xb68452, repeat: 3.6 },
    tshirt: { material: 'tshirtPique', tint: 0xf3efe7, repeat: 4.7 },
    jeans: { material: 'denim', tint: 0x4a6fa4, repeat: 4.1 },
    pants: { material: 'fleece', tint: 0x374151, repeat: 5.2 },
    jacket: { material: 'jacketSuede', tint: 0x7a543c, repeat: 3.5 },
    dress: { material: 'dressJacquard', tint: 0xad8b73, repeat: 3.0 },
    tie: { material: 'tieHerringbone', tint: 0x516072, repeat: 5.0 },
    hat: { material: 'hatBoucle', tint: 0x4b5563, repeat: 4.2 },
    shoes: { material: 'shoeDarkLeather', tint: 0x2b211a, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xd6a35f, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xd6a35f, repeat: 5.4 },
    ring: { material: 'jewelryLeather', tint: 0xd6a35f, repeat: 5.4 },
    watch: { material: 'watchStrap', tint: 0x3b2c22, repeat: 4.4 }
  },
  jacquardNight: {
    shirt: { material: 'dressJacquard', tint: 0x7c3f88, repeat: 3.2 },
    tshirt: { material: 'shirtCotton', tint: 0xeee7ff, repeat: 4.4 },
    jeans: { material: 'darkDenim', tint: 0x1f335f, repeat: 4.5 },
    pants: { material: 'darkDenim', tint: 0x1f335f, repeat: 4.5 },
    jacket: { material: 'jacketLeather', tint: 0x111827, repeat: 3.5 },
    dress: { material: 'dressJacquard', tint: 0x7c3f88, repeat: 3.0 },
    tie: { material: 'check', tint: 0xe3c16f, repeat: 4.0 },
    hat: { material: 'hatBoucle', tint: 0x181824, repeat: 4.2 },
    shoes: { material: 'shoeDarkLeather', tint: 0x0f172a, repeat: 3.0 },
    accessory: { material: 'jewelryLeather', tint: 0xe3c16f, repeat: 5.0 },
    earring: { material: 'jewelryLeather', tint: 0xe3c16f, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xe3c16f, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  softFleece: {
    shirt: { material: 'fleece', tint: 0x556070, repeat: 5.3 },
    tshirt: { material: 'tshirtPique', tint: 0xe5e7eb, repeat: 4.8 },
    jeans: { material: 'denim', tint: 0x3f5f85, repeat: 4.4 },
    pants: { material: 'accessoryCanvas', tint: 0x8b633f, repeat: 3.7 },
    jacket: { material: 'jacketSuede', tint: 0x617084, repeat: 3.6 },
    dress: { material: 'dressJacquard', tint: 0xb88ab8, repeat: 3.0 },
    tie: { material: 'tieHerringbone', tint: 0x94a3b8, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0x475569, repeat: 4.2 },
    shoes: { material: 'shoeLeather', tint: 0xe7e5df, repeat: 2.9 },
    accessory: { material: 'accessoryCanvas', tint: 0xb88a55, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xd9b66d, repeat: 5.4 },
    ring: { material: 'jewelryLeather', tint: 0xd9b66d, repeat: 5.4 },
    watch: { material: 'watchStrap', tint: 0x334155, repeat: 4.5 }
  },
  patternedRed: {
    shirt: { material: 'picnic', tint: 0xc44f42, repeat: 3.4 },
    tshirt: { material: 'shirtCotton', tint: 0xfff7ed, repeat: 4.4 },
    jeans: { material: 'denim', tint: 0x263f73, repeat: 4.7 },
    pants: { material: 'darkDenim', tint: 0x263f73, repeat: 4.7 },
    jacket: { material: 'jacketLeather', tint: 0x2a1111, repeat: 3.5 },
    dress: { material: 'picnic', tint: 0xc44f42, repeat: 3.3 },
    tie: { material: 'tieHerringbone', tint: 0xf1f5f9, repeat: 5.0 },
    hat: { material: 'hatBoucle', tint: 0x511b1b, repeat: 4.1 },
    shoes: { material: 'shoeDarkLeather', tint: 0x111827, repeat: 3.0 },
    accessory: { material: 'accessoryCanvas', tint: 0xf1f5f9, repeat: 3.4 },
    earring: { material: 'jewelryLeather', tint: 0xf4c95d, repeat: 5.5 },
    ring: { material: 'jewelryLeather', tint: 0xf4c95d, repeat: 5.5 },
    watch: { material: 'watchStrap', tint: 0x111827, repeat: 4.6 }
  },
  mixedDenim: {
    shirt: { material: 'denim', tint: 0x3b6ea8, repeat: 4.0 },
    tshirt: { material: 'tshirtPique', tint: 0xdbeafe, repeat: 4.8 },
    jeans: { material: 'darkDenim', tint: 0x1e3a6e, repeat: 4.8 },
    pants: { material: 'check', tint: 0x4f6f93, repeat: 4.2 },
    jacket: { material: 'jacketSuede', tint: 0x3b4a61, repeat: 3.5 },
    dress: { material: 'dressJacquard', tint: 0x4f6f93, repeat: 3.1 },
    tie: { material: 'tieHerringbone', tint: 0xd6a35f, repeat: 5.2 },
    hat: { material: 'hatBoucle', tint: 0x1e293b, repeat: 4.2 },
    shoes: { material: 'shoeLeather', tint: 0xf8fafc, repeat: 2.9 },
    accessory: { material: 'accessoryCanvas', tint: 0xd6a35f, repeat: 3.2 },
    earring: { material: 'jewelryLeather', tint: 0xd6a35f, repeat: 5.4 },
    ring: { material: 'jewelryLeather', tint: 0xd6a35f, repeat: 5.4 },
    watch: { material: 'watchStrap', tint: 0x1f2937, repeat: 4.5 }
  }
});
const TOP_SEAT_AVATAR_UP_LIFT = 4.9;
const NON_HUMAN_SEAT_AVATAR_UP_LIFT = 1.0;
const HUMAN_AVATAR_BOTTOM_OFFSET = 'calc(2.85rem + env(safe-area-inset-bottom, 0px))';
// Keep Murlan table/chairs at the exact shared Battle Royale baseline scale.
const TABLE_AND_CHAIR_VISUAL_SHRINK = 1;
const CARD_VISUAL_TRIM = TABLE_AND_CHAIR_VISUAL_SHRINK;
const AVATAR_VISUAL_SCALE = 0.95;

const TABLE_RADIUS = 3.4 * MODEL_SCALE * 0.83 * TABLE_AND_CHAIR_VISUAL_SHRINK;
const TABLE_HORIZONTAL_SHRINK = 1;
const CHAIR_COUNT = 4;
const CUSTOM_SEAT_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(0),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(180)
];

const SUITS = ['♠', '♥', '♦', '♣'];
const OPEN_SOURCE_SUIT_CODES = Object.freeze({
  '♠': 'S',
  '♥': 'H',
  '♦': 'D',
  '♣': 'C'
});
const OPEN_SOURCE_RANK_CODES = Object.freeze({
  A: 'a',
  K: 'k',
  Q: 'q',
  J: 'j'
});
const SUIT_COLORS = {
  '♠': '#111111',
  '♣': '#111111',
  '♥': '#cc2233',
  '♦': '#cc2233',
  '🃏': '#111111'
};

function detectCoarsePointer() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia === 'function') {
    try {
      const coarseQuery = window.matchMedia('(pointer: coarse)');
      if (typeof coarseQuery?.matches === 'boolean') {
        return coarseQuery.matches;
      }
    } catch (err) {
      // ignore
    }
  }
  try {
    if ('ontouchstart' in window) {
      return true;
    }
    const nav = window.navigator;
    if (nav && typeof nav.maxTouchPoints === 'number') {
      return nav.maxTouchPoints > 0;
    }
  } catch (err) {
    // ignore
  }
  return false;
}

function detectLowRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(max-refresh-rate: 59hz)', '(max-refresh-rate: 50hz)', '(prefers-reduced-motion: reduce)'];
  for (const query of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return true;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return false;
}

function detectDisplayRefreshTier() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return '60';
  }
  const queries = [
    ['120', '(min-refresh-rate: 120hz)'],
    ['90', '(min-refresh-rate: 90hz)']
  ];
  for (const [tier, query] of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return tier;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return '60';
}

let cachedRendererString = null;
let rendererLookupAttempted = false;

function readGraphicsRendererString() {
  if (rendererLookupAttempted) {
    return cachedRendererString;
  }
  rendererLookupAttempted = true;
  if (typeof document === 'undefined') {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      canvas.getContext('webgl2');
    if (!gl) {
      return null;
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? '';
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    } else {
      const vendor = gl.getParameter(gl.VENDOR) ?? '';
      const renderer = gl.getParameter(gl.RENDERER) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    }
    return cachedRendererString;
  } catch (err) {
    return null;
  }
}

function classifyRendererTier(rendererString) {
  if (typeof rendererString !== 'string' || rendererString.length === 0) {
    return 'unknown';
  }
  const signature = rendererString.toLowerCase();
  if (
    signature.includes('mali') ||
    signature.includes('adreno') ||
    signature.includes('powervr') ||
    signature.includes('apple a') ||
    signature.includes('snapdragon') ||
    signature.includes('tegra x1')
  ) {
    return 'mobile';
  }
  if (
    signature.includes('geforce') ||
    signature.includes('nvidia') ||
    signature.includes('radeon') ||
    signature.includes('rx ') ||
    signature.includes('rtx') ||
    signature.includes('apple m') ||
    signature.includes('arc')
  ) {
    return 'desktopHigh';
  }
  if (signature.includes('intel') || signature.includes('iris') || signature.includes('uhd')) {
    return 'desktopMid';
  }
  return 'unknown';
}

function resolveDefaultPixelRatioCap() {
  if (typeof window === 'undefined') {
    return 2;
  }
  return window.innerWidth <= 1366 ? 1.5 : 2;
}

function detectPreferredFrameRateId() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DEFAULT_FRAME_RATE_ID;
  }
  const coarsePointer = detectCoarsePointer();
  const ua = navigator.userAgent ?? '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouch = maxTouchPoints > 1;
  const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const lowRefresh = detectLowRefreshDisplay();
  const refreshTier = detectDisplayRefreshTier();
  const rendererTier = classifyRendererTier(readGraphicsRendererString());

  if (lowRefresh) {
    return 'fhd60';
  }

  if (isMobileUA || coarsePointer || isTouch || rendererTier === 'mobile') {
    if ((deviceMemory !== null && deviceMemory <= 4) || hardwareConcurrency <= 4) {
      return 'fhd60';
    }
    if (refreshTier === '120' && hardwareConcurrency >= 8 && (deviceMemory == null || deviceMemory >= 6)) {
      return 'uhd120';
    }
    if (
      refreshTier === '90' ||
      hardwareConcurrency >= 6 ||
      (deviceMemory != null && deviceMemory >= 6)
    ) {
      return 'smooth90';
    }
    return 'fhd60';
  }

  if (refreshTier === '120' && (rendererTier === 'desktopHigh' || hardwareConcurrency >= 8)) {
    return 'uhd120';
  }

  if (refreshTier === '90' || rendererTier === 'desktopMid') {
    return 'smooth90';
  }

  return DEFAULT_FRAME_RATE_ID;
}

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const PREFERRED_TEXTURE_SIZES = ['2k', '1k'];
const POLYHAVEN_MODEL_CACHE = new Map();
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

let sharedKtx2Loader = null;

function stripQueryHash(u) {
  return u.split('#')[0].split('?')[0];
}

function isModelUrl(u) {
  const s = stripQueryHash(u).toLowerCase();
  return s.endsWith('.glb') || s.endsWith('.gltf');
}

function extractAllHttpUrls(apiJson) {
  const out = new Set();
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      if (v.startsWith('http')) out.add(v);
      return;
    }
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    Object.values(v).forEach(walk);
  };
  walk(apiJson);
  return Array.from(out);
}

function pickBestModelUrl(urls) {
  const modelUrls = urls.filter(isModelUrl);
  const glbs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.glb'));
  const gltfs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.gltf'));

  const score = (u) => {
    const lu = u.toLowerCase();
    let s = 0;
    if (lu.includes('2k')) s += 3;
    if (lu.includes('1k')) s += 2;
    if (lu.includes('4k')) s += 1;
    if (lu.includes('8k')) s -= 2;
    if (lu.includes('download')) s += 1;
    return s;
  };

  glbs.sort((a, b) => score(b) - score(a));
  gltfs.sort((a, b) => score(b) - score(a));

  return glbs[0] || gltfs[0] || null;
}

function pickBestTextureUrls(apiJson, preferredSizes = PREFERRED_TEXTURE_SIZES) {
  if (!apiJson || typeof apiJson !== 'object') {
    return { diffuse: null, normal: null, roughness: null };
  }

  const urls = [];

  const walk = (value) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (value.startsWith('http') && (lower.includes('.jpg') || lower.includes('.png'))) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(apiJson);

  const pick = (keywords) => {
    const scored = urls
      .filter((url) => keywords.some((kw) => url.toLowerCase().includes(kw)))
      .map((url) => {
        const lower = url.toLowerCase();
        let score = 0;
        preferredSizes.forEach((size, index) => {
          if (lower.includes(size)) {
            score += (preferredSizes.length - index) * 10;
          }
        });
        if (lower.includes('jpg')) score += 6;
        if (lower.includes('png')) score += 3;
        if (lower.includes('preview') || lower.includes('thumb')) score -= 50;
        if (lower.includes('.exr')) score -= 100;
        return { url, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url;
  };

  return {
    diffuse: pick(['diff', 'diffuse', 'albedo', 'basecolor']),
    normal: pick(['nor_gl', 'normal_gl', 'nor', 'normal']),
    roughness: pick(['rough', 'roughness'])
  };
}

const HDRI_URL_CACHE = new Map();
const HDRI_RESOLUTION_PATTERN = /(?:^|[_/-])((?:1|2|4|8)k)(?=\.|[_/-]|$)/i;

const normalizeHdriResolutionId = (value) => {
  const lower = String(value || '').toLowerCase();
  if (HDRI_RESOLUTION_LADDER.includes(lower)) return lower;
  return null;
};

const extractResolutionFromHdriUrl = (url) => {
  if (typeof url !== 'string' || !url.length) return null;
  const match = url.toLowerCase().match(HDRI_RESOLUTION_PATTERN);
  if (!match?.[1]) return null;
  return normalizeHdriResolutionId(match[1]) ?? match[1];
};

const collectHdriCandidates = (apiJson) => {
  const out = [];
  const pushUrl = (url, hintedResolution = null) => {
    if (typeof url !== 'string' || !url.startsWith('http')) return;
    const lower = url.toLowerCase();
    if (!lower.includes('.hdr') && !lower.includes('.exr')) return;
    const format = lower.includes('.hdr') ? 'hdr' : lower.includes('.exr') ? 'exr' : 'unknown';
    out.push({
      url,
      resolution: normalizeHdriResolutionId(hintedResolution) ?? extractResolutionFromHdriUrl(url),
      format
    });
  };
  const walk = (value, hintedResolution = null) => {
    if (!value) return;
    if (typeof value === 'string') {
      pushUrl(value, hintedResolution);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, hintedResolution));
      return;
    }
    if (typeof value !== 'object') return;
    Object.entries(value).forEach(([key, entry]) => {
      const nextHint = normalizeHdriResolutionId(key) ?? hintedResolution;
      walk(entry, nextHint);
    });
  };
  walk(apiJson);
  return out;
};

const pickPolyHavenHdriUrl = (apiJson, preferredResolutions = DEFAULT_HDRI_RESOLUTIONS) => {
  const candidates = collectHdriCandidates(apiJson);
  if (!candidates.length) return null;
  const pickBestByResolution = (targetResolution) => {
    const matching = candidates.filter((entry) => entry.resolution === targetResolution);
    if (!matching.length) return null;
    return matching.find((entry) => entry.format === 'hdr') ?? matching[0];
  };

  for (const res of preferredResolutions) {
    const normalized = normalizeHdriResolutionId(res);
    if (!normalized) continue;
    const matched = pickBestByResolution(normalized);
    if (matched?.url) return matched.url;
  }

  for (const fallbackRes of HDRI_RESOLUTION_LADDER) {
    const matched = pickBestByResolution(fallbackRes);
    if (matched?.url) return matched.url;
  }

  const hdrCandidate = candidates.find((candidate) => candidate.format === 'hdr');
  if (hdrCandidate?.url) {
    return hdrCandidate.url;
  }

  for (const candidate of candidates) {
    if (candidate?.url) {
      return candidate.url;
    }
  }
  return null;
};

async function resolvePolyHavenHdriUrl(config = {}) {
  const cacheKey = `${config?.assetId ?? 'fallback'}|${(config?.preferredResolutions || []).join(',')}|${config?.fallbackResolution ?? ''}|${config?.forceResolution ?? ''}`;
  if (HDRI_URL_CACHE.has(cacheKey)) {
    return HDRI_URL_CACHE.get(cacheKey);
  }
  const forcedResolution =
    typeof config?.forceResolution === 'string' && config.forceResolution.length
      ? config.forceResolution
      : null;
  const preferred = forcedResolution
    ? [forcedResolution]
    : Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
      ? config.preferredResolutions
      : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = forcedResolution || config?.fallbackResolution || preferred[0] || '2k';
  const fallbackUrl =
    config?.fallbackUrl ||
    `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${config?.assetId ?? 'neon_photostudio'}_${fallbackRes}.hdr`;
  if (config?.assetUrls && typeof config.assetUrls === 'object') {
    for (const res of preferred) {
      if (config.assetUrls[res]) {
        HDRI_URL_CACHE.set(cacheKey, config.assetUrls[res]);
        return config.assetUrls[res];
      }
    }
    const manual = Object.values(config.assetUrls).find((value) => typeof value === 'string' && value.length);
    if (manual) {
      HDRI_URL_CACHE.set(cacheKey, manual);
      return manual;
    }
  }
  if (typeof config?.assetUrl === 'string' && config.assetUrl.length) {
    HDRI_URL_CACHE.set(cacheKey, config.assetUrl);
    return config.assetUrl;
  }
  if (!config?.assetId || typeof fetch !== 'function') {
    HDRI_URL_CACHE.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(config.assetId)}`);
    if (!response?.ok) {
      HDRI_URL_CACHE.set(cacheKey, fallbackUrl);
      return fallbackUrl;
    }
    const json = await response.json();
    const picked = pickPolyHavenHdriUrl(json, preferred);
    const resolvedUrl = picked || fallbackUrl;
    HDRI_URL_CACHE.set(cacheKey, resolvedUrl);
    return resolvedUrl;
  } catch (error) {
    console.warn('Failed to resolve Poly Haven HDRI url', error);
    HDRI_URL_CACHE.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }
}

async function loadPolyHavenHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const HDRI_LOAD_TIMEOUT_MS = 30000;
  const resolveFallback = async () => {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const hemi = new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 1.05);
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(6, 24),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.05 })
      );
      floor.rotation.x = -Math.PI / 2;
      const tempScene = new THREE.Scene();
      tempScene.add(hemi);
      tempScene.add(floor);
      const { texture } = pmrem.fromScene(tempScene);
      texture.name = 'murlan-fallback-env';
      pmrem.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      return { envMap: texture, url: null };
    } catch (error) {
      console.warn('Failed to build Murlan fallback HDRI environment', error);
      return null;
    }
  };
  const configuredPreferred = Array.isArray(config?.preferredResolutions)
    ? config.preferredResolutions
    : DEFAULT_HDRI_RESOLUTIONS;
  const attemptedUrls = new Set();
  const resolutionAttempts = [...new Set(
    configuredPreferred
      .map((entry) => normalizeHdriResolutionId(entry))
      .filter((entry) => Boolean(entry))
  )];
  if (!resolutionAttempts.length) {
    resolutionAttempts.push(...DEFAULT_HDRI_RESOLUTIONS);
  }
  const loadFromUrl = (url) =>
    new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timeoutId = setTimeout(() => {
        console.warn('Timed out loading Poly Haven HDRI candidate', {
          assetId: config?.assetId,
          url,
          timeoutMs: HDRI_LOAD_TIMEOUT_MS
        });
        finish(null);
      }, HDRI_LOAD_TIMEOUT_MS);
      const lowerUrl = `${url ?? ''}`.toLowerCase();
      const useExr = lowerUrl.endsWith('.exr');
      const loader = useExr ? new EXRLoader() : new RGBELoader();
      loader.setCrossOrigin?.('anonymous');
      loader.load(
        url,
        (texture) => {
          clearTimeout(timeoutId);
          if (settled) {
            texture.dispose?.();
            return;
          }
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = pmrem.fromEquirectangular(texture).texture;
          envMap.name = `${config?.assetId ?? 'polyhaven'}-env`;
          pmrem.dispose();
          finish({ envMap, url, backgroundMap: texture });
        },
        undefined,
        () => {
          clearTimeout(timeoutId);
          finish(null);
        }
      );
    });

  const buildResolutionCandidates = (forcedResolution, resolvedUrl = '') => {
    const assetId = config?.assetId || 'neon_photostudio';
    const normalizedResolution = normalizeHdriResolutionId(forcedResolution) || forcedResolution || '2k';
    const directHdrUrl = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${normalizedResolution}/${assetId}_${normalizedResolution}.hdr`;
    const directExrUrl = `https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/${normalizedResolution}/${assetId}_${normalizedResolution}.exr`;
    return [...new Set([resolvedUrl, directHdrUrl, directExrUrl].filter((entry) => typeof entry === 'string' && entry))];
  };

  for (const forcedResolution of resolutionAttempts) {
    const resolvedUrl = await resolvePolyHavenHdriUrl({ ...config, forceResolution: forcedResolution });
    const candidateUrls = buildResolutionCandidates(forcedResolution, resolvedUrl);
    let loaded = null;
    for (const url of candidateUrls) {
      if (attemptedUrls.has(url)) continue;
      attemptedUrls.add(url);
      loaded = await loadFromUrl(url);
      if (loaded?.envMap) return loaded;
    }
    console.warn('Failed to load Poly Haven HDRI at requested resolution', {
      assetId: config?.assetId,
      forcedResolution,
      urls: candidateUrls
    });
  }

  const fallbackUrl = await resolvePolyHavenHdriUrl(config);
  if (fallbackUrl && !attemptedUrls.has(fallbackUrl)) {
    const loadedFallback = await loadFromUrl(fallbackUrl);
    if (loadedFallback?.envMap) return loadedFallback;
    console.warn('Failed to load Poly Haven HDRI fallback url', {
      assetId: config?.assetId,
      url: fallbackUrl
    });
  }

  return resolveFallback();
}

async function loadTexture(textureLoader, url, isColor, maxAnisotropy = 1) {
  return await new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        if (isColor) {
          applySRGBColorSpace(texture);
        }
        texture.flipY = false;
        texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => reject(new Error('texture load failed'))
    );
  });
}

function normalizePbrTexture(texture, maxAnisotropy = 1, { preserveWrapping = false, preserveFlipY = false } = {}) {
  if (!texture) return;
  if (!preserveFlipY) texture.flipY = false;
  if (!preserveWrapping) {
    texture.wrapS = texture.wrapS ?? THREE.RepeatWrapping;
    texture.wrapT = texture.wrapT ?? THREE.RepeatWrapping;
  }
  texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
  texture.needsUpdate = true;
}

async function loadPolyhavenTextureSet(
  assetId,
  textureLoader,
  maxAnisotropy = 1,
  cache = null,
  preferredTextureSizes = PREFERRED_TEXTURE_SIZES
) {
  if (!assetId || !textureLoader) return null;
  const key = `${assetId.toLowerCase()}|${maxAnisotropy}`;
  if (cache?.has(key)) {
    return cache.get(key);
  }

  const promise = (async () => {
    try {
      const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      const urls = pickBestTextureUrls(json, preferredTextureSizes);
      if (!urls.diffuse) {
        return null;
      }

      const [diffuse, normal, roughness] = await Promise.all([
        loadTexture(textureLoader, urls.diffuse, true, maxAnisotropy),
        urls.normal ? loadTexture(textureLoader, urls.normal, false, maxAnisotropy) : null,
        urls.roughness ? loadTexture(textureLoader, urls.roughness, false, maxAnisotropy) : null
      ]);

      [diffuse, normal, roughness].filter(Boolean).forEach((tex) => normalizePbrTexture(tex, maxAnisotropy));

      return { diffuse, normal, roughness };
    } catch (error) {
      return null;
    }
  })();

  if (cache) {
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

function applyTextureSetToModel(model, textureSet, fallbackTexture, maxAnisotropy = 1) {
  const normalizeTexture = (texture, isColor = false) => {
    if (!texture) return null;
    if (isColor) applySRGBColorSpace(texture);
    normalizePbrTexture(texture, maxAnisotropy);
    return texture;
  };

  const applyToMaterial = (material) => {
    if (!material) return;
    material.roughness = Math.max(material.roughness ?? 0.4, 0.4);
    material.metalness = Math.min(material.metalness ?? 0.4, 0.4);

    if (material.map) {
      normalizeTexture(material.map, true);
    } else if (textureSet?.diffuse) {
      material.map = normalizeTexture(textureSet.diffuse, true);
      material.needsUpdate = true;
    } else if (fallbackTexture) {
      material.map = normalizeTexture(fallbackTexture, true);
      material.needsUpdate = true;
    }

    if (material.emissiveMap) {
      normalizeTexture(material.emissiveMap, true);
    }

    if (!material.normalMap && textureSet?.normal) {
      material.normalMap = textureSet.normal;
    }
    if (material.normalMap) {
      normalizeTexture(material.normalMap, false);
    }

    if (!material.roughnessMap && textureSet?.roughness) {
      material.roughnessMap = textureSet.roughness;
    }
    normalizeTexture(material.roughnessMap, false);
  };

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(applyToMaterial);
  });
}

function normalizeMaterialTextures(material, maxAnisotropy = 1) {
  if (!material) return;
  if (material.map) {
    applySRGBColorSpace(material.map);
    normalizePbrTexture(material.map, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
  }
  if (material.emissiveMap) {
    applySRGBColorSpace(material.emissiveMap);
    normalizePbrTexture(material.emissiveMap, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
  }
  normalizePbrTexture(material.normalMap, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
  normalizePbrTexture(material.roughnessMap, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
  normalizePbrTexture(material.metalnessMap, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
  normalizePbrTexture(material.aoMap, maxAnisotropy, { preserveWrapping: true, preserveFlipY: true });
}


function getMurlanCharacterAnisotropyCap(renderer = null) {
  try {
    return Math.max(1, renderer?.capabilities?.getMaxAnisotropy?.() || 8);
  } catch {
    return 8;
  }
}

function loadMurlanCharacterTexture(url, { isColor = false, repeat = 3.5, maxAnisotropy = 8, wrapping = THREE.RepeatWrapping } = {}) {
  if (!url) return null;
  const cacheKey = `${url}|${isColor ? 'srgb' : 'linear'}|${repeat}|${maxAnisotropy}|${wrapping}`;
  if (MURLAN_CHARACTER_TEXTURE_CACHE.has(cacheKey)) return MURLAN_CHARACTER_TEXTURE_CACHE.get(cacheKey);
  const normalizeLoaded = (texture) => {
    if (!texture) return;
    if (isColor) applySRGBColorSpace(texture);
    texture.wrapS = wrapping;
    texture.wrapT = wrapping;
    texture.repeat.set(repeat, repeat);
    normalizePbrTexture(texture, maxAnisotropy, { preserveWrapping: true });
    texture.needsUpdate = true;
  };
  const texture = MURLAN_CHARACTER_TEXTURE_LOADER.load(
    url,
    normalizeLoaded,
    undefined,
    () => MURLAN_CHARACTER_TEXTURE_CACHE.delete(cacheKey)
  );
  normalizeLoaded(texture);
  texture.userData = { ...(texture.userData || {}), murlanSharedClothTexture: true };
  MURLAN_CHARACTER_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function isNearlyWhiteCharacterMaterial(mat) {
  if (!mat?.color) return false;
  return mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82 && !mat.map;
}

function isLowSaturationLightCharacterMaterial(mat) {
  if (!mat?.color || mat.map) return false;
  const max = Math.max(mat.color.r, mat.color.g, mat.color.b);
  const min = Math.min(mat.color.r, mat.color.g, mat.color.b);
  return max > 0.72 && max - min < 0.18;
}

function classifyMurlanHumanSurface(obj, mat) {
  const name = `${obj?.name || ''} ${mat?.name || ''}`.toLowerCase();
  if (/eye|iris|pupil|cornea|wolf3d_eyes/.test(name)) return 'eye';
  if (/hair|brow|beard|mustache|moustache|lash|wolf3d_hair|wolf3d_beard|wolf3d_eyebrow/.test(name)) return 'hair';
  if (/teeth|tooth|tongue|mouth|gum/.test(name)) return 'mouth';
  if (/earring|ear_ring|stud|hoop/.test(name)) return 'earring';
  if (/ring|finger_ring/.test(name)) return 'ring';
  if (/watch|bracelet|wrist/.test(name)) return 'watch';
  if (/hat|cap|beanie|fedora|headwear/.test(name)) return 'hat';
  if (/tie|bowtie|bow_tie|necktie|scarf/.test(name)) return 'tie';
  if (/shoe|boot|sole|sneaker|footwear|wolf3d_outfit_footwear/.test(name)) return 'shoes';
  if (/dress|skirt|gown/.test(name)) return 'dress';
  if (/jacket|coat|blazer|hood|hoodie/.test(name)) return 'jacket';
  if (/tshirt|t-shirt|tee/.test(name)) return 'tshirt';
  if (/shirt|top|torso|chest|sleeve|upper|outfit_top|wolf3d_outfit_top/.test(name)) return 'shirt';
  if (/jean|denim/.test(name)) return 'jeans';
  if (/pants|trouser|short|legging|bottom|outfit_bottom|wolf3d_outfit_bottom/.test(name)) return 'pants';
  if (/belt|strap|bag|glove|sock|accessory|accent/.test(name)) return 'accessory';
  if (/skin|head|face|neck|hand|finger|wolf3d_head|wolf3d_body|bodymesh/.test(name) && !/outfit|shirt|pants|trouser|shoe|sock|cloth|jacket|hood|dress|skirt|uniform|suit/.test(name)) return 'skin';
  if (/cloth|clothing|uniform|outfit|suit/.test(name)) return 'shirt';
  if (isNearlyWhiteCharacterMaterial(mat) && /torso|chest|spine|pelvis|hip|arm|body|mesh/.test(name)) return 'shirt';
  if (isNearlyWhiteCharacterMaterial(mat) && /leg/.test(name)) return 'pants';
  return 'other';
}

function resolveMurlanCharacterClothSlot(theme, slot, seatIndex) {
  const combo = MURLAN_CHARACTER_CLOTH_COMBOS[theme?.clothCombo] || MURLAN_CHARACTER_CLOTH_COMBOS.royalDenim;
  const slotAliases = {
    upperCloth: 'shirt',
    lowerCloth: 'pants',
    accentCloth: 'accessory',
    shoe: 'shoes'
  };
  const resolvedSlot = slotAliases[slot] || slot;
  const slotConfig = combo?.[resolvedSlot] || combo?.shirt || { material: 'shirtCotton' };
  const material = MURLAN_CHARACTER_CLOTH_MATERIALS[slotConfig.material] || MURLAN_CHARACTER_CLOTH_MATERIALS.shirtCotton;
  const repeatBoost = seatIndex === 0 ? 0.75 : 0;
  return {
    ...material,
    slot: resolvedSlot,
    tint: slotConfig.tint ?? material.tint ?? 0xffffff,
    repeat: (slotConfig.repeat ?? 3.5) + repeatBoost
  };
}

function applyMurlanCharacterClothMaterial(mat, cloth, maxAnisotropy = 8) {
  mat.map = loadMurlanCharacterTexture(cloth.color, { isColor: true, repeat: cloth.repeat, maxAnisotropy });
  mat.normalMap = loadMurlanCharacterTexture(cloth.normal, { repeat: cloth.repeat, maxAnisotropy });
  mat.roughnessMap = loadMurlanCharacterTexture(cloth.roughness, { repeat: cloth.repeat, maxAnisotropy });
  mat.color = new THREE.Color(cloth.tint ?? 0xffffff);
  const normalScale = cloth.normalScale ?? 0.28;
  mat.normalScale = new THREE.Vector2(normalScale, normalScale);
  mat.roughness = 0.86;
  mat.metalness = ['earring', 'ring', 'watch'].includes(cloth.slot) ? 0.08 : 0.015;
  mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 0.35, ['earring', 'ring', 'watch'].includes(cloth.slot) ? 0.8 : 0.35);
  mat.userData = {
    ...(mat.userData || {}),
    murlanPhysicalClothingSlot: cloth.slot,
    polyhavenCloth: cloth.source,
    polyhavenGltf: cloth.gltf
  };
}

function applyMurlanSkinDetailMaterial(mat, skinColor, maxAnisotropy = 8) {
  const detail = MURLAN_CHARACTER_BODY_DETAIL_MATERIALS.skin;
  if (!mat.map && (isLowSaturationLightCharacterMaterial(mat) || isNearlyWhiteCharacterMaterial(mat))) {
    mat.color = skinColor.clone();
  } else if (mat.color) {
    mat.color.lerp(skinColor, 0.24);
  }
  if (!mat.normalMap) {
    mat.normalMap = loadMurlanCharacterTexture(detail.normal, {
      repeat: detail.repeat,
      maxAnisotropy,
      wrapping: THREE.MirroredRepeatWrapping
    });
    mat.normalScale = new THREE.Vector2(detail.normalScale, detail.normalScale);
  }
  mat.roughness = Math.min(mat.roughness ?? 0.62, 0.62);
  mat.metalness = 0;
  mat.userData = { ...(mat.userData || {}), murlanSkinDetail: detail.source };
}

function applyMurlanHairDetailMaterial(mat, hairColor, maxAnisotropy = 8) {
  const detail = MURLAN_CHARACTER_BODY_DETAIL_MATERIALS.hair;
  mat.map = loadMurlanCharacterTexture(detail.color, { isColor: true, repeat: detail.repeat, maxAnisotropy });
  mat.normalMap = loadMurlanCharacterTexture(detail.normal, { repeat: detail.repeat, maxAnisotropy });
  mat.roughnessMap = loadMurlanCharacterTexture(detail.roughness, { repeat: detail.repeat, maxAnisotropy });
  mat.color = hairColor.clone();
  mat.normalScale = new THREE.Vector2(detail.normalScale, detail.normalScale);
  mat.roughness = 0.62;
  mat.metalness = 0.02;
  mat.envMapIntensity = 0.28;
  mat.userData = { ...(mat.userData || {}), murlanHairDetail: detail.source, polyhavenGltf: detail.gltf };
}

function enhanceMurlanCharacterMaterials(instance, theme, seatIndex = 0, renderer = null) {
  const maxAnisotropy = getMurlanCharacterAnisotropyCap(renderer);
  const clothSlots = {
    shirt: resolveMurlanCharacterClothSlot(theme, 'shirt', seatIndex),
    tshirt: resolveMurlanCharacterClothSlot(theme, 'tshirt', seatIndex),
    jeans: resolveMurlanCharacterClothSlot(theme, 'jeans', seatIndex),
    pants: resolveMurlanCharacterClothSlot(theme, 'pants', seatIndex),
    jacket: resolveMurlanCharacterClothSlot(theme, 'jacket', seatIndex),
    dress: resolveMurlanCharacterClothSlot(theme, 'dress', seatIndex),
    tie: resolveMurlanCharacterClothSlot(theme, 'tie', seatIndex),
    hat: resolveMurlanCharacterClothSlot(theme, 'hat', seatIndex),
    shoes: resolveMurlanCharacterClothSlot(theme, 'shoes', seatIndex),
    accessory: resolveMurlanCharacterClothSlot(theme, 'accessory', seatIndex),
    earring: resolveMurlanCharacterClothSlot(theme, 'earring', seatIndex),
    ring: resolveMurlanCharacterClothSlot(theme, 'ring', seatIndex),
    watch: resolveMurlanCharacterClothSlot(theme, 'watch', seatIndex)
  };
  const skinColor = new THREE.Color(theme?.skinTone ?? 0xd2a07c);
  const hairColor = new THREE.Color(theme?.hairColor ?? 0x21150f);
  const eyeColor = new THREE.Color(theme?.eyeColor ?? 0x3f5f75);

  instance.traverse((obj) => {
    if (!obj?.isMesh) return;
    const sourceMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const enhancedMaterials = sourceMaterials.map((sourceMat) => {
      if (!sourceMat) return sourceMat;
      const mat = sourceMat.clone ? sourceMat.clone() : new THREE.MeshStandardMaterial();
      const surface = classifyMurlanHumanSurface(obj, mat);
      if (clothSlots[surface]) {
        applyMurlanCharacterClothMaterial(mat, clothSlots[surface], maxAnisotropy);
      } else if (surface === 'hair') {
        applyMurlanHairDetailMaterial(mat, hairColor, maxAnisotropy);
      } else if (surface === 'eye') {
        mat.map = null;
        mat.color = eyeColor.clone();
        mat.roughness = 0.18;
        mat.metalness = 0;
        mat.envMapIntensity = 1.1;
      } else if (surface === 'skin') {
        applyMurlanSkinDetailMaterial(mat, skinColor, maxAnisotropy);
      } else if (surface === 'mouth') {
        if (isNearlyWhiteCharacterMaterial(mat)) {
          mat.color = new THREE.Color(0xf8fafc);
        }
        mat.roughness = 0.32;
        mat.metalness = 0;
      } else if (isNearlyWhiteCharacterMaterial(mat)) {
        mat.color = skinColor.clone();
        mat.roughness = 0.58;
        mat.metalness = 0;
      }
      normalizeMaterialTextures(mat, maxAnisotropy);
      mat.needsUpdate = true;
      return mat;
    });
    obj.material = Array.isArray(obj.material) ? enhancedMaterials : enhancedMaterials[0];
  });
}

function prepareLoadedModel(model, options = {}) {
  const { preserveGltfTextureMapping = false, maxAnisotropy = 8 } = options;
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (preserveGltfTextureMapping) {
          normalizeMaterialTextures(mat, maxAnisotropy);
        } else {
          if (mat.map) applySRGBColorSpace(mat.map);
          if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
          normalizePbrTexture(mat.map, maxAnisotropy);
          normalizePbrTexture(mat.emissiveMap, maxAnisotropy);
        }
        mat.needsUpdate = true;
      });
    }
  });
}
const TARGET_CHAIR_SIZE = new THREE.Vector3(
  0.9 * MODEL_SCALE * 1.5 * 1.3 * CHAIR_SIZE_SCALE,
  Math.max(
    0.68 * MODEL_SCALE * 1.5 * 1.3 * CHAIR_SIZE_SCALE * 1.2,
    0.9 * MODEL_SCALE * 1.5 * 1.3 * CHAIR_SIZE_SCALE
  ),
  0.95 * MODEL_SCALE * 1.5 * 1.3 * CHAIR_SIZE_SCALE
);
const TARGET_CHAIR_MIN_Y = 0;
const TARGET_CHAIR_CENTER_Z = 0;

const DEFAULT_APPEARANCE = {
  outfit: 0,
  cards: 0,
  stools: DEFAULT_STOOL_INDEX,
  characters: 0,
  tables: 0,
  tableShape: DEFAULT_TABLE_SHAPE_INDEX,
  tableCloth: DEFAULT_TABLE_CLOTH_INDEX,
  tableFinish: DEFAULT_TABLE_FINISH_INDEX,
  environmentHdri: DEFAULT_HDRI_INDEX
};
const APPEARANCE_STORAGE_KEY = 'murlanRoyaleAppearance';
const FRAME_RATE_STORAGE_KEY = 'murlanFrameRate';
const CARD_ACTION_ANIMATION_STORAGE_KEY = 'murlanCardActionAnimation';
const COMMENTARY_PRESET_STORAGE_KEY = 'murlanRoyaleCommentaryPreset';
const COMMENTARY_MUTE_STORAGE_KEY = 'murlanRoyaleCommentaryMute';

const CARD_ACTION_ANIMATION_OPTIONS = Object.freeze([
  {
    id: 'precisionLift',
    label: 'Precision Lift',
    description: 'Hand pinches, lifts, carries, then places flat with the safest orientation.'
  },
  {
    id: 'lowArcDeal',
    label: 'Low Arc',
    description: 'A compact curved carry that keeps cards close to the table.'
  },
  {
    id: 'straightSlide',
    label: 'Slide Place',
    description: 'A controlled forward slide with a short pickup and soft release.'
  },
  {
    id: 'flipSettle',
    label: 'Flip Settle',
    description: 'A small wrist flip before settling into the same final orientation.'
  },
  {
    id: 'springSnap',
    label: 'Spring Snap',
    description: 'A faster spring-style placement with a tiny overshoot correction.'
  }
]);
const DEFAULT_CARD_ACTION_ANIMATION_ID = CARD_ACTION_ANIMATION_OPTIONS[0].id;

function resolveCardActionAnimationOption(id) {
  return CARD_ACTION_ANIMATION_OPTIONS.find((option) => option.id === id) ?? CARD_ACTION_ANIMATION_OPTIONS[0];
}
const COMMENTARY_QUEUE_LIMIT = 4;
const COMMENTARY_MIN_INTERVAL_MS = 900;
const COMMENTARY_MAX_LATENCY_MS = 2200;
const COMMENTARY_PRIORITY_MAX_LATENCY_MS = 6000;
const MURLAN_ROYALE_COMMENTARY_PRESETS = Object.freeze([
  {
    id: 'english',
    label: 'English',
    description: 'Mixed voices, classic English',
    language: 'en',
    voiceHints: {
      [MURLAN_ROYALE_SPEAKERS.lead]: [
        'en-US',
        'English',
        'male',
        'David',
        'Guy',
        'Daniel',
        'Alex'
      ],
      [MURLAN_ROYALE_SPEAKERS.analyst]: [
        'en-GB',
        'English',
        'female',
        'Sonia',
        'Hazel',
        'Kate',
        'Emma'
      ],
      [MURLAN_ROYALE_SPEAKERS.hype]: [
        'en-US',
        'English',
        'male',
        'Matthew',
        'James',
        'Michael'
      ],
      [MURLAN_ROYALE_SPEAKERS.tactician]: [
        'en-GB',
        'English',
        'female',
        'Amy',
        'Olivia',
        'Serena'
      ],
      [MURLAN_ROYALE_SPEAKERS.veteran]: [
        'en-US',
        'English',
        'male',
        'George',
        'Mark',
        'Brian'
      ]
    },
    speakerSettings: {
      [MURLAN_ROYALE_SPEAKERS.lead]: { rate: 1, pitch: 0.96, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.hype]: { rate: 1.08, pitch: 1.1, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.tactician]: { rate: 0.98, pitch: 1, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.veteran]: { rate: 0.96, pitch: 0.92, volume: 1 }
    }
  },
  {
    id: 'saffron-table',
    label: 'Indian Table',
    description: 'Hindi commentary with lively pacing',
    language: 'hi',
    voiceHints: {
      [MURLAN_ROYALE_SPEAKERS.lead]: [
        'hi-IN',
        'hi',
        'Hindi',
        'male',
        'Raj',
        'Amit',
        'Arjun'
      ],
      [MURLAN_ROYALE_SPEAKERS.analyst]: [
        'hi-IN',
        'hi',
        'Hindi',
        'female',
        'Asha',
        'Priya',
        'Neha'
      ],
      [MURLAN_ROYALE_SPEAKERS.hype]: [
        'hi-IN',
        'hi',
        'Hindi',
        'male',
        'Rohan',
        'Vijay',
        'Karan'
      ],
      [MURLAN_ROYALE_SPEAKERS.tactician]: [
        'hi-IN',
        'hi',
        'Hindi',
        'female',
        'Ananya',
        'Kiran',
        'Deepa'
      ],
      [MURLAN_ROYALE_SPEAKERS.veteran]: [
        'hi-IN',
        'hi',
        'Hindi',
        'male',
        'Suresh',
        'Ajay',
        'Prakash'
      ]
    },
    speakerSettings: {
      [MURLAN_ROYALE_SPEAKERS.lead]: { rate: 1.06, pitch: 1.02, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.08, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.hype]: { rate: 1.12, pitch: 1.12, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.tactician]: { rate: 1.02, pitch: 1, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.veteran]: { rate: 0.98, pitch: 0.96, volume: 1 }
    }
  },
  {
    id: 'moscow-mics',
    label: 'Russian Booth',
    description: 'Russian commentary with steady cadence',
    language: 'ru',
    voiceHints: {
      [MURLAN_ROYALE_SPEAKERS.lead]: [
        'ru-RU',
        'ru',
        'Russian',
        'male',
        'Dmitri',
        'Ivan',
        'Sergey',
        'Alexey'
      ],
      [MURLAN_ROYALE_SPEAKERS.analyst]: [
        'ru-RU',
        'ru',
        'Russian',
        'female',
        'Anna',
        'Svetlana',
        'Irina',
        'Olga'
      ],
      [MURLAN_ROYALE_SPEAKERS.hype]: [
        'ru-RU',
        'ru',
        'Russian',
        'male',
        'Pavel',
        'Nikolai',
        'Kirill'
      ],
      [MURLAN_ROYALE_SPEAKERS.tactician]: [
        'ru-RU',
        'ru',
        'Russian',
        'female',
        'Maria',
        'Elena',
        'Daria'
      ],
      [MURLAN_ROYALE_SPEAKERS.veteran]: [
        'ru-RU',
        'ru',
        'Russian',
        'male',
        'Oleg',
        'Viktor',
        'Yuri'
      ]
    },
    speakerSettings: {
      [MURLAN_ROYALE_SPEAKERS.lead]: { rate: 1, pitch: 0.95, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.analyst]: { rate: 1.03, pitch: 1.02, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.hype]: { rate: 1.07, pitch: 1.04, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.tactician]: { rate: 0.98, pitch: 0.98, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.veteran]: { rate: 0.96, pitch: 0.94, volume: 1 }
    }
  },
  {
    id: 'latin-pulse',
    label: 'Latin Pulse',
    description: 'Spanish play-by-play with lively color',
    language: 'es',
    voiceHints: {
      [MURLAN_ROYALE_SPEAKERS.lead]: [
        'es-ES',
        'es-MX',
        'Spanish',
        'male',
        'Jorge',
        'Carlos',
        'Miguel'
      ],
      [MURLAN_ROYALE_SPEAKERS.analyst]: [
        'es-ES',
        'es-MX',
        'Spanish',
        'female',
        'Isabella',
        'Lucia',
        'Camila'
      ],
      [MURLAN_ROYALE_SPEAKERS.hype]: [
        'es-ES',
        'es-MX',
        'Spanish',
        'male',
        'Diego',
        'Andres',
        'Sergio'
      ],
      [MURLAN_ROYALE_SPEAKERS.tactician]: [
        'es-ES',
        'es-MX',
        'Spanish',
        'female',
        'Elena',
        'Sofia',
        'Valeria'
      ],
      [MURLAN_ROYALE_SPEAKERS.veteran]: [
        'es-ES',
        'es-MX',
        'Spanish',
        'male',
        'Ramon',
        'Alberto',
        'Hector'
      ]
    },
    speakerSettings: {
      [MURLAN_ROYALE_SPEAKERS.lead]: { rate: 1.05, pitch: 1, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.1, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.hype]: { rate: 1.12, pitch: 1.12, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.tactician]: { rate: 1, pitch: 0.98, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.veteran]: { rate: 0.97, pitch: 0.95, volume: 1 }
    }
  },
  {
    id: 'francophone-booth',
    label: 'Francophone Booth',
    description: 'French broadcast pairing',
    language: 'fr',
    voiceHints: {
      [MURLAN_ROYALE_SPEAKERS.lead]: [
        'fr-FR',
        'French',
        'male',
        'Henri',
        'Louis',
        'Paul'
      ],
      [MURLAN_ROYALE_SPEAKERS.analyst]: [
        'fr-FR',
        'French',
        'female',
        'Amelie',
        'Marie',
        'Charlotte'
      ],
      [MURLAN_ROYALE_SPEAKERS.hype]: [
        'fr-FR',
        'French',
        'male',
        'Julien',
        'Antoine',
        'Lucas'
      ],
      [MURLAN_ROYALE_SPEAKERS.tactician]: [
        'fr-FR',
        'French',
        'female',
        'Claire',
        'Camille',
        'Lea'
      ],
      [MURLAN_ROYALE_SPEAKERS.veteran]: [
        'fr-FR',
        'French',
        'male',
        'Bernard',
        'Olivier',
        'Gerard'
      ]
    },
    speakerSettings: {
      [MURLAN_ROYALE_SPEAKERS.lead]: { rate: 0.98, pitch: 0.96, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.hype]: { rate: 1.06, pitch: 1.08, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.tactician]: { rate: 0.98, pitch: 0.98, volume: 1 },
      [MURLAN_ROYALE_SPEAKERS.veteran]: { rate: 0.95, pitch: 0.94, volume: 1 }
    }
  },
]);
const DEFAULT_COMMENTARY_PRESET_ID = MURLAN_ROYALE_COMMENTARY_PRESETS[0]?.id || 'english';
const COMMENTARY_PRIMARY_SPEAKERS = Object.freeze({
  english: MURLAN_ROYALE_SPEAKERS.analyst,
  'latin-pulse': MURLAN_ROYALE_SPEAKERS.analyst
});
const CUSTOMIZATION_SECTIONS = [
  { key: 'tables', label: 'Table Model', options: TABLE_THEMES },
  { key: 'tableShape', label: 'Table Shape', options: TABLE_SHAPE_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: MURLAN_TABLE_CLOTHS },
  { key: 'tableFinish', label: 'Table Finish', options: MURLAN_TABLE_FINISHES },
  { key: 'environmentHdri', label: 'Arena HDRI', options: MURLAN_HDRI_OPTIONS },
  { key: 'cards', label: 'Cards', options: CARD_THEMES },
  { key: 'stools', label: 'Stools', options: STOOL_THEMES },
  ...(ENABLE_3D_HUMAN_CHARACTERS
    ? [{ key: 'characters', label: '3D Players', options: MURLAN_CHARACTER_THEMES }]
    : [])
];

function createRegularPolygonShape(sides = 8, radius = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['outfit', OUTFIT_THEMES.length],
    ['cards', CARD_THEMES.length],
    ['stools', STOOL_THEMES.length],
    ['characters', MURLAN_CHARACTER_THEMES.length],
    ['tables', TABLE_THEMES.length],
    ['tableShape', TABLE_SHAPE_OPTIONS.length],
    ['tableCloth', MURLAN_TABLE_CLOTHS.length],
    ['tableFinish', MURLAN_TABLE_FINISHES.length],
    ['environmentHdri', MURLAN_HDRI_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(TARGET_CHAIR_SIZE.x, TARGET_CHAIR_SIZE.y, TARGET_CHAIR_SIZE.z);
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    model.scale.multiplyScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(
    -scaledCenter.x,
    TARGET_CHAIR_MIN_Y - scaledBox.min.y,
    TARGET_CHAIR_CENTER_Z - scaledCenter.z
  );
  model.position.add(offset);
}

function extractChairMaterials(model) {
  const upholstery = new Set();
  const metal = new Set();
  model.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat.map) applySRGBColorSpace(mat.map);
        if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
        const bucket = (mat.metalness ?? 0) > 0.35 ? metal : upholstery;
        bucket.add(mat);
      });
    }
  });
  const upholsteryArr = Array.from(upholstery);
  const metalArr = Array.from(metal);
  return {
    seat: upholsteryArr[0] ?? metalArr[0] ?? null,
    leg: metalArr[0] ?? upholsteryArr[0] ?? null,
    upholstery: upholsteryArr,
    metal: metalArr
  };
}

const SHARED_GLTF_TEXTURE_PROPS = Object.freeze([
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'alphaMap',
  'emissiveMap',
  'bumpMap',
  'displacementMap',
  'clearcoatMap',
  'clearcoatRoughnessMap',
  'clearcoatNormalMap',
  'specularMap',
  'sheenColorMap',
  'sheenRoughnessMap'
]);

function disposeOwnedMaterialTextures(material) {
  if (!material) return;
  SHARED_GLTF_TEXTURE_PROPS.forEach((prop) => {
    const texture = material[prop];
    if (texture?.isTexture && texture.userData?.murlanCanDispose === true) {
      texture.dispose?.();
    }
  });
}

function disposeObjectResources(object) {
  const materials = new Set();
  object.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => mat && materials.add(mat));
      obj.geometry?.dispose?.();
    }
  });
  materials.forEach((mat) => {
    disposeOwnedMaterialTextures(mat);
    mat?.dispose?.();
  });
}

function cloneModelWithLocalMaterials(source) {
  if (!source) return source;
  const clonedRoot = source.clone(true);
  const textureCache = new Map();
  const materialCache = new Map();

  const cloneTexture = (texture) => {
    if (!texture?.isTexture) return texture ?? null;
    if (textureCache.has(texture)) return textureCache.get(texture);
    const cloned = texture.clone();
    cloned.needsUpdate = true;
    textureCache.set(texture, cloned);
    return cloned;
  };

  const cloneMaterial = (material) => {
    if (!material) return material;
    if (materialCache.has(material)) return materialCache.get(material);
    const cloned = material.clone();
    SHARED_GLTF_TEXTURE_PROPS.forEach((prop) => {
      if (cloned[prop]) cloned[prop] = cloneTexture(cloned[prop]);
    });
    materialCache.set(material, cloned);
    return cloned;
  };

  clonedRoot.traverse((node) => {
    if (!node?.isMesh) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map((mat) => cloneMaterial(mat));
    } else {
      node.material = cloneMaterial(node.material);
    }
  });

  return clonedRoot;
}

function liftModelToGround(model, targetMinY = 0) {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += targetMinY - box.min.y;
}

function groundObjectToY(object, targetY = 0) {
  if (!object) return 0;
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.y)) return 0;
  const delta = targetY - box.min.y;
  if (delta !== 0) {
    object.position.y += delta;
  }
  return delta;
}

function centerObjectOnArenaXZ(object) {
  if (!object) return;
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.z)) return;
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
}

function fitModelToHeight(model, targetHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const currentHeight = box.max.y - box.min.y;
  if (currentHeight > 0) {
    const scale = targetHeight / currentHeight;
    model.scale.multiplyScalar(scale);
  }
  liftModelToGround(model, 0);
}

function fitTableModelToArena(model) {
  if (!model) return { surfaceY: TABLE_HEIGHT, radius: TABLE_RADIUS };
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size.x, size.z);
  const targetHeight = TABLE_MODEL_TARGET_HEIGHT;
  const targetDiameter = TABLE_MODEL_TARGET_DIAMETER;
  const targetRadius = targetDiameter / 2;
  const scaleY = size.y > 0 ? targetHeight / size.y : 1;
  const scaleXZ = maxXZ > 0 ? targetDiameter / maxXZ : 1;

  if (scaleY !== 1 || scaleXZ !== 1) {
    model.scale.set(
      model.scale.x * scaleXZ,
      model.scale.y * scaleY,
      model.scale.z * scaleXZ
    );
  }
  model.scale.x *= TABLE_HORIZONTAL_SHRINK;

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -scaledBox.min.y, -center.z));

  const recenteredBox = new THREE.Box3().setFromObject(model);
  const surfaceOffset = targetHeight - recenteredBox.max.y;
  if (surfaceOffset !== 0) {
    model.position.y += surfaceOffset;
    recenteredBox.translate(new THREE.Vector3(0, surfaceOffset, 0));
  }

  const radius = Math.max(
    Math.abs(recenteredBox.max.x),
    Math.abs(recenteredBox.min.x),
    Math.abs(recenteredBox.max.z),
    Math.abs(recenteredBox.min.z),
    targetRadius
  );
  return {
    surfaceY: targetHeight,
    // Preserve previous card/avatar/camera layout radius even after shrinking visuals.
    radius: radius / TABLE_AND_CHAIR_VISUAL_SHRINK
  };
}

async function createPolyhavenInstance(
  assetId,
  targetHeight,
  rotationY = 0,
  renderer = null,
  textureOptions = {},
  preserveGltfTextureMapping = true
) {
  const model = await loadPolyhavenModel(assetId, renderer);
  prepareLoadedModel(model, { preserveGltfTextureMapping });
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null,
    textureSet = null,
    preferredTextureSizes = PREFERRED_TEXTURE_SIZES
  } = textureOptions || {};
  if (textureLoader && !preserveGltfTextureMapping) {
    try {
      const textures =
        textureSet ??
        (await loadPolyhavenTextureSet(
          assetId,
          textureLoader,
          maxAnisotropy,
          textureCache,
          preferredTextureSizes
        ));
      if (textures || fallbackTexture) {
        applyTextureSetToModel(model, textures, fallbackTexture, maxAnisotropy);
      }
    } catch (error) {
      if (fallbackTexture) {
        applyTextureSetToModel(model, null, fallbackTexture, maxAnisotropy);
      }
    }
  }
  fitModelToHeight(model, targetHeight);
  if (rotationY) model.rotation.y += rotationY;
  return model;
}

function buildPolyhavenModelUrls(assetId) {
  if (!assetId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${assetId}/${assetId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`
  ];
}

function extractPolyhavenIncludeUrlMap(manifest, resolution = '2k') {
  const include = manifest?.gltf?.[resolution]?.gltf?.include;
  if (!include || typeof include !== 'object') return null;
  const map = new Map();
  Object.entries(include).forEach(([relativePath, entry]) => {
    if (!relativePath || typeof relativePath !== 'string') return;
    const fileUrl = entry?.url;
    if (!fileUrl || typeof fileUrl !== 'string') return;
    map.set(relativePath, fileUrl);
    map.set(relativePath.replace(/^\.\//, ''), fileUrl);
    map.set(relativePath.split('/').pop() || relativePath, fileUrl);
  });
  return map;
}

function buildPolyhavenManifestCandidates(manifest, resolutionOrder = ['2k', '1k']) {
  if (!manifest?.gltf || typeof manifest.gltf !== 'object') return [];
  const availableResolutions = Object.keys(manifest.gltf);
  const orderedResolutions = Array.from(new Set([...resolutionOrder, ...availableResolutions]));
  return orderedResolutions
    .map((resolution) => {
      const url = manifest?.gltf?.[resolution]?.gltf?.url;
      if (!url || typeof url !== 'string') return null;
      return {
        url,
        resolution: String(resolution).toLowerCase(),
        includeUrlMap: extractPolyhavenIncludeUrlMap(manifest, resolution)
      };
    })
    .filter(Boolean);
}

function createPolyhavenGltfLoader(renderer = null, includeUrlMap = null) {
  const manager = new THREE.LoadingManager();
  if (includeUrlMap?.size) {
    manager.setURLModifier((requestUrl = '') => {
      const cleanUrl = String(requestUrl || '').split('?')[0];
      const normalized = cleanUrl.replace(/^\.\//, '');
      const fileName = normalized.split('/').pop();
      return (
        includeUrlMap.get(cleanUrl) ||
        includeUrlMap.get(normalized) ||
        includeUrlMap.get(fileName) ||
        requestUrl
      );
    });
  }
  return createConfiguredGLTFLoader(renderer, manager);
}

function shouldPreserveChairMaterials(theme) {
  return Boolean(theme?.preserveMaterials || theme?.source === 'polyhaven' || theme?.source === 'gltf');
}

function createConfiguredGLTFLoader(renderer = null, manager = undefined) {
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin?.('anonymous');

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder?.(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
  }

  if (renderer) {
    try {
      sharedKtx2Loader.detectSupport(renderer);
    } catch (error) {
      console.warn('Murlan KTX2 support detection failed', error);
    }
  }

  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

async function loadGltfChair(urls = CHAIR_MODEL_URLS, rotationY = 0, renderer = null) {
  const loader = createConfiguredGLTFLoader(renderer);

  let gltf = null;
  let lastError = null;
  for (const url of urls) {
    try {
      gltf = await loader.loadAsync(url);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!gltf) {
    throw lastError || new Error('Failed to load chair model');
  }

  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) {
    throw new Error('Chair model missing scene');
  }

  prepareLoadedModel(model);

  fitChairModelToFootprint(model);
  if (rotationY) {
    model.rotation.y += rotationY;
  }

  return {
    chairTemplate: model,
    materials: extractChairMaterials(model)
  };
}

const CHARACTER_MODEL_CACHE = new Map();

function createThumbnailCharacterStandIn(theme = {}) {
  const group = new THREE.Group();
  group.name = `${theme.id || 'murlan'}-procedural-human-stand-in`;

  const texture = theme.thumbnail ? new THREE.TextureLoader().load(theme.thumbnail) : null;
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.userData = { ...(texture.userData || {}), murlanCanDispose: true };
  }

  const makeMaterial = (color, { roughness = 0.74, metalness = 0.03, map = null } = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
      map
    });

  const skinMaterial = makeMaterial(theme.skinTone ?? 0xd2a07c, { roughness: 0.58, metalness: 0 });
  const hairMaterial = makeMaterial(theme.hairColor ?? 0x21150f, { roughness: 0.68, metalness: 0.01 });
  const jacketMaterial = makeMaterial(resolveMurlanCharacterClothSlot(theme, 'jacket', 0).tint ?? 0x1f2937);
  const shirtMaterial = makeMaterial(resolveMurlanCharacterClothSlot(theme, 'shirt', 0).tint ?? 0xf8fafc);
  const pantsMaterial = makeMaterial(resolveMurlanCharacterClothSlot(theme, 'pants', 0).tint ?? 0x1f2937);
  const shoeMaterial = makeMaterial(resolveMurlanCharacterClothSlot(theme, 'shoes', 0).tint ?? 0x0f172a, { roughness: 0.62, metalness: 0.06 });
  const tieMaterial = makeMaterial(resolveMurlanCharacterClothSlot(theme, 'tie', 0).tint ?? 0x8b0f16, { roughness: 0.7, metalness: 0.02 });

  const addMesh = (mesh, position, rotation = null) => {
    mesh.position.copy(position);
    if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Compact seated humanoid proportions matching the same seatRoot scale/offset path as GLB humans.
  addMesh(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.18 * MODEL_SCALE, 0.36 * MODEL_SCALE, 8, 16), jacketMaterial),
    new THREE.Vector3(0, 0.82 * MODEL_SCALE, 0)
  );
  addMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.2 * MODEL_SCALE, 0.28 * MODEL_SCALE, 0.035 * MODEL_SCALE), shirtMaterial),
    new THREE.Vector3(0, 0.84 * MODEL_SCALE, 0.165 * MODEL_SCALE)
  );
  addMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.045 * MODEL_SCALE, 0.22 * MODEL_SCALE, 0.025 * MODEL_SCALE), tieMaterial),
    new THREE.Vector3(0, 0.83 * MODEL_SCALE, 0.19 * MODEL_SCALE)
  );

  addMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.155 * MODEL_SCALE, 24, 18), skinMaterial),
    new THREE.Vector3(0, 1.2 * MODEL_SCALE, 0.02 * MODEL_SCALE)
  );
  addMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.163 * MODEL_SCALE, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.54), hairMaterial),
    new THREE.Vector3(0, 1.25 * MODEL_SCALE, 0.01 * MODEL_SCALE)
  );

  if (texture) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2 * MODEL_SCALE, 0.2 * MODEL_SCALE),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xffffff),
        map: texture,
        roughness: 0.5,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    addMesh(face, new THREE.Vector3(0, 1.2 * MODEL_SCALE, 0.162 * MODEL_SCALE));
  }

  const armGeometry = new THREE.CapsuleGeometry(0.045 * MODEL_SCALE, 0.34 * MODEL_SCALE, 8, 12);
  addMesh(
    new THREE.Mesh(armGeometry, jacketMaterial),
    new THREE.Vector3(-0.23 * MODEL_SCALE, 0.77 * MODEL_SCALE, 0.12 * MODEL_SCALE),
    { x: THREE.MathUtils.degToRad(58), z: THREE.MathUtils.degToRad(-18) }
  );
  addMesh(
    new THREE.Mesh(armGeometry.clone(), jacketMaterial),
    new THREE.Vector3(0.23 * MODEL_SCALE, 0.77 * MODEL_SCALE, 0.12 * MODEL_SCALE),
    { x: THREE.MathUtils.degToRad(58), z: THREE.MathUtils.degToRad(18) }
  );
  addMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.052 * MODEL_SCALE, 14, 10), skinMaterial),
    new THREE.Vector3(-0.31 * MODEL_SCALE, 0.61 * MODEL_SCALE, 0.26 * MODEL_SCALE)
  );
  addMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.052 * MODEL_SCALE, 14, 10), skinMaterial),
    new THREE.Vector3(0.31 * MODEL_SCALE, 0.61 * MODEL_SCALE, 0.26 * MODEL_SCALE)
  );

  const legGeometry = new THREE.CapsuleGeometry(0.055 * MODEL_SCALE, 0.38 * MODEL_SCALE, 8, 12);
  addMesh(
    new THREE.Mesh(legGeometry, pantsMaterial),
    new THREE.Vector3(-0.1 * MODEL_SCALE, 0.43 * MODEL_SCALE, 0.16 * MODEL_SCALE),
    { x: THREE.MathUtils.degToRad(82), z: THREE.MathUtils.degToRad(-3) }
  );
  addMesh(
    new THREE.Mesh(legGeometry.clone(), pantsMaterial),
    new THREE.Vector3(0.1 * MODEL_SCALE, 0.43 * MODEL_SCALE, 0.16 * MODEL_SCALE),
    { x: THREE.MathUtils.degToRad(82), z: THREE.MathUtils.degToRad(3) }
  );
  addMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.13 * MODEL_SCALE, 0.055 * MODEL_SCALE, 0.2 * MODEL_SCALE), shoeMaterial),
    new THREE.Vector3(-0.1 * MODEL_SCALE, 0.24 * MODEL_SCALE, 0.39 * MODEL_SCALE)
  );
  addMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.13 * MODEL_SCALE, 0.055 * MODEL_SCALE, 0.2 * MODEL_SCALE), shoeMaterial),
    new THREE.Vector3(0.1 * MODEL_SCALE, 0.24 * MODEL_SCALE, 0.39 * MODEL_SCALE)
  );

  return group;
}

async function loadCharacterModel(theme, renderer = null) {
  const urls = Array.isArray(theme?.modelUrls) && theme.modelUrls.length
    ? theme.modelUrls
    : theme?.url
      ? [theme.url]
      : [];
  if (!urls.length) throw new Error('Missing character model URL');
  const cacheKey = `${theme.id || urls[0]}::${urls.join('|')}`;
  if (CHARACTER_MODEL_CACHE.has(cacheKey)) {
    return CHARACTER_MODEL_CACHE.get(cacheKey);
  }
  const promise = (async () => {
    const loader = createConfiguredGLTFLoader(renderer);
    loader.setCrossOrigin?.('anonymous');
    let gltf = null;
    let lastError = null;
    for (const url of urls) {
      try {
        // eslint-disable-next-line no-await-in-loop
        gltf = await loader.loadAsync(url);
        if (gltf) break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!gltf) {
      if (theme?.thumbnail) {
        console.warn('Using Murlan thumbnail stand-in for missing character GLB', {
          characterId: theme.id,
          urls
        });
        return createThumbnailCharacterStandIn(theme);
      }
      throw lastError || new Error(`Character load failed for ${theme.id || 'unknown'}`);
    }
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error(`Character scene missing for ${theme.id || 'unknown'}`);
    prepareLoadedModel(root, { preserveGltfTextureMapping: true, maxAnisotropy: 8 }); // keep original glTF UV/texture mapping intact
    return root;
  })();
  CHARACTER_MODEL_CACHE.set(cacheKey, promise);
  promise.catch(() => CHARACTER_MODEL_CACHE.delete(cacheKey));
  return promise;
}

function createCharacterCards({ handLift = 0.96, handCardsInput = [], cardTheme = CARD_THEMES[0], playerColor = '#1d4ed8', cardTextureSize = null } = {}) {
  const cardsGroup = new THREE.Group();
  const handCards = Array.isArray(handCardsInput) && handCardsInput.length
    ? handCardsInput.slice(0, 5)
    : [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }, { rank: 'Q', suit: '♣' }];
  const safeCount = Math.max(handCards.length, 2);
  const cardGeometry = createCardGeometry(0.218 * MODEL_SCALE, 0.316 * MODEL_SCALE, 0.01 * MODEL_SCALE, {
    rounded: true,
    cornerRadiusRatio: 0.18,
    segments: 14
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cardTheme?.edgeColor || '#f5f7fb'),
    roughness: 0.96,
    metalness: 0
  });
  const backTexture = makeCardBackTexture(cardTheme);
  const managedTextures = [backTexture];
  const managedMaterials = [edgeMaterial];

  // Narrow centers and wider rotations make held helper decks pinch at the
  // thumb/bottom while opening gradually toward the card tops.
  const spread = 0.082 * MODEL_SCALE;
  for (let idx = 0; idx < safeCount; idx++) {
    const handCard = handCards[idx] || handCards[handCards.length - 1];
    const faceTexture = makeCardFace(handCard.rank, handCard.suit, cardTheme, cardTextureSize?.heldW, cardTextureSize?.heldH);
    managedTextures.push(faceTexture);
    const frontMaterial = new THREE.MeshStandardMaterial({
      map: faceTexture,
      color: new THREE.Color(CARD_FRONT_BASE_COLOR),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0
    });
    const backMaterial = new THREE.MeshStandardMaterial({
      map: backTexture,
      color: new THREE.Color(CARD_BACK_BASE_COLOR),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0,
      emissive: new THREE.Color('#0f172a'),
      emissiveIntensity: 0
    });
    managedMaterials.push(frontMaterial, backMaterial);
    const sideMaterials = [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, frontMaterial, backMaterial];
    const card = new THREE.Mesh(cardGeometry, sideMaterials);
    const centered = idx - (safeCount - 1) / 2;
    card.position.set(centered * spread, handLift * MODEL_SCALE + Math.abs(centered) * 0.008, idx * 0.004);
    card.rotation.set(
      THREE.MathUtils.degToRad(-72),
      THREE.MathUtils.degToRad(-centered * 12),
      THREE.MathUtils.degToRad(centered * 16)
    );
    card.castShadow = true;
    card.receiveShadow = true;
    cardsGroup.add(card);
  }

  cardsGroup.userData.dispose = () => {
    cardGeometry.dispose();
    managedMaterials.forEach((material) => material.dispose());
    managedTextures.forEach((texture) => texture.dispose());
  };
  return cardsGroup;
}

function normalizeCharacterPivot(characterRoot) {
  if (!characterRoot) return;
  const bounds = new THREE.Box3().setFromObject(characterRoot);
  if (bounds.isEmpty()) return;
  characterRoot.position.y -= bounds.min.y;
}

function findBoneByHints(root, hints = []) {
  if (!root || !hints.length) return null;
  let matched = null;
  root.traverse((obj) => {
    if (matched || !obj?.isBone) return;
    const name = String(obj.name || '').toLowerCase();
    if (!name) return;
    if (hints.some((hint) => name.includes(hint))) {
      matched = obj;
    }
  });
  return matched;
}

function captureBoneRotation(bone) {
  return bone ? bone.rotation.clone() : new THREE.Euler();
}

function applyRotationOffset(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  bone.rotation.x += x;
  bone.rotation.y += y;
  bone.rotation.z += z;
}

function computeHeldCardsPose() {
  // Keep every character-held helper deck in the same local hand pose as the
  // bottom human player. Because the cards are parented to each character
  // model, this preserves the existing fan layout while placing opponent cards
  // between their hands instead of applying separate top/side offsets.
  return {
    x: 0,
    y: 1.2 * MODEL_SCALE + 1.12 * MODEL_SCALE,
    z: 0.82 * MODEL_SCALE - 52.5 * MODEL_SCALE
  };
}

function createCharacterRig(instance, seatRoot, seatConfig, characterTheme, player, playerIndex, cardTheme, cardTextureSize = null) {
  const hips = findBoneByHints(instance, ['hips', 'pelvis', 'pelvisjoint', 'hip_joint']);
  const spine = findBoneByHints(instance, ['spine', 'chest', 'torso']);
  const head = findBoneByHints(instance, ['head', 'neck', 'headjoint', 'head_joint']);
  const rightUpperArm = findBoneByHints(instance, ['rightarm', 'arm.r', 'r_upperarm', 'rightshoulder', 'armjointr', 'arm_joint_r_1', 'arm_joint_r', 'shoulderr']);
  const rightForeArm = findBoneByHints(instance, ['rightforearm', 'r_forearm', 'rightlowerarm', 'forearmr', 'elbowr', 'arm_joint_r_2', 'arm_joint_r_3']);
  const rightHand = findBoneByHints(instance, ['righthand', 'hand.r', 'r_hand', 'handjointr', 'hand_joint_r']);
  const leftUpperArm = findBoneByHints(instance, ['leftarm', 'arm.l', 'l_upperarm', 'leftshoulder', 'armjointl', 'arm_joint_l_1', 'arm_joint_l', 'shoulderl']);
  const leftForeArm = findBoneByHints(instance, ['leftforearm', 'l_forearm', 'leftlowerarm', 'forearml', 'elbowl', 'arm_joint_l_2', 'arm_joint_l_3']);
  const leftHand = findBoneByHints(instance, ['lefthand', 'hand.l', 'l_hand', 'handjointl', 'hand_joint_l']);
  const rightIndexFinger = findBoneByHints(instance, ['rightindex', 'index.r', 'index_01_r', 'r_index']);
  const rightThumbFinger = findBoneByHints(instance, ['rightthumb', 'thumb.r', 'thumb_01_r', 'r_thumb']);
  const rightMiddleFinger = findBoneByHints(instance, ['rightmiddle', 'middle.r', 'middle_01_r', 'r_middle']);
  const leftThigh = findBoneByHints(instance, ['leftupleg', 'leftthigh', 'l_thigh', 'legjointl1', 'leg_joint_l_1', 'leg_joint_l']);
  const leftCalf = findBoneByHints(instance, ['leftleg', 'leftcalf', 'l_calf', 'legjointl2', 'leg_joint_l_2', 'leg_joint_l_3']);
  const rightThigh = findBoneByHints(instance, ['rightupleg', 'rightthigh', 'r_thigh', 'legjointr1', 'leg_joint_r_1', 'leg_joint_r']);
  const rightCalf = findBoneByHints(instance, ['rightleg', 'rightcalf', 'r_calf', 'legjointr2', 'leg_joint_r_2', 'leg_joint_r_3']);

  let heldCards = null;
  let heldCardsPose = null;
  if (SHOW_CHARACTER_HELD_CARD_HELPERS) {
    heldCards = createCharacterCards({
      handLift: characterTheme.handLift ?? 0.94,
      handCardsInput: player?.hand ?? [],
      cardTheme,
      playerColor: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] ?? '#1d4ed8',
      cardTextureSize
    });

    heldCards.userData.playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] ?? '#1d4ed8';
    heldCards.userData.cardsSignature = (player?.hand ?? []).slice(0, 5).map((card) => `${card.rank || ''}${card.suit || ''}`).join('-');

    instance.add(heldCards);
    const resolvedSeatIndex = seatConfig?.seatIndex ?? playerIndex;
    heldCardsPose = computeHeldCardsPose({ player, resolvedSeatIndex });
    heldCards.position.set(heldCardsPose.x, heldCardsPose.y, heldCardsPose.z);
    heldCards.rotation.set(THREE.MathUtils.degToRad(-18), THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(0));
    heldCards.scale.setScalar(1.2);
  }

  if (!leftThigh || !rightThigh) {
    instance.position.y -= 0.02 * MODEL_SCALE;
    instance.position.z -= 0.02 * MODEL_SCALE;
    instance.rotation.x = 0;
  }

  const rig = {
    seatIndex: seatConfig?.seatIndex ?? playerIndex,
    seatRoot,
    instance,
    seatConfig,
    bones: {
      hips,
      spine,
      head,
      rightUpperArm,
      rightForeArm,
      rightHand,
      rightIndexFinger,
      rightThumbFinger,
      rightMiddleFinger,
      leftUpperArm,
      leftForeArm,
      leftHand,
      leftThigh,
      leftCalf,
      rightThigh,
      rightCalf
    },
    defaults: {
      hips: captureBoneRotation(hips),
      spine: captureBoneRotation(spine),
      head: captureBoneRotation(head),
      rightUpperArm: captureBoneRotation(rightUpperArm),
      rightForeArm: captureBoneRotation(rightForeArm),
      rightHand: captureBoneRotation(rightHand),
      rightIndexFinger: captureBoneRotation(rightIndexFinger),
      rightThumbFinger: captureBoneRotation(rightThumbFinger),
      rightMiddleFinger: captureBoneRotation(rightMiddleFinger),
      leftUpperArm: captureBoneRotation(leftUpperArm),
      leftForeArm: captureBoneRotation(leftForeArm),
      leftHand: captureBoneRotation(leftHand),
      leftThigh: captureBoneRotation(leftThigh),
      leftCalf: captureBoneRotation(leftCalf),
      rightThigh: captureBoneRotation(rightThigh),
      rightCalf: captureBoneRotation(rightCalf)
    },
    heldCards,
    heldCardsPose,
    isBottomHumanSeat: Boolean(player?.isHuman),
    currentActionId: 0
  };

  // Match Ludo Battle Royal seated framing: keep characters visually lower on portrait screens.
  instance.position.y -= 0.09 * MODEL_SCALE;

  // Professional seated base pose aligned with Ludo human-leg orientation.
  applyRotationOffset(hips, THREE.MathUtils.degToRad(-9), 0, 0);
  applyRotationOffset(spine, THREE.MathUtils.degToRad(-3), 0, 0);
  applyRotationOffset(head, THREE.MathUtils.degToRad(2), 0, 0);
  applyRotationOffset(leftUpperArm, THREE.MathUtils.degToRad(-44), THREE.MathUtils.degToRad(-11), THREE.MathUtils.degToRad(-8));
  applyRotationOffset(leftForeArm, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(-7), THREE.MathUtils.degToRad(-7));
  applyRotationOffset(leftHand, THREE.MathUtils.degToRad(22), THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(-9));
  applyRotationOffset(rightUpperArm, THREE.MathUtils.degToRad(-46), THREE.MathUtils.degToRad(11), THREE.MathUtils.degToRad(8));
  applyRotationOffset(rightForeArm, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(7), THREE.MathUtils.degToRad(7));
  applyRotationOffset(rightHand, THREE.MathUtils.degToRad(24), THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(9));
  applyRotationOffset(rightIndexFinger, THREE.MathUtils.degToRad(18), THREE.MathUtils.degToRad(-3), THREE.MathUtils.degToRad(-2));
  applyRotationOffset(rightThumbFinger, THREE.MathUtils.degToRad(-12), THREE.MathUtils.degToRad(4), THREE.MathUtils.degToRad(9));
  applyRotationOffset(rightMiddleFinger, THREE.MathUtils.degToRad(16), THREE.MathUtils.degToRad(-2), THREE.MathUtils.degToRad(-1));

  if (player?.isHuman) {
    // Bottom player: reach farther toward the enlarged fan and soften the elbow
    // bend so the forearms look straighter and closer to the card bottoms.
    applyRotationOffset(leftUpperArm, THREE.MathUtils.degToRad(-8), THREE.MathUtils.degToRad(-2), THREE.MathUtils.degToRad(2));
    applyRotationOffset(leftForeArm, THREE.MathUtils.degToRad(-14), THREE.MathUtils.degToRad(2), THREE.MathUtils.degToRad(2));
    applyRotationOffset(leftHand, THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(2), THREE.MathUtils.degToRad(2));
    applyRotationOffset(rightUpperArm, THREE.MathUtils.degToRad(-8), THREE.MathUtils.degToRad(2), THREE.MathUtils.degToRad(-2));
    applyRotationOffset(rightForeArm, THREE.MathUtils.degToRad(-14), THREE.MathUtils.degToRad(-2), THREE.MathUtils.degToRad(-2));
    applyRotationOffset(rightHand, THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(-2), THREE.MathUtils.degToRad(-2));
  }
  // Legs rotated opposite/downward (not upward) to mirror Ludo Battle Royal seated humans.
  applyRotationOffset(leftThigh, THREE.MathUtils.degToRad(-90.5), THREE.MathUtils.degToRad(9.2), THREE.MathUtils.degToRad(2.9));
  applyRotationOffset(rightThigh, THREE.MathUtils.degToRad(-90.5), THREE.MathUtils.degToRad(1.7), THREE.MathUtils.degToRad(-1.1));
  applyRotationOffset(leftCalf, THREE.MathUtils.degToRad(-95.1), THREE.MathUtils.degToRad(1.1), THREE.MathUtils.degToRad(0.6));
  applyRotationOffset(rightCalf, THREE.MathUtils.degToRad(-95.1), THREE.MathUtils.degToRad(-1.1), THREE.MathUtils.degToRad(-0.6));

  rig.seatedPose = {
    hips: captureBoneRotation(hips),
    spine: captureBoneRotation(spine),
    head: captureBoneRotation(head),
    rightUpperArm: captureBoneRotation(rightUpperArm),
    rightForeArm: captureBoneRotation(rightForeArm),
    rightHand: captureBoneRotation(rightHand),
    rightIndexFinger: captureBoneRotation(rightIndexFinger),
    rightThumbFinger: captureBoneRotation(rightThumbFinger),
    rightMiddleFinger: captureBoneRotation(rightMiddleFinger),
    leftUpperArm: captureBoneRotation(leftUpperArm),
    leftForeArm: captureBoneRotation(leftForeArm),
    leftHand: captureBoneRotation(leftHand),
    leftThigh: captureBoneRotation(leftThigh),
    leftCalf: captureBoneRotation(leftCalf),
    rightThigh: captureBoneRotation(rightThigh),
    rightCalf: captureBoneRotation(rightCalf)
  };

  if (HUMAN_CARD_HAND_DEBUG_HELPERS) {
    const handHelper = new THREE.Mesh(
      new THREE.SphereGeometry(0.018 * MODEL_SCALE, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    const fingerHelper = new THREE.Mesh(
      new THREE.SphereGeometry(0.014 * MODEL_SCALE, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    const cardHelper = new THREE.Mesh(
      new THREE.SphereGeometry(0.016 * MODEL_SCALE, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x84cc16 })
    );
    seatRoot.add(handHelper, fingerHelper, cardHelper);
    rig.debugHelpers = { handHelper, fingerHelper, cardHelper };
  }

  return rig;
}

function refreshRigHeldCards(rig, handCardsInput, playerColor, cardTheme, cardTextureSize = null) {
  if (!rig || !SHOW_CHARACTER_HELD_CARD_HELPERS) return;
  const safeCards = Array.isArray(handCardsInput) && handCardsInput.length ? handCardsInput.slice(0, 5) : [];
  const currentCount = rig.heldCards?.children?.length ?? 0;
  const colorChanged = rig.heldCards?.userData?.playerColor !== playerColor;
  const cardsSignature = safeCards.map((card) => `${card.rank || ''}${card.suit || ''}`).join('-');
  const cardsChanged = rig.heldCards?.userData?.cardsSignature !== cardsSignature;
  if (currentCount === Math.max(safeCards.length, 2) && !colorChanged && !cardsChanged) return;

  const parent = rig.heldCards?.parent || null;
  rig.heldCards?.userData?.dispose?.();
  if (parent) parent.remove(rig.heldCards);

  const nextCards = createCharacterCards({
    handLift: 0.94,
    handCardsInput: safeCards,
    cardTheme,
    playerColor,
    cardTextureSize
  });
  nextCards.userData.playerColor = playerColor;
  nextCards.userData.cardsSignature = cardsSignature;

  rig.instance.add(nextCards);
  const heldCardsPose = rig.heldCardsPose || computeHeldCardsPose({
    player: { isHuman: Boolean(rig.isBottomHumanSeat) },
    resolvedSeatIndex: rig.seatIndex ?? 0
  });
  nextCards.position.set(heldCardsPose.x, heldCardsPose.y, heldCardsPose.z);
  nextCards.rotation.set(THREE.MathUtils.degToRad(-18), THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(0));
  nextCards.scale.setScalar(1.3);

  rig.heldCards = nextCards;
}

function lerpBoneToPose(bone, from, to, t) {
  if (!bone || !from || !to) return;
  bone.rotation.x = THREE.MathUtils.lerp(from.x, to.x, t);
  bone.rotation.y = THREE.MathUtils.lerp(from.y, to.y, t);
  bone.rotation.z = THREE.MathUtils.lerp(from.z, to.z, t);
}

function applyRigPoseLerp(rig, targetPose, alpha = 1) {
  if (!rig || !targetPose) return;
  const seated = rig.seatedPose || {};
  Object.entries(rig.bones || {}).forEach(([key, bone]) => {
    if (!bone) return;
    const from = seated[key] || rig.defaults?.[key];
    const to = targetPose[key] || seated[key] || from;
    if (!from || !to) return;
    lerpBoneToPose(bone, from, to, alpha);
  });
}

function buildPoseVariant(basePose, overrides = {}) {
  const out = { ...basePose };
  Object.entries(overrides).forEach(([key, delta]) => {
    const base = basePose?.[key];
    if (!base) return;
    out[key] = new THREE.Euler(base.x + (delta.x || 0), base.y + (delta.y || 0), base.z + (delta.z || 0));
  });
  return out;
}

function createThrownCardMesh(color = '#f8fafc') {
  const geometry = new THREE.PlaneGeometry(0.2 * MODEL_SCALE, 0.3 * MODEL_SCALE);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.34,
    metalness: 0.06,
    side: THREE.DoubleSide
  });
  const card = new THREE.Mesh(geometry, material);
  card.castShadow = true;
  card.receiveShadow = true;
  card.userData.dispose = () => {
    geometry.dispose();
    material.dispose();
  };
  return card;
}

function attachSeatedCharacter({ template, seatConfig, characterTheme, store, player = null, playerIndex = 0, cardTheme, cardTextureSize = null }) {
  if (!template || !seatConfig?.chair) return;
  const instance = cloneSkeleton(template);
  instance.traverse((obj) => {
    if (!obj?.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    // Preserve original glTF UV transforms first, then apply the Domino Royal clothing/face material pass per seat.
    mats.forEach((mat) => {
      if (!mat) return;
      const colorTextures = [mat.map, mat.emissiveMap].filter(Boolean);
      colorTextures.forEach((texture) => {
        applySRGBColorSpace(texture);
        texture.matrixAutoUpdate = true;
      });
      [mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap]
        .filter(Boolean)
        .forEach((texture) => {
          texture.matrixAutoUpdate = true;
        });
      mat.needsUpdate = true;
    });
  });
  enhanceMurlanCharacterMaterials(instance, characterTheme, playerIndex, store?.renderer);
  normalizeCharacterPivot(instance);

  const seatRoot = new THREE.Group();
  const seatScale = (characterTheme.scale ?? 0.82) * CHARACTER_PROPORTION_SCALE;
  const scaleDelta = Math.max(0, CHARACTER_PROPORTION_SCALE - 1);
  seatRoot.scale.multiplyScalar(seatScale);
  const baseSeatOffsetY = (characterTheme.normalizedSeatOffsetY ?? characterTheme.seatOffsetY ?? -0.92) - 0.2;
  const baseSeatOffsetZ = characterTheme.normalizedSeatOffsetZ ?? characterTheme.seatOffsetZ ?? -0.24;
  seatRoot.position.set(
    0,
    baseSeatOffsetY - 0.22 - scaleDelta * 0.08 - HUMAN_CHARACTER_EXTRA_LOWER_OFFSET,
    baseSeatOffsetZ - 0.03 - HUMAN_CHARACTER_EXTRA_OUTWARD_OFFSET
  );
  seatRoot.rotation.set(characterTheme.seatPitch ?? 0, characterTheme.seatYaw ?? 0, 0);

  seatRoot.add(instance);
  seatRoot.userData.dispose = () => {
    const rig = seatConfig?.characterRig;
    rig?.heldCards?.userData?.dispose?.();
  };

  const rig = createCharacterRig(instance, seatRoot, seatConfig, characterTheme, player, playerIndex, cardTheme, cardTextureSize);
  if (rig?.heldCards?.parent) {
    rig.heldCards.parent.remove(rig.heldCards);
  }
  seatConfig.characterRig = rig;
  seatConfig.characterRoot = seatRoot;
  if (!store.characterRigs) store.characterRigs = new Map();
  store.characterRigs.set(seatConfig.seatIndex ?? playerIndex, rig);

  seatConfig.chair.add(seatRoot);
  store.characterInstances.push(seatRoot);
}



function resolveCharacterActionAnimationProfile(styleId) {
  switch (styleId) {
    case 'lowArcDeal':
      return { reach: 0.9, pinch: 0.88, hold: 0.7, carry: 0.92, hover: 0.86, contact: 0.82, release: 0.76, recover: 0.86, pickupLift: 0.042, carryLift: 0.086, tableHover: 0.064, carryBlend: 0.54, wristFlip: 0.1, spring: 0 };
    case 'straightSlide':
      return { reach: 0.82, pinch: 0.78, hold: 0.52, carry: 0.78, hover: 0.68, contact: 0.74, release: 0.66, recover: 0.78, pickupLift: 0.024, carryLift: 0.034, tableHover: 0.036, carryBlend: 0.5, wristFlip: 0.035, spring: 0 };
    case 'flipSettle':
      return { reach: 1.06, pinch: 0.98, hold: 0.62, carry: 0.98, hover: 0.96, contact: 0.92, release: 0.84, recover: 0.92, pickupLift: 0.06, carryLift: 0.15, tableHover: 0.09, carryBlend: 0.45, wristFlip: 0.34, spring: 0 };
    case 'springSnap':
      return { reach: 0.78, pinch: 0.68, hold: 0.42, carry: 0.66, hover: 0.56, contact: 0.58, release: 0.58, recover: 0.72, pickupLift: 0.048, carryLift: 0.11, tableHover: 0.074, carryBlend: 0.5, wristFlip: 0.16, spring: 0.048 };
    case 'precisionLift':
    default:
      return { reach: 1.12, pinch: 1.08, hold: 0.78, carry: 1.14, hover: 1.02, contact: 0.96, release: 0.9, recover: 1.02, pickupLift: 0.064, carryLift: 0.135, tableHover: 0.09, carryBlend: 0.5, wristFlip: 0.18, spring: 0 };
  }
}

function orientThrownActionCard(card, styleId, progress = 0, finalYaw = 0) {
  if (!card) return;
  const profile = resolveCharacterActionAnimationProfile(styleId);
  const flip = Math.sin(THREE.MathUtils.clamp(progress, 0, 1) * Math.PI) * profile.wristFlip;
  card.rotation.set(-Math.PI / 2 + COMMUNITY_CARD_TOP_TILT * 0.35 + flip, finalYaw, 0);
}

function runCharacterAction(store, rig, action) {
  if (!store || !rig || !action) return;
  const now = performance.now();
  const list = store.characterActionAnimations || (store.characterActionAnimations = []);
  const basePose = rig.seatedPose;
  const cardsColor = PLAYER_COLORS[action.playerIndex % PLAYER_COLORS.length] ?? '#f8fafc';
  const actionAnimationStyle = store.cardActionAnimationStyle ?? DEFAULT_CARD_ACTION_ANIMATION_ID;
  const actionAnimationProfile = resolveCharacterActionAnimationProfile(actionAnimationStyle);

  if (action.type === 'PASS') {
    const relaxedOpenHand = {
      rightIndexFinger: { x: THREE.MathUtils.degToRad(-4), y: THREE.MathUtils.degToRad(2) },
      rightThumbFinger: { x: THREE.MathUtils.degToRad(7), z: THREE.MathUtils.degToRad(-5) },
      rightMiddleFinger: { x: THREE.MathUtils.degToRad(-3), y: THREE.MathUtils.degToRad(1) }
    };
    const looseKnockFist = {
      rightIndexFinger: { x: THREE.MathUtils.degToRad(44), y: THREE.MathUtils.degToRad(-5), z: THREE.MathUtils.degToRad(-2) },
      rightThumbFinger: { x: THREE.MathUtils.degToRad(-24), y: THREE.MathUtils.degToRad(6), z: THREE.MathUtils.degToRad(15) },
      rightMiddleFinger: { x: THREE.MathUtils.degToRad(40), y: THREE.MathUtils.degToRad(-3), z: THREE.MathUtils.degToRad(-1) }
    };
    const armDownDiagonal = {
      spine: { x: THREE.MathUtils.degToRad(-12), z: THREE.MathUtils.degToRad(2) },
      head: { x: THREE.MathUtils.degToRad(6), y: THREE.MathUtils.degToRad(-1) },
      leftUpperArm: { x: THREE.MathUtils.degToRad(-5), y: THREE.MathUtils.degToRad(3) },
      leftForeArm: { x: THREE.MathUtils.degToRad(8) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(-18), y: THREE.MathUtils.degToRad(-13), z: THREE.MathUtils.degToRad(-18) },
      rightForeArm: { x: THREE.MathUtils.degToRad(48), y: THREE.MathUtils.degToRad(-5), z: THREE.MathUtils.degToRad(-2) }
    };
    const reachBeforeKnock = buildPoseVariant(basePose, {
      ...armDownDiagonal,
      rightHand: { x: THREE.MathUtils.degToRad(2), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(-8) },
      ...relaxedOpenHand
    });
    const cockedKnuckles = buildPoseVariant(basePose, {
      ...armDownDiagonal,
      rightHand: { x: THREE.MathUtils.degToRad(-13), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(-8) },
      ...looseKnockFist
    });
    const tableTap = buildPoseVariant(basePose, {
      ...armDownDiagonal,
      rightHand: { x: THREE.MathUtils.degToRad(14), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(-8) },
      ...looseKnockFist
    });
    const rebound = buildPoseVariant(basePose, {
      ...armDownDiagonal,
      rightHand: { x: THREE.MathUtils.degToRad(-6), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(-8) },
      ...looseKnockFist
    });

    let cursor = now;
    [
      [reachBeforeKnock, 320],
      [cockedKnuckles, 170],
      [tableTap, 78],
      [rebound, 110],
      [tableTap, 70],
      [rebound, 125],
      [basePose, 460]
    ].forEach(([pose, duration]) => {
      list.push({
        start: cursor,
        duration,
        update: (t) => applyRigPoseLerp(rig, pose, t)
      });
      cursor += duration;
    });
    return;
  }

  if (action.type === 'PLAY') {
    const openFingers = {
      rightIndexFinger: { x: THREE.MathUtils.degToRad(-8), y: THREE.MathUtils.degToRad(2) },
      rightThumbFinger: { x: THREE.MathUtils.degToRad(10), z: THREE.MathUtils.degToRad(-8) },
      rightMiddleFinger: { x: THREE.MathUtils.degToRad(-6), y: THREE.MathUtils.degToRad(1) }
    };
    const pinchFingers = {
      rightIndexFinger: { x: THREE.MathUtils.degToRad(36), y: THREE.MathUtils.degToRad(-4), z: THREE.MathUtils.degToRad(-3) },
      rightThumbFinger: { x: THREE.MathUtils.degToRad(-28), y: THREE.MathUtils.degToRad(4), z: THREE.MathUtils.degToRad(16) },
      rightMiddleFinger: { x: THREE.MathUtils.degToRad(28), y: THREE.MathUtils.degToRad(-2), z: THREE.MathUtils.degToRad(-2) }
    };
    const releaseFingers = {
      rightIndexFinger: { x: THREE.MathUtils.degToRad(9), y: THREE.MathUtils.degToRad(2) },
      rightThumbFinger: { x: THREE.MathUtils.degToRad(5), y: THREE.MathUtils.degToRad(-2), z: THREE.MathUtils.degToRad(-6) },
      rightMiddleFinger: { x: THREE.MathUtils.degToRad(7), y: THREE.MathUtils.degToRad(1) }
    };
    const reachToCards = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(-17), z: THREE.MathUtils.degToRad(-1) },
      leftUpperArm: { x: THREE.MathUtils.degToRad(-12), y: THREE.MathUtils.degToRad(7), z: THREE.MathUtils.degToRad(3) },
      leftForeArm: { x: THREE.MathUtils.degToRad(12), y: THREE.MathUtils.degToRad(2) },
      leftHand: { x: THREE.MathUtils.degToRad(5), y: THREE.MathUtils.degToRad(3) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(-74), y: THREE.MathUtils.degToRad(-20), z: THREE.MathUtils.degToRad(-24) },
      rightForeArm: { x: THREE.MathUtils.degToRad(-28), y: THREE.MathUtils.degToRad(-4) },
      rightHand: { x: THREE.MathUtils.degToRad(-11), y: THREE.MathUtils.degToRad(-20), z: THREE.MathUtils.degToRad(-14) },
      head: { x: THREE.MathUtils.degToRad(-11), y: THREE.MathUtils.degToRad(-2) },
      ...openFingers
    });
    const pinchPickup = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(-18), z: THREE.MathUtils.degToRad(-1) },
      leftUpperArm: { x: THREE.MathUtils.degToRad(-10), y: THREE.MathUtils.degToRad(6), z: THREE.MathUtils.degToRad(2) },
      leftForeArm: { x: THREE.MathUtils.degToRad(10), y: THREE.MathUtils.degToRad(2) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(-76), y: THREE.MathUtils.degToRad(-21), z: THREE.MathUtils.degToRad(-24) },
      rightForeArm: { x: THREE.MathUtils.degToRad(-31), y: THREE.MathUtils.degToRad(-5) },
      rightHand: { x: THREE.MathUtils.degToRad(-14), y: THREE.MathUtils.degToRad(-22), z: THREE.MathUtils.degToRad(-16) },
      head: { x: THREE.MathUtils.degToRad(-12), y: THREE.MathUtils.degToRad(-2) },
      ...pinchFingers
    });
    const controlledCarry = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(-3) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(-16), y: THREE.MathUtils.degToRad(-24), z: THREE.MathUtils.degToRad(-22) },
      rightForeArm: { x: THREE.MathUtils.degToRad(22), y: THREE.MathUtils.degToRad(-2) },
      rightHand: { x: THREE.MathUtils.degToRad(7), y: THREE.MathUtils.degToRad(-15), z: THREE.MathUtils.degToRad(-9) },
      ...pinchFingers
    });
    const hoverAboveTable = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(5), z: THREE.MathUtils.degToRad(1) },
      leftUpperArm: { x: THREE.MathUtils.degToRad(-6), y: THREE.MathUtils.degToRad(5) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(20), y: THREE.MathUtils.degToRad(-25), z: THREE.MathUtils.degToRad(-22) },
      rightForeArm: { x: THREE.MathUtils.degToRad(46), y: THREE.MathUtils.degToRad(-2) },
      rightHand: { x: THREE.MathUtils.degToRad(15), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(-6) },
      ...pinchFingers
    });
    const tableContact = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(9), z: THREE.MathUtils.degToRad(1) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(34), y: THREE.MathUtils.degToRad(-22), z: THREE.MathUtils.degToRad(-19) },
      rightForeArm: { x: THREE.MathUtils.degToRad(58), y: THREE.MathUtils.degToRad(-1) },
      rightHand: { x: THREE.MathUtils.degToRad(10), y: THREE.MathUtils.degToRad(-6), z: THREE.MathUtils.degToRad(-1) },
      ...pinchFingers
    });
    const releaseOnTable = buildPoseVariant(basePose, {
      spine: { x: THREE.MathUtils.degToRad(7) },
      rightUpperArm: { x: THREE.MathUtils.degToRad(34), y: THREE.MathUtils.degToRad(-20), z: THREE.MathUtils.degToRad(-18) },
      rightForeArm: { x: THREE.MathUtils.degToRad(56) },
      rightHand: { x: THREE.MathUtils.degToRad(15), y: THREE.MathUtils.degToRad(-5) },
      ...releaseFingers
    });

    const thrown = createThrownCardMesh(cardsColor);
    store.scene?.add(thrown);

    const handPos = new THREE.Vector3();
    if (rig.bones?.rightHand) {
      rig.bones.rightHand.getWorldPosition(handPos);
    } else {
      rig.seatRoot.getWorldPosition(handPos);
      handPos.add(rig.seatConfig?.forward?.clone().multiplyScalar(0.16 * MODEL_SCALE) ?? new THREE.Vector3());
      handPos.y += 0.18 * MODEL_SCALE;
    }
    const primaryPlayedCardId = action.cardId || action.cards?.[0]?.id;
    const selectedCardMesh = primaryPlayedCardId ? store.cardMap?.get(primaryPlayedCardId)?.mesh : null;
    const pickupPos = handPos.clone();
    if (selectedCardMesh) {
      selectedCardMesh.getWorldPosition(pickupPos);
      pickupPos.y += 0.012 * MODEL_SCALE;
    }

    const target = (store.tableAnchor || new THREE.Vector3()).clone();
    target.y += 0.08 * MODEL_SCALE;
    target.add((rig.seatConfig?.right || new THREE.Vector3(1, 0, 0)).clone().multiplyScalar(0.04 * MODEL_SCALE));

    const pickupHoverPos = pickupPos.clone().add(new THREE.Vector3(0, actionAnimationProfile.pickupLift * MODEL_SCALE, 0));
    const carryPos = pickupHoverPos.clone().lerp(target, actionAnimationProfile.carryBlend);
    carryPos.y += actionAnimationProfile.carryLift * MODEL_SCALE;
    const tableHoverPos = target.clone().add(new THREE.Vector3(0, actionAnimationProfile.tableHover * MODEL_SCALE, 0));
    const tableContactPos = target.clone().add(new THREE.Vector3(0, 0.012 * MODEL_SCALE, 0));
    thrown.position.copy(pickupPos);
    const finalCardYaw = Math.atan2(rig.seatConfig?.forward?.x ?? 0, rig.seatConfig?.forward?.z ?? 1);
    orientThrownActionCard(thrown, actionAnimationStyle, 0, finalCardYaw);

    const dReach = Math.round(320 * actionAnimationProfile.reach);
    const dPinch = Math.round(360 * actionAnimationProfile.pinch);
    const dHold = Math.round(180 * actionAnimationProfile.hold);
    const dCarry = Math.round(520 * actionAnimationProfile.carry);
    const dHover = Math.round(360 * actionAnimationProfile.hover);
    const dContact = Math.round(420 * actionAnimationProfile.contact);
    const dRelease = Math.round(280 * actionAnimationProfile.release);
    const dRecover = Math.round(560 * actionAnimationProfile.recover);
    let cursor = now;

    list.push({
      start: cursor,
      duration: dReach,
      update: (t) => {
        applyRigPoseLerp(rig, reachToCards, t);
        thrown.position.copy(pickupPos);
        orientThrownActionCard(thrown, actionAnimationStyle, 0, finalCardYaw);
      }
    });
    cursor += dReach;
    list.push({
      start: cursor,
      duration: dPinch,
      update: (t) => {
        applyRigPoseLerp(rig, pinchPickup, t);
        const eased = easeInOutCubic(t);
        thrown.position.lerpVectors(pickupPos, pickupHoverPos, eased);
        orientThrownActionCard(thrown, actionAnimationStyle, eased * 0.18, finalCardYaw);
      }
    });
    cursor += dPinch;
    list.push({
      start: cursor,
      duration: dHold,
      update: (t) => {
        applyRigPoseLerp(rig, pinchPickup, t);
        thrown.position.copy(pickupHoverPos);
        orientThrownActionCard(thrown, actionAnimationStyle, 0.18, finalCardYaw);
      }
    });
    cursor += dHold;
    list.push({
      start: cursor,
      duration: dCarry,
      update: (t) => {
        applyRigPoseLerp(rig, controlledCarry, t);
        const eased = easeInOutCubic(t);
        thrown.position.lerpVectors(pickupHoverPos, carryPos, eased);
        if (actionAnimationProfile.spring > 0) {
          thrown.position.addScaledVector(rig.seatConfig?.forward ?? new THREE.Vector3(), Math.sin(eased * Math.PI) * actionAnimationProfile.spring * MODEL_SCALE);
        }
        orientThrownActionCard(thrown, actionAnimationStyle, 0.18 + eased * 0.36, finalCardYaw);
      }
    });
    cursor += dCarry;
    list.push({
      start: cursor,
      duration: dHover,
      update: (t) => {
        applyRigPoseLerp(rig, hoverAboveTable, t);
        const eased = easeInOutCubic(t);
        thrown.position.lerpVectors(carryPos, tableHoverPos, eased);
        orientThrownActionCard(thrown, actionAnimationStyle, 0.54 + eased * 0.22, finalCardYaw);
      }
    });
    cursor += dHover;
    list.push({
      start: cursor,
      duration: dContact,
      update: (t) => {
        applyRigPoseLerp(rig, tableContact, t);
        const eased = easeInOutCubic(t);
        thrown.position.lerpVectors(tableHoverPos, tableContactPos, eased);
        orientThrownActionCard(thrown, actionAnimationStyle, 0.76 + eased * 0.2, finalCardYaw);
      }
    });
    cursor += dContact;
    list.push({
      start: cursor,
      duration: dRelease,
      update: (t) => {
        applyRigPoseLerp(rig, releaseOnTable, t);
        thrown.position.copy(tableContactPos);
        orientThrownActionCard(thrown, actionAnimationStyle, 1, finalCardYaw);
      },
      complete: () => {
        thrown.userData?.dispose?.();
        store.scene?.remove(thrown);
      }
    });
    cursor += dRelease;
    list.push({
      start: cursor,
      duration: dRecover,
      update: (t) => applyRigPoseLerp(rig, basePose, t)
    });
  }
}

function stepCharacterActions(store, time) {
  const list = store.characterActionAnimations;
  if (!list?.length) return;
  store.characterActionAnimations = list.filter((anim) => {
    const elapsed = time - anim.start;
    if (elapsed < 0) return true;
    const progress = Math.min(1, elapsed / Math.max(anim.duration || 1, 1));
    const eased = easeInOutCubic(progress);
    try {
      anim.update?.(eased);
    } catch (error) {
      console.warn('Character action animation failed', error);
      return false;
    }
    if (progress >= 1) {
      anim.complete?.();
      return false;
    }
    return true;
  });
}

function updateRigContactHelpers(store) {
  if (!store?.characterRigs) return;
  const tmpHand = new THREE.Vector3();
  const tmpFinger = new THREE.Vector3();
  const tmpCard = new THREE.Vector3();
  store.characterRigs.forEach((rig) => {
    const helpers = rig?.debugHelpers;
    if (!helpers) return;
    rig.bones?.rightHand?.getWorldPosition(tmpHand);
    if (rig.bones?.rightIndexFinger) rig.bones.rightIndexFinger.getWorldPosition(tmpFinger);
    else tmpFinger.copy(tmpHand);
    const firstCard = rig.heldCards?.children?.[0];
    if (firstCard) firstCard.getWorldPosition(tmpCard);
    else tmpCard.copy(tmpHand);
    rig.seatRoot.worldToLocal(tmpHand);
    rig.seatRoot.worldToLocal(tmpFinger);
    rig.seatRoot.worldToLocal(tmpCard);
    helpers.handHelper.position.copy(tmpHand);
    helpers.fingerHelper.position.copy(tmpFinger);
    helpers.cardHelper.position.copy(tmpCard);
  });
}


async function loadPolyhavenModel(assetId, renderer = null) {
  if (!assetId) throw new Error('Missing Poly Haven asset id');
  const normalizedId = assetId.toLowerCase();
  const cacheKey = normalizedId;
  if (POLYHAVEN_MODEL_CACHE.has(cacheKey)) {
    return POLYHAVEN_MODEL_CACHE.get(cacheKey);
  }

  const promise = (async () => {
    const modelCandidates = [];
    const assetCandidates = Array.from(new Set([assetId, normalizedId]));
    const seenUrls = new Set();

    for (const candidateId of assetCandidates) {
      try {
        const filesJson = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(candidateId)}`).then((r) => r.json());
        const manifestCandidates = buildPolyhavenManifestCandidates(filesJson);
        manifestCandidates.forEach((candidate) => {
          if (!candidate?.url || seenUrls.has(candidate.url)) return;
          seenUrls.add(candidate.url);
          modelCandidates.push(candidate);
        });
        const allUrls = extractAllHttpUrls(filesJson);
        const apiModelUrl = pickBestModelUrl(allUrls);
        if (apiModelUrl && !seenUrls.has(apiModelUrl)) {
          seenUrls.add(apiModelUrl);
          modelCandidates.push({ url: apiModelUrl, includeUrlMap: null, resolution: null });
        }
      } catch (error) {
        console.warn('Poly Haven file lookup failed, falling back to direct URLs', error);
      }

      buildPolyhavenModelUrls(candidateId).forEach((u) => {
        if (seenUrls.has(u)) return;
        seenUrls.add(u);
        modelCandidates.push({ url: u, includeUrlMap: null, resolution: null });
      });
    }

    if (!modelCandidates.length) {
      throw new Error(`No model URL found for ${assetId}`);
    }

    let gltf = null;
    let lastError = null;
    for (const candidate of modelCandidates) {
      try {
        const includeUrlMap = candidate?.includeUrlMap;
        const modelUrl = candidate?.url;
        if (!modelUrl) continue;
        const loader = createPolyhavenGltfLoader(renderer, includeUrlMap);
        const resolvedUrl = new URL(modelUrl, typeof window !== 'undefined' ? window.location?.href : modelUrl).href;
        const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
        loader.setResourcePath?.(resourcePath);
        loader.setPath?.('');
        gltf = await loader.loadAsync(resolvedUrl);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!gltf) {
      throw lastError || new Error(`Failed to load chair model for ${assetId}`);
    }

    const root = gltf.scene || gltf.scenes?.[0] || gltf;
    if (!root) {
      throw new Error(`Missing scene for ${assetId}`);
    }
    prepareLoadedModel(root, { preserveGltfTextureMapping: true, maxAnisotropy: 8 }); // keep original glTF UV/texture mapping intact
    return root;
  })();

  POLYHAVEN_MODEL_CACHE.set(cacheKey, promise);
  promise.catch(() => POLYHAVEN_MODEL_CACHE.delete(cacheKey));
  const baseModel = await promise;
  return cloneModelWithLocalMaterials(baseModel);
}

function createProceduralChair(theme) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.seatColor || '#7c3aed'),
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.legColor || '#111827'),
    roughness: 0.55,
    metalness: 0.38
  });

  const chair = new THREE.Group();

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), seatMaterial);
  seatMesh.position.y = SEAT_THICKNESS / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chair.add(seatMesh);

  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  chair.add(backMesh);

  const armGeometry = new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH);
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  chair.add(leftArm);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  chair.add(rightArm);

  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 18),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  chair.add(legMesh);

  return {
    chairTemplate: chair,
    materials: {
      seat: seatMaterial,
      leg: legMaterial,
      upholstery: [seatMaterial],
      metal: [legMaterial]
    },
    preserveOriginal: false
  };
}

async function buildChairTemplate(theme, renderer = null, textureOptions = {}) {
  const rotationY = theme?.modelRotation || 0;
  const preserveMaterials = shouldPreserveChairMaterials(theme);
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null,
    preferredTextureSizes = PREFERRED_TEXTURE_SIZES
  } = textureOptions || {};
  try {
    if (theme?.source === 'polyhaven' && theme?.assetId) {
      const polyhavenRoot = await loadPolyhavenModel(theme.assetId, renderer);
      const model = polyhavenRoot.clone(true);
      prepareLoadedModel(model, { preserveGltfTextureMapping: preserveMaterials, maxAnisotropy });
      if (textureLoader && !preserveMaterials) {
        try {
          const textures = await loadPolyhavenTextureSet(
            theme.assetId,
            textureLoader,
            maxAnisotropy,
            textureCache,
            preferredTextureSizes
          );
          if (textures || fallbackTexture) {
            applyTextureSetToModel(model, textures, fallbackTexture, maxAnisotropy);
          }
        } catch (error) {
          if (fallbackTexture) {
            applyTextureSetToModel(model, null, fallbackTexture, maxAnisotropy);
          }
        }
      }
      fitChairModelToFootprint(model);
      if (rotationY) model.rotation.y += rotationY;
      const materials = extractChairMaterials(model);
      if (!preserveMaterials) {
        applyChairThemeMaterials({ chairMaterials: materials }, theme);
      }
      return { chairTemplate: model, materials, preserveOriginal: preserveMaterials };
    }
    if (theme?.source === 'gltf' && Array.isArray(theme.urls) && theme.urls.length) {
      const gltfChair = await loadGltfChair(theme.urls, rotationY, renderer);
      prepareLoadedModel(gltfChair.chairTemplate, { preserveGltfTextureMapping: preserveMaterials, maxAnisotropy });
      if (!preserveMaterials) {
        applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
      }
      return { ...gltfChair, preserveOriginal: preserveMaterials };
    }
    const gltfChair = await loadGltfChair(CHAIR_MODEL_URLS, rotationY, renderer);
    prepareLoadedModel(gltfChair.chairTemplate, { preserveGltfTextureMapping: preserveMaterials, maxAnisotropy });
    if (!preserveMaterials) {
      applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    }
    return { ...gltfChair, preserveOriginal: preserveMaterials };
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  return createProceduralChair(theme);
}

const STOOL_SCALE = 1.5 * 1.3 * 1.3 * CHAIR_SIZE_SCALE;
const CARD_SCALE = 1.08 * CARD_VISUAL_TRIM;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const CARD_H = 0.56 * MODEL_SCALE * CARD_SCALE;
const CARD_D = 0.01 * MODEL_SCALE * CARD_SCALE; // Extra-trimmed thickness to avoid dark edge wedges.
const CARD_SURFACE_OFFSET = CARD_D * 3;
const DISCARD_PILE_OFFSET = Object.freeze({
  x: 0,
  y: CARD_H * 1.14,
  z: -TABLE_RADIUS * 0.18
});
const DISCARD_PILE_FORWARD_SHIFT = -CARD_H * 0.14;
const DISCARD_PILE_RIGHT_SHIFT = 0;
const SEAT_WIDTH = 0.86 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.74 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.11 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.56 * MODEL_SCALE * STOOL_SCALE;
const BASE_TABLE_HEIGHT = 0.94 * MODEL_SCALE;
const CHAIR_GAP = 0.19 * MODEL_SCALE; // push chairs slightly farther from the table ring.
const CHAIR_RADIUS = TABLE_RADIUS + SEAT_DEPTH * 0.5 + CHAIR_GAP;
const AI_CHAIR_GAP = CHAIR_GAP;
const AI_CHAIR_RADIUS = CHAIR_RADIUS;
const CHAIR_SEAT_INWARD_FACTOR = 1;
const CHAIR_VISUAL_SCALE = 1.36;
const CAMERA_SEATED_LATERAL_OFFSETS = Object.freeze({ portrait: 0, landscape: 0 });
const CAMERA_SEATED_RETREAT_OFFSETS = Object.freeze({
  portrait: 0.82,
  landscape: 0.62
});
const CAMERA_SEATED_ELEVATION_OFFSETS = Object.freeze({
  portrait: 2.22,
  landscape: 0.96
});
const CAMERA_LOOK_VERTICAL_ALLOWANCE = Object.freeze({
  portrait: { up: THREE.MathUtils.degToRad(8.5), down: THREE.MathUtils.degToRad(4.5) },
  landscape: { up: THREE.MathUtils.degToRad(7), down: THREE.MathUtils.degToRad(4) }
});
const CAMERA_TARGET_LIFT = 0.08 * MODEL_SCALE;
const CAMERA_FOCUS_CENTER_LIFT = 0.1 * MODEL_SCALE;
const CAMERA_TARGET_TOP_PLAYER_BIAS = 0.36 * MODEL_SCALE;
const CAMERA_SCREEN_DOWN_SHIFT = Object.freeze({
  portrait: 0.19 * MODEL_SCALE,
  landscape: 0.05 * MODEL_SCALE
});
const HUMAN_HAND_CARD_SCALE = 1.12;
// Keep the bottom edges tucked together like a real thumb-held fan while the
// stronger yaw below preserves the open top spread shown in the reference photos.
const HUMAN_HAND_CARD_SPACING = CARD_W * HUMAN_HAND_CARD_SCALE * 0.16;
const HUMAN_HAND_CARD_MAX_SPREAD = HUMAN_HAND_CARD_SPACING * 10;
const HUMAN_HAND_EXTRA_LIFT = 0.068 * MODEL_SCALE;
const HUMAN_HAND_FAN_MAX_YAW = THREE.MathUtils.degToRad(29);
const HUMAN_HAND_FAN_ARC_LIFT = 0.036 * MODEL_SCALE;
const HUMAN_HAND_FAN_DIRECTION = 1;
const HUMAN_HAND_UNIFORM_YAW_FROM_LEFT = false;
const HUMAN_HAND_CLOSER_OFFSET = 0.042 * MODEL_SCALE;
const HUMAN_HAND_BOTTOM_SHIFT_Y = 0;
const AI_HAND_CLOSER_OFFSET = 0.02 * MODEL_SCALE;
const HUMAN_HAND_LEFT_SHIFT = 0;
const AI_HAND_LEFT_SHIFT = 0;
const HUMAN_HAND_UP_SHIFT_Y = 0.168 * MODEL_SCALE;
const HUMAN_HAND_DIRECTIONAL_LIFT = 0;
const HUMAN_HAND_BOTTOM_INWARD_TILT_X = THREE.MathUtils.degToRad(4);
const AI_HAND_CARD_SPACING = HUMAN_HAND_CARD_SPACING;
const AI_HAND_CARD_MAX_SPREAD = HUMAN_HAND_CARD_MAX_SPREAD;
const TOP_AI_HAND_CARD_SPACING_MULTIPLIER = 1.1;
const TOP_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER = 1.08;
const SIDE_AI_HAND_CARD_SPACING_MULTIPLIER = 0.92;
const SIDE_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER = 0.88;
const AI_HAND_FAN_MAX_YAW = HUMAN_HAND_FAN_MAX_YAW;
const AI_TOP_HAND_FAN_MAX_YAW = THREE.MathUtils.degToRad(22);
const AI_SIDE_HAND_FAN_MAX_YAW = THREE.MathUtils.degToRad(19);
const AI_HAND_FAN_ARC_LIFT = 0.052 * MODEL_SCALE;
const AI_HAND_CARD_SCALE = 0.84;
const AI_SIDE_HAND_EXTRA_INWARD_PULL = 0.035 * MODEL_SCALE;
const AI_TOP_HAND_EXTRA_INWARD_PULL = 0.07 * MODEL_SCALE;
const AI_SIDE_HAND_EXTRA_OUTWARD_PUSH = 1.72 * MODEL_SCALE;
const AI_TOP_HAND_EXTRA_OUTWARD_PUSH = 2.34 * MODEL_SCALE;
const AI_SIDE_HAND_UP_SHIFT_Y = -0.42 * MODEL_SCALE;
const AI_TOP_HAND_UP_SHIFT_Y = -0.18 * MODEL_SCALE;
const AI_SIDE_HAND_LATERAL_PALM_SHIFT = 0.12 * MODEL_SCALE;
const AI_SIDE_HAND_TOPWARD_SHIFT = 1.96 * MODEL_SCALE;
const AI_TOP_HAND_LATERAL_PALM_SHIFT = 0;
const AI_SIDE_HAND_GRIP_PITCH_X = THREE.MathUtils.degToRad(-6);
const AI_TOP_HAND_GRIP_PITCH_X = THREE.MathUtils.degToRad(-3);
const AI_SIDE_HAND_GRIP_ROLL_Z = THREE.MathUtils.degToRad(4);
const HUMAN_HAND_TABLE_EDGE_MARGIN = CARD_H * 0.04;
const HUMAN_HAND_EXTRA_INWARD_PULL = 0.2 * MODEL_SCALE;
const AI_HAND_TABLE_EDGE_MARGIN = CARD_H * 0.2;
const HAND_CARDS_INWARD_BIAS = 0.18 * MODEL_SCALE;
const COMMUNITY_CARD_TOP_TILT = THREE.MathUtils.degToRad(12);
const COMMUNITY_CARD_SCALE = 1.14;
const COMMUNITY_CARD_SPACING = HUMAN_HAND_CARD_SPACING * 0.2;
const COMMUNITY_CARD_MAX_SPREAD = COMMUNITY_CARD_SPACING * 12;
const COMMUNITY_CARD_BOTTOM_LOCK_Y_OFFSET = Math.sin(COMMUNITY_CARD_TOP_TILT) * CARD_H * 0.5;
const COMMUNITY_CARD_FAN_ARC_LIFT = 0;
const COMMUNITY_CARD_CLOSER_TO_HUMAN = -0.08 * MODEL_SCALE;
const COMMUNITY_CARD_BOTTOM_SHIFT_Y = -0.028 * MODEL_SCALE;
const COMMUNITY_CARD_LEFT_SHIFT = 0;
const COMMUNITY_CARD_DIRECTIONAL_LIFT = 0;
const COMMUNITY_CARD_SIDE_ORIENTATION_YAW = 0;
const COMMUNITY_CARD_STRAIGHT_FLUSH_RIGHT_DROP = 0.048 * MODEL_SCALE;
const TABLE_PLAY_LIFT_ARC = 0.058 * MODEL_SCALE;
const PRECISE_CARD_PLACE_DURATION_MS = 1680;
const PRECISE_CARD_PICKUP_LIFT = 0.072 * MODEL_SCALE;
const PRECISE_CARD_PICKUP_PORTION = 0.34;
const PRECISE_CARD_SETTLE_SLIDE = 0.045 * MODEL_SCALE;
const PRECISE_CARD_SETTLE_PORTION = 0.18;
const TABLE_CARD_AREA_FORWARD_SHIFT = 0.72 * MODEL_SCALE;
const DEAL_CARD_STEP_DELAY_MS = 60;
const DEAL_SHUFFLE_LEAD_IN_MS = 220;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 1.1;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const CHAIR_GROUND_DROP = 0;
const CHAIR_SCREEN_LOWER_OFFSET = 0.14 * MODEL_SCALE;
const HUMAN_CHAIR_EXTRA_OUTWARD_OFFSET = 0.52 * MODEL_SCALE; // pull the human seat a bit closer to the table on portrait framing.
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const TABLE_SIDE_TRIM_SCALE = 1;
const TABLE_MODEL_TARGET_DIAMETER = TABLE_RADIUS * 2.04;
const TABLE_MODEL_TARGET_HEIGHT = TABLE_HEIGHT;
const TABLE_HEIGHT_RAISE = TABLE_HEIGHT - BASE_TABLE_HEIGHT;
const HUMAN_SELECTION_OFFSET = 0.14 * MODEL_SCALE;
const AI_CARD_LIFT = 0.076 * MODEL_SCALE;
const PLAYER_HAND_TABLE_OUTWARD_PUSH = 0.4 * MODEL_SCALE;
const PLAYER_HAND_OUTWARD_PUSH_ONE_CARD = CARD_H;
const PLAYER_HAND_UP_LIFT_ONE_CARD = CARD_H;

function resolveSeatHandRadius(tableRadius, isHumanSeat) {
  const safeTableRadius = Number.isFinite(tableRadius) ? tableRadius : TABLE_RADIUS;
  if (isHumanSeat) {
    return (
      safeTableRadius +
      HUMAN_HAND_TABLE_EDGE_MARGIN +
      PLAYER_HAND_TABLE_OUTWARD_PUSH -
      HUMAN_HAND_CLOSER_OFFSET -
      HAND_CARDS_INWARD_BIAS
    );
  }
  return (
    safeTableRadius +
    AI_HAND_TABLE_EDGE_MARGIN +
    PLAYER_HAND_TABLE_OUTWARD_PUSH -
    AI_HAND_CLOSER_OFFSET -
    HAND_CARDS_INWARD_BIAS
  );
}

function calcFanCardPose(cardCount, cardIdx) {
  if (cardCount <= 1) {
    return {
      centeredOffset: 0,
      normalizedOffset: 0,
      centerWeight: 1,
      leftWeight: 0.5
    };
  }
  const centeredOffset = cardIdx - (cardCount - 1) / 2;
  const normalizedOffset = centeredOffset / ((cardCount - 1) / 2);
  return {
    centeredOffset,
    normalizedOffset,
    centerWeight: 1 - Math.abs(normalizedOffset),
    leftWeight: (1 + normalizedOffset) * 0.5
  };
}

function cardIdNoise(cardId, seed = 0) {
  const text = String(cardId ?? '');
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 999;
}

const CARD_ANIMATION_DURATION = 420;
const FRAME_TIME_CATCH_UP_MULTIPLIER = 3;
const AI_TURN_DELAY = 2600;
const CAMERA_PLAYER_SWITCH_HOLD_MS = 1500;
const CAMERA_TURN_DURATION_MS = 360;
const CAMERA_PLAY_FOLLOW_HOLD_MS = 420;
const CAMERA_PLAY_NEXT_TURN_DELAY_MS = 520;
const CAMERA_PLAY_TURN_DURATION_MS = 300;
const CAMERA_PLAY_CARD_FOCUS_DELAY_MS = 170;
const CAMERA_TARGET_TURN_SNAP_DISTANCE = 0.018 * MODEL_SCALE;
const CAMERA_PLAYER_TARGET_WEIGHT = 0.6;
const HDRI_GROUND_FLOOR_Y = 0;
const ARENA_GROUND_Y = HDRI_GROUND_FLOOR_Y;
const HDRI_GROUND_FLOOR_RADIUS_MULTIPLIER = 1.76;
const HDRI_GROUND_FLOOR_OPACITY = 0.22;
const HDRI_WALL_DISTANCE_MULTIPLIER = 1.22;
const HDRI_BACKGROUND_PITCH = THREE.MathUtils.degToRad(-2.4);
const CAMERA_SIDE_LOOK_EXTRA = 0.42 * MODEL_SCALE;
const CAMERA_INWARD_RADIUS_FACTOR = 0.86;
const CAMERA_UP_TILT_FORWARD_BLEND = 0.38 * MODEL_SCALE;
const CAMERA_UP_TILT_FORWARD_LERP = 0.14;
const CAMERA_AUTO_FOCUS_ON_PLAY_ENABLED = true;
const CAMERA_AUTO_RECENTER_ON_HUMAN_TURN_ENABLED = false;
const CAMERA_HUMAN_TURN_TARGET_WEIGHT = 0.74;
const CAMERA_HUMAN_TURN_TARGET_DOWNSHIFT = 0.08 * MODEL_SCALE;
const PASS_BUBBLE_DURATION_MS = 1700;

const PLAYER_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#22c55e'];
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '78%' },
  { left: '80%', top: '50%' },
  { left: '20%', top: '50%' },
  { left: '50%', top: '22%' }
];

const AI_NAME_TRANSLATIONS = Object.freeze({
  zh: {
    Aria: '艾莉娅',
    Milo: '米洛',
    Sora: '索拉'
  },
  hi: {
    Aria: 'आरिया',
    Milo: 'माइलो',
    Sora: 'सोरा'
  },
  ru: {
    Aria: 'Ария',
    Milo: 'Майло',
    Sora: 'Сора'
  },
  sq: {
    Aria: 'Aria',
    Milo: 'Milo',
    Sora: 'Sora'
  }
});

const COMMENTARY_FALLBACK_LABELS = Object.freeze({
  en: {
    player: 'Player',
    table: 'table',
    combo: 'a clean combo'
  },
  zh: {
    player: '玩家',
    table: '牌桌',
    combo: '一手稳健的组合'
  },
  hi: {
    player: 'खिलाड़ी',
    table: 'टेबल',
    combo: 'साफ कॉम्बो'
  },
  ru: {
    player: 'Игрок',
    table: 'стол',
    combo: 'чистая комбинация'
  },
  es: {
    player: 'Jugador',
    table: 'mesa',
    combo: 'un combo limpio'
  },
  fr: {
    player: 'Joueur',
    table: 'table',
    combo: 'un combo propre'
  },
  ar: {
    player: 'اللاعب',
    table: 'الطاولة',
    combo: 'تركيبة نظيفة'
  },
  sq: {
    player: 'Lojtari',
    table: 'tavolina',
    combo: 'një kombinim i pastër'
  }
});

const COMMENTARY_COMBO_LABELS = Object.freeze({
  en: {
    single: (card) => `a ${card}`,
    pair: (rank) => `pair ${rank}`,
    trips: (rank) => `trips ${rank}`,
    bomb: (rank) => `bomb ${rank}`,
    straight: (start, end) => `straight ${start} - ${end}`,
    flush: (count) => `flush with ${count} cards`,
    fullHouse: () => 'full house',
    straightFlush: () => 'straight flush'
  },
  zh: {
    single: (card) => `单张${card}`,
    pair: (rank) => `对子${rank}`,
    trips: (rank) => `三条${rank}`,
    bomb: (rank) => `炸弹${rank}`,
    straight: (start, end) => `顺子${start}-${end}`,
    flush: (count) => `同花${count}张`,
    fullHouse: () => '葫芦',
    straightFlush: () => '同花顺'
  },
  hi: {
    single: (card) => `एकल ${card}`,
    pair: (rank) => `जोड़ी ${rank}`,
    trips: (rank) => `ट्रिप्स ${rank}`,
    bomb: (rank) => `बॉम्ब ${rank}`,
    straight: (start, end) => `स्ट्रेट ${start}-${end}`,
    flush: (count) => `${count} पत्तों का फ्लश`,
    fullHouse: () => 'फुल हाउस',
    straightFlush: () => 'स्ट्रेट फ्लश'
  },
  ru: {
    single: (card) => `одиночная ${card}`,
    pair: (rank) => `пара ${rank}`,
    trips: (rank) => `сет ${rank}`,
    bomb: (rank) => `бомба ${rank}`,
    straight: (start, end) => `стрит ${start}-${end}`,
    flush: (count) => `флеш на ${count} карт`,
    fullHouse: () => 'фул-хаус',
    straightFlush: () => 'стрит-флеш'
  },
  es: {
    single: (card) => `una ${card}`,
    pair: (rank) => `pareja ${rank}`,
    trips: (rank) => `trío ${rank}`,
    bomb: (rank) => `bomba ${rank}`,
    straight: (start, end) => `escalera ${start}-${end}`,
    flush: (count) => `color de ${count} cartas`,
    fullHouse: () => 'full house',
    straightFlush: () => 'escalera de color'
  },
  fr: {
    single: (card) => `une ${card}`,
    pair: (rank) => `paire ${rank}`,
    trips: (rank) => `brelan ${rank}`,
    bomb: (rank) => `bombe ${rank}`,
    straight: (start, end) => `suite ${start}-${end}`,
    flush: (count) => `couleur de ${count} cartes`,
    fullHouse: () => 'full',
    straightFlush: () => 'quinte flush'
  },
  ar: {
    single: (card) => `ورقة ${card}`,
    pair: (rank) => `زوج ${rank}`,
    trips: (rank) => `ثلاثية ${rank}`,
    bomb: (rank) => `قنبلة ${rank}`,
    straight: (start, end) => `تسلسل ${start}-${end}`,
    flush: (count) => `فلش من ${count} أوراق`,
    fullHouse: () => 'فل هاوس',
    straightFlush: () => 'ستريت فلش'
  },
  sq: {
    single: (card) => `një ${card}`,
    pair: (rank) => `çift ${rank}`,
    trips: (rank) => `treshe ${rank}`,
    bomb: (rank) => `bombë ${rank}`,
    straight: (start, end) => `drejtë ${start}-${end}`,
    flush: (count) => `ngjyrë me ${count} letra`,
    fullHouse: () => 'shtëpi e plotë',
    straightFlush: () => 'drejtë e ngjyrës'
  }
});

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const FRAME_RATE_OPTIONS = Object.freeze([
  {
    id: 'fhd60',
    label: 'Performance (60 Hz)',
    fps: 60,
    renderScale: 1,
    pixelRatioCap: 1.4,
    resolution: '2K texture pack • 60 FPS',
    hdriResolution: '2k',
    preferredTextureSizes: ['2k', '1k'],
    cardTextureScale: 1,
    description: 'Balanced profile with Poly Haven 2K HDRI assets.'
  },
  {
    id: 'smooth90',
    label: 'Smooth (90 Hz)',
    fps: 90,
    renderScale: 1.12,
    pixelRatioCap: 1.55,
    resolution: '4K texture pack • 90 FPS',
    hdriResolution: '4k',
    preferredTextureSizes: ['4k', '2k', '1k'],
    cardTextureScale: 1.18,
    description: 'Poly Haven 4K HDRI target with fallback to 2K.'
  },
  {
    id: 'uhd120',
    label: 'Ultra (120 Hz)',
    fps: 120,
    renderScale: 1.22,
    pixelRatioCap: 1.72,
    resolution: '8K texture pack • 120 FPS',
    hdriResolution: '8k',
    preferredTextureSizes: ['8k', '4k', '2k', '1k'],
    cardTextureScale: 1.36,
    description: 'Poly Haven 8K HDRI target with fallback to 4K.'
  }
]);

const HDRI_RESOLUTION_POLICY_BY_FPS = Object.freeze([
  { minFps: 120, preferredResolutions: Object.freeze(['8k', '4k', '2k']), fallbackResolution: '4k' },
  { minFps: 90, preferredResolutions: Object.freeze(['4k', '2k']), fallbackResolution: '2k' },
  { minFps: 0, preferredResolutions: Object.freeze(['2k', '1k']), fallbackResolution: '1k' }
]);
const HDRI_RESOLUTION_RANK = Object.freeze({ '1k': 1, '2k': 2, '4k': 3, '8k': 4 });

function resolveHdriPolicyForFps(fps) {
  const safeFps = Number.isFinite(fps) ? fps : 60;
  return (
    HDRI_RESOLUTION_POLICY_BY_FPS.find((policy) => safeFps >= policy.minFps) ??
    HDRI_RESOLUTION_POLICY_BY_FPS[HDRI_RESOLUTION_POLICY_BY_FPS.length - 1]
  );
}

function buildHdriResolutionChain(primaryResolution, policy = null) {
  const base = Array.isArray(policy?.preferredResolutions) ? policy.preferredResolutions : [];
  const fallbackLadder = ['8k', '4k', '2k', '1k'];
  const safePrimary = typeof primaryResolution === 'string' ? primaryResolution : '2k';
  const maxRank = HDRI_RESOLUTION_RANK[safePrimary] ?? HDRI_RESOLUTION_RANK['2k'];
  const ordered = [primaryResolution, ...base, ...fallbackLadder].filter(
    (value) => typeof value === 'string' && value.length
  );
  return [...new Set(ordered)].filter((resolution) => (HDRI_RESOLUTION_RANK[resolution] ?? 0) <= maxRank);
}

const DEFAULT_FRAME_RATE_OPTION =
  FRAME_RATE_OPTIONS.find((opt) => opt.id === DEFAULT_FRAME_RATE_ID) ?? FRAME_RATE_OPTIONS[0];

function resolveHdriResolutionFromGraphics(frameOption) {
  const targetFromGraphics = frameOption?.hdriResolution;
  if (targetFromGraphics === '2k' || targetFromGraphics === '4k' || targetFromGraphics === '8k') {
    return targetFromGraphics;
  }
  return '2k';
}

function resolveCardTextureSize(frameOption) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '';
  const isAndroidWebView =
    /Android/i.test(ua) && (/\bwv\b/i.test(ua) || /Version\/\d+\.\d+ Chrome\//i.test(ua));
  const deviceMemory = typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number'
    ? navigator.deviceMemory
    : null;
  const memoryScaleCap = deviceMemory != null && deviceMemory <= 4 ? 0.72 : 1;
  const webViewScaleCap = isAndroidWebView ? 0.7 : 1;
  const runtimeScaleCap = Math.min(memoryScaleCap, webViewScaleCap);
  const scale = Number.isFinite(frameOption?.cardTextureScale)
    ? THREE.MathUtils.clamp(frameOption.cardTextureScale, 1, 1.5)
    : 1;
  const effectiveScale = Math.max(0.62, scale * runtimeScaleCap);
  return {
    w: Math.round(768 * effectiveScale),
    h: Math.round(1080 * effectiveScale),
    heldW: Math.round(256 * effectiveScale),
    heldH: Math.round(360 * effectiveScale),
    id: `${frameOption?.id || DEFAULT_FRAME_RATE_ID}-${effectiveScale.toFixed(2)}`
  };
}

const GAME_CONFIG = { ...BASE_CONFIG };
const START_CARD = { rank: '3', suit: '♠' };

export default function MurlanRoyaleArena({ search }) {
  const mountRef = useRef(null);
  const players = useMemo(() => buildPlayers(search), [search]);
  const characterRosterSeedRef = useRef(Math.random());

  const [murlanInventory, setMurlanInventory] = useState(() => getMurlanInventory(murlanAccountId()));

  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const [configOpen, setConfigOpen] = useState(false);

  const [gameState, setGameState] = useState(() => initializeGame(players));
  const [selectedIds, setSelectedIds] = useState([]);
  const [uiState, setUiState] = useState(() => computeUiState(gameState));
  const [actionError, setActionError] = useState('');
  const [threeReady, setThreeReady] = useState(false);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const [discardHudAnchor, setDiscardHudAnchor] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [passBubbles, setPassBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const [commentaryPresetId, setCommentaryPresetId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(COMMENTARY_PRESET_STORAGE_KEY);
      if (stored && MURLAN_ROYALE_COMMENTARY_PRESETS.some((preset) => preset.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_COMMENTARY_PRESET_ID;
  });
  const [commentaryMuted, setCommentaryMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(COMMENTARY_MUTE_STORAGE_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
    }
    return false;
  });
  const commentaryMutedRef = useRef(commentaryMuted);
  const commentaryReadyRef = useRef(false);
  const commentaryQueueRef = useRef([]);
  const commentarySpeakingRef = useRef(false);
  const commentaryLastEventAtRef = useRef(0);
  const pendingCommentaryLinesRef = useRef(null);
  const commentaryIntroPlayedRef = useRef(false);
  const commentarySpeakerIndexRef = useRef(0);
  const commentaryEventRef = useRef({ lastActionId: null, status: null });
  const resolvedAccountId = useMemo(() => murlanAccountId(), []);
  const humanPlayerIndex = useMemo(() => {
    const idx = players.findIndex((player) => player.isHuman);
    return idx >= 0 ? idx : 0;
  }, [players]);
  const humanAvatarUrl = useMemo(
    () => getAvatarUrl(players[humanPlayerIndex]?.avatar || players[0]?.avatar || ''),
    [players, humanPlayerIndex],
  );
  const giftPlayers = useMemo(
    () =>
      players.map((player, index) => ({
        ...player,
        index,
        id: player.id ?? (player.isHuman ? resolvedAccountId : `murlan-ai-${index}`),
        photoUrl: getAvatarUrl(player.avatar)
      })),
    [players, resolvedAccountId],
  );
  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') map.set(anchor.index, anchor);
    });
    return map;
  }, [seatAnchors]);

  const customizationSections = useMemo(() => {
    const tableTheme = TABLE_THEMES[appearance.tables] ?? TABLE_THEMES[0];
    const tableShape = TABLE_SHAPE_OPTIONS[appearance.tableShape] ?? TABLE_SHAPE_OPTIONS[DEFAULT_TABLE_SHAPE_INDEX];
    const allowTableSurfaceControls =
      tableTheme?.source === 'procedural' &&
      TABLE_SHAPES_WITH_SURFACE_CUSTOMIZATION.has(tableShape?.id);
    return CUSTOMIZATION_SECTIONS.map((section) => ({
      ...section,
      options: section.options
        .map((option, idx) => ({ ...option, idx }))
        .filter(({ id }) =>
          section.key === 'tableShape' ? true : isMurlanOptionUnlocked(section.key, id, murlanInventory)
        )
    }))
      .filter((section) => section.options.length > 0)
      .filter((section) =>
        section.key === 'tableFinish' || section.key === 'tableCloth' ? allowTableSurfaceControls : true
      );
  }, [appearance.tables, appearance.tableShape, murlanInventory]);
  const [frameRateId, setFrameRateId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem(FRAME_RATE_STORAGE_KEY);
      if (stored && FRAME_RATE_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
      const detected = detectPreferredFrameRateId();
      if (detected && FRAME_RATE_OPTIONS.some((opt) => opt.id === detected)) {
        return detected;
      }
    }
    return DEFAULT_FRAME_RATE_ID || DEFAULT_FRAME_RATE_OPTION.id;
  });
  const [cardActionAnimationId, setCardActionAnimationId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem(CARD_ACTION_ANIMATION_STORAGE_KEY);
      if (stored && CARD_ACTION_ANIMATION_OPTIONS.some((option) => option.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_CARD_ACTION_ANIMATION_ID;
  });
  const activeCardActionAnimation = useMemo(
    () => resolveCardActionAnimationOption(cardActionAnimationId),
    [cardActionAnimationId]
  );
  const cardActionAnimationRef = useRef(cardActionAnimationId);
  useEffect(() => {
    cardActionAnimationRef.current = cardActionAnimationId;
    if (threeStateRef.current) {
      threeStateRef.current.cardActionAnimationStyle = cardActionAnimationId;
    }
  }, [cardActionAnimationId]);
  const activeFrameRateOption = useMemo(
    () => FRAME_RATE_OPTIONS.find((opt) => opt.id === frameRateId) ?? DEFAULT_FRAME_RATE_OPTION,
    [frameRateId]
  );
  const frameQualityProfile = useMemo(() => {
    const option = activeFrameRateOption ?? DEFAULT_FRAME_RATE_OPTION;
    const fallback = DEFAULT_FRAME_RATE_OPTION;
    const fps =
      Number.isFinite(option?.fps) && option.fps > 0
        ? option.fps
        : Number.isFinite(fallback?.fps) && fallback.fps > 0
          ? fallback.fps
          : 60;
    const renderScale =
      typeof option?.renderScale === 'number' && Number.isFinite(option.renderScale)
        ? THREE.MathUtils.clamp(option.renderScale, 1, 1.6)
        : 1;
    const pixelRatioCap =
      typeof option?.pixelRatioCap === 'number' && Number.isFinite(option.pixelRatioCap)
        ? Math.max(1, option.pixelRatioCap)
        : resolveDefaultPixelRatioCap();
    return {
      id: option?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      renderScale,
      pixelRatioCap
    };
  }, [activeFrameRateOption]);
  const activeTextureResolutionOrder = useMemo(() => {
    const configured = Array.isArray(activeFrameRateOption?.preferredTextureSizes)
      ? activeFrameRateOption.preferredTextureSizes
      : [];
    const clean = configured.filter((entry) => typeof entry === 'string' && entry.length);
    return clean.length ? clean : PREFERRED_TEXTURE_SIZES;
  }, [activeFrameRateOption]);
  const cardTextureQuality = useMemo(
    () => resolveCardTextureSize(activeFrameRateOption),
    [activeFrameRateOption]
  );
  const cardTextureQualityRef = useRef(cardTextureQuality);
  useEffect(() => {
    cardTextureQualityRef.current = cardTextureQuality;
  }, [cardTextureQuality]);
  const frameQualityRef = useRef(frameQualityProfile);
  useEffect(() => {
    frameQualityRef.current = frameQualityProfile;
  }, [frameQualityProfile]);
  const resolvedHdriResolution = useMemo(() => {
    return resolveHdriResolutionFromGraphics(activeFrameRateOption);
  }, [activeFrameRateOption]);
  const activeHdriPolicy = useMemo(
    () => resolveHdriPolicyForFps(activeFrameRateOption?.fps),
    [activeFrameRateOption]
  );
  const resolvedFrameTiming = useMemo(() => {
    const fallbackFps =
      Number.isFinite(DEFAULT_FRAME_RATE_OPTION?.fps) && DEFAULT_FRAME_RATE_OPTION.fps > 0
        ? DEFAULT_FRAME_RATE_OPTION.fps
        : 60;
    const fps =
      Number.isFinite(frameQualityProfile?.fps) && frameQualityProfile.fps > 0
        ? frameQualityProfile.fps
        : fallbackFps;
    const targetMs = 1000 / fps;
    return {
      id: frameQualityProfile?.id ?? DEFAULT_FRAME_RATE_OPTION?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      targetMs,
      maxMs: targetMs * FRAME_TIME_CATCH_UP_MULTIPLIER
    };
  }, [frameQualityProfile]);
  const frameTimingRef = useRef(resolvedFrameTiming);
  useEffect(() => {
    frameTimingRef.current = resolvedFrameTiming;
  }, [resolvedFrameTiming]);
  const hdriVariantRef = useRef(DEFAULT_HDRI_VARIANT);
  const disposeEnvironmentRef = useRef(() => {});
  const envTextureRef = useRef(null);

  const ensureAppearanceUnlocked = useCallback(
    (value = DEFAULT_APPEARANCE) => {
      const normalized = normalizeAppearance(value);
      const map = {
        outfit: OUTFIT_THEMES,
        cards: CARD_THEMES,
        stools: STOOL_THEMES,
        characters: MURLAN_CHARACTER_THEMES,
        tables: TABLE_THEMES,
        tableShape: TABLE_SHAPE_OPTIONS,
        tableCloth: MURLAN_TABLE_CLOTHS,
        tableFinish: MURLAN_TABLE_FINISHES,
        environmentHdri: MURLAN_HDRI_OPTIONS
      };
      let changed = false;
      const next = { ...normalized };
      Object.entries(map).forEach(([key, options]) => {
        const idx = Number.isFinite(next[key]) ? next[key] : 0;
        const option = options[idx];
        const isUnlocked = key === 'tableShape' ? true : isMurlanOptionUnlocked(key, option?.id, murlanInventory);
        if (!option || !isUnlocked) {
          const fallbackIdx = options.findIndex((opt) =>
            key === 'tableShape' ? true : isMurlanOptionUnlocked(key, opt.id, murlanInventory)
          );
          const safeIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
          if (safeIdx !== idx) {
            next[key] = safeIdx;
            changed = true;
          }
        }
      });
      return changed ? next : normalized;
    },
    [murlanInventory]
  );

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === murlanAccountId()) {
        setMurlanInventory(getMurlanInventory(murlanAccountId()));
      }
    };
    window.addEventListener('murlanInventoryUpdate', handler);
    return () => window.removeEventListener('murlanInventoryUpdate', handler);
  }, []);

  useEffect(() => {
    setAppearance((prev) => ensureAppearanceUnlocked(prev));
  }, [ensureAppearanceUnlocked]);

  const syncAudioVolume = useCallback(() => {
    const baseVolume = muted ? 0 : getGameVolume();
    const cardSound = soundsRef.current.card;
    const turnSound = soundsRef.current.turn;
    if (cardSound) {
      cardSound.volume = baseVolume * 0.55;
    }
    if (turnSound) {
      turnSound.volume = baseVolume * 0.55;
    }
    if (bombSoundRef.current) {
      bombSoundRef.current.volume = baseVolume;
    }
    if (hahaSoundRef.current) {
      hahaSoundRef.current.volume = baseVolume;
    }
  }, [muted]);

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  const activeCommentaryPreset = useMemo(
    () =>
      MURLAN_ROYALE_COMMENTARY_PRESETS.find((preset) => preset.id === commentaryPresetId) ??
      MURLAN_ROYALE_COMMENTARY_PRESETS[0],
    [commentaryPresetId]
  );
  const [, setCommentarySupported] = useState(() => getSpeechSupport());
  const commentarySpeakers = useMemo(() => {
    const base = [
      MURLAN_ROYALE_SPEAKERS.lead,
      MURLAN_ROYALE_SPEAKERS.analyst,
      MURLAN_ROYALE_SPEAKERS.hype,
      MURLAN_ROYALE_SPEAKERS.tactician,
      MURLAN_ROYALE_SPEAKERS.veteran
    ];
    const primary = COMMENTARY_PRIMARY_SPEAKERS[activeCommentaryPreset?.id];
    if (!primary) return base;
    return [primary, ...base.filter((speaker) => speaker !== primary)];
  }, [activeCommentaryPreset?.id]);
  const pickCommentarySpeaker = useCallback(() => {
    const primary = COMMENTARY_PRIMARY_SPEAKERS[activeCommentaryPreset?.id];
    if (primary) {
      return primary;
    }
    const index = commentarySpeakerIndexRef.current;
    commentarySpeakerIndexRef.current = index + 1;
    return commentarySpeakers[index % commentarySpeakers.length] || MURLAN_ROYALE_SPEAKERS.analyst;
  }, [activeCommentaryPreset?.id, commentarySpeakers]);

  useEffect(() => {
    const updateSupport = () => setCommentarySupported(getSpeechSupport());
    updateSupport();
    const unsubscribe = onSpeechSupportChange((supported) => setCommentarySupported(Boolean(supported)));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    commentaryMutedRef.current = commentaryMuted;
    if (commentaryMuted) {
      const synth = getSpeechSynthesis();
      synth?.cancel();
      commentaryQueueRef.current = [];
      commentarySpeakingRef.current = false;
      pendingCommentaryLinesRef.current = null;
    }
  }, [commentaryMuted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMMENTARY_PRESET_STORAGE_KEY, commentaryPresetId);
    }
  }, [commentaryPresetId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMMENTARY_MUTE_STORAGE_KEY, commentaryMuted ? '1' : '0');
    }
  }, [commentaryMuted]);

  const playNextCommentary = useCallback(async () => {
    if (commentarySpeakingRef.current) return;
    const now = performance.now();
    let next = commentaryQueueRef.current.shift();
    while (next) {
      const age = now - (next.createdAt ?? now);
      const maxDelay = next.maxDelay ?? COMMENTARY_MAX_LATENCY_MS;
      if (age <= maxDelay) break;
      next = commentaryQueueRef.current.shift();
    }
    if (!next) return;
    const synth = getSpeechSynthesis();
    if (!synth) return;
    commentarySpeakingRef.current = true;
    try {
      synth.cancel();
    } catch {}
    await speakCommentaryLines(next.lines, {
      speakerSettings: next.preset?.speakerSettings,
      voiceHints: next.preset?.voiceHints
    });
    commentarySpeakingRef.current = false;
    if (commentaryQueueRef.current.length) {
      playNextCommentary();
    }
  }, []);

  const playImmediateCommentary = useCallback(
    (entry) => {
      if (!entry?.lines?.length) return;
      const synth = getSpeechSynthesis();
      if (!synth) return;
      commentarySpeakingRef.current = true;
      try {
        synth.cancel();
      } catch {}
      const startedAt = performance.now();
      Promise.resolve(
        speakCommentaryLines(entry.lines, {
          speakerSettings: entry.preset?.speakerSettings,
          voiceHints: entry.preset?.voiceHints
        })
      ).finally(() => {
        commentarySpeakingRef.current = false;
        if (commentaryQueueRef.current.length) {
          playNextCommentary();
        }
        commentaryLastEventAtRef.current = startedAt;
      });
    },
    [playNextCommentary]
  );

  const enqueueMurlanCommentary = useCallback(
    (lines, { priority = false, preset = activeCommentaryPreset } = {}) => {
      if (!Array.isArray(lines) || lines.length === 0) return;
      if (commentaryMutedRef.current || isGameMuted()) return;
      const now = performance.now();
      if (!commentaryReadyRef.current) {
        pendingCommentaryLinesRef.current = {
          lines,
          priority,
          preset,
          createdAt: now,
          maxDelay: priority ? COMMENTARY_PRIORITY_MAX_LATENCY_MS : COMMENTARY_MAX_LATENCY_MS
        };
        return;
      }
      if (!priority && now - commentaryLastEventAtRef.current < COMMENTARY_MIN_INTERVAL_MS) return;
      if (!priority && commentaryQueueRef.current.length >= COMMENTARY_QUEUE_LIMIT) return;
      const entry = {
        lines,
        preset,
        createdAt: now,
        maxDelay: priority ? COMMENTARY_PRIORITY_MAX_LATENCY_MS : COMMENTARY_MAX_LATENCY_MS
      };
      if (priority) {
        commentaryQueueRef.current.unshift(entry);
      } else {
        commentaryQueueRef.current.push(entry);
      }
      if (!commentarySpeakingRef.current) {
        playNextCommentary();
      }
      commentaryLastEventAtRef.current = now;
    },
    [activeCommentaryPreset, playNextCommentary]
  );

  const enqueueMurlanCommentaryEvent = useCallback(
    (event, context = {}, options = {}) => {
      const speaker = options.speaker ?? pickCommentarySpeaker();
      const text = buildMurlanCommentaryLine({
        event,
        speaker,
        language: activeCommentaryPreset?.language ?? commentaryPresetId,
        context: {
          arena: 'Murlan Royale arena',
          ...context
        }
      });
      enqueueMurlanCommentary([{ speaker, text }], options);
    },
    [
      activeCommentaryPreset?.language,
      commentaryPresetId,
      enqueueMurlanCommentary,
      pickCommentarySpeaker
    ]
  );

  const unlockCommentary = useCallback(() => {
    if (commentaryReadyRef.current) return;
    primeSpeechSynthesis();
    const synth = getSpeechSynthesis();
    if (typeof synth?.resume === 'function') {
      try {
        synth.resume();
      } catch {}
    }
    synth?.getVoices?.();
    commentaryReadyRef.current = true;
    const pending = pendingCommentaryLinesRef.current;
    if (pending) {
      pendingCommentaryLinesRef.current = null;
      playImmediateCommentary(pending);
      return;
    }
    if (commentaryQueueRef.current.length) {
      playNextCommentary();
    }
  }, [playImmediateCommentary, playNextCommentary]);

  useEffect(() => {
    syncAudioVolume();
  }, [syncAudioVolume]);

  useEffect(() => {
    const handler = () => syncAudioVolume();
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, [syncAudioVolume]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('pointerdown', unlockCommentary);
    window.addEventListener('pointerup', unlockCommentary);
    window.addEventListener('click', unlockCommentary);
    window.addEventListener('touchstart', unlockCommentary);
    window.addEventListener('touchend', unlockCommentary);
    window.addEventListener('keydown', unlockCommentary);
    return () => {
      window.removeEventListener('pointerdown', unlockCommentary);
      window.removeEventListener('pointerup', unlockCommentary);
      window.removeEventListener('click', unlockCommentary);
      window.removeEventListener('touchstart', unlockCommentary);
      window.removeEventListener('touchend', unlockCommentary);
      window.removeEventListener('keydown', unlockCommentary);
    };
  }, [unlockCommentary]);

  useEffect(() => {
    if (!configOpen) return;
    unlockCommentary();
  }, [configOpen, unlockCommentary]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || commentaryMutedRef.current) return;
      primeSpeechSynthesis();
      const synth = getSpeechSynthesis();
      if (typeof synth?.resume === 'function') {
        try {
          synth.resume();
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const snapshot = commentaryEventRef.current;
    const previousActionId = snapshot.lastActionId;
    const previousStatus = snapshot.status;
    const players = gameState.players || [];
    const languageKey = resolveMurlanLanguageKey(activeCommentaryPreset?.language ?? commentaryPresetId);

    const resolvePlayerName = (index) => {
      const player = players[index];
      return resolveLocalizedPlayerName(player, index, languageKey);
    };

    const resolveOpponentName = (index) => {
      const opponent =
        players.find((p, idx) => idx !== index && !p.finished) ||
        players.find((p, idx) => idx !== index);
      if (!opponent) return getCommentaryFallbackLabel('table', languageKey) || 'the table';
      const opponentIndex = players.indexOf(opponent);
      return resolveLocalizedPlayerName(opponent, opponentIndex >= 0 ? opponentIndex : 0, languageKey);
    };

    const resolveComboEvent = (combo) => {
      if (!combo?.type) return 'play';
      switch (combo.type) {
        case ComboType.SINGLE:
          return 'single';
        case ComboType.PAIR:
          return 'pair';
        case ComboType.TRIPS:
          return 'trips';
        case ComboType.STRAIGHT:
          return 'straight';
        case ComboType.FLUSH:
          return 'flush';
        case ComboType.FULL_HOUSE:
          return 'fullHouse';
        case ComboType.STRAIGHT_FLUSH:
          return 'straightFlush';
        case ComboType.BOMB_4K:
          return 'bomb';
        default:
          return 'play';
      }
    };

    if (!commentaryIntroPlayedRef.current) {
      commentaryIntroPlayedRef.current = true;
      enqueueMurlanCommentary(
        [
          {
            speaker: MURLAN_ROYALE_SPEAKERS.lead,
            text: buildMurlanCommentaryLine({
              event: 'intro',
              speaker: MURLAN_ROYALE_SPEAKERS.lead,
              language: activeCommentaryPreset?.language ?? commentaryPresetId,
              context: { arena: 'Murlan Royale arena' }
            })
          },
          {
            speaker: MURLAN_ROYALE_SPEAKERS.analyst,
            text: buildMurlanCommentaryLine({
              event: 'introReply',
              speaker: MURLAN_ROYALE_SPEAKERS.analyst,
              language: activeCommentaryPreset?.language ?? commentaryPresetId,
              context: { arena: 'Murlan Royale arena' }
            })
          },
          {
            speaker: MURLAN_ROYALE_SPEAKERS.lead,
            text: buildMurlanCommentaryLine({
              event: 'shuffle',
              speaker: MURLAN_ROYALE_SPEAKERS.lead,
              language: activeCommentaryPreset?.language ?? commentaryPresetId,
              context: { arena: 'Murlan Royale arena' }
            })
          }
        ],
        { priority: true, preset: activeCommentaryPreset }
      );
    }

    if (gameState.lastActionId && gameState.lastActionId !== previousActionId) {
      const action = gameState.lastAction;
      if (action) {
        const playerName = resolvePlayerName(action.playerIndex);
        const opponentName = resolveOpponentName(action.playerIndex);
        const cardsLeft = players[action.playerIndex]?.hand?.length ?? 0;
        const comboLabel = action.combo
          ? describeCommentaryCombo(action.combo, action.cards, languageKey)
          : action.cards?.length
            ? action.cards.map((card) => localizedCardLabel(card, languageKey)).join(' ')
            : getCommentaryFallbackLabel('combo', languageKey);
        const context = {
          player: playerName,
          opponent: opponentName,
          combo: comboLabel,
          cardsLeft
        };

        if (action.firstMove) {
          enqueueMurlanCommentaryEvent('firstMove', context);
        } else if (action.type === 'PASS') {
          enqueueMurlanCommentaryEvent('pass', context);
        } else {
          enqueueMurlanCommentaryEvent(resolveComboEvent(action.combo), context);
        }

        if (action.tableCleared) {
          const leaderName = resolvePlayerName(gameState.activePlayer);
          enqueueMurlanCommentaryEvent('clearTable', { ...context, player: leaderName }, { priority: true });
        }

        if (action.type === 'PLAY' && cardsLeft > 0 && cardsLeft <= 2) {
          enqueueMurlanCommentaryEvent('close', context);
        }
      }
    }

    if (gameState.status === 'ENDED' && previousStatus !== 'ENDED') {
      const winnerName = resolvePlayerName(gameState.activePlayer);
      enqueueMurlanCommentaryEvent('win', { player: winnerName }, { priority: true });
      enqueueMurlanCommentaryEvent('outro', { player: winnerName }, { priority: true });
    }

    commentaryEventRef.current = {
      lastActionId: gameState.lastActionId,
      status: gameState.status
    };
  }, [
    activeCommentaryPreset,
    commentaryPresetId,
    enqueueMurlanCommentary,
    enqueueMurlanCommentaryEvent,
    gameState
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(FRAME_RATE_STORAGE_KEY, frameRateId);
    } catch (error) {
      console.warn('Failed to persist frame rate option', error);
    }
  }, [frameRateId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(CARD_ACTION_ANIMATION_STORAGE_KEY, cardActionAnimationId);
    } catch (error) {
      console.warn('Failed to persist card action animation option', error);
    }
  }, [cardActionAnimationId]);

  const gameStateRef = useRef(gameState);
  const selectedRef = useRef(selectedIds);
  const humanTurnRef = useRef(false);

  const threeStateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    textureLoader: null,
    textureCache: new Map(),
    maxAnisotropy: 1,
    fallbackTexture: null,
    arena: null,
    cardGeometry: null,
    cardMap: new Map(),
    faceTextureCache: new Map(),
    seatConfigs: [],
    selectionTargets: [],
    animations: [],
    raycaster: new THREE.Raycaster(),
    tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, TABLE_CARD_AREA_FORWARD_SHIFT),
    deckAnchor: new THREE.Vector3(0.72 * MODEL_SCALE, TABLE_HEIGHT + CARD_H / 2 + CARD_SURFACE_OFFSET, TABLE_CARD_AREA_FORWARD_SHIFT + 0.08 * MODEL_SCALE),
    discardAnchor: new THREE.Vector3(
      DISCARD_PILE_OFFSET.x,
      TABLE_HEIGHT + DISCARD_PILE_OFFSET.y,
      DISCARD_PILE_OFFSET.z + TABLE_CARD_AREA_FORWARD_SHIFT
    ),
    scoreboard: null,
    hdriGround: null,
    tableInfo: null,
    tableThemeId: null,
    tableShapeId: null,
    tableClothId: null,
    tableFinishId: null,
    chairMaterials: null,
    chairTemplate: null,
    chairThemePreserve: false,
    chairThemeId: null,
    chairInstances: [],
    characterThemeId: null,
    characterInstances: [],
    characterRigs: new Map(),
    characterActionAnimations: [],
    cardActionAnimationStyle: DEFAULT_CARD_ACTION_ANIMATION_ID,
    decorPlants: [],
    decorGroup: null,
    outfitParts: [],
    cardThemeId: '',
    cardTextureQualityId: resolveCardTextureSize(DEFAULT_FRAME_RATE_OPTION).id,
    appearance: { ...DEFAULT_APPEARANCE },
    environmentHdri: DEFAULT_HDRI_VARIANT,
    disposeEnvironment: null,
    environmentTexture: null
  });
  const soundsRef = useRef({ card: null, turn: null });
  const bombSoundRef = useRef(null);
  const hahaSoundRef = useRef(null);
  const audioStateRef = useRef({ tableIds: [], activePlayer: null, status: null, initialized: false });
  const prevStateRef = useRef(null);
  const tableBuildTokenRef = useRef(0);
  const characterActionRef = useRef({ lastActionId: 0 });
  const cameraDefaultTargetRef = useRef(new THREE.Vector3(0, TABLE_HEIGHT, 0));
  const cameraLookBasisRef = useRef({
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, -1),
    targetDistance: 1
  });
  const cameraLockedPositionRef = useRef(new THREE.Vector3());
  const cameraLockedBasePositionRef = useRef(new THREE.Vector3());
  const cameraForwardScratchRef = useRef(new THREE.Vector3());
  const cameraOrbitSphericalRef = useRef({ phi: null, phiMin: null, phiMax: null });
  const cameraForwardOffsetScratchRef = useRef(new THREE.Vector3());
  const cameraTurnAnimationRef = useRef(null);
  const cameraTurnHoldTimeoutRef = useRef(null);
  const cameraTurnSuppressUntilRef = useRef(0);
  const cameraPlayFollowTimeoutRef = useRef(null);
  const cameraPlayCardFocusTimeoutRef = useRef(null);
  const cameraPlayTrackAnimationRef = useRef(null);
  const cameraDisableForwardDriftUntilRef = useRef(0);
  const passBubbleTimeoutsRef = useRef(new Map());

  const enforceRotationOnlyCamera = useCallback(() => {
    const { camera, controls } = threeStateRef.current;
    if (!camera || !controls) return;
    const lockedPosition = cameraLockedPositionRef.current;
    const basePosition = cameraLockedBasePositionRef.current;
    const defaultTarget = cameraDefaultTargetRef.current;
    const orbit = cameraOrbitSphericalRef.current;
    const orbitalOffset = camera.position.clone().sub(controls.target);
    const currentSpherical = new THREE.Spherical().setFromVector3(orbitalOffset);
    const phiMin = Number.isFinite(orbit.phiMin) ? orbit.phiMin : controls.minPolarAngle;
    const phiMax = Number.isFinite(orbit.phiMax) ? orbit.phiMax : controls.maxPolarAngle;
    const basePhi = Number.isFinite(orbit.phi) ? orbit.phi : currentSpherical.phi;
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const disableForwardDrift = now < cameraDisableForwardDriftUntilRef.current;
    const upTiltRange = Math.max(1e-4, basePhi - phiMin);
    const upTiltRatio = disableForwardDrift
      ? 0
      : THREE.MathUtils.clamp((basePhi - currentSpherical.phi) / upTiltRange, 0, 1);
    const forwardOffset = cameraForwardOffsetScratchRef.current
      .copy(defaultTarget)
      .sub(basePosition)
      .setY(0);
    if (forwardOffset.lengthSq() > 1e-6) {
      forwardOffset
        .normalize()
        .multiplyScalar(CAMERA_UP_TILT_FORWARD_BLEND * upTiltRatio);
    } else {
      forwardOffset.set(0, 0, 0);
    }
    const liftedY = THREE.MathUtils.lerp(basePosition.y, defaultTarget.y, upTiltRatio * 0.22);
    const desiredLockedPosition = basePosition.clone().add(forwardOffset);
    desiredLockedPosition.y = liftedY;
    const blend = upTiltRatio > 0.0001 ? CAMERA_UP_TILT_FORWARD_LERP : 1;
    lockedPosition.lerp(desiredLockedPosition, blend);
    if (camera.position.distanceToSquared(lockedPosition) <= 1e-8) return;
    const forward = cameraForwardScratchRef.current;
    camera.getWorldDirection(forward);
    if (forward.lengthSq() <= 1e-8) return;
    const distance = Math.max(0.1, cameraLookBasisRef.current?.targetDistance ?? 1);
    camera.position.copy(lockedPosition);
    controls.target.copy(lockedPosition).addScaledVector(forward.normalize(), distance);
    camera.lookAt(controls.target);
  }, []);

  const ensureCardMeshes = useCallback((state) => {
    const three = threeStateRef.current;
    if (!three.arena || !three.cardGeometry) return;
    const theme = CARD_THEMES[appearanceRef.current.cards] ?? CARD_THEMES[0];
    three.cardThemeId = theme.id;
    state.allCards.forEach((card) => {
      if (three.cardMap.has(card.id)) return;
      const mesh = createCardMesh(card, three.cardGeometry, three.faceTextureCache, theme, cardTextureQualityRef.current);
      mesh.visible = false;
      mesh.position.set(0, -10, 0);
      three.arena.add(mesh);
      three.cardMap.set(card.id, { mesh });
    });
  }, []);

  const updateSeatAnchors = useCallback(() => {
    const store = threeStateRef.current;
    const { camera, seatConfigs, discardAnchor } = store;
    const mount = mountRef.current;
    if (!camera || !seatConfigs?.length || !mount) return;
    const rect = mount.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const anchors = seatConfigs.map((seat, index) => {
      const anchorPoint = new THREE.Vector3();
      const shouldUseChairAnchor = !gameStateRef.current?.players?.[index]?.isHuman;
      if (shouldUseChairAnchor && seat?.chair) {
        seat.chair.getWorldPosition(anchorPoint);
        anchorPoint.y += 0.32 * MODEL_SCALE;
      } else {
        const headBone = seat?.characterRig?.bones?.head;
        if (headBone) {
          headBone.getWorldPosition(anchorPoint);
          anchorPoint.y += 0.08 * MODEL_SCALE;
        } else {
          const stool = seat.stoolPosition ? seat.stoolPosition.clone() : new THREE.Vector3();
          stool.y = seat.stoolHeight ?? CHAIR_BASE_HEIGHT;
          anchorPoint.copy(stool);
        }
      }
      const projected = anchorPoint.clone().project(camera);
      const x = clampValue(((projected.x + 1) / 2) * 100, -10, 110);
      const y = clampValue(((1 - projected.y) / 2) * 100, -10, 110);
      const depth = anchorPoint.distanceTo(camera.position);
      return { index, x, y, depth };
    });

    setSeatAnchors(anchors);

    if (discardAnchor) {
      const projected = discardAnchor.clone().project(camera);
      const x = clampValue(((projected.x + 1) / 2) * 100, 4, 96);
      const y = clampValue(((1 - projected.y) / 2) * 100, 4, 96);
      const depth = discardAnchor.distanceTo(camera.position);
      setDiscardHudAnchor((prev) => {
        if (
          prev &&
          Math.abs(prev.x - x) < 0.8 &&
          Math.abs(prev.y - y) < 0.8 &&
          Math.abs(prev.depth - depth) < 0.15
        ) {
          return prev;
        }
        return { x, y, depth };
      });
    }
  }, []);

  const triggerLiveAvatarVideo = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('tonplaygram:live-avatar:start', {
        detail: { gameSlug: 'murlanroyale' }
      })
    );
  }, []);

  const stopCameraTurnAnimation = useCallback(() => {
    if (cameraTurnAnimationRef.current != null) {
      cancelAnimationFrame(cameraTurnAnimationRef.current);
      cameraTurnAnimationRef.current = null;
    }
  }, []);

  const clearCameraTurnHoldTimeout = useCallback(() => {
    if (cameraTurnHoldTimeoutRef.current != null) {
      clearTimeout(cameraTurnHoldTimeoutRef.current);
      cameraTurnHoldTimeoutRef.current = null;
    }
  }, []);

  const clearCameraPlayFollowTimeout = useCallback(() => {
    if (cameraPlayFollowTimeoutRef.current != null) {
      clearTimeout(cameraPlayFollowTimeoutRef.current);
      cameraPlayFollowTimeoutRef.current = null;
    }
  }, []);

  const clearCameraPlayCardFocusTimeout = useCallback(() => {
    if (cameraPlayCardFocusTimeoutRef.current != null) {
      clearTimeout(cameraPlayCardFocusTimeoutRef.current);
      cameraPlayCardFocusTimeoutRef.current = null;
    }
  }, []);

  const stopCameraPlayTrackAnimation = useCallback(() => {
    if (cameraPlayTrackAnimationRef.current != null) {
      cancelAnimationFrame(cameraPlayTrackAnimationRef.current);
      cameraPlayTrackAnimationRef.current = null;
    }
  }, []);

  const turnCameraTowardTarget = useCallback(
    (targetPoint = null, options = {}) => {
      const three = threeStateRef.current;
      const { controls, camera } = three;
      const basis = cameraLookBasisRef.current;
      if (!controls || !camera || !basis?.targetDistance) return;

      const fallbackTarget = cameraDefaultTargetRef.current;
      const desiredPoint = targetPoint?.clone?.() ?? fallbackTarget.clone();
      const aimDirection = desiredPoint.sub(camera.position);
      if (aimDirection.lengthSq() <= 1e-6) return;
      aimDirection.normalize();
      const desiredTarget = camera.position.clone().addScaledVector(aimDirection, basis.targetDistance);
      const snapDistance = controls.target.distanceTo(desiredTarget);

      if (snapDistance <= CAMERA_TARGET_TURN_SNAP_DISTANCE || options.animate === false) {
        stopCameraTurnAnimation();
        controls.target.copy(desiredTarget);
        controls.update();
        updateSeatAnchors();
        return;
      }

      stopCameraTurnAnimation();
      const durationMs = options.durationMs ?? CAMERA_TURN_DURATION_MS;
      const startTime = performance.now();
      const startTarget = controls.target.clone();
      const animateStep = (now) => {
        const t = Math.min(1, (now - startTime) / Math.max(1, durationMs));
        const eased = t * (2 - t);
        controls.target.lerpVectors(startTarget, desiredTarget, eased);
        controls.update();
        updateSeatAnchors();
        if (t < 1) {
          cameraTurnAnimationRef.current = requestAnimationFrame(animateStep);
        } else {
          cameraTurnAnimationRef.current = null;
        }
      };
      cameraTurnAnimationRef.current = requestAnimationFrame(animateStep);
    },
    [stopCameraTurnAnimation, updateSeatAnchors]
  );

  const applyRendererQuality = useCallback(() => {
    const renderer = threeStateRef.current.renderer;
    const host = mountRef.current;
    if (!renderer || !host) return;
    const quality = frameQualityRef.current;
    const dpr =
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : 1;
    const pixelRatioCap =
      quality?.pixelRatioCap ??
      (typeof window !== 'undefined' ? resolveDefaultPixelRatioCap() : 2);
    const renderScale =
      typeof quality?.renderScale === 'number' && Number.isFinite(quality.renderScale)
        ? THREE.MathUtils.clamp(quality.renderScale, 1, 1.6)
        : 1;
    renderer.setPixelRatio(Math.min(pixelRatioCap, dpr));
    renderer.setSize(host.clientWidth * renderScale, host.clientHeight * renderScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }, []);

  useEffect(() => {
    applyRendererQuality();
  }, [applyRendererQuality, frameQualityProfile]);

  const updateScoreboardDisplay = useCallback((entries = []) => {
    const store = threeStateRef.current;
    const scoreboard = store.scoreboard;
    if (!scoreboard?.context || !scoreboard.texture || !scoreboard.mesh || !scoreboard.canvas) return;
    const { canvas, context, texture, mesh } = scoreboard;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);

    if (!entries?.length) {
      mesh.visible = false;
      texture.needsUpdate = true;
      return;
    }

    mesh.visible = true;
    context.save();
    const padding = 36;
    const innerWidth = width - padding * 2;
    context.fillStyle = 'rgba(8, 12, 24, 0.82)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = 12;
    roundRect(context, padding, padding, innerWidth, height - padding * 2, 48);
    context.fill();
    context.stroke();
    context.clip();

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = 'rgba(226, 232, 240, 0.82)';
    context.font = '700 64px "Inter", "Segoe UI", sans-serif';
    context.fillText('Results', padding + 24, 120);
    context.font = '500 28px "Inter", "Segoe UI", sans-serif';
    context.fillStyle = 'rgba(148, 163, 184, 0.8)';
    context.fillText('Cards remaining', padding + 24, 160);

    const rowHeight = 76;
    const rowGap = 12;
    const rowWidth = innerWidth - 48;
    const rowX = padding + 24;
    const maxRows = Math.min(entries.length, 4);

    for (let i = 0; i < maxRows; i += 1) {
      const entry = entries[i];
      const rowY = 168 + i * (rowHeight + rowGap);
      const isActive = Boolean(entry?.isActive);
      const finished = Boolean(entry?.finished);
      const displayName = typeof entry?.name === 'string' ? entry.name : 'Player';
      const trimmedName = displayName.trim();
      const fallbackInitial = trimmedName ? trimmedName.charAt(0).toUpperCase() : '🂠';
      const avatar = entry?.avatar && !entry.avatar.startsWith('http') ? entry.avatar : fallbackInitial;

      context.fillStyle = isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)';
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 4;
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.stroke();

      context.textBaseline = 'middle';
      context.textAlign = 'left';
      context.font = '700 60px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = '#f8fafc';
      context.fillText(avatar, rowX + 36, rowY + rowHeight / 2);

      context.save();
      context.beginPath();
      context.rect(rowX + 110, rowY + 18, rowWidth - 220, rowHeight - 36);
      context.clip();
      context.font = '600 40px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = '#e2e8f0';
      context.fillText(displayName, rowX + 110, rowY + rowHeight / 2);
      context.restore();

      context.textAlign = 'right';
      context.font = '700 42px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = finished ? '#4ade80' : '#f1f5f9';
      const scoreLabel = finished ? '🏁' : String(entry?.cardsLeft ?? 0);
      context.fillText(scoreLabel, rowX + rowWidth - 32, rowY + rowHeight / 2);
    }

    context.restore();
    texture.needsUpdate = true;
  }, []);


  const applyStateToScene = useCallback((state, selection, immediate = false) => {
    const three = threeStateRef.current;
    if (!three.scene) return;

    const previous = prevStateRef.current;
    const selectionSet = new Set(selection);
    const handsVisible = new Set();
    const tableSet = new Set(state.tableCards.map((card) => card.id));
    const discardSet = new Set(state.discardPile.map((card) => card.id));

    const seatConfigs = three.seatConfigs;
    const cardMap = three.cardMap;
    const humanTurn = state.status === 'PLAYING' && state.players[state.activePlayer]?.isHuman;
    const isInitialDealAnimation = !previous && (state.lastActionId ?? 0) === 0;
    humanTurnRef.current = humanTurn;
    state.players.forEach((player, idx) => {
      const seat = seatConfigs[idx];
      if (!seat) return;
      const cards = player.hand;

      const baseHeight = TABLE_HEIGHT + CARD_H / 2 + AI_CARD_LIFT + HUMAN_HAND_EXTRA_LIFT;
      const forward = seat.forward;
      const right = seat.right;
      const radius = seat.radius;
      const focus = seat.focus;
      const spacing = seat.spacing;
      const maxSpread = seat.maxSpread;
      const spread = cards.length > 1 ? Math.min((cards.length - 1) * spacing, maxSpread) : 0;
      cards.forEach((card, cardIdx) => {
        const entry = cardMap.get(card.id);
        if (!entry) return;
        const mesh = entry.mesh;
        const isHumanCard = player.isHuman;
        const layerIndex = isHumanCard ? cards.length - 1 - cardIdx : cardIdx;
        applyHandCardLayering(mesh, isHumanCard, layerIndex);
        const isSideSeat = seat?.handVariant === 'side';
        const backLogoVariant = isHumanCard
          ? 'default'
          : seat?.handVariant === 'top'
            ? 'top'
            : seat?.handVariant === 'side'
              ? 'sideGift'
              : 'side';
        setBackLogoOrientation(mesh, backLogoVariant);
        mesh.visible = true;
        updateCardFace(mesh, isHumanCard ? 'front' : 'back');
        handsVisible.add(card.id);
        const { normalizedOffset, centerWeight, leftWeight } = calcFanCardPose(cards.length, cardIdx);
        const aiHandVariant = isHumanCard ? 'human' : seat?.handVariant;
        const humanLineOffset = cards.length > 1
          ? -spread / 2 + (cardIdx / Math.max(cards.length - 1, 1)) * spread
          : 0;
        const lateral = humanLineOffset;
        const radial = radius + PLAYER_HAND_OUTWARD_PUSH_ONE_CARD;
        const fanArcLift = isHumanCard ? HUMAN_HAND_FAN_ARC_LIFT : AI_HAND_FAN_ARC_LIFT;
        const fanDirection = isHumanCard
          ? HUMAN_HAND_FAN_DIRECTION
          : isSideSeat
            ? -HUMAN_HAND_FAN_DIRECTION
            : (forward?.x ?? 0) < -0.45
              ? -HUMAN_HAND_FAN_DIRECTION
              : HUMAN_HAND_FAN_DIRECTION;
        const aiFanMaxYaw = aiHandVariant === 'side'
          ? AI_SIDE_HAND_FAN_MAX_YAW
          : aiHandVariant === 'top'
            ? AI_TOP_HAND_FAN_MAX_YAW
            : AI_HAND_FAN_MAX_YAW;
        const fanYaw = HUMAN_HAND_UNIFORM_YAW_FROM_LEFT
          ? HUMAN_HAND_FAN_MAX_YAW
          : normalizedOffset * (isHumanCard ? HUMAN_HAND_FAN_MAX_YAW : aiFanMaxYaw) * fanDirection;
        const layoutAxis = right?.clone?.() ?? new THREE.Vector3(1, 0, 0);
        if (layoutAxis.lengthSq() > 1e-6) {
          layoutAxis.normalize();
        } else {
          layoutAxis.set(1, 0, 0);
        }
        const target = forward.clone().multiplyScalar(radial).addScaledVector(layoutAxis, lateral);
        const aiExtraInwardPull = aiHandVariant === 'side'
          ? AI_SIDE_HAND_EXTRA_INWARD_PULL
          : aiHandVariant === 'top'
            ? AI_TOP_HAND_EXTRA_INWARD_PULL
            : 0;
        const aiExtraUpShift = aiHandVariant === 'side'
          ? AI_SIDE_HAND_UP_SHIFT_Y
          : aiHandVariant === 'top'
            ? AI_TOP_HAND_UP_SHIFT_Y
            : 0;
        const aiPalmLateralShift = aiHandVariant === 'side'
          ? (forward?.x ?? 0) < 0
            ? AI_SIDE_HAND_LATERAL_PALM_SHIFT
            : -AI_SIDE_HAND_LATERAL_PALM_SHIFT
          : aiHandVariant === 'top'
            ? AI_TOP_HAND_LATERAL_PALM_SHIFT
            : 0;
        const aiSideTopwardShift = aiHandVariant === 'side'
          ? (forward?.x ?? 0) < 0
            ? AI_SIDE_HAND_TOPWARD_SHIFT
            : -AI_SIDE_HAND_TOPWARD_SHIFT
          : 0;
        const aiExtraOutwardPush = aiHandVariant === 'side'
          ? AI_SIDE_HAND_EXTRA_OUTWARD_PUSH
          : aiHandVariant === 'top'
            ? AI_TOP_HAND_EXTRA_OUTWARD_PUSH
            : 0;
        target.addScaledVector(forward, isHumanCard ? HUMAN_HAND_CLOSER_OFFSET : AI_HAND_CLOSER_OFFSET);
        target.addScaledVector(forward, aiExtraOutwardPush - (HUMAN_HAND_EXTRA_INWARD_PULL + aiExtraInwardPull));
        target.addScaledVector(layoutAxis, (isHumanCard ? HUMAN_HAND_LEFT_SHIFT : AI_HAND_LEFT_SHIFT) + aiPalmLateralShift + aiSideTopwardShift);
        target.y =
          baseHeight +
          centerWeight * fanArcLift +
          HUMAN_HAND_BOTTOM_SHIFT_Y +
          HUMAN_HAND_UP_SHIFT_Y +
          aiExtraUpShift +
          leftWeight * HUMAN_HAND_DIRECTIONAL_LIFT +
          PLAYER_HAND_UP_LIFT_ONE_CARD;
        if (isHumanCard && selectionSet.has(card.id)) target.y += HUMAN_SELECTION_OFFSET;
        mesh.scale.setScalar(isHumanCard ? HUMAN_HAND_CARD_SCALE : AI_HAND_CARD_SCALE);
        const handLookTarget = target.clone().addScaledVector(forward, 2.4 * MODEL_SCALE);
        setCommunityCardLegibility(mesh, false);
        const previousPlayer = previous?.players?.[idx];
        const isNewHandCard = Boolean(card && !previousPlayer?.hand?.some((prevCard) => prevCard.id === card.id));
        let handDealDelay = isNewHandCard ? (cardIdx * state.players.length + idx) * DEAL_CARD_STEP_DELAY_MS : 0;
        if (isNewHandCard && !immediate && three.deckAnchor) {
          const shuffleSpreadX = (cardIdNoise(card.id, 11) - 0.5) * CARD_W * 0.22;
          const shuffleSpreadZ = (cardIdNoise(card.id, 29) - 0.5) * CARD_H * 0.22;
          mesh.position.copy(three.deckAnchor).add(new THREE.Vector3(shuffleSpreadX, 0, shuffleSpreadZ));
          if (isInitialDealAnimation) {
            handDealDelay += DEAL_SHUFFLE_LEAD_IN_MS;
          }
        }
        setMeshPosition(
          mesh,
          target,
          handLookTarget,
          {
            face: isHumanCard ? 'front' : 'back',
            yawY: fanYaw,
            pitchX:
              centerWeight * HUMAN_HAND_BOTTOM_INWARD_TILT_X +
              (aiHandVariant === 'side'
                ? AI_SIDE_HAND_GRIP_PITCH_X
                : aiHandVariant === 'top'
                  ? AI_TOP_HAND_GRIP_PITCH_X
                  : 0),
            rollZ:
              !isHumanCard && aiHandVariant === 'side'
                ? AI_SIDE_HAND_GRIP_ROLL_Z * Math.sign(forward?.x || 1)
                : 0
          },
          immediate,
          three.animations,
          handDealDelay
        );
        mesh.userData.cardId = card.id;
        if (isHumanCard && humanTurn) {
          three.selectionTargets.push(mesh);
        }
      });
    });

    const tableAnchor = three.tableAnchor.clone();
    const tableCount = state.tableCards.length;
    const humanSeat = seatConfigs.find((seat) => state.players[seat.seatIndex]?.isHuman);
    const bottomCardSpacing = Math.max(humanSeat?.spacing ?? 0, COMMUNITY_CARD_SPACING);
    const bottomCardMaxSpread = Math.max(humanSeat?.maxSpread ?? 0, COMMUNITY_CARD_MAX_SPREAD);
    const tableSpread = tableCount > 1
      ? Math.min((tableCount - 1) * bottomCardSpacing, bottomCardMaxSpread)
      : 0;
    const tableSpacing = tableCount > 1 ? tableSpread / (tableCount - 1) : 0;
    const tableStartX = tableCount > 1 ? -tableSpread / 2 : 0;
    const tableLookBase = tableAnchor.clone().setY(tableAnchor.y + 0.28 * MODEL_SCALE);
    if (humanSeat?.forward) {
      tableAnchor.addScaledVector(humanSeat.forward, COMMUNITY_CARD_CLOSER_TO_HUMAN);
      tableLookBase.addScaledVector(humanSeat.forward, COMMUNITY_CARD_CLOSER_TO_HUMAN);
    }
    const communityLookTarget = humanSeat?.focus?.clone().addScaledVector(humanSeat.forward, 2.4 * MODEL_SCALE)
      ?? tableLookBase.clone();
    const shouldSlopeCommunityCards = false;
    const orderedTableCards = [...state.tableCards].reverse();
    const actionPlayerIndex = Number.isInteger(state.lastAction?.playerIndex) ? state.lastAction.playerIndex : null;
    const actionPlayer = actionPlayerIndex != null ? state.players[actionPlayerIndex] : null;
    const isPlayAction = state.lastAction?.type === 'PLAY' && actionPlayer;
    const actionCardIdSet = new Set((state.lastAction?.cards ?? []).map((played) => played?.id).filter(Boolean));
    orderedTableCards.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      const tableLayerIndex = tableCount - 1 - idx;
      applyTableCardLayering(mesh, tableLayerIndex, 8);
      mesh.scale.setScalar(COMMUNITY_CARD_SCALE);
      updateCardFace(mesh, 'front');
      setCommunityCardLegibility(mesh, true);
      const target = tableAnchor.clone();
      const { normalizedOffset } = calcFanCardPose(tableCount, idx);
      const communityFanYaw = normalizedOffset * COMMUNITY_CARD_SIDE_ORIENTATION_YAW;
      const lateralOffset = tableStartX + idx * tableSpacing;
      if (humanSeat?.right) {
        target.addScaledVector(humanSeat.right, lateralOffset + COMMUNITY_CARD_LEFT_SHIFT);
      } else {
        target.x += lateralOffset + COMMUNITY_CARD_LEFT_SHIFT;
      }
      target.y += 0.075 * MODEL_SCALE + COMMUNITY_CARD_BOTTOM_LOCK_Y_OFFSET + COMMUNITY_CARD_FAN_ARC_LIFT + COMMUNITY_CARD_BOTTOM_SHIFT_Y + COMMUNITY_CARD_DIRECTIONAL_LIFT;
      if (shouldSlopeCommunityCards) {
        target.y += -normalizedOffset * COMMUNITY_CARD_STRAIGHT_FLUSH_RIGHT_DROP;
      }
      const wasInAnyHand = previous?.players?.some((prevPlayer) =>
        prevPlayer?.hand?.some((prevCard) => prevCard.id === card.id)
      );
      const shouldPrecisionPlacePlayedCard =
        !immediate && isPlayAction && actionCardIdSet.has(card.id) && wasInAnyHand;
      setMeshPosition(
        mesh,
        target,
        communityLookTarget,
        { face: 'front', flat: true, flatTiltX: COMMUNITY_CARD_TOP_TILT, flatYawY: communityFanYaw },
        immediate,
        three.animations,
        0,
        {
          duration: shouldPrecisionPlacePlayedCard ? PRECISE_CARD_PLACE_DURATION_MS : undefined,
          liftArc: !immediate && wasInAnyHand ? TABLE_PLAY_LIFT_ARC : 0,
          preLift: shouldPrecisionPlacePlayedCard ? PRECISE_CARD_PICKUP_LIFT : 0,
          preLiftPortion: shouldPrecisionPlacePlayedCard ? PRECISE_CARD_PICKUP_PORTION : 0,
          settleSlide: shouldPrecisionPlacePlayedCard ? PRECISE_CARD_SETTLE_SLIDE : 0,
          settlePortion: shouldPrecisionPlacePlayedCard ? PRECISE_CARD_SETTLE_PORTION : 0
        }
      );
    });

    const pileRightAxis = humanSeat?.right?.clone()?.normalize?.() ?? new THREE.Vector3(1, 0, 0);
    const pileForwardAxis = humanSeat?.forward?.clone()?.normalize?.() ?? new THREE.Vector3(0, 0, 1);
    const discardAnchor = tableAnchor
      .clone()
      .addScaledVector(pileForwardAxis, DISCARD_PILE_FORWARD_SHIFT)
      .addScaledVector(pileRightAxis, DISCARD_PILE_RIGHT_SHIFT)
      .add(new THREE.Vector3(0, DISCARD_PILE_OFFSET.y, 0));
    state.discardPile.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      applyTableCardLayering(mesh, idx, 6);
      mesh.scale.setScalar(1);
      updateCardFace(mesh, 'front');
      setCommunityCardLegibility(mesh, true);
      const target = discardAnchor.clone();
      const scatterX = (cardIdNoise(card.id, 3) - 0.5) * CARD_W * 0.05;
      const scatterZ = (cardIdNoise(card.id, 7) - 0.5) * CARD_H * 0.04;
      target.addScaledVector(pileRightAxis, scatterX);
      target.addScaledVector(pileForwardAxis, scatterZ);
      target.y += idx * 0.0022;
      const discardYaw = (cardIdNoise(card.id, 13) - 0.5) * THREE.MathUtils.degToRad(2);
      const discardTilt = (cardIdNoise(card.id, 17) - 0.5) * THREE.MathUtils.degToRad(0.8);
      setMeshPosition(
        mesh,
        target,
        tableLookBase,
        { face: 'front', flat: true, flatTiltX: COMMUNITY_CARD_TOP_TILT + discardTilt, flatYawY: discardYaw },
        immediate,
        three.animations
      );
    });

    three.cardMap.forEach(({ mesh }, id) => {
      if (handsVisible.has(id) || tableSet.has(id) || discardSet.has(id)) return;
      mesh.scale.setScalar(1);
      mesh.visible = false;
      if (mesh.userData?.animation) {
        mesh.userData.animation.cancelled = true;
        mesh.userData.animation = null;
      }
    });

    if (!humanTurn) {
      three.selectionTargets = [];
    }
    if (three.renderer?.domElement) {
      three.renderer.domElement.style.cursor = humanTurn && three.selectionTargets.length ? 'pointer' : 'default';
    }
  }, []);

  const rebuildTable = useCallback(
    async (tableTheme, tableFinish, tableCloth, tableShapeOption) => {
      const three = threeStateRef.current;
      if (!three?.arena || !three.renderer) return null;
      const token = ++tableBuildTokenRef.current;
      if (three.tableInfo) {
        three.tableInfo.dispose?.();
        three.tableInfo = null;
      }

      const theme = tableTheme || TABLE_THEMES[0];
      const finish = tableFinish || MURLAN_TABLE_FINISHES[DEFAULT_TABLE_FINISH_INDEX] || null;
      const cloth = tableCloth || MURLAN_TABLE_CLOTHS[DEFAULT_TABLE_CLOTH_INDEX] || null;
      const shapeOption = tableShapeOption || TABLE_SHAPE_OPTIONS[DEFAULT_TABLE_SHAPE_INDEX];
      let tableInfo = null;

      if (theme?.source === 'polyhaven' && theme?.assetId) {
        try {
          const model = await createPolyhavenInstance(
            theme.assetId,
            TABLE_MODEL_TARGET_HEIGHT,
            theme.rotationY || 0,
            three.renderer,
            {
              textureLoader: three.textureLoader,
              maxAnisotropy: three.maxAnisotropy,
              fallbackTexture: three.fallbackTexture,
              textureCache: three.textureCache,
              preferredTextureSizes: activeTextureResolutionOrder
            }
          );
          if (tableBuildTokenRef.current === token && model) {
            const tableGroup = new THREE.Group();
            tableGroup.add(model);
            const { surfaceY, radius } = fitTableModelToArena(tableGroup);
            const groundedDelta = groundObjectToY(tableGroup, ARENA_GROUND_Y);
            centerObjectOnArenaXZ(tableGroup);
            three.arena.add(tableGroup);
            tableInfo = {
              group: tableGroup,
              surfaceY: surfaceY + groundedDelta,
              tableHeight: surfaceY + groundedDelta,
              radius,
              dispose: () => {
                disposeObjectResources(tableGroup);
                if (tableGroup.parent) tableGroup.parent.remove(tableGroup);
              },
              materials: null,
              shapeId: theme.id,
              rotationY: theme.rotationY ?? 0,
              themeId: theme.id
            };
          }
        } catch (error) {
          console.warn('Failed to load Poly Haven table', error);
        }
      }

      if (!tableInfo) {
        const procedural = createMurlanStyleTable({
          arena: three.arena,
          renderer: three.renderer,
          tableRadius: TABLE_RADIUS * TABLE_SIDE_TRIM_SCALE,
          tableHeight: TABLE_HEIGHT,
          pedestalHeightScale: 0.76,
          includeBase: true,
          shapeOption,
          woodOption: finish?.woodOption || undefined,
          clothOption: cloth || undefined
        });
        tableInfo = { ...procedural, themeId: theme?.id || 'murlan-default' };
        if (tableInfo?.group) {
          centerObjectOnArenaXZ(tableInfo.group);
          groundObjectToY(tableInfo.group, ARENA_GROUND_Y);
        }
      }

      if (tableBuildTokenRef.current !== token) {
        tableInfo.dispose?.();
        return null;
      }

      three.tableInfo = tableInfo;
      three.tableThemeId = theme?.id || 'murlan-default';
      three.tableShapeId = shapeOption?.id ?? TABLE_SHAPE_OPTIONS[DEFAULT_TABLE_SHAPE_INDEX]?.id ?? null;
      three.tableClothId = cloth?.id ?? null;
      three.tableFinishId = finish?.id ?? null;
      three.tableAnchor = new THREE.Vector3(0, tableInfo.surfaceY + CARD_SURFACE_OFFSET, TABLE_CARD_AREA_FORWARD_SHIFT);
      three.discardAnchor = new THREE.Vector3(
        DISCARD_PILE_OFFSET.x,
        tableInfo.surfaceY + DISCARD_PILE_OFFSET.y,
        DISCARD_PILE_OFFSET.z + TABLE_CARD_AREA_FORWARD_SHIFT
      );
      return tableInfo;
    },
    [activeTextureResolutionOrder]
  );

  const rebuildChairs = useCallback(
    async (stoolTheme) => {
      if (!threeReady) return;
      const safe = stoolTheme || STOOL_THEMES[0];
      const store = threeStateRef.current;
      const chairBuild = await buildChairTemplate(safe, store.renderer, {
        textureLoader: store.textureLoader,
        maxAnisotropy: store.maxAnisotropy,
        fallbackTexture: store.fallbackTexture,
        textureCache: store.textureCache,
        preferredTextureSizes: activeTextureResolutionOrder
      });
      const currentAppearance = normalizeAppearance(appearanceRef.current);
      const expectedTheme = STOOL_THEMES[currentAppearance.stools] ?? STOOL_THEMES[0];
      if (expectedTheme.id !== safe.id) return;
      if (store.chairMaterials) {
        const mats = new Set([
          store.chairMaterials.seat,
          store.chairMaterials.leg,
          ...(store.chairMaterials.upholstery ?? []),
          ...(store.chairMaterials.metal ?? [])
        ]);
        mats.forEach((mat) => mat?.dispose?.());
      }
      if (store.chairTemplate) {
        disposeObjectResources(store.chairTemplate);
      }
      store.chairTemplate = chairBuild.chairTemplate;
      store.chairMaterials = chairBuild.materials;
      store.chairThemePreserve = chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(safe);
      store.chairThemeId = safe.id;
      applyChairThemeMaterials(store, safe);

      store.chairInstances.forEach((chair) => {
        const previous = chair?.userData?.chairModel;
        if (previous) {
          disposeObjectResources(previous);
          chair.remove(previous);
        }
        const clone = chairBuild.chairTemplate.clone(true);
        chair.add(clone);
        chair.userData.chairModel = clone;
      });
    },
    [activeTextureResolutionOrder, threeReady]
  );

  const rebuildSeatCharacters = useCallback(
    async (characterTheme) => {
      if (!threeReady) return;
      const store = threeStateRef.current;
      if (!store?.seatConfigs?.length) return;
      if (!ENABLE_3D_HUMAN_CHARACTERS) {
        store.characterInstances?.forEach((entry) => {
          if (!entry) return;
          entry.parent?.remove(entry);
          disposeObjectResources(entry);
        });
        store.characterInstances = [];
        store.characterRigs = new Map();
        store.characterActionAnimations = [];
        store.characterThemeId = null;
        return;
      }
      const currentPlayers = gameStateRef.current?.players ?? players;
      const humanSeatIndex = currentPlayers.findIndex((player) => player?.isHuman);
      const safe = characterTheme || MURLAN_CHARACTER_THEMES[0];
      const characterRoster = buildSeatCharacterThemeRoster(
        safe,
        currentPlayers,
        humanSeatIndex >= 0 ? humanSeatIndex : 0,
        gameStateRef.current?.characterRosterSeed ?? characterRosterSeedRef.current
      );

      store.characterInstances?.forEach((entry) => {
        if (!entry) return;
        entry.parent?.remove(entry);
        disposeObjectResources(entry);
      });
      store.characterInstances = [];
      store.characterRigs = new Map();
      store.characterActionAnimations = [];

      const currentAppearance = normalizeAppearance(appearanceRef.current);
      const expectedTheme = MURLAN_CHARACTER_THEMES[currentAppearance.characters] ?? MURLAN_CHARACTER_THEMES[0];
      if (expectedTheme.id !== safe.id) return;

      const uniqueThemes = [...new Map(characterRoster.map((theme) => [theme?.id, theme])).values()].filter(Boolean);
      const templateEntries = await Promise.all(uniqueThemes.map(async (theme) => {
        try {
          return [theme.id, await loadCharacterModel(theme, store.renderer)];
        } catch (error) {
          console.warn('Failed to load character theme', theme?.id, error);
          return [theme.id, null];
        }
      }));
      const templatesById = new Map(templateEntries.filter(([, template]) => template));
      if (!templatesById.size) return;
      const loadedFallbackThemes = characterRoster.filter((theme) => theme?.id && templatesById.has(theme.id));

      store.characterThemeId = characterThemeRosterSignature(characterRoster);
      store.seatConfigs.forEach((seatConfig, seatIndex) => {
        const seatTheme = characterRoster[seatIndex] || safe;
        const resolvedSeatTheme = resolveLoadedSeatCharacterTheme({
          seatTheme,
          selectedTheme: safe,
          templatesById,
          fallbackThemes: loadedFallbackThemes,
          player: currentPlayers[seatIndex] ?? null,
          seatIndex,
          humanSeatIndex: humanSeatIndex >= 0 ? humanSeatIndex : 0
        });
        if (!resolvedSeatTheme?.template) return;
        attachSeatedCharacter({
          template: resolvedSeatTheme.template,
          seatConfig,
          characterTheme: resolvedSeatTheme.theme,
          store,
          player: currentPlayers[seatIndex] ?? null,
          playerIndex: seatIndex,
          cardTheme: CARD_THEMES[currentAppearance.cards] ?? CARD_THEMES[0]
        });
      });
    },
    [threeReady]
  );

  const applyHdriEnvironment = useCallback(
    async (variantConfig = hdriVariantRef.current || DEFAULT_HDRI_VARIANT) => {
      const three = threeStateRef.current;
      if (!three.renderer || !three.scene) return;
      const activeVariant = variantConfig || hdriVariantRef.current || DEFAULT_HDRI_VARIANT;
      if (!activeVariant) return;
      const resolution = resolvedHdriResolution || DEFAULT_HDRI_RESOLUTIONS[0];
      const preferredResolutions = buildHdriResolutionChain(resolution, activeHdriPolicy);
      const envResult = await loadPolyHavenHdriEnvironment(three.renderer, {
        ...activeVariant,
        preferredResolutions,
        fallbackResolution: activeHdriPolicy?.fallbackResolution ?? preferredResolutions[1] ?? resolution
      });
      if (!envResult?.envMap || !three.scene) return;
      const prevDispose = disposeEnvironmentRef.current;
      const prevTexture = envTextureRef.current;
      const prevBackground = three.environmentTexture || null;
      three.scene.environment = envResult.envMap;
      three.scene.background = envResult.backgroundMap || envResult.envMap;
      const hdriSource = typeof activeVariant?.source === 'string' ? activeVariant.source : 'polyhaven';
      const rotationY = Number.isFinite(activeVariant?.rotationY)
        ? activeVariant.rotationY
        : hdriSource === 'polyhaven'
          ? -Math.PI / 12
          : 0;
      const invertedRotationY = rotationY + Math.PI;
      const rotationX = Number.isFinite(activeVariant?.rotationX) ? activeVariant.rotationX : 0;
      if ('backgroundRotation' in three.scene) {
        three.scene.backgroundRotation.set(rotationX, invertedRotationY, 0);
      }
      if ('environmentRotation' in three.scene) {
        three.scene.environmentRotation.set(rotationX, invertedRotationY, 0);
      }
      if ('backgroundIntensity' in three.scene && typeof activeVariant?.backgroundIntensity === 'number') {
        three.scene.backgroundIntensity = activeVariant.backgroundIntensity;
      }
      if ('backgroundBlurriness' in three.scene) {
        three.scene.backgroundBlurriness = Number.isFinite(activeVariant?.backgroundBlurriness)
          ? activeVariant.backgroundBlurriness
          : 0;
      }
      if (typeof activeVariant?.environmentIntensity === 'number') {
        three.scene.environmentIntensity = activeVariant.environmentIntensity;
      }
      three.renderer.toneMappingExposure = activeVariant?.exposure ?? three.renderer.toneMappingExposure;
      envTextureRef.current = envResult.envMap;
      three.environmentTexture = envResult.backgroundMap || null;
      disposeEnvironmentRef.current = () => {
        if (three.scene) {
          if (three.scene.environment === envResult.envMap) {
            three.scene.environment = null;
          }
          if (three.scene.background === envResult.backgroundMap || three.scene.background === envResult.envMap) {
            three.scene.background = null;
          }
        }
        envResult.backgroundMap?.dispose?.();
        envResult.envMap.dispose?.();
      };
      if (prevDispose && prevTexture !== envResult.envMap) {
        prevDispose();
      }
      if (prevBackground && prevBackground !== envResult.backgroundMap) {
        prevBackground.dispose?.();
      }
    },
    [activeHdriPolicy, resolvedHdriResolution]
  );

  useEffect(() => {
    if (!threeReady) return;
    void applyHdriEnvironment(hdriVariantRef.current);
  }, [applyHdriEnvironment, threeReady]);

  const updateSceneAppearance = useCallback(
    (nextAppearance, { refreshCards = false } = {}) => {
      if (!threeReady) return;
      const safe = normalizeAppearance(nextAppearance);
      const stoolTheme = STOOL_THEMES[safe.stools] ?? STOOL_THEMES[0];
      const outfitTheme = OUTFIT_THEMES[safe.outfit] ?? OUTFIT_THEMES[0];
      const cardTheme = CARD_THEMES[safe.cards] ?? CARD_THEMES[0];
      const characterTheme = ENABLE_3D_HUMAN_CHARACTERS
      ? MURLAN_CHARACTER_THEMES[safe.characters] ?? MURLAN_CHARACTER_THEMES[0]
      : null;
      const tableTheme = TABLE_THEMES[safe.tables] ?? TABLE_THEMES[0];
      const tableShape = TABLE_SHAPE_OPTIONS[safe.tableShape] ?? TABLE_SHAPE_OPTIONS[DEFAULT_TABLE_SHAPE_INDEX];
      const tableFinish = resolveTableFinish(safe.tableFinish);
      const tableFinishId =
        tableFinish?.id ?? MURLAN_TABLE_FINISHES[DEFAULT_TABLE_FINISH_INDEX]?.id ?? null;
      const tableCloth = resolveTableCloth(safe.tableCloth);
      const tableClothId =
        tableCloth?.id ?? MURLAN_TABLE_CLOTHS[DEFAULT_TABLE_CLOTH_INDEX]?.id ?? null;
      const environmentVariant = resolveHdriVariant(safe.environmentHdri);
      hdriVariantRef.current = environmentVariant;

      void (async () => {
        const three = threeStateRef.current;
        if (!three.scene) return;
        const tableChanged =
          three.tableThemeId !== tableTheme.id ||
          (tableTheme?.source === 'procedural' && three.tableShapeId !== tableShape?.id) ||
          !three.tableInfo ||
          (tableTheme?.source === 'procedural' && three.tableFinishId !== tableFinishId);
        if (tableChanged) {
          await rebuildTable(tableTheme, tableFinish, tableCloth, tableShape);
        } else if (
          tableTheme?.source === 'procedural' &&
          three.tableInfo?.materials &&
          three.tableClothId !== tableClothId
        ) {
          applyTableMaterials(three.tableInfo.materials, { woodOption: tableFinish?.woodOption, clothOption: tableCloth }, three.renderer);
          three.tableClothId = tableClothId;
        }

        const preserveRequested = shouldPreserveChairMaterials(stoolTheme);
        if (three.chairThemePreserve == null) {
          three.chairThemePreserve = preserveRequested;
        }
        if (three.chairThemeId !== stoolTheme.id) {
          three.chairThemePreserve = preserveRequested;
          void rebuildChairs(stoolTheme);
        } else {
          applyChairThemeMaterials(three, stoolTheme);
        }
        if (ENABLE_3D_HUMAN_CHARACTERS && characterTheme) {
          const currentPlayers = gameStateRef.current?.players ?? players;
          const rosterHumanSeatIndex = currentPlayers.findIndex((player) => player?.isHuman);
          const expectedCharacterRoster = buildSeatCharacterThemeRoster(
            characterTheme,
            currentPlayers,
            rosterHumanSeatIndex >= 0 ? rosterHumanSeatIndex : 0,
            gameStateRef.current?.characterRosterSeed ?? characterRosterSeedRef.current
          );
          if (three.characterThemeId !== characterThemeRosterSignature(expectedCharacterRoster)) {
            void rebuildSeatCharacters(characterTheme);
          }
        } else if (three.characterInstances?.length) {
          void rebuildSeatCharacters(null);
        }
        applyOutfitThemeMaterials(three, outfitTheme);

        const shouldRefreshCards =
          refreshCards ||
          three.appearance?.cards !== safe.cards ||
          three.cardTextureQualityId !== cardTextureQualityRef.current.id;
        if (shouldRefreshCards) {
          three.cardTextureQualityId = cardTextureQualityRef.current.id;
        }
        applyCardThemeMaterials(three, cardTheme, shouldRefreshCards, cardTextureQualityRef.current);
        void applyHdriEnvironment(environmentVariant);

        three.appearance = { ...safe };

        ensureCardMeshes(gameStateRef.current);
        applyStateToScene(gameStateRef.current, selectedRef.current, true);
      })();
    },
    [
      applyHdriEnvironment,
      applyStateToScene,
      ensureCardMeshes,
      rebuildChairs,
      rebuildSeatCharacters,
      rebuildTable,
      applyTableMaterials,
      threeReady
    ]
  );

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tables': {
        const thumb = option?.thumbnail;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            {thumb ? (
              <img src={thumb} alt={option?.label || 'Table model'} className="h-full w-full object-cover opacity-80" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-100/80">
                {option?.label || 'Table'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
            <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {(option?.label || 'Table').slice(0, 22)}
            </div>
          </div>
        );
      }
      case 'tableFinish': {
        const swatches = option?.swatches ?? ['#b8b3aa', '#d6d0c7'];
        const thumb = option?.thumbnail;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10">
            {thumb ? (
              <img
                src={thumb}
                alt={option?.label || 'Table finish'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1] ?? swatches[0]})`
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
          </div>
        );
      }
      case 'tableCloth': {
        const swatches = option?.swatches ?? ['#1f7a4a', '#0f4f2d'];
        const thumb = option?.thumbnail;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10">
            {thumb ? (
              <img
                src={thumb}
                alt={option?.label || 'Table cloth'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1] ?? swatches[0]})`
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
          </div>
        );
      }
      case 'cards':
        return (
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-14 w-9 rounded-md border"
              style={{
                background: option.frontBackground,
                borderColor: option.frontBorder || '#e5e7eb'
              }}
            />
            <div
              className="h-14 w-9 rounded-md border border-white/10"
              style={{
                backgroundImage: `linear-gradient(135deg, ${
                  option.backGradient?.[0] ?? option.backColor
                }, ${option.backGradient?.[1] ?? option.backColor})`,
                boxShadow: `0 0 0 2px ${option.backAccent || 'rgba(255,255,255,0.25)'} inset`
              }}
            />
          </div>
        );
      case 'characters':
        return (
          <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            {option.thumbnail ? (
              <img src={option.thumbnail} alt={option.label} className="h-full w-full object-cover opacity-90" loading="lazy" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/35 via-transparent to-black/60" />
            <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-sky-100/80">
              3D Player
            </div>
          </div>
        );
      case 'stools':
        return (
          <div className="relative flex h-14 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden">
            {option.thumbnail ? (
              <img
                src={option.thumbnail}
                alt={option.label}
                className="h-full w-full object-cover opacity-90"
                loading="lazy"
              />
            ) : (
              <>
                <div className="h-6 w-12 rounded-md" style={{ background: option.seatColor }} />
                <div
                  className="absolute bottom-1 h-2 w-14 rounded-full opacity-80"
                style={{ background: option.legColor }}
              />
            </>
          )}
        </div>
        );
      case 'environmentHdri': {
        const [primary, secondary] = option.swatches?.length
          ? option.swatches
          : ['#0ea5e9', '#312e81'];
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            {option?.thumbnail ? (
              <img
                src={option.thumbnail}
                alt={option.label || 'HDRI option'}
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 30% 30%, ${primary}, transparent 45%), radial-gradient(circle at 80% 60%, ${secondary}, transparent 55%), linear-gradient(135deg, ${primary}99, ${secondary}dd)`
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/60" />
            <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              HDRI
            </div>
          </div>
        );
      }
      case 'outfit':
      default:
        return (
          <div className="relative flex h-14 w-full items-center justify-center">
            <div className="relative h-14 w-14 rounded-full" style={{ background: option.baseColor }}>
              <div
                className="absolute inset-1 rounded-full border-2"
                style={{ borderColor: option.accentColor }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: option.accentColor }}
              />
            </div>
          </div>
        );
    }
  }, []);

  useEffect(() => {
    prevStateRef.current = gameState;
    gameStateRef.current = gameState;
    setUiState(computeUiState(gameState));
    if (!threeReady) return;

    applyStateToScene(gameState, selectedRef.current);
  }, [gameState, threeReady, applyStateToScene]);

  useEffect(() => {
    selectedRef.current = selectedIds;
    if (threeReady) {
      applyStateToScene(gameStateRef.current, selectedIds);
    }
  }, [selectedIds, threeReady, applyStateToScene]);

  useEffect(() => {
    if (threeReady) {
      updateSeatAnchors();
    }
  }, [threeReady, updateSeatAnchors]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const card = new Audio('/assets/sounds/flipcard-91468.mp3');
    const turn = new Audio('/assets/sounds/wooden-door-knock-102902.mp3');
    card.preload = 'auto';
    turn.preload = 'auto';
    const baseVolume = getGameVolume();
    card.volume = baseVolume * 0.55;
    turn.volume = baseVolume * 0.55;
    soundsRef.current = { card, turn };
    return () => {
      [card, turn].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = '';
      });
      soundsRef.current = { card: null, turn: null };
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const bomb = new Audio(bombSound);
    const haha = new Audio('/assets/sounds/Haha.mp3');
    bomb.preload = 'auto';
    haha.preload = 'auto';
    const baseVolume = getGameVolume();
    bomb.volume = baseVolume;
    haha.volume = baseVolume;
    bombSoundRef.current = bomb;
    hahaSoundRef.current = haha;
    return () => {
      [bomb, haha].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = '';
      });
      bombSoundRef.current = null;
      hahaSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const prev = audioStateRef.current;
    const tableIds = gameState.tableCards.map((card) => card.id);
    const hasNewTableCards =
      prev.initialized &&
      (tableIds.length > prev.tableIds.length ||
        tableIds.some((id, index) => id !== prev.tableIds[index]));
    if (hasNewTableCards && tableIds.length) {
      if (muted) {
        audioStateRef.current = {
          tableIds,
          activePlayer: gameState.activePlayer,
          status: gameState.status,
          initialized: true
        };
        return;
      }
      const cardSound = soundsRef.current.card;
      if (cardSound) {
        try {
          cardSound.currentTime = 0;
          void cardSound.play();
        } catch (error) {
          // ignore playback errors (autoplay restrictions)
        }
      }
    }
    const activeChanged = prev.initialized && prev.activePlayer !== gameState.activePlayer;
    const activePlayer = Number.isInteger(gameState.activePlayer)
      ? gameState.players[gameState.activePlayer]
      : null;
    if (activeChanged && gameState.status === 'PLAYING' && activePlayer?.isHuman) {
      if (muted) {
        audioStateRef.current = {
          tableIds,
          activePlayer: gameState.activePlayer,
          status: gameState.status,
          initialized: true
        };
        return;
      }
      const turnSound = soundsRef.current.turn;
      if (turnSound) {
        try {
          turnSound.currentTime = 0;
          void turnSound.play();
        } catch (error) {
          // ignore playback errors
        }
      }
    }
    audioStateRef.current = {
      tableIds,
      activePlayer: gameState.activePlayer,
      status: gameState.status,
      initialized: true
    };
  }, [gameState, muted]);

  useEffect(() => {
    const action = gameState?.lastAction;
    const actionId = gameState?.lastActionId ?? 0;
    if (!actionId || action?.type !== 'PASS' || !Number.isInteger(action?.playerIndex)) return;
    const bubbleId = `pass-${actionId}-${action.playerIndex}`;
    setPassBubbles((prev) => [...prev.filter((entry) => entry.id !== bubbleId), { id: bubbleId, playerIndex: action.playerIndex }]);
    const activeTimeout = passBubbleTimeoutsRef.current.get(bubbleId);
    if (activeTimeout != null) {
      clearTimeout(activeTimeout);
    }
    const timeoutId = setTimeout(() => {
      setPassBubbles((prev) => prev.filter((entry) => entry.id !== bubbleId));
      passBubbleTimeoutsRef.current.delete(bubbleId);
    }, PASS_BUBBLE_DURATION_MS);
    passBubbleTimeoutsRef.current.set(bubbleId, timeoutId);
  }, [gameState?.lastAction, gameState?.lastActionId]);

  useEffect(() => {
    return () => {
      passBubbleTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      passBubbleTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!threeReady) return;
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    if (now < cameraTurnSuppressUntilRef.current) {
      return;
    }
    const three = threeStateRef.current;
    const controls = three?.controls;
    if (!controls) return;

    const activeIndex = gameState?.activePlayer;
    const activeSeat = Number.isInteger(activeIndex) ? three.seatConfigs?.[activeIndex] : null;
    const activePlayer = Number.isInteger(activeIndex) ? gameState?.players?.[activeIndex] : null;
    const basis = cameraLookBasisRef.current;

    if (!basis?.position || !basis?.direction) return;

    clearCameraTurnHoldTimeout();

    if (gameState?.status !== 'PLAYING') {
      if (CAMERA_AUTO_RECENTER_ON_HUMAN_TURN_ENABLED) {
        turnCameraTowardTarget(cameraDefaultTargetRef.current, { animate: true });
      }
      return;
    }

    if (activePlayer?.isHuman) {
      if (CAMERA_AUTO_RECENTER_ON_HUMAN_TURN_ENABLED) {
        const humanSeatFocus = activeSeat?.focus?.clone?.() ?? cameraDefaultTargetRef.current.clone();
        const humanTurnFocus = cameraDefaultTargetRef.current
          .clone()
          .lerp(humanSeatFocus, CAMERA_HUMAN_TURN_TARGET_WEIGHT);
        humanTurnFocus.y -= CAMERA_HUMAN_TURN_TARGET_DOWNSHIFT;
        turnCameraTowardTarget(humanTurnFocus, { animate: true });
      }
      return;
    }

    if (!activeSeat?.stoolPosition) {
      return;
    }

    const blendedFocus = cameraDefaultTargetRef.current
      .clone()
      .lerp(activeSeat.focus, CAMERA_PLAYER_TARGET_WEIGHT);
    const sideSign = Math.sign(activeSeat?.stoolPosition?.x ?? 0);
    if (sideSign !== 0) {
      blendedFocus.x += sideSign * CAMERA_SIDE_LOOK_EXTRA;
    }
    cameraTurnHoldTimeoutRef.current = setTimeout(() => {
      turnCameraTowardTarget(blendedFocus, { animate: true });
      cameraTurnHoldTimeoutRef.current = null;
    }, CAMERA_PLAYER_SWITCH_HOLD_MS);

    return () => clearCameraTurnHoldTimeout();
  }, [
    clearCameraTurnHoldTimeout,
    gameState.activePlayer,
    gameState.players,
    gameState.status,
    threeReady,
    turnCameraTowardTarget
  ]);

  useEffect(() => {
    if (!threeReady) return;
    if (!CAMERA_AUTO_FOCUS_ON_PLAY_ENABLED) return;
    const action = gameState?.lastAction;
    if (!action || action.type !== 'PLAY') return;
    clearCameraTurnHoldTimeout();
    clearCameraPlayFollowTimeout();
    clearCameraPlayCardFocusTimeout();
    stopCameraPlayTrackAnimation();

    const store = threeStateRef.current;
    const centerTarget = store.discardAnchor?.clone?.() ?? store.tableAnchor?.clone?.() ?? cameraDefaultTargetRef.current.clone();
    turnCameraTowardTarget(cameraDefaultTargetRef.current, { animate: true, durationMs: CAMERA_PLAY_TURN_DURATION_MS });
    cameraPlayCardFocusTimeoutRef.current = setTimeout(() => {
      turnCameraTowardTarget(centerTarget, { animate: true, durationMs: CAMERA_PLAY_TURN_DURATION_MS });
      cameraPlayCardFocusTimeoutRef.current = null;
    }, CAMERA_PLAY_CARD_FOCUS_DELAY_MS);

    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const trackUntil = start + CAMERA_PLAY_FOLLOW_HOLD_MS;
    const trackCardDuringFlight = (time) => {
      turnCameraTowardTarget(centerTarget, { animate: false });
      if (time < trackUntil) {
        cameraPlayTrackAnimationRef.current = requestAnimationFrame(trackCardDuringFlight);
      } else {
        cameraPlayTrackAnimationRef.current = null;
      }
    };
    cameraPlayTrackAnimationRef.current = requestAnimationFrame(trackCardDuringFlight);
    cameraTurnSuppressUntilRef.current = start + CAMERA_PLAY_FOLLOW_HOLD_MS + CAMERA_PLAY_NEXT_TURN_DELAY_MS;
    cameraDisableForwardDriftUntilRef.current =
      start + CAMERA_PLAY_FOLLOW_HOLD_MS + CAMERA_PLAY_NEXT_TURN_DELAY_MS;

    cameraPlayFollowTimeoutRef.current = setTimeout(() => {
      const liveState = gameStateRef.current;
      const activeIndex = liveState?.activePlayer;
      const activeSeat = Number.isInteger(activeIndex) ? store.seatConfigs?.[activeIndex] : null;
      const activePlayer = Number.isInteger(activeIndex) ? liveState?.players?.[activeIndex] : null;
      if (liveState?.status !== 'PLAYING' || !activeSeat?.stoolPosition) {
        turnCameraTowardTarget(cameraDefaultTargetRef.current, { animate: true });
      } else if (activePlayer?.isHuman) {
        turnCameraTowardTarget(cameraDefaultTargetRef.current, { animate: true });
      } else {
        const blendedFocus = cameraDefaultTargetRef.current
          .clone()
          .lerp(activeSeat.focus, CAMERA_PLAYER_TARGET_WEIGHT);
        const sideSign = Math.sign(activeSeat?.stoolPosition?.x ?? 0);
        if (sideSign !== 0) {
          blendedFocus.x += sideSign * CAMERA_SIDE_LOOK_EXTRA;
        }
        turnCameraTowardTarget(blendedFocus, { animate: true });
      }
      cameraPlayFollowTimeoutRef.current = null;
    }, CAMERA_PLAY_FOLLOW_HOLD_MS + CAMERA_PLAY_NEXT_TURN_DELAY_MS);

    return () => {
      clearCameraPlayFollowTimeout();
      clearCameraPlayCardFocusTimeout();
      stopCameraPlayTrackAnimation();
    };
  }, [
    clearCameraPlayCardFocusTimeout,
    clearCameraPlayFollowTimeout,
    clearCameraTurnHoldTimeout,
    gameState?.lastAction,
    gameState?.lastActionId,
    stopCameraPlayTrackAnimation,
    threeReady,
    turnCameraTowardTarget
  ]);

  useEffect(() => {
    if (!threeReady) return;
    const lastActionId = gameState?.lastActionId ?? 0;
    if (!lastActionId || characterActionRef.current.lastActionId === lastActionId) return;
    characterActionRef.current.lastActionId = lastActionId;

    const action = gameState?.lastAction;
    if (!action || !Number.isInteger(action.playerIndex)) return;
    const store = threeStateRef.current;
    const rig = store.characterRigs?.get(action.playerIndex);
    if (!rig) return;
    runCharacterAction(store, rig, action);
  }, [gameState?.lastAction, gameState?.lastActionId, threeReady]);

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist appearance', error);
      }
    }
    const previous = threeStateRef.current.appearance;
    const cardChanged = previous?.cards !== appearance.cards;
    updateSceneAppearance(appearance, { refreshCards: cardChanged });
  }, [appearance, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateSceneAppearance(appearanceRef.current, { refreshCards: true });
  }, [threeReady, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateScoreboardDisplay(uiState.scoreboard);
  }, [threeReady, uiState.scoreboard, updateScoreboardDisplay]);

  const toggleSelection = useCallback((cardId) => {
    setSelectedIds((prev) => {
      if (!humanTurnRef.current) return prev;
      const human = gameStateRef.current.players.find((p) => p.isHuman);
      if (!human || !human.hand.some((card) => card.id === cardId)) return prev;
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let observer = null;
    let frameId = null;
    let dom = null;
    let cardGeometry = null;
    let arenaGroup = null;
    let handlePointerDown = null;
    let disposed = false;
    let lastRenderTime = performance.now();

    const setup = async () => {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      applyRendererSRGB(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.85;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      mount.appendChild(renderer.domElement);
      dom = renderer.domElement;
      threeStateRef.current.renderer = renderer;
      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin?.('anonymous');
      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
      const fallbackTexture = textureLoader.load(
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/uv_grid_opengl.jpg'
      );
      applySRGBColorSpace(fallbackTexture);
      fallbackTexture.wrapS = THREE.RepeatWrapping;
      fallbackTexture.wrapT = THREE.RepeatWrapping;
      fallbackTexture.repeat.set(1.6, 1.6);
      fallbackTexture.anisotropy = maxAnisotropy;
      threeStateRef.current.textureLoader = textureLoader;
      threeStateRef.current.textureCache = new Map();
      threeStateRef.current.maxAnisotropy = maxAnisotropy;
      threeStateRef.current.fallbackTexture = fallbackTexture;
      applyRendererQuality();

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#030712');

      const ambient = new THREE.AmbientLight(0xffffff, 0.35);
      scene.add(ambient);

      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(6, 8, 5);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffffff, 0.65);
      fill.position.set(-5, 5.5, 3);
      scene.add(fill);

      const rim = new THREE.DirectionalLight(0xffffff, 0.9);
      rim.position.set(0, 6, -6);
      scene.add(rim);

      const spot = new THREE.SpotLight(0xffffff, 0.8, 0, Math.PI / 4, 0.35, 1.1);
      spot.position.set(0, 4.2, 4.6);
      scene.add(spot);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
      scene.add(spotTarget);
      spot.target = spotTarget;

      arenaGroup = new THREE.Group();
      scene.add(arenaGroup);

      const currentAppearance = normalizeAppearance(appearanceRef.current);
      const stoolTheme = STOOL_THEMES[currentAppearance.stools] ?? STOOL_THEMES[0];
      const characterTheme = ENABLE_3D_HUMAN_CHARACTERS
      ? MURLAN_CHARACTER_THEMES[currentAppearance.characters] ?? MURLAN_CHARACTER_THEMES[0]
      : null;
      const cardTheme = CARD_THEMES[currentAppearance.cards] ?? CARD_THEMES[0];
      const tableTheme = TABLE_THEMES[currentAppearance.tables] ?? TABLE_THEMES[0];
      const tableShape = TABLE_SHAPE_OPTIONS[currentAppearance.tableShape] ?? TABLE_SHAPE_OPTIONS[DEFAULT_TABLE_SHAPE_INDEX];
      const tableFinish = resolveTableFinish(currentAppearance.tableFinish);
      const tableCloth = resolveTableCloth(currentAppearance.tableCloth);
      const outfitTheme = OUTFIT_THEMES[currentAppearance.outfit] ?? OUTFIT_THEMES[0];
      const environmentVariant = resolveHdriVariant(currentAppearance.environmentHdri);
      hdriVariantRef.current = environmentVariant;

      const arenaScale = 1.18 * ARENA_GROWTH;
      const boardSize = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * arenaScale;
      const camConfig = buildArenaCameraConfig(boardSize);
      const interiorWidth = Math.max(TABLE_RADIUS * ARENA_GROWTH * 3.4, CHAIR_RADIUS * 2 + 4 * MODEL_SCALE)
        * HDRI_WALL_DISTANCE_MULTIPLIER;
      const interiorDepth = interiorWidth;
      const innerHalfWidth = interiorWidth / 2;
      const innerHalfDepth = interiorDepth / 2;

      const floorRadius = Math.max(innerHalfWidth, innerHalfDepth) * 1.35;
      const hdriGroundRadius = floorRadius * HDRI_GROUND_FLOOR_RADIUS_MULTIPLIER;
      const hdriGround = new THREE.Mesh(
        new THREE.CircleGeometry(hdriGroundRadius, 96),
        new THREE.ShadowMaterial({
          color: 0x000000,
          opacity: HDRI_GROUND_FLOOR_OPACITY
        })
      );
      hdriGround.rotation.x = -Math.PI / 2;
      hdriGround.position.y = ARENA_GROUND_Y;
      hdriGround.receiveShadow = true;
      hdriGround.renderOrder = -1;
      arenaGroup.add(hdriGround);
      threeStateRef.current.hdriGround = hdriGround;

      const cameraBoundRadius = Math.hypot(innerHalfWidth, innerHalfDepth);
      void applyHdriEnvironment(environmentVariant);

      const scoreboardCanvas = document.createElement('canvas');
      scoreboardCanvas.width = 1024;
      scoreboardCanvas.height = 512;
      const scoreboardContext = scoreboardCanvas.getContext('2d');
      if (scoreboardContext) {
        const scoreboardTexture = new THREE.CanvasTexture(scoreboardCanvas);
        applySRGBColorSpace(scoreboardTexture);
        scoreboardTexture.anisotropy = 8;
        const scoreboardMaterial = new THREE.MeshBasicMaterial({
          map: scoreboardTexture,
          transparent: true,
          toneMapped: false,
          depthWrite: false
        });
        const scoreboardWidth = Math.min(innerHalfWidth * 0.72, 3.45 * MODEL_SCALE);
        const scoreboardHeight = scoreboardWidth * 0.39;
        const scoreboardGeometry = new THREE.PlaneGeometry(scoreboardWidth, scoreboardHeight);
        const scoreboardMesh = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
        const scoreboardY = TABLE_HEIGHT + 1.56 * MODEL_SCALE;
        const scoreboardZ = -Math.max(TABLE_RADIUS * 2.2, floorRadius * 0.72);
        scoreboardMesh.position.set(0, scoreboardY, scoreboardZ);
        scoreboardMesh.lookAt(new THREE.Vector3(0, scoreboardMesh.position.y, 0));
        scoreboardMesh.renderOrder = 2;
        scoreboardMesh.visible = false;
        arenaGroup.add(scoreboardMesh);
        threeStateRef.current.scoreboard = {
          canvas: scoreboardCanvas,
          context: scoreboardContext,
          texture: scoreboardTexture,
          material: scoreboardMaterial,
          geometry: scoreboardGeometry,
          mesh: scoreboardMesh
        };
      } else {
        threeStateRef.current.scoreboard = null;
      }

      updateScoreboardDisplay(computeUiState(gameStateRef.current).scoreboard);

      await rebuildTable(tableTheme, tableFinish, tableCloth, tableShape);
      if (disposed) return;

      const chairBuild = await buildChairTemplate(stoolTheme, renderer, {
        textureLoader,
        maxAnisotropy,
        fallbackTexture,
        textureCache: threeStateRef.current.textureCache,
        preferredTextureSizes: activeTextureResolutionOrder
      });
      if (disposed) return;
      const chairTemplate = chairBuild.chairTemplate;
      threeStateRef.current.chairTemplate = chairTemplate;
      threeStateRef.current.chairMaterials = chairBuild.materials;
      threeStateRef.current.chairThemePreserve =
        chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(stoolTheme);
      threeStateRef.current.chairThemeId = stoolTheme.id;
      applyChairThemeMaterials(threeStateRef.current, stoolTheme);

      const chairRadius = CHAIR_RADIUS;
      const activeTableRadius = threeStateRef.current.tableInfo?.radius ?? TABLE_RADIUS;
      const seatThickness = SEAT_THICKNESS;

      cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D, {
        rounded: true,
        cornerRadiusRatio: 0.31,
        segments: 14
      });

      const seatConfigs = [];
      threeStateRef.current.chairInstances = [];

      for (let i = 0; i < CHAIR_COUNT; i++) {
        const player = players[i] ?? null;
        const chair = new THREE.Group();
        chair.scale.set(
          CHAIR_VISUAL_SCALE,
          CHAIR_VISUAL_SCALE * 1.08,
          CHAIR_VISUAL_SCALE
        );
        const chairModel = chairTemplate.clone(true);
        chair.add(chairModel);
        chairModel.scale.y *= CHAIR_HEIGHT_TRIM_SCALE;
        chair.userData.chairModel = chairModel;
        threeStateRef.current.chairInstances.push(chair);

        const angle = CUSTOM_SEAT_ANGLES[i] ?? Math.PI / 2 - (i / CHAIR_COUNT) * Math.PI * 2;
        const isHumanSeat = Boolean(player?.isHuman);
        const seatRadius =
          (isHumanSeat
            ? AI_CHAIR_RADIUS + HUMAN_CHAIR_EXTRA_OUTWARD_OFFSET
            : AI_CHAIR_RADIUS) * CHAIR_SEAT_INWARD_FACTOR;
        const x = Math.cos(angle) * seatRadius * TABLE_HORIZONTAL_SHRINK;
        const z = Math.sin(angle) * seatRadius;
        const chairBaseHeight = CHAIR_BASE_HEIGHT - 0.04 * MODEL_SCALE;
        chair.position.set(x, chairBaseHeight, z);
        groundObjectToY(chair, ARENA_GROUND_Y);
        chair.position.y -= CHAIR_GROUND_DROP + CHAIR_SCREEN_LOWER_OFFSET;
        chair.lookAt(new THREE.Vector3(0, chair.position.y, 0));
        arenaGroup.add(chair);

        const forward = new THREE.Vector3(x, 0, z).normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        const isTopSeatOnScreen = forward.z < -0.45;
        const isSideSeatOnScreen = !isHumanSeat && Math.abs(forward.x) > 0.45;
        const aiSeatSpacingMultiplier = isSideSeatOnScreen
          ? SIDE_AI_HAND_CARD_SPACING_MULTIPLIER
          : isTopSeatOnScreen
            ? TOP_AI_HAND_CARD_SPACING_MULTIPLIER
            : 1;
        const aiSeatMaxSpreadMultiplier = isSideSeatOnScreen
          ? SIDE_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER
          : isTopSeatOnScreen
            ? TOP_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER
            : 1;
        const focus = forward
          .clone()
          .multiplyScalar(seatRadius - (isHumanSeat ? 1.05 * MODEL_SCALE : 0.65 * MODEL_SCALE));
        focus.y = TABLE_HEIGHT + CARD_H * (isHumanSeat ? 0.72 : 0.55);
        const stoolPosition = forward.clone().multiplyScalar(seatRadius);
        stoolPosition.y = chair.position.y + SEAT_THICKNESS / 2;
        const stoolHeight = stoolPosition.y + SEAT_THICKNESS / 2;
        seatConfigs.push({
          seatIndex: i,
          chair,
          forward,
          right,
          focus,
          // Use the same table-relative hand-card radius for every seat so
          // opponent cards land in the matching in-hands pocket used by the
          // bottom human player; spacing/max spread still keep each hand layout.
          radius: resolveSeatHandRadius(activeTableRadius, true),
          spacing: isHumanSeat ? HUMAN_HAND_CARD_SPACING : AI_HAND_CARD_SPACING * aiSeatSpacingMultiplier,
          maxSpread: isHumanSeat ? HUMAN_HAND_CARD_MAX_SPREAD : AI_HAND_CARD_MAX_SPREAD * aiSeatMaxSpreadMultiplier,
          stoolPosition,
          stoolHeight,
          handVariant: isSideSeatOnScreen ? 'side' : isTopSeatOnScreen ? 'top' : 'default'
        });

      }

      const humanSeatIndex = players.findIndex((player) => player?.isHuman);
      const humanSeatConfig = humanSeatIndex >= 0 ? seatConfigs[humanSeatIndex] : null;

      let initialCharacterRoster = [];
      if (ENABLE_3D_HUMAN_CHARACTERS && characterTheme) {
        try {
          initialCharacterRoster = buildSeatCharacterThemeRoster(
            characterTheme,
            players,
            humanSeatIndex >= 0 ? humanSeatIndex : 0,
            gameStateRef.current?.characterRosterSeed ?? characterRosterSeedRef.current
          );
          const uniqueThemes = [...new Map(initialCharacterRoster.map((theme) => [theme?.id, theme])).values()].filter(Boolean);
          const templateEntries = await Promise.all(uniqueThemes.map(async (theme) => {
            try {
              return [theme.id, await loadCharacterModel(theme, renderer)];
            } catch (error) {
              console.warn('Failed to load initial character theme', theme?.id, error);
              return [theme.id, null];
            }
          }));
          const templatesById = new Map(templateEntries.filter(([, template]) => template));
          if (!templatesById.size) {
            throw new Error('No initial character templates loaded');
          }
          const loadedFallbackThemes = initialCharacterRoster.filter((theme) => theme?.id && templatesById.has(theme.id));
          for (let i = 0; i < seatConfigs.length; i++) {
            const seatConfig = seatConfigs[i];
            const player = players[i] ?? null;
            const seatTheme = initialCharacterRoster[i] || characterTheme;
            const resolvedSeatTheme = resolveLoadedSeatCharacterTheme({
              seatTheme,
              selectedTheme: characterTheme,
              templatesById,
              fallbackThemes: loadedFallbackThemes,
              player,
              seatIndex: i,
              humanSeatIndex: humanSeatIndex >= 0 ? humanSeatIndex : 0
            });
            if (!resolvedSeatTheme?.template) continue;
            attachSeatedCharacter({
              template: resolvedSeatTheme.template,
              seatConfig,
              characterTheme: resolvedSeatTheme.theme,
              store: threeStateRef.current,
              player,
              playerIndex: i,
              cardTheme,
              cardTextureSize: cardTextureQualityRef.current
            });
          }
        } catch (error) {
          console.warn('Failed to place initial player characters', error);
        }
      }

      threeStateRef.current.outfitParts = [];
      threeStateRef.current.appearance = { ...currentAppearance };
      threeStateRef.current.characterThemeId = ENABLE_3D_HUMAN_CHARACTERS && characterTheme ? characterThemeRosterSignature(initialCharacterRoster) : null;

      spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
      spot.target.updateMatrixWorld();

      const isPortrait = mount.clientHeight > mount.clientWidth;
      camera = new THREE.PerspectiveCamera(
        camConfig.fov,
        mount.clientWidth / mount.clientHeight,
        camConfig.near,
        camConfig.far
      );
      const targetScreenDownShift = isPortrait
        ? CAMERA_SCREEN_DOWN_SHIFT.portrait
        : CAMERA_SCREEN_DOWN_SHIFT.landscape;
      const targetHeightOffset = CAMERA_TARGET_LIFT + 0.03 * MODEL_SCALE + targetScreenDownShift;
      let target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset, 0);
      let initialCameraPosition;
      if (humanSeatConfig) {
        const humanSeatAngle = Math.atan2(humanSeatConfig.forward.z, humanSeatConfig.forward.x);
        const stoolAnchor = humanSeatConfig.stoolPosition?.clone() ??
          new THREE.Vector3(
            Math.cos(humanSeatAngle) * chairRadius,
            TABLE_HEIGHT,
            Math.sin(humanSeatAngle) * chairRadius
          );
        const stoolHeight = humanSeatConfig.stoolHeight ?? TABLE_HEIGHT + seatThickness / 2;
        const retreatOffset = isPortrait
          ? CAMERA_SEATED_RETREAT_OFFSETS.portrait
          : CAMERA_SEATED_RETREAT_OFFSETS.landscape;
        const lateralOffset = isPortrait
          ? CAMERA_SEATED_LATERAL_OFFSETS.portrait
          : CAMERA_SEATED_LATERAL_OFFSETS.landscape;
        const elevation = isPortrait
          ? CAMERA_SEATED_ELEVATION_OFFSETS.portrait
          : CAMERA_SEATED_ELEVATION_OFFSETS.landscape;
        initialCameraPosition = stoolAnchor
          .addScaledVector(humanSeatConfig.forward, -retreatOffset)
          .addScaledVector(humanSeatConfig.right, lateralOffset);
        initialCameraPosition.y = stoolHeight + elevation;
        target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset + CAMERA_FOCUS_CENTER_LIFT, 0)
          .addScaledVector(humanSeatConfig.forward, -CAMERA_TARGET_TOP_PLAYER_BIAS);
      } else {
        const humanSeatAngle = Math.PI / 2;
        const cameraBackOffset = isPortrait ? 2.05 : 1.18;
        const cameraForwardOffset = isPortrait ? 0.18 : 0.35;
        const cameraHeightOffset = isPortrait ? 1.06 : 0.88;
        initialCameraPosition = new THREE.Vector3(
          Math.cos(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset),
          TABLE_HEIGHT + cameraHeightOffset,
          Math.sin(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset)
        );
      }
      const initialOffset = initialCameraPosition.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(initialOffset);
      const safeHorizontalReach = Math.max(2.6 * MODEL_SCALE, cameraBoundRadius);
      const maxOrbitRadius = Math.max(3.6 * MODEL_SCALE, safeHorizontalReach / Math.sin(ARENA_CAMERA_DEFAULTS.phiMax));
      const minOrbitRadius = Math.max(2.4 * MODEL_SCALE, maxOrbitRadius * 0.58);
      const desiredRadius = Math.min(maxOrbitRadius, minOrbitRadius * 1.1) * CAMERA_INWARD_RADIUS_FACTOR * 0.86;
      spherical.radius = desiredRadius;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        ARENA_CAMERA_DEFAULTS.phiMin,
        ARENA_CAMERA_DEFAULTS.phiMax
      );
      const nextPosition = new THREE.Vector3().setFromSpherical(spherical).add(target);
      camera.position.copy(nextPosition);
      camera.lookAt(target);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableRotate = true;
      controls.minPolarAngle = ARENA_CAMERA_DEFAULTS.phiMin;
      controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
      const cameraOffset = camera.position.clone().sub(target);
      const cameraSpherical = new THREE.Spherical().setFromVector3(cameraOffset);
      const horizontalSwing = THREE.MathUtils.degToRad(isPortrait ? 32 : 27);
      const lockedPolarAngle = THREE.MathUtils.clamp(
        cameraSpherical.phi,
        ARENA_CAMERA_DEFAULTS.phiMin,
        ARENA_CAMERA_DEFAULTS.phiMax
      );
      const verticalAllowance = isPortrait
        ? CAMERA_LOOK_VERTICAL_ALLOWANCE.portrait
        : CAMERA_LOOK_VERTICAL_ALLOWANCE.landscape;
      controls.minPolarAngle = THREE.MathUtils.clamp(
        lockedPolarAngle - verticalAllowance.up,
        ARENA_CAMERA_DEFAULTS.phiMin,
        ARENA_CAMERA_DEFAULTS.phiMax
      );
      controls.maxPolarAngle = THREE.MathUtils.clamp(
        lockedPolarAngle + verticalAllowance.down,
        ARENA_CAMERA_DEFAULTS.phiMin,
        ARENA_CAMERA_DEFAULTS.phiMax
      );
      controls.minAzimuthAngle = cameraSpherical.theta - horizontalSwing;
      controls.maxAzimuthAngle = cameraSpherical.theta + horizontalSwing;
      controls.minDistance = desiredRadius;
      controls.maxDistance = desiredRadius;
      controls.rotateSpeed = 0.68;
      controls.target.copy(target);
      controls.update();
      cameraLockedPositionRef.current.copy(camera.position);
      cameraLockedBasePositionRef.current.copy(camera.position);
      cameraOrbitSphericalRef.current = {
        phi: cameraSpherical.phi,
        phiMin: controls.minPolarAngle,
        phiMax: controls.maxPolarAngle
      };
      cameraDefaultTargetRef.current.copy(target);
      const lookVector = controls.target.clone().sub(camera.position);
      const targetDistance = Math.max(0.1, lookVector.length());
      const direction = lookVector.normalize();
      cameraLookBasisRef.current = {
        position: camera.position.clone(),
        direction,
        targetDistance
      };

      const resize = () => {
        applyRendererQuality();
        const { clientWidth, clientHeight } = mount;
        const aspect = clientHeight > 0 ? clientWidth / clientHeight : 1;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        updateSeatAnchors();
      };

      observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      const stepAnimations = (time) => {
        const store = threeStateRef.current;
        const list = store.animations;
        if (list?.length) {
          store.animations = list.filter((anim) => {
            if (anim.cancelled) return false;
            const progress = (time - anim.start) / anim.duration;
            if (progress <= 0) {
              anim.mesh.position.copy(anim.from);
              orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
              return true;
            }
            const clampedProgress = Math.min(1, progress);
            const eased = easeOutCubic(clampedProgress);
            if (anim.preLift > 0) {
              const liftCutoff = anim.preLiftPortion ?? 0.3;
              if (clampedProgress < liftCutoff) {
                const liftT = easeOutCubic(clampedProgress / liftCutoff);
                anim.mesh.position.lerpVectors(
                  anim.from,
                  anim.from.clone().add(new THREE.Vector3(0, anim.preLift, 0)),
                  liftT
                );
              } else {
                const moveT = easeOutCubic((clampedProgress - liftCutoff) / Math.max(1e-6, 1 - liftCutoff));
                const liftedFrom = anim.from.clone().add(new THREE.Vector3(0, anim.preLift, 0));
                anim.mesh.position.lerpVectors(liftedFrom, anim.to, moveT);
              }
            } else {
              anim.mesh.position.lerpVectors(anim.from, anim.to, eased);
            }
            if (anim.liftArc > 0) {
              anim.mesh.position.y += Math.sin(clampedProgress * Math.PI) * anim.liftArc;
            }
            if (anim.settleSlide > 0) {
              const settlePortion = anim.settlePortion ?? 0.16;
              const settleStart = Math.max(0, 1 - settlePortion);
              if (clampedProgress >= settleStart) {
                const settleT = easeInOutCubic((clampedProgress - settleStart) / Math.max(1e-6, settlePortion));
                const slideDirection = anim.to.clone().sub(anim.from).setY(0);
                if (slideDirection.lengthSq() > 1e-6) {
                  slideDirection.normalize();
                  anim.mesh.position.addScaledVector(slideDirection, (1 - settleT) * anim.settleSlide);
                }
                anim.mesh.position.y -= Math.sin(settleT * Math.PI) * 0.006 * MODEL_SCALE;
              }
            }
            orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
            if (clampedProgress >= 1) {
              anim.mesh.position.copy(anim.to);
              orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
              anim.mesh.userData.animation = null;
              return false;
            }
            return true;
          });
        }
        stepCharacterActions(store, time);
        updateRigContactHelpers(store);
      };

      const animate = (time) => {
        const frameTiming = frameTimingRef.current;
        const targetFrameTime = frameTiming?.targetMs ?? 1000 / 60;
        const maxFrameTime =
          frameTiming?.maxMs ?? targetFrameTime * FRAME_TIME_CATCH_UP_MULTIPLIER;
        const delta = time - lastRenderTime;
        if (delta >= targetFrameTime - 0.5) {
          const appliedDelta = Math.min(delta, maxFrameTime);
          lastRenderTime = time - Math.max(0, delta - appliedDelta);
          stepAnimations(time);
          controls.update();
          enforceRotationOnlyCamera();
          updateSeatAnchors();
          renderer.render(scene, camera);
        }
        frameId = requestAnimationFrame(animate);
      };

      frameId = requestAnimationFrame(animate);

      threeStateRef.current.renderer = renderer;
      threeStateRef.current.scene = scene;
      threeStateRef.current.camera = camera;
      threeStateRef.current.controls = controls;
      threeStateRef.current.arena = arenaGroup;
      threeStateRef.current.cardGeometry = cardGeometry;
      threeStateRef.current.seatConfigs = seatConfigs;

      ensureCardMeshes(gameStateRef.current);
      applyStateToScene(gameStateRef.current, selectedRef.current, false);
      updateSeatAnchors();
      setThreeReady(true);

      handlePointerDown = (event) => {
        if (!humanTurnRef.current) return;
        const rect = dom.getBoundingClientRect();
        const cardId = pickMostPreciseCardAtPointer({
          event,
          rect,
          camera,
          selectionTargets: threeStateRef.current.selectionTargets,
          raycaster: threeStateRef.current.raycaster
        });
        if (cardId) toggleSelection(cardId);
      };
      dom.addEventListener('pointerdown', handlePointerDown);
    };

    setup().catch((error) => console.error('Failed to set up Murlan Royale arena', error));

    return () => {
      disposed = true;
      const store = threeStateRef.current;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      clearCameraPlayFollowTimeout();
      clearCameraPlayCardFocusTimeout();
      stopCameraPlayTrackAnimation();
      stopCameraTurnAnimation();
      observer?.disconnect?.();
      controls?.dispose?.();
      disposeEnvironmentRef.current?.();
      envTextureRef.current = null;
      if (dom && handlePointerDown) {
        dom.removeEventListener('pointerdown', handlePointerDown);
      }
      if (mount && dom && dom.parentElement === mount) {
        mount.removeChild(dom);
      }
      renderer?.dispose?.();
      cardGeometry?.dispose?.();
      store.cardMap.forEach(({ mesh }) => {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const mats = new Set(list.filter(Boolean));
        const { frontMaterial, backMaterial, hiddenMaterial } = mesh.userData ?? {};
        [frontMaterial, backMaterial, hiddenMaterial].forEach((mat) => {
          if (mat) mats.add(mat);
        });
        mats.forEach((mat) => {
          if (typeof mat.dispose === 'function') {
            mat.dispose();
          }
        });
        arenaGroup?.remove(mesh);
      });
      store.faceTextureCache.forEach((tex) => tex.dispose());
      if (store.scoreboard) {
        const { mesh, geometry, material, texture } = store.scoreboard;
        if (mesh?.parent) {
          mesh.parent.remove(mesh);
        }
        geometry?.dispose?.();
        material?.dispose?.();
        texture?.dispose?.();
        store.scoreboard = null;
      }
      if (store.hdriGround) {
        if (store.hdriGround.parent) {
          store.hdriGround.parent.remove(store.hdriGround);
        }
        store.hdriGround.geometry?.dispose?.();
        store.hdriGround.material?.dispose?.();
        store.hdriGround = null;
      }
      if (store.tableInfo) {
        store.tableInfo.dispose?.();
        store.tableInfo = null;
      }
      if (store.chairMaterials) {
        const mats = new Set([
          store.chairMaterials.seat,
          store.chairMaterials.leg,
          ...(store.chairMaterials.upholstery ?? []),
          ...(store.chairMaterials.metal ?? [])
        ]);
        mats.forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }
      if (store.chairTemplate) {
        store.chairTemplate.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose?.();
          }
        });
        store.chairTemplate = null;
      }
      if (store.chairInstances?.length) {
        store.chairInstances.forEach((group) => {
          const model = group?.userData?.chairModel;
          if (model) {
            disposeObjectResources(model);
            group.remove(model);
          }
        });
        store.chairInstances = [];
      }
      if (store.characterInstances?.length) {
        store.characterInstances.forEach((instance) => {
          instance?.userData?.dispose?.();
          if (instance?.parent) instance.parent.remove(instance);
          disposeObjectResources(instance);
        });
        store.characterInstances = [];
        store.characterRigs = new Map();
        store.characterActionAnimations = [];
      }
      if (store.decorGroup) {
        disposeObjectResources(store.decorGroup);
        if (store.decorGroup.parent) {
          store.decorGroup.parent.remove(store.decorGroup);
        }
        store.decorGroup = null;
        store.decorPlants = [];
      }
      if (store.outfitParts) {
        store.outfitParts.forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }
      if (store.textureCache) {
        store.textureCache.forEach((promise) => {
          Promise.resolve(promise).then((set) => {
            if (set) {
              [set.diffuse, set.normal, set.roughness].forEach((tex) => tex?.dispose?.());
            }
          });
        });
        store.textureCache.clear();
      }
      store.fallbackTexture?.dispose?.();
      threeStateRef.current = {
        renderer: null,
        scene: null,
        camera: null,
        controls: null,
        textureLoader: null,
        textureCache: new Map(),
        maxAnisotropy: 1,
        fallbackTexture: null,
        arena: null,
        cardGeometry: null,
        cardMap: new Map(),
        faceTextureCache: new Map(),
        seatConfigs: [],
        selectionTargets: [],
        animations: [],
        raycaster: new THREE.Raycaster(),
        tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, TABLE_CARD_AREA_FORWARD_SHIFT),
        discardAnchor: new THREE.Vector3(
          DISCARD_PILE_OFFSET.x,
          TABLE_HEIGHT + DISCARD_PILE_OFFSET.y,
          DISCARD_PILE_OFFSET.z + TABLE_CARD_AREA_FORWARD_SHIFT
        ),
        scoreboard: null,
        hdriGround: null,
        tableInfo: null,
        tableThemeId: null,
        tableShapeId: null,
        tableClothId: null,
        tableFinishId: null,
        chairMaterials: null,
        chairTemplate: null,
        chairThemePreserve: false,
        chairThemeId: null,
        chairInstances: [],
        characterThemeId: null,
        characterInstances: [],
        characterRigs: new Map(),
        characterActionAnimations: [],
        cardActionAnimationStyle: cardActionAnimationRef.current,
        decorPlants: [],
        decorGroup: null,
        outfitParts: [],
        cardThemeId: '',
        cardTextureQualityId: resolveCardTextureSize(DEFAULT_FRAME_RATE_OPTION).id,
        appearance: { ...DEFAULT_APPEARANCE }
      };
      setThreeReady(false);
      setSeatAnchors([]);
    };
  }, [activeTextureResolutionOrder, applyHdriEnvironment, applyRendererQuality, applyStateToScene, clearCameraPlayCardFocusTimeout, clearCameraPlayFollowTimeout, enforceRotationOnlyCamera, ensureCardMeshes, players, rebuildTable, stopCameraPlayTrackAnimation, stopCameraTurnAnimation, toggleSelection, updateScoreboardDisplay, updateSeatAnchors]);

  useEffect(() => {
    if (!threeReady) return;
    const state = gameState;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || active.isHuman) return;
    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (prev.status !== 'PLAYING') return prev;
        const current = prev.players[prev.activePlayer];
        if (!current || current.isHuman) return prev;
        return runAiTurn(prev);
      });
    }, AI_TURN_DELAY);
    return () => clearTimeout(timer);
  }, [gameState, threeReady]);

  const handlePlay = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    const selectedCards = extractSelectedCards(active.hand, selectedRef.current);
    if (!selectedCards.length) {
      setActionError('Select at least one card.');
      return;
    }
    const combo = detectCombo(selectedCards, GAME_CONFIG);
    if (!combo) {
      setActionError('The combination is not valid.');
      return;
    }
    const includesStart = selectedCards.some(
      (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
    );
    if (state.firstMove && !includesStart) {
      setActionError('The first move must include the 3♠.');
      return;
    }
    if (!canBeat(combo, state.tableCombo, GAME_CONFIG)) {
      setActionError('This combo does not beat the one on the table.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPlayState(state, selectedCards, combo));
  }, []);

  const handlePass = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    if (!state.tableCombo) {
      setActionError('You cannot pass without a combo on the table.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPassState(state));
  }, []);

  const handleClear = useCallback(() => {
    setSelectedIds([]);
    setActionError('');
  }, []);

  const humanPlayer = gameState.players.find((player) => player.isHuman) ?? null;
  const topSeatIndex = useMemo(() => {
    let bestIndex = -1;
    let bestY = Number.POSITIVE_INFINITY;
    players.forEach((_, idx) => {
      if (idx === humanPlayerIndex) return;
      const anchor = seatAnchorMap.get(idx);
      const fallback = FALLBACK_SEAT_POSITIONS[idx % FALLBACK_SEAT_POSITIONS.length];
      const y = anchor?.y ?? Number.parseFloat(fallback.top);
      if (Number.isFinite(y) && y < bestY) {
        bestY = y;
        bestIndex = idx;
      }
    });
    return bestIndex;
  }, [humanPlayerIndex, players, seatAnchorMap]);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none flex h-full flex-col">
        {uiState.scoreboard?.length ? (
          <div className="sr-only" aria-live="polite">
            <p>Current score:</p>
            <ul>
              {uiState.scoreboard.map((entry) => (
                <li key={entry.id}>
                  {entry.name}
                  {entry.isActive ? ' (turn)' : ''}
                  {entry.finished ? ' - finished the game' : ` - ${entry.cardsLeft} cards`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="absolute inset-0 pointer-events-none">
          {players.map((player, idx) => {
            const activePlayer = gameState.players?.[idx] ?? player;
            const anchor = seatAnchorMap.get(idx);
            const fallback = FALLBACK_SEAT_POSITIONS[idx % FALLBACK_SEAT_POSITIONS.length];
            const isSideSeat = idx !== humanPlayerIndex && idx !== topSeatIndex;
            const sideSeatTopLift = (isSideSeat ? 9.1 : 5.9) + NON_HUMAN_SEAT_AVATAR_UP_LIFT;
            const topSeatLift = idx === topSeatIndex ? TOP_SEAT_AVATAR_UP_LIFT : 0;
            const positionStyle = idx === humanPlayerIndex
              ? {
                  position: 'fixed',
                  left: '50%',
                  bottom: HUMAN_AVATAR_BOTTOM_OFFSET,
                  transform: 'translateX(-50%)',
                  zIndex: 24
                }
              : anchor
                ? {
                    position: 'absolute',
                    left: `${anchor.x}%`,
                    top: `${clampValue(anchor.y - sideSeatTopLift - topSeatLift, -10, 110)}%`,
                    transform: 'translate(-50%, -50%)'
                  }
                : {
                    position: 'absolute',
                    left: fallback.left,
                    top: `${clampValue(Number.parseFloat(fallback.top) - sideSeatTopLift - topSeatLift, -10, 110)}%`,
                    transform: 'translate(-50%, -50%)'
                  };
            const avatarSizeBase = anchor ? clampValue(1.25 - (anchor.depth - 2.4) * 0.12, 0.85, 1.25) : 1;
            const avatarSize = avatarSizeBase * AVATAR_VISUAL_SCALE;
            const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
            const isTurn = gameState.activePlayer === idx;
            return (
              <div
                key={activePlayer?.id ?? idx}
                className="absolute pointer-events-auto flex flex-col items-center gap-1"
                style={positionStyle}
                data-self-player={idx === humanPlayerIndex ? 'true' : 'false'}
              >
                <AvatarTimer
                  index={idx}
                  photoUrl={activePlayer?.avatar}
                  active={isTurn && idx !== humanPlayerIndex}
                  isTurn={isTurn}
                  timerPct={1}
                  name={activePlayer?.name}
                  color={color}
                  size={avatarSize}
                  frameScale={(idx === humanPlayerIndex ? 2 : 1) * AVATAR_VISUAL_SCALE}
                  onClick={idx === humanPlayerIndex ? triggerLiveAvatarVideo : undefined}
                />
              </div>
            );
          })}
          {passBubbles.map((bubble) => {
            const idx = bubble.playerIndex;
            const anchor = seatAnchorMap.get(idx);
            const fallback = FALLBACK_SEAT_POSITIONS[idx % FALLBACK_SEAT_POSITIONS.length];
            const isHumanBubble = idx === humanPlayerIndex;
            const style = isHumanBubble
              ? {
                  position: 'fixed',
                  left: '50%',
                  bottom: 'calc(8.2rem + env(safe-area-inset-bottom, 0px))',
                  transform: 'translateX(-50%)'
                }
              : anchor
                ? {
                    position: 'absolute',
                    left: `${anchor.x}%`,
                    top: `${clampValue(anchor.y - 15.5, -10, 110)}%`,
                    transform: 'translate(-50%, -50%)'
                  }
                : {
                    position: 'absolute',
                    left: fallback.left,
                    top: `${clampValue(Number.parseFloat(fallback.top) - 15.5, -10, 110)}%`,
                    transform: 'translate(-50%, -50%)'
                  };
            return (
              <div
                key={bubble.id}
                className="absolute rounded-full border border-red-300/75 bg-gradient-to-r from-red-700/95 via-red-600/95 to-red-500/95 px-3 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_10px_24px_rgba(239,68,68,0.5)] animate-[ping_1.2s_ease-out_1]"
                style={style}
              >
                PASS
              </div>
            );
          })}
        </div>
        <div
          className="absolute z-30 pointer-events-auto"
          style={{
            top: 'calc(5.9rem + env(safe-area-inset-top, 0px))',
            left: 'calc(0.35rem + env(safe-area-inset-left, 0px))'
          }}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setConfigOpen((prev) => !prev)}
              aria-label={configOpen ? 'Close game settings menu' : 'Open game settings menu'}
              aria-expanded={configOpen}
              className={`flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                configOpen ? 'border-white/30 text-white' : ''
              }`}
            >
              <span className="text-base leading-none">☰</span>
              <span className="leading-none">Menu</span>
            </button>
            {configOpen && (
              <div className="absolute left-0 pointer-events-auto mt-2 w-72 max-w-[80vw] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur pr-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</p>
                    <p className="mt-1 text-[0.7rem] text-white/70">
                      Personalize the Murlan Royale table, chairs, and cards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigOpen(false)}
                    className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    aria-label="Close customization"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-sky-300/20 bg-sky-400/10 p-3 space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-sky-100">Card Action Animation</p>
                      <p className="mt-1 text-[0.7rem] text-white/65">
                        Active: {activeCardActionAnimation.label}. Choose how characters pick, carry, and place cards.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {CARD_ACTION_ANIMATION_OPTIONS.map((option) => {
                        const active = option.id === cardActionAnimationId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setCardActionAnimationId(option.id)}
                            aria-pressed={active}
                            className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              active
                                ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                            }`}
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">{option.label}</span>
                            <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-white/55">
                              {option.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Personalize Arena</p>
                      <p className="mt-1 text-[0.7rem] text-white/60">Table surface, chairs, and cards.</p>
                    </div>
                    <div className="mt-3 space-y-4">
                      {customizationSections.map(({ key, label, options }) => (
                        <div key={key} className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {options.map((option, idx) => {
                              const selected = appearance[key] === idx;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                                  aria-pressed={selected}
                                  className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                    selected
                                      ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                      : 'border-white/10 bg-white/5 hover:border-white/20'
                                  }`}
                                >
                                  {renderPreview(key, option)}
                                  <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Graphics</p>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                        Active: {resolvedHdriResolution.toUpperCase()}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {FRAME_RATE_OPTIONS.map((option) => {
                        const active = option.id === frameRateId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setFrameRateId(option.id)}
                            aria-pressed={active}
                            className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              active
                                ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">{option.label}</span>
                              <span className="text-[11px] font-semibold tracking-wide text-sky-100">
                                {option.resolution ? `${option.resolution} • ${option.fps} FPS` : `${option.fps} FPS`}
                              </span>
                            </span>
                            {option.description ? (
                              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                {option.description}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-auto">
          <BottomLeftIcons
            className="fixed right-4 top-[4.9rem] z-20"
            buttonClassName="flex flex-col items-center bg-transparent p-1 text-white hover:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-300"
            order={['mute']}
            showChat={false}
            showGift={false}
            showInfo={false}
          />
          <BottomLeftIcons
            className="fixed left-4 bottom-[4.8rem] z-20"
            buttonClassName="flex flex-col items-center bg-transparent p-1 text-white hover:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-300"
            iconClassName="text-2xl"
            order={['chat']}
            showGift={false}
            showInfo={false}
            showMute={false}
            onChat={() => setShowChat(true)}
          />
          <BottomLeftIcons
            className="fixed right-4 bottom-[4.8rem] z-20"
            buttonClassName="flex flex-col items-center bg-transparent p-1 text-white hover:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-300"
            iconClassName="text-2xl"
            order={['gift']}
            showChat={false}
            showInfo={false}
            showMute={false}
            onGift={() => setShowGift(true)}
          />
        </div>
        <div className="mt-auto px-3 pb-2 pointer-events-none">
          <div className="mx-auto w-full max-w-2xl pointer-events-auto">
            <div className="fixed bottom-[8.8rem] left-1/2 z-20 flex -translate-x-1/2 flex-nowrap items-center justify-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={handlePass}
                className="rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-red-900/70 disabled:to-red-800/70 disabled:opacity-60 disabled:shadow-none"
                disabled={!uiState.humanTurn || !gameState.tableCombo}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-amber-300/60 disabled:to-amber-400/60 disabled:text-black/60 disabled:shadow-none"
                disabled={!selectedIds.length}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-800/60 disabled:to-green-700/60 disabled:opacity-60 disabled:shadow-none"
                disabled={!uiState.humanTurn || !selectedIds.length}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <div className="pointer-events-auto">
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          onSend={(text) => {
            const id = Date.now();
            setChatBubbles((bubbles) => [...bubbles, { id, text, photoUrl: humanAvatarUrl }]);
            if (!muted) {
              const audio = new Audio(chatBeep);
              audio.volume = getGameVolume();
              audio.play().catch(() => {});
            }
            setTimeout(
              () => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)),
              3000,
            );
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          players={giftPlayers}
          senderIndex={humanPlayerIndex}
          onGiftSent={({ from, to, gift }) => {
            const start = document.querySelector(`[data-player-index="${from}"]`);
            const end = document.querySelector(`[data-player-index="${to}"]`);
            if (start && end) {
              const s = start.getBoundingClientRect();
              const e = end.getBoundingClientRect();
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              let icon;
              if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
                icon = document.createElement('img');
                icon.src = gift.icon;
                icon.className = 'w-5 h-5';
              } else {
                icon = document.createElement('div');
                icon.textContent = gift.icon;
                icon.style.fontSize = '24px';
              }
              icon.style.position = 'fixed';
              icon.style.left = '0px';
              icon.style.top = '0px';
              icon.style.pointerEvents = 'none';
              icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
              icon.style.zIndex = '9999';
              document.body.appendChild(icon);
              const giftSound = giftSounds[gift.id];
              if (gift.id === 'laugh_bomb' && !muted) {
                if (bombSoundRef.current && hahaSoundRef.current) {
                  bombSoundRef.current.currentTime = 0;
                  bombSoundRef.current.play().catch(() => {});
                  hahaSoundRef.current.currentTime = 0;
                  hahaSoundRef.current.play().catch(() => {});
                  setTimeout(() => {
                    hahaSoundRef.current?.pause();
                  }, 5000);
                }
              } else if (gift.id === 'coffee_boost' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.currentTime = 4;
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'baby_chick' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              } else if (gift.id === 'magic_trick' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'fireworks' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 6000);
              } else if (gift.id === 'surprise_box' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 5000);
              } else if (gift.id === 'bullseye' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                setTimeout(() => {
                  audio.play().catch(() => {});
                }, 2500);
              } else if (giftSound && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              }
              const animation = icon.animate(
                [
                  { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                  { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                  { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` },
                ],
                { duration: 3500, easing: 'linear' },
              );
              animation.onfinish = () => icon.remove();
            }
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <InfoPopup
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title="Murlan Royale"
          info="Play valid combos (singles, pairs, trips, straights, flushes, full house, bombs) to beat the current table. The first move must include 3♠. Pass if you cannot beat the combo."
        />
      </div>
    </div>
  );
}

function runAiTurn(state) {
  const active = state.players[state.activePlayer];
  if (!active || active.isHuman) return state;
  const action = aiChooseAction(active.hand, state.tableCombo, GAME_CONFIG);
  if (action.type === 'PLAY' && action.cards?.length) {
    const combo = detectCombo(action.cards, GAME_CONFIG);
    if (combo) {
      const includesStart = action.cards.some(
        (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
      );
      if (!state.firstMove || includesStart) {
        return buildPlayState(state, action.cards, combo);
      }
    }
  }
  if (!state.tableCombo && active.hand.length) {
    const card = active.hand[0];
    const combo = detectCombo([card], GAME_CONFIG);
    if (combo) return buildPlayState(state, [card], combo);
  }
  return buildPassState(state);
}

function buildPlayState(state, cards, combo) {
  const players = state.players.map((player, idx) => {
    if (idx !== state.activePlayer) return { ...player, hand: [...player.hand] };
    const remaining = player.hand.filter((card) => !cards.includes(card));
    return { ...player, hand: remaining, finished: remaining.length === 0 };
  });

  const discardPile = state.tableCards.length
    ? [...state.discardPile, ...state.tableCards]
    : [...state.discardPile];

  const actionId = (state.lastActionId ?? 0) + 1;
  const lastAction = {
    id: actionId,
    type: 'PLAY',
    playerIndex: state.activePlayer,
    combo,
    cards,
    firstMove: state.firstMove
  };
  const aliveCount = players.filter((p) => !p.finished).length;
  const lastWinner = state.activePlayer;
  let tableCombo = combo.type === ComboType.BOMB_4K ? null : combo;
  let tableCards = [...cards];
  let nextActive = getNextAlive(players, state.activePlayer);

  if (combo.type === ComboType.BOMB_4K) {
    tableCombo = null;
    tableCards = [...cards];
    nextActive = players[state.activePlayer].finished
      ? getNextAlive(players, state.activePlayer)
      : lastWinner;
  }

  let status = state.status;
  if (aliveCount <= 1) {
    status = 'ENDED';
    nextActive = state.activePlayer;
    tableCombo = null;
  }

  return {
    ...state,
    players,
    tableCombo,
    tableCards,
    discardPile,
    lastWinner,
    passesInRow: 0,
    firstMove: false,
    activePlayer: nextActive,
    status,
    lastAction,
    lastActionId: actionId
  };
}

function buildPassState(state) {
  const players = state.players;
  const aliveCount = players.filter((p) => !p.finished).length;
  const actionId = (state.lastActionId ?? 0) + 1;
  let passesInRow = state.passesInRow + 1;
  let tableCombo = state.tableCombo;
  let tableCards = state.tableCards;
  let discardPile = state.discardPile;
  let activePlayer = getNextAlive(players, state.activePlayer);
  let tableCleared = false;

  if (tableCombo && passesInRow >= aliveCount - 1) {
    discardPile = tableCards.length ? [...discardPile, ...tableCards] : discardPile;
    tableCombo = null;
    tableCards = [];
    passesInRow = 0;
    tableCleared = true;
    const winner = state.lastWinner ?? state.activePlayer;
    activePlayer = players[winner]?.finished ? getNextAlive(players, winner) : winner;
  }

  return {
    ...state,
    activePlayer,
    passesInRow,
    tableCombo,
    tableCards,
    discardPile,
    lastAction: {
      id: actionId,
      type: 'PASS',
      playerIndex: state.activePlayer,
      tableCleared
    },
    lastActionId: actionId
  };
}

function extractSelectedCards(hand, selectedIds) {
  const idSet = new Set(selectedIds);
  return hand.filter((card) => idSet.has(card.id));
}

function initializeGame(playersInfo) {
  const deck = createDeck();
  shuffleInPlace(deck);
  const hands = dealHands(deck, playersInfo.length);
  const playerStates = playersInfo.map((info, idx) => ({
    ...info,
    hand: sortHand(hands[idx], GAME_CONFIG),
    finished: false
  }));
  const startIdx = playerStates.findIndex((player) =>
    player.hand.some((card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit)
  );
  const active = startIdx === -1 ? 0 : startIdx;
  return {
    players: playerStates,
    activePlayer: active,
    tableCombo: null,
    tableCards: [],
    discardPile: [],
    passesInRow: 0,
    lastWinner: active,
    firstMove: true,
    status: 'PLAYING',
    allCards: deck,
    lastAction: null,
    lastActionId: 0,
    characterRosterSeed: Math.random()
  };
}

function createDeck() {
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `c-${id++}`, rank, suit });
    }
  }
  deck.push({ id: `c-${id++}`, rank: 'JR', suit: '🃏' });
  deck.push({ id: `c-${id++}`, rank: 'JB', suit: '🃏' });
  return deck;
}

function shuffleInPlace(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealHands(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  deck.forEach((card) => {
    hands[idx].push(card);
    idx = (idx + 1) % playerCount;
  });
  return hands;
}

function getNextAlive(players, index) {
  if (!players.length) return 0;
  const { length } = players;
  let next = (index - 1 + length) % length;
  let safety = 0;
  while (players[next]?.finished) {
    next = (next - 1 + length) % length;
    safety += 1;
    if (safety > length) return index;
  }
  return next;
}

function computeUiState(state) {
  const scoreboard = state.players.map((player, idx) => ({
    id: idx,
    name: player.name,
    avatar: player.avatar,
    cardsLeft: player.hand.length,
    finished: player.finished,
    isActive: idx === state.activePlayer,
    isHuman: !!player.isHuman
  }));
  let message = '';
  let tableSummary = '';
  let humanTurn = false;

  if (state.status === 'ENDED') {
    const winners = scoreboard.filter((entry) => entry.finished).map((entry) => entry.name);
    message = winners.length === 1 ? `${winners[0]} emerged victorious!` : `Winners: ${winners.join(', ')}`;
  } else {
    const active = state.players[state.activePlayer];
    if (active) {
      humanTurn = !!active.isHuman;
      if (humanTurn) {
        message = state.firstMove
          ? 'Choose the cards (include 3♠) and press "Play".'
          : state.tableCombo
            ? 'Find a combo that beats the table or press "Pass".'
            : 'Pick your cards and press "Play" to start the trick.';
      } else {
        message = `Waiting for ${active.name}...`;
      }
    }
  }

  if (state.tableCards.length) {
    const description = describeSimpleCombo(state.tableCombo, state.tableCards);
    if (description) {
      const owner = state.lastWinner != null ? state.players[state.lastWinner]?.name : null;
      tableSummary = owner ? `${owner}: ${description}` : description;
    }
  }

  return { scoreboard, message, tableSummary, humanTurn, status: state.status };
}

function describeSimpleCombo(combo, cards) {
  if (!cards?.length) return '';
  const shownCards = cards.slice(0, 5).map((card) => cardLabel(card)).join(' ');
  if (!combo) {
    return shownCards;
  }

  const extra = cards.length > 5 ? ` +${cards.length - 5}` : '';
  switch (combo.type) {
    case ComboType.SINGLE:
      return `Card ${cardLabel(cards[0])}`;
    case ComboType.PAIR:
      return `Pair ${shownCards}${extra}`;
    case ComboType.TRIPS:
      return `Trips ${shownCards}${extra}`;
    case ComboType.BOMB_4K:
      return `Bomb ${shownCards}${extra}`;
    case ComboType.STRAIGHT:
      return `Straight ${shownCards}${extra}`;
    case ComboType.FLUSH:
      return `Flush ${shownCards}${extra}`;
    case ComboType.FULL_HOUSE:
      return `Full house ${shownCards}${extra}`;
    case ComboType.STRAIGHT_FLUSH:
      return `Straight flush ${shownCards}${extra}`;
    default:
      return `${shownCards}${extra}`;
  }
}

function cardLabel(card) {
  if (!card) return '';
  if (card.rank === 'JR' || card.rank === 'JB') return '🃏';
  return `${card.rank}${card.suit || ''}`;
}

function buildPlayers(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const requestedPlayers = Number.parseInt(params.get('players') || '', 10);
  const totalPlayers = Number.isFinite(requestedPlayers)
    ? Math.min(Math.max(requestedPlayers, 2), 4)
    : 4;
  const aiCount = Math.max(totalPlayers - 1, 1);
  const providedFlags = (params.get('flags') || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .map((index) => FLAG_EMOJIS[index])
    .filter(Boolean);
  const seedFlags = providedFlags.length
    ? [...providedFlags]
    : [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const fallbackAiRoster = [
    { name: 'Aria', avatar: '🦊' },
    { name: 'Milo', avatar: '🐻' },
    { name: 'Sora', avatar: '🐱' }
  ];
  const aiPlayers = Array.from({ length: aiCount }, (_, index) => {
    const flag = seedFlags[index];
    if (flag) {
      return { name: flagName(flag), avatar: flag };
    }
    return fallbackAiRoster[index] ?? { name: `Bot ${index + 1}`, avatar: '🤖' };
  });
  const basePlayers = [{ name: username, avatar, isHuman: true }, ...aiPlayers];
  return basePlayers.map((player, index) => ({ ...player, color: PLAYER_COLORS[index % PLAYER_COLORS.length] }));
}

function flagName(flag) {
  if (!flag) return 'Player';
  const base = 0x1f1e6;
  const codePoints = [...flag].map((c) => c.codePointAt(0) - base + 65);
  try {
    const region = String.fromCharCode(...codePoints);
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(region) || `Player ${flag}`;
  } catch (error) {
    return `Player ${flag}`;
  }
}

function flagNameForLocale(flag, languageKey) {
  if (!flag) return '';
  const base = 0x1f1e6;
  const codePoints = [...flag].map((c) => c.codePointAt(0) - base + 65);
  try {
    const region = String.fromCharCode(...codePoints);
    const locale = languageKey && languageKey !== 'en' ? languageKey : 'en';
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return names.of(region) || '';
  } catch (error) {
    return '';
  }
}

function getCommentaryFallbackLabel(kind, languageKey) {
  const localized = COMMENTARY_FALLBACK_LABELS[languageKey];
  return localized?.[kind] || COMMENTARY_FALLBACK_LABELS.en?.[kind] || '';
}

function resolveLocalizedPlayerName(player, index, languageKey) {
  if (!player) {
    const fallback = getCommentaryFallbackLabel('player', languageKey) || 'Player';
    return `${fallback} ${index + 1}`.trim();
  }
  if (player.isHuman) return player.name || `${getCommentaryFallbackLabel('player', languageKey)} ${index + 1}`.trim();
  if (player.avatar) {
    const localizedFlag = flagNameForLocale(player.avatar, languageKey);
    if (localizedFlag) return localizedFlag;
  }
  const translated = AI_NAME_TRANSLATIONS[languageKey]?.[player.name];
  return translated || player.name || `${getCommentaryFallbackLabel('player', languageKey)} ${index + 1}`.trim();
}

function localizedCardLabel(card, languageKey) {
  if (!card) return '';
  if (card.rank === 'JR') {
    if (languageKey === 'zh') return '红色鬼牌';
    if (languageKey === 'hi') return 'लाल जोकर';
    if (languageKey === 'ru') return 'красный джокер';
    if (languageKey === 'es') return 'comodín rojo';
    if (languageKey === 'fr') return 'joker rouge';
    if (languageKey === 'ar') return 'جوكر أحمر';
    if (languageKey === 'sq') return 'xhoker i kuq';
    return 'Red Joker';
  }
  if (card.rank === 'JB') {
    if (languageKey === 'zh') return '黑色鬼牌';
    if (languageKey === 'hi') return 'काला जोकर';
    if (languageKey === 'ru') return 'черный джокер';
    if (languageKey === 'es') return 'comodín negro';
    if (languageKey === 'fr') return 'joker noir';
    if (languageKey === 'ar') return 'جوكر أسود';
    if (languageKey === 'sq') return 'xhoker i zi';
    return 'Black Joker';
  }
  return `${card.rank}`;
}

function describeCommentaryCombo(combo, cards, languageKey) {
  if (!cards?.length) return '';
  const labels = COMMENTARY_COMBO_LABELS[languageKey] || COMMENTARY_COMBO_LABELS.en;
  const cardNames = cards.map((card) => localizedCardLabel(card, languageKey));
  if (!combo) {
    return cardNames.join(' ');
  }
  switch (combo.type) {
    case ComboType.SINGLE:
      return labels.single(cardNames[0]);
    case ComboType.PAIR:
      return labels.pair(combo.keyRank);
    case ComboType.TRIPS:
      return labels.trips(combo.keyRank);
    case ComboType.BOMB_4K:
      return labels.bomb(combo.keyRank);
    case ComboType.STRAIGHT:
      return labels.straight(cardNames[0], cardNames[cardNames.length - 1]);
    case ComboType.FLUSH:
      return labels.flush(cards.length);
    case ComboType.FULL_HOUSE:
      return labels.fullHouse();
    case ComboType.STRAIGHT_FLUSH:
      return labels.straightFlush();
    default:
      return cardNames.join(' ');
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function pickMostPreciseCardAtPointer({
  event,
  rect,
  camera,
  selectionTargets
}) {
  if (!event || !rect || !camera || !Array.isArray(selectionTargets) || !selectionTargets.length) {
    return null;
  }
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  const screenCorners = [];
  const cardPlaneZ = CARD_D * 0.5;
  const localCorners = [
    new THREE.Vector3(-CARD_W / 2, -CARD_H / 2, cardPlaneZ),
    new THREE.Vector3(CARD_W / 2, -CARD_H / 2, cardPlaneZ),
    new THREE.Vector3(CARD_W / 2, CARD_H / 2, cardPlaneZ),
    new THREE.Vector3(-CARD_W / 2, CARD_H / 2, cardPlaneZ)
  ];
  const cross2d = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const isPointInsideQuad = (px, py, quad) => {
    let sign = 0;
    for (let i = 0; i < quad.length; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % quad.length];
      const cross = cross2d(a.x, a.y, b.x, b.y, px, py);
      if (Math.abs(cross) < 0.0001) continue;
      const nextSign = cross > 0 ? 1 : -1;
      if (sign === 0) {
        sign = nextSign;
      } else if (sign !== nextSign) {
        return false;
      }
    }
    return true;
  };
  const pointDistanceToQuadCentroid = (px, py, quad) => {
    if (!quad?.length) return Number.POSITIVE_INFINITY;
    const cx = quad.reduce((sum, point) => sum + point.x, 0) / quad.length;
    const cy = quad.reduce((sum, point) => sum + point.y, 0) / quad.length;
    return Math.hypot(px - cx, py - cy);
  };

  let bestCardId = null;
  let bestRenderOrder = Number.NEGATIVE_INFINITY;
  let bestDistanceToCamera = Number.POSITIVE_INFINITY;
  let bestCentroidDistance = Number.POSITIVE_INFINITY;
  const meshWorldPosition = new THREE.Vector3();

  selectionTargets.forEach((mesh) => {
    if (!mesh) return;
    const cardId = mesh.userData.cardId || mesh.parent?.userData.cardId;
    if (!cardId) return;
    mesh.updateWorldMatrix(true, false);
    screenCorners.length = 0;
    for (const local of localCorners) {
      const world = local.clone().applyMatrix4(mesh.matrixWorld);
      const projected = world.project(camera);
      screenCorners.push({
        x: ((projected.x + 1) * 0.5) * rect.width,
        y: ((1 - projected.y) * 0.5) * rect.height
      });
    }
    const inside = isPointInsideQuad(pointerX, pointerY, screenCorners);
    if (!inside) {
      return;
    }

    const meshRenderOrder = Number.isFinite(mesh.renderOrder) ? mesh.renderOrder : 0;
    mesh.getWorldPosition(meshWorldPosition);
    const distanceToCamera = meshWorldPosition.distanceTo(camera.position);
    const centroidDistance = pointDistanceToQuadCentroid(pointerX, pointerY, screenCorners);

    const isBetterRenderOrder = meshRenderOrder > bestRenderOrder;
    const isTieRenderOrder = meshRenderOrder === bestRenderOrder;
    const isBetterDepth = distanceToCamera < bestDistanceToCamera - 1e-4;
    const isTieDepth = Math.abs(distanceToCamera - bestDistanceToCamera) <= 1e-4;
    const isBetterCentroid = centroidDistance < bestCentroidDistance;

    if (
      isBetterRenderOrder ||
      (isTieRenderOrder && isBetterDepth) ||
      (isTieRenderOrder && isTieDepth && isBetterCentroid)
    ) {
      bestRenderOrder = meshRenderOrder;
      bestDistanceToCamera = distanceToCamera;
      bestCentroidDistance = centroidDistance;
      bestCardId = cardId;
    }
  });

  return bestCardId;
}

function setMeshPosition(mesh, target, lookTarget, orientation, immediate, animations, delayMs = 0, motion = {}) {
  if (!mesh) return;
  const orientTarget = lookTarget.clone();
  const orientOptions =
    typeof orientation === 'object' && orientation !== null
      ? orientation
      : { face: orientation ? 'front' : 'back', flat: false };
  const stopExisting = () => {
    if (mesh.userData?.animation) {
      mesh.userData.animation.cancelled = true;
      mesh.userData.animation = null;
    }
  };

  if (immediate || !animations) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  const current = mesh.position.clone();
  if (current.distanceToSquared(target) < 1e-6) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  stopExisting();
  const animation = {
    mesh,
    from: current,
    to: target.clone(),
    lookTarget: orientTarget,
    orientation: orientOptions,
    start: performance.now() + Math.max(0, delayMs),
    duration: Math.max(1, Number(motion?.duration) || CARD_ANIMATION_DURATION),
    liftArc: Math.max(0, Number(motion?.liftArc) || 0),
    preLift: Math.max(0, Number(motion?.preLift) || 0),
    preLiftPortion: THREE.MathUtils.clamp(
      Number.isFinite(Number(motion?.preLiftPortion)) ? Number(motion.preLiftPortion) : 0.3,
      0.1,
      0.8
    ),
    settleSlide: Math.max(0, Number(motion?.settleSlide) || 0),
    settlePortion: THREE.MathUtils.clamp(
      Number.isFinite(Number(motion?.settlePortion)) ? Number(motion.settlePortion) : 0.16,
      0.04,
      0.35
    ),
    cancelled: false
  };
  mesh.userData.animation = animation;
  animations.push(animation);
}

function orientMesh(mesh, lookTarget, options = {}) {
  const { face = 'front', flat = false, flatTiltX = 0, flatYawY = 0, yawY = 0, pitchX = 0, rollZ = 0 } = options;
  if (flat) {
    mesh.rotation.set(-Math.PI / 2 + flatTiltX, (face === 'back' ? Math.PI : 0) + flatYawY, 0);
    return;
  }
  mesh.up.set(0, 1, 0);
  mesh.lookAt(lookTarget);
  mesh.rotation.z = 0;
  if (yawY) {
    mesh.rotateY(yawY);
  }
  if (pitchX) {
    mesh.rotateX(pitchX);
  }
  if (rollZ) {
    mesh.rotateZ(rollZ);
  }
  if (face === 'back') {
    mesh.rotateY(Math.PI);
  }
}

function updateCardFace(mesh, mode) {
  if (!mesh?.material) return;
  const { frontMaterial, backMaterial, cardFace } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial) return;
  if (mode === cardFace) return;
  if (mode === 'back') {
    mesh.material[4] = backMaterial;
    mesh.material[5] = backMaterial;
    mesh.userData.cardFace = 'back';
    return;
  }
  mesh.material[4] = frontMaterial;
  mesh.material[5] = backMaterial;
  mesh.userData.cardFace = 'front';
}

function setCommunityCardLegibility(mesh, highlighted) {
  const frontMaterial = mesh?.userData?.frontMaterial;
  if (!frontMaterial) return;
  if (!mesh.userData.frontMaterialDefaults) {
    mesh.userData.frontMaterialDefaults = {
      roughness: frontMaterial.roughness,
      metalness: frontMaterial.metalness,
      emissiveIntensity: frontMaterial.emissiveIntensity ?? 0,
      envMapIntensity: frontMaterial.envMapIntensity ?? 1,
      toneMapped: frontMaterial.toneMapped ?? true,
      color: frontMaterial.color?.clone?.() ?? new THREE.Color('#ffffff'),
      emissive: frontMaterial.emissive?.clone?.() ?? new THREE.Color('#000000')
    };
  }
  const defaults = mesh.userData.frontMaterialDefaults;
  if (!frontMaterial.emissive) {
    frontMaterial.emissive = new THREE.Color('#000000');
  }
  if (highlighted) {
    frontMaterial.roughness = 1;
    frontMaterial.metalness = 0;
    frontMaterial.envMapIntensity = 0;
    frontMaterial.toneMapped = false;
    frontMaterial.color?.set?.('#f2f5f9');
    frontMaterial.emissive.set('#0b1220');
    frontMaterial.emissiveIntensity = 0.028;
  } else {
    frontMaterial.roughness = defaults.roughness;
    frontMaterial.metalness = defaults.metalness;
    frontMaterial.envMapIntensity = defaults.envMapIntensity;
    frontMaterial.toneMapped = defaults.toneMapped;
    frontMaterial.color?.copy?.(defaults.color);
    frontMaterial.emissive.copy(defaults.emissive);
    frontMaterial.emissiveIntensity = defaults.emissiveIntensity;
  }
  frontMaterial.needsUpdate = true;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const CARD_FRONT_BASE_COLOR = '#e9eef5';
const CARD_BACK_BASE_COLOR = '#ffffff';

function createCardMesh(card, geometry, cache, theme, textureQuality = null) {
  const textureKey = textureQuality?.id || 'default';
  const faceKey = `${theme.id}-${card.rank}-${card.suit}-${textureKey}`;
  let faceTexture = cache.get(faceKey);
  if (!faceTexture) {
    faceTexture = makeCardFace(card.rank, card.suit, theme, textureQuality?.w, textureQuality?.h);
    cache.set(faceKey, faceTexture);
  }
  const edgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.edgeColor || '#f5f7fb'),
    roughness: 0.98,
    metalness: 0,
    envMapIntensity: 0
  });
  const edgeMats = [edgeMat, edgeMat.clone(), edgeMat.clone(), edgeMat.clone()];
  const frontMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0,
    color: new THREE.Color(CARD_FRONT_BASE_COLOR)
  });
  const backTexture = makeCardBackTexture(theme, textureQuality);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTexture,
    color: new THREE.Color(CARD_BACK_BASE_COLOR),
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0,
    emissive: new THREE.Color('#0f172a'),
    emissiveIntensity: 0
  });
  const hiddenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.hiddenColor || theme.backColor),
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0
  });
  const mesh = new THREE.Mesh(geometry, [...edgeMats, frontMat, backMat]);
  mesh.userData.cardId = card.id;
  mesh.userData.card = card;
  mesh.userData.frontMaterial = frontMat;
  mesh.userData.backMaterial = backMat;
  mesh.userData.hiddenMaterial = hiddenMat;
  mesh.userData.edgeMaterials = edgeMats;
  mesh.userData.backTexture = backTexture;
  mesh.userData.cardFace = 'front';
  return mesh;
}

function applyHandCardLayering(mesh, isHumanCard, stackOrder = 0) {
  if (!mesh?.isMesh) return;
  const orderBase = isHumanCard ? 16 : 4;
  mesh.renderOrder = orderBase + stackOrder;

  const shouldForceRenderOrder = true;
  if (mesh.userData?.forceHandRenderOrder === shouldForceRenderOrder) return;
  mesh.userData.forceHandRenderOrder = shouldForceRenderOrder;

  const allMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  allMaterials.forEach((material) => {
    if (!material) return;
    material.depthTest = !shouldForceRenderOrder;
    material.depthWrite = !shouldForceRenderOrder;
    material.needsUpdate = true;
  });
}

function applyTableCardLayering(mesh, stackOrder = 0, orderBase = 8) {
  if (!mesh?.isMesh) return;
  mesh.renderOrder = orderBase + stackOrder;

  const shouldForceRenderOrder = true;
  if (mesh.userData?.forceTableRenderOrder === shouldForceRenderOrder) return;
  mesh.userData.forceTableRenderOrder = shouldForceRenderOrder;

  const allMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  allMaterials.forEach((material) => {
    if (!material) return;
    material.depthTest = !shouldForceRenderOrder;
    material.depthWrite = !shouldForceRenderOrder;
    material.needsUpdate = true;
  });
}

function setBackLogoOrientation(mesh, variant = 'default') {
  const backMaterial = mesh?.userData?.backMaterial;
  const baseTexture = mesh?.userData?.backTexture;
  if (!backMaterial || !baseTexture) return;

  const desiredVariant = variant || 'default';
  if (desiredVariant === 'default') {
    if (mesh.userData.backLogoOrientedTexture) {
      mesh.userData.backLogoOrientedTexture.dispose?.();
      mesh.userData.backLogoOrientedTexture = null;
      mesh.userData.backLogoOrientedTextureSource = null;
      mesh.userData.backLogoOrientedVariant = null;
    }
    if (backMaterial.map !== baseTexture) {
      backMaterial.map = baseTexture;
      backMaterial.needsUpdate = true;
    }
    return;
  }

  if (
    mesh.userData.backLogoOrientedTexture &&
    (mesh.userData.backLogoOrientedTextureSource !== baseTexture ||
      mesh.userData.backLogoOrientedVariant !== desiredVariant)
  ) {
    mesh.userData.backLogoOrientedTexture.dispose?.();
    mesh.userData.backLogoOrientedTexture = null;
    mesh.userData.backLogoOrientedTextureSource = null;
    mesh.userData.backLogoOrientedVariant = null;
  }

  if (!mesh.userData.backLogoOrientedTexture) {
    const tunedTexture = baseTexture.clone();
    tunedTexture.wrapS = THREE.RepeatWrapping;
    tunedTexture.wrapT = THREE.RepeatWrapping;
    tunedTexture.repeat.set(1, 1);
    tunedTexture.offset.set(0, 0);
    tunedTexture.rotation = 0;
    tunedTexture.center.set(0.5, 0.5);
    // Back-face UVs are mirrored on these seats; flip horizontally so the logo reads correctly.
    tunedTexture.repeat.x = -1;
    tunedTexture.offset.x = 1;
    if (desiredVariant === 'top') {
      // Top seat cards need a 180° turn so the logo reads upright from the camera.
      tunedTexture.rotation = Math.PI;
    } else if (desiredVariant === 'side') {
      // Left side seat: keep the logo upright from the mobile portrait camera.
      tunedTexture.rotation = 0;
    } else if (desiredVariant === 'sideGift') {
      // Right side seat: keep the logo upright from the mobile portrait camera.
      tunedTexture.rotation = 0;
    }
    tunedTexture.needsUpdate = true;
    mesh.userData.backLogoOrientedTexture = tunedTexture;
    mesh.userData.backLogoOrientedTextureSource = baseTexture;
    mesh.userData.backLogoOrientedVariant = desiredVariant;
  }

  if (backMaterial.map !== mesh.userData.backLogoOrientedTexture) {
    backMaterial.map = mesh.userData.backLogoOrientedTexture;
    backMaterial.needsUpdate = true;
  }
}

function buildStandardPipLayout(rank) {
  const numericRank = Number.parseInt(String(rank), 10);
  if (Number.isNaN(numericRank) || numericRank < 2 || numericRank > 10) {
    if (String(rank) === 'A') return [{ x: 0, y: 0, flip: false }];
    return [];
  }
  const layouts = {
    2: [{ x: 0, y: -0.64, flip: false }, { x: 0, y: 0.64, flip: true }],
    3: [{ x: 0, y: -0.64, flip: false }, { x: 0, y: 0, flip: false }, { x: 0, y: 0.64, flip: true }],
    4: [
      { x: -0.45, y: -0.62, flip: false },
      { x: 0.45, y: -0.62, flip: false },
      { x: -0.45, y: 0.62, flip: true },
      { x: 0.45, y: 0.62, flip: true }
    ],
    5: [
      { x: -0.45, y: -0.62, flip: false },
      { x: 0.45, y: -0.62, flip: false },
      { x: 0, y: 0, flip: false },
      { x: -0.45, y: 0.62, flip: true },
      { x: 0.45, y: 0.62, flip: true }
    ],
    6: [
      { x: -0.45, y: -0.7, flip: false },
      { x: 0.45, y: -0.7, flip: false },
      { x: -0.45, y: 0, flip: false },
      { x: 0.45, y: 0, flip: false },
      { x: -0.45, y: 0.7, flip: true },
      { x: 0.45, y: 0.7, flip: true }
    ],
    7: [
      { x: -0.45, y: -0.72, flip: false },
      { x: 0.45, y: -0.72, flip: false },
      { x: 0, y: -0.28, flip: false },
      { x: -0.45, y: 0.12, flip: false },
      { x: 0.45, y: 0.12, flip: false },
      { x: -0.45, y: 0.72, flip: true },
      { x: 0.45, y: 0.72, flip: true }
    ],
    8: [
      { x: -0.45, y: -0.72, flip: false },
      { x: 0.45, y: -0.72, flip: false },
      { x: -0.45, y: -0.24, flip: false },
      { x: 0.45, y: -0.24, flip: false },
      { x: -0.45, y: 0.24, flip: true },
      { x: 0.45, y: 0.24, flip: true },
      { x: -0.45, y: 0.72, flip: true },
      { x: 0.45, y: 0.72, flip: true }
    ],
    9: [
      { x: -0.45, y: -0.72, flip: false },
      { x: 0.45, y: -0.72, flip: false },
      { x: -0.45, y: -0.24, flip: false },
      { x: 0.45, y: -0.24, flip: false },
      { x: 0, y: 0, flip: false },
      { x: -0.45, y: 0.24, flip: true },
      { x: 0.45, y: 0.24, flip: true },
      { x: -0.45, y: 0.72, flip: true },
      { x: 0.45, y: 0.72, flip: true }
    ],
    10: [
      { x: -0.45, y: -0.74, flip: false },
      { x: 0.45, y: -0.74, flip: false },
      { x: -0.45, y: -0.34, flip: false },
      { x: 0.45, y: -0.34, flip: false },
      { x: 0, y: -0.02, flip: false },
      { x: -0.45, y: 0.34, flip: true },
      { x: 0.45, y: 0.34, flip: true },
      { x: -0.45, y: 0.74, flip: true },
      { x: 0.45, y: 0.74, flip: true },
      { x: 0, y: 0.45, flip: true }
    ]
  };
  return layouts[numericRank] ?? [];
}

function drawCourtFigure(g, rank, suit, color, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const frameW = w * 0.54;
  const frameH = h * 0.62;
  const left = cx - frameW / 2;
  const top = cy - frameH / 2;
  const isJack = rank === 'J';
  const isQueen = rank === 'Q';
  const isKing = rank === 'K';
  const skinTone = isQueen ? '#f7d7c3' : isKing ? '#e8c3a5' : '#efc9ab';
  const robeTop = isQueen ? '#7c3aed' : isKing ? '#0f4c81' : '#14532d';
  const robeBottom = isQueen ? '#c084fc' : isKing ? '#60a5fa' : '#4ade80';
  const accent = isQueen ? '#f9a8d4' : isKing ? '#facc15' : '#fb7185';
  const hair = isQueen ? '#5b3b1c' : isKing ? '#3f2b1d' : '#2b1a0f';

  g.save();
  g.lineWidth = Math.max(2, Math.round(w * 0.008));
  g.strokeStyle = '#334155';
  const frameGradient = g.createLinearGradient(left, top, left, top + frameH);
  frameGradient.addColorStop(0, '#fefefe');
  frameGradient.addColorStop(1, '#e2e8f0');
  g.fillStyle = frameGradient;
  roundRect(g, left, top, frameW, frameH, Math.round(w * 0.06));
  g.fill();
  g.stroke();

  const vignette = g.createRadialGradient(cx, cy, frameW * 0.12, cx, cy, frameW * 0.62);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(15,23,42,0.18)');
  g.fillStyle = vignette;
  roundRect(g, left, top, frameW, frameH, Math.round(w * 0.06));
  g.fill();

  g.fillStyle = '#fef08a';
  g.strokeStyle = '#a16207';
  g.lineWidth = Math.max(1.6, Math.round(w * 0.005));
  const crownY = top + frameH * 0.14;
  const crownW = frameW * (isKing ? 0.42 : isQueen ? 0.38 : 0.34);
  const crownH = frameH * (isKing ? 0.2 : 0.16);
  g.beginPath();
  g.moveTo(cx - crownW * 0.5, crownY + crownH * 0.82);
  g.lineTo(cx - crownW * 0.33, crownY + crownH * 0.22);
  g.lineTo(cx - crownW * 0.07, crownY + crownH * 0.58);
  g.lineTo(cx + crownW * 0.07, crownY + crownH * 0.12);
  g.lineTo(cx + crownW * 0.31, crownY + crownH * 0.52);
  g.lineTo(cx + crownW * 0.5, crownY + crownH * 0.82);
  g.closePath();
  g.fill();
  g.stroke();

  g.fillStyle = hair;
  g.beginPath();
  g.ellipse(cx, top + frameH * 0.34, frameW * 0.16, frameH * 0.12, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = skinTone;
  g.beginPath();
  g.ellipse(cx, top + frameH * 0.37, frameW * 0.11, frameH * 0.09, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#111827';
  g.beginPath();
  g.arc(cx - frameW * 0.035, top + frameH * 0.36, frameW * 0.01, 0, Math.PI * 2);
  g.arc(cx + frameW * 0.035, top + frameH * 0.36, frameW * 0.01, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = '#7f1d1d';
  g.lineWidth = Math.max(1.2, Math.round(w * 0.0035));
  g.beginPath();
  g.arc(cx, top + frameH * 0.405, frameW * 0.035, 0.15 * Math.PI, 0.85 * Math.PI, false);
  g.stroke();

  const robeGradient = g.createLinearGradient(cx, top + frameH * 0.5, cx, top + frameH * 0.9);
  robeGradient.addColorStop(0, robeTop);
  robeGradient.addColorStop(1, robeBottom);
  g.fillStyle = robeGradient;
  g.beginPath();
  g.moveTo(cx - frameW * 0.24, top + frameH * 0.54);
  g.quadraticCurveTo(cx, top + frameH * 0.46, cx + frameW * 0.24, top + frameH * 0.54);
  g.lineTo(cx + frameW * 0.2, top + frameH * 0.89);
  g.lineTo(cx - frameW * 0.2, top + frameH * 0.89);
  g.closePath();
  g.fill();

  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(cx, top + frameH * 0.54);
  g.lineTo(cx + frameW * 0.06, top + frameH * 0.84);
  g.lineTo(cx - frameW * 0.06, top + frameH * 0.84);
  g.closePath();
  g.fill();

  if (isKing) {
    g.fillStyle = '#fde68a';
    g.beginPath();
    g.arc(cx, top + frameH * 0.66, frameW * 0.032, 0, Math.PI * 2);
    g.fill();
  }
  if (isQueen) {
    g.strokeStyle = '#be185d';
    g.lineWidth = Math.max(1.2, Math.round(w * 0.003));
    g.beginPath();
    g.moveTo(cx - frameW * 0.09, top + frameH * 0.72);
    g.lineTo(cx + frameW * 0.09, top + frameH * 0.72);
    g.stroke();
  }
  if (isJack) {
    g.fillStyle = '#fca5a5';
    g.fillRect(cx - frameW * 0.015, top + frameH * 0.67, frameW * 0.03, frameH * 0.13);
  }

  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(w * 0.13)}px "Inter", "Segoe UI Symbol", sans-serif`;
  g.fillText(suit, cx, top + frameH * 0.93);

  g.fillStyle = '#111827';
  g.font = `900 ${Math.round(w * 0.085)}px "Inter", "Segoe UI", sans-serif`;
  g.fillText(rank, cx, top + frameH * 0.08);
  g.restore();
}

function createFallbackOpenSourceCardSvg(cardKey) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400">
      <defs>
        <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#efe9dc" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" rx="42" ry="42" width="964" height="1364" fill="url(#bg)" stroke="rgba(0,0,0,0.14)" stroke-width="8" />
      <rect x="46" y="46" rx="28" ry="28" width="908" height="1308" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="3" />
      <text x="500" y="660" text-anchor="middle" font-size="170" font-family="Georgia, serif" fill="#111">${cardKey}</text>
      <text x="500" y="840" text-anchor="middle" font-size="64" font-family="Georgia, serif" fill="#666">Open source card</text>
    </svg>
  `;
}

function toOpenSourceDeckKey(rank, suit) {
  if (rank === 'JR') return 'J1';
  if (rank === 'JB') return 'J1';
  const suitCode = OPEN_SOURCE_SUIT_CODES[suit];
  if (!suitCode) return null;
  const rankCode = OPEN_SOURCE_RANK_CODES[rank] || String(rank).toLowerCase();
  return `${suitCode}${rankCode}`;
}

function svgMarkupFromOpenSourceDeck(rank, suit) {
  const cardKey = toOpenSourceDeckKey(rank, suit);
  if (!cardKey) return createFallbackOpenSourceCardSvg(`${rank}${suit ?? ''}`);
  const CardComponent = OpenSourceDeck?.[cardKey];
  if (!CardComponent) return createFallbackOpenSourceCardSvg(cardKey);
  const svg = renderToStaticMarkup(<CardComponent width={1000} height={1400} />);
  return svg;
}


function makeCardFace(rank, suit, theme, w = 768, h = 1080) {
  const svg = svgMarkupFromOpenSourceDeck(rank, suit);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(256, Math.round(w));
  canvas.height = Math.max(360, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallbackTex = new THREE.TextureLoader().load(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    );
    applySRGBColorSpace(fallbackTex);
    fallbackTex.anisotropy = 12;
    fallbackTex.magFilter = THREE.LinearFilter;
    fallbackTex.minFilter = THREE.LinearMipmapLinearFilter;
    fallbackTex.generateMipmaps = true;
    return fallbackTex;
  }

  const tex = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(tex);
  tex.anisotropy = 12;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const faceZoom = 1.045;
    const zoomedWidth = canvas.width * faceZoom;
    const zoomedHeight = canvas.height * faceZoom;
    const offsetX = (canvas.width - zoomedWidth) * 0.5;
    const offsetY = (canvas.height - zoomedHeight) * 0.5;

    // Draw card art clipped to rounded corners but keep opaque white corners to avoid black wedges.
    const cornerRadius = Math.round(Math.min(canvas.width, canvas.height) * 0.092);
    ctx.save();
    roundRect(ctx, 0, 0, canvas.width, canvas.height, cornerRadius);
    ctx.clip();
    ctx.drawImage(image, offsetX, offsetY, zoomedWidth, zoomedHeight);
    if (rank === 'JB') {
      recolorBlackJokerFigure(ctx, canvas.width, canvas.height);
    }

    // Slightly thicken rank/suit glyph edges for better mobile readability.
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(canvas, -0.9, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0.9, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, -0.9, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0.9, canvas.width, canvas.height);
    ctx.drawImage(canvas, -0.65, -0.65, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0.65, 0.65, canvas.width, canvas.height);
    ctx.drawImage(canvas, -0.65, 0.65, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0.65, -0.65, canvas.width, canvas.height);

    // Darker front-face matte layer for less glare and reduced overall brightness on mobile screens.
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    tex.needsUpdate = true;
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  tex.needsUpdate = true;
  return tex;
}

function recolorBlackJokerFigure(ctx, width, height) {
  if (!ctx || width <= 0 || height <= 0) return;
  const figureBounds = {
    left: Math.floor(width * 0.18),
    right: Math.ceil(width * 0.82),
    top: Math.floor(height * 0.12),
    bottom: Math.ceil(height * 0.9)
  };
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x < figureBounds.left || x > figureBounds.right || y < figureBounds.top || y > figureBounds.bottom) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 12) continue;
    // Recolor only strong red costume regions. Keep yellow/skin rounded face tones unchanged.
    const isStrongRedCostume = r >= 120 && g <= 95 && b <= 95 && r >= g + 24 && r >= b + 24;
    if (!isStrongRedCostume) continue;
    data[i] = 17;
    data[i + 1] = 17;
    data[i + 2] = 17;
  }
  ctx.putImageData(imageData, 0, 0);
}

function makeCardBackTexture(theme, textureQuality = null) {
  const safeQualityScale = Number.isFinite(textureQuality?.w)
    ? THREE.MathUtils.clamp(textureQuality.w / 768, 0.62, 1.5)
    : 1;
  const width = Math.round(1024 * safeQualityScale);
  const height = Math.round(1536 * safeQualityScale);
  return makeTonplaygramCardBackTexture(theme, width, height);
}

function applyChairThemeMaterials(three, theme) {
  const mats = three?.chairMaterials;
  if (!mats) return;
  const preserve = three?.chairThemePreserve ?? shouldPreserveChairMaterials(theme);
  if (preserve) return;
  const seatColor = theme?.seatColor || '#7c3aed';
  const legColor = theme?.legColor || '#111827';
  if (mats.seat?.color) {
    mats.seat.color.set(seatColor);
    mats.seat.needsUpdate = true;
  }
  if (mats.leg?.color) {
    mats.leg.color.set(legColor);
    mats.leg.needsUpdate = true;
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(seatColor);
      mat.needsUpdate = true;
    }
  });
  (mats.metal ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(legColor);
      mat.needsUpdate = true;
    }
  });
}

function applyOutfitThemeMaterials(three, theme) {
  const parts = three?.outfitParts;
  if (!parts?.length) return;
  const base = theme?.baseColor ? new THREE.Color(theme.baseColor) : null;
  const accent = theme?.accentColor ? new THREE.Color(theme.accentColor) : null;
  parts.forEach((mat, index) => {
    if (!mat?.color) return;
    if (base) {
      mat.color.lerp(base, 0.08 + (index % 2) * 0.04);
    }
    if (accent && mat.sheenColor) {
      mat.sheenColor.lerp(accent, 0.12);
    }
    mat.needsUpdate = true;
  });
}

function applyCardThemeMaterials(three, theme, force = false, textureQuality = null) {
  if (!three?.cardMap) return;
  if (!force && three.cardThemeId === theme.id) return;
  const frontTextures = new Set();
  const backTextures = new Set();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backTexture } = mesh.userData ?? {};
    if (frontMaterial?.map) frontTextures.add(frontMaterial.map);
    if (backTexture) backTextures.add(backTexture);
  });
  frontTextures.forEach((tex) => tex?.dispose?.());
  backTextures.forEach((tex) => tex?.dispose?.());
  three.faceTextureCache.forEach((tex) => tex.dispose());
  three.faceTextureCache.clear();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backMaterial, hiddenMaterial, edgeMaterials, card } = mesh.userData ?? {};
    if (!frontMaterial || !backMaterial || !edgeMaterials || !card) return;
    const textureKey = textureQuality?.id || 'default';
    const faceKey = `${theme.id}-${card.rank}-${card.suit}-${textureKey}`;
    let faceTexture = three.faceTextureCache.get(faceKey);
    if (!faceTexture) {
      faceTexture = makeCardFace(card.rank, card.suit, theme, textureQuality?.w, textureQuality?.h);
      three.faceTextureCache.set(faceKey, faceTexture);
    }
    frontMaterial.map = faceTexture;
    frontMaterial.color?.set?.(CARD_FRONT_BASE_COLOR);
    frontMaterial.needsUpdate = true;
    const backTexture = makeCardBackTexture(theme, textureQuality);
    mesh.userData.backTexture = backTexture;
    backMaterial.map = backTexture;
    backMaterial.color?.set?.(CARD_BACK_BASE_COLOR);
    backMaterial.roughness = 1;
    backMaterial.metalness = 0;
    backMaterial.envMapIntensity = 0;
    backMaterial.needsUpdate = true;
    frontMaterial.roughness = 1;
    frontMaterial.metalness = 0;
    frontMaterial.envMapIntensity = 0;
    if (hiddenMaterial?.color) {
      hiddenMaterial.color.set(theme.hiddenColor || theme.backColor);
      hiddenMaterial.roughness = 1;
      hiddenMaterial.metalness = 0;
      hiddenMaterial.envMapIntensity = 0;
      hiddenMaterial.needsUpdate = true;
    }
    edgeMaterials.forEach((mat) => {
      mat.color?.set?.(theme.edgeColor || '#f5f7fb');
      mat.roughness = 0.98;
      mat.metalness = 0;
      mat.envMapIntensity = 0;
      mat.needsUpdate = true;
    });
  });
  three.cardThemeId = theme.id;
}
