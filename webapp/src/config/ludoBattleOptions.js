import { TOKEN_TYPE_SEQUENCE } from '../utils/ludoTokenConstants.js';

export const HEAD_PRESET_OPTIONS = Object.freeze([
  {
    id: 'headGlass',
    label: 'Glass',
    preset: {
      color: '#ffffff',
      metalness: 0,
      roughness: 0.05,
      transmission: 0.95,
      ior: 1.5,
      thickness: 0.5
    }
  },
  {
    id: 'headRuby',
    label: 'Ruby',
    preset: {
      color: '#9b111e',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.92,
      ior: 2.4,
      thickness: 0.6
    }
  },
  {
    id: 'headPearl',
    label: 'Pearl',
    preset: {
      color: '#f5f5f5',
      metalness: 0.05,
      roughness: 0.25,
      transmission: 0,
      ior: 1.3,
      thickness: 0.2
    }
  },
  {
    id: 'headSapphire',
    label: 'Sapphire',
    preset: {
      color: '#0f52ba',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.8,
      thickness: 0.7
    }
  },
  {
    id: 'headEmerald',
    label: 'Emerald',
    preset: {
      color: '#046a38',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.8,
      thickness: 0.7
    }
  },
  {
    id: 'headDiamond',
    label: 'Diamond',
    preset: {
      color: '#ffffff',
      metalness: 0,
      roughness: 0.03,
      transmission: 0.98,
      ior: 2.4,
      thickness: 0.8
    }
  }
]);

export const TOKEN_STYLE_OPTIONS = Object.freeze([
  {
    id: 'battleChess',
    label: 'Battle Chess Tokens',
    description: 'Use the Chess Battle Royale GLTF set for every pawn.',
    typeSequence: TOKEN_TYPE_SEQUENCE,
    prefersAbg: true
  },
  {
    id: 'towerRooks',
    label: 'Minimal Rook Set',
    description: 'Swap every pawn with sleek GLTF rooks for a clean read.',
    typeSequence: ['r'],
    prefersAbg: true
  }
]);

export const TOKEN_PIECE_OPTIONS = Object.freeze([
  { id: 'piecePawn', label: 'Play as Pawn', type: 'p', symbol: '♙' },
  { id: 'pieceRook', label: 'Play as Rook', type: 'r', symbol: '♖' },
  { id: 'pieceKnight', label: 'Play as Knight', type: 'n', symbol: '♘' },
  { id: 'pieceBishop', label: 'Play as Bishop', type: 'b', symbol: '♗' },
  { id: 'pieceQueen', label: 'Play as Queen', type: 'q', symbol: '♕' },
  { id: 'pieceKing', label: 'Play as King', type: 'k', symbol: '♔' }
]);

export const CAPTURE_ANIMATION_OPTIONS = Object.freeze([
  {
    id: 'missileJavelin',
    label: 'Javelin Missile',
    description: 'Perimeter missile orbit with a spear-like terminal strike.'
  },
  {
    id: 'droneAttack',
    label: 'Drone Attack',
    description: 'Attack drone sweep adapted from Chess Battle Royal scale.'
  },
  {
    id: 'fighterJetAttack',
    label: 'Fighter Jet Attack',
    description: 'Fast fighter jet strike adapted from Chess Battle Royal scale.'
  },
  {
    id: 'helicopterAttack',
    label: 'Helicopter Strike',
    description: 'Attack helicopter run that launches twin missiles on a jet-style path.'
  },
  {
    id: 'glockSidearmAttack',
    label: 'Glock Sidearm',
    description: 'Pick the Glock from the table, aim, and fire before taking the tile.'
  },
  {
    id: 'pistolSidearmAttack',
    label: 'Pistol Sidearm',
    description: 'Classic pistol takedown sequence with table pickup and close shot.'
  },
  {
    id: 'assaultRifleAttack',
    label: 'Assault Rifle',
    description: 'AR burst capture with a short aim hold before advancing to the target tile.'
  },
  {
    id: 'uziSprayAttack',
    label: 'Uzi Spray',
    description: 'Fast SMG capture variation inspired by Tirana 2040 Uzi loadout.'
  },
  {
    id: 'ak47VolleyAttack',
    label: 'AK-47 Volley',
    description: 'Heavy AK-style capture volley while preserving existing vehicle attacks.'
  },
  {
    id: 'grenadeBlastAttack',
    label: 'Grenade Blast',
    description: 'Grenade-style capture with quick throw/pickup pacing from the armory set.'
  },
  {
    id: 'shotgunBlastAttack',
    label: 'Shotgun Blast',
    description: 'Short-range tactical shotgun blast with fast pickup timing.'
  },
  {
    id: 'sniperShotAttack',
    label: 'Sniper Shot',
    description: 'Precision long-barrel sniper takedown sequence.'
  },
  {
    id: 'smgBurstAttack',
    label: 'SMG Burst',
    description: 'Compact SMG burst animation with controlled recoil.'
  },
  {
    id: 'revolverStrikeAttack',
    label: 'Revolver Strike',
    description: 'Heavy revolver sidearm capture variation with stronger kick.'
  },
  {
    id: 'carbineSweepAttack',
    label: 'Carbine Sweep',
    description: 'Carbine sweep animation with quick target acquisition from the weapon rack.'
  },
  {
    id: 'marksmanRifleAttack',
    label: 'Marksman Rifle',
    description: 'Precise DMR-style takedown with a stable right-hand aiming hold.'
  }

]);


export const HUMAN_CHARACTER_OPTIONS = Object.freeze([
  {
    id: 'rpm-current',
    label: 'Current Avatar',
    description: 'Ready Player Me seated avatar with full PBR texture maps.',
    modelUrls: ['https://threejs.org/examples/models/gltf/readyplayer.me.glb'],
    source: 'three.js examples',
    license: 'MIT examples bundle'
  },
  {
    id: 'mixamo-aj',
    label: 'AJ',
    description: 'Mixamo AJ humanoid rig that can be fully re-targeted for seated gameplay.',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Aj.glb'],
    source: 'three.js examples / Mixamo',
    license: 'Mixamo sample terms'
  },
  {
    id: 'mixamo-jane',
    label: 'Jane',
    description: 'Mixamo Jane with preserved GLB material textures and humanoid skeleton.',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Jane.glb'],
    source: 'three.js examples / Mixamo',
    license: 'Mixamo sample terms'
  },
  {
    id: 'mixamo-eva',
    label: 'Eva',
    description: 'Mixamo Eva realistic female rig ready for seated pose overrides.',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Eva.glb'],
    source: 'three.js examples / Mixamo',
    license: 'Mixamo sample terms'
  },
  {
    id: 'mixamo-joe',
    label: 'Joe',
    description: 'Mixamo Joe humanoid compatible with existing Ludo seated animation helpers.',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Joe.glb'],
    source: 'three.js examples / Mixamo',
    license: 'Mixamo sample terms'
  },
  {
    id: 'mixamo-remy',
    label: 'Remy',
    description: 'Mixamo Remy character tuned to the same target seated height in-game.',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Remy.glb'],
    source: 'three.js examples / Mixamo',
    license: 'Mixamo sample terms'
  }
]);

export const TOKEN_PALETTE_OPTIONS = Object.freeze([
  {
    id: 'vividCore',
    label: 'Vivid Core',
    swatches: [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e]
  },
  {
    id: 'frostbite',
    label: 'Frostbite Pastel',
    swatches: [0xfb7185, 0x60a5fa, 0xfde047, 0x86efac]
  },
  {
    id: 'midnightPulse',
    label: 'Midnight Pulse',
    swatches: [0xbe123c, 0x1d4ed8, 0xca8a04, 0x15803d]
  },
  {
    id: 'radiantCandy',
    label: 'Radiant Candy',
    swatches: [0xff7aa2, 0x7dd3fc, 0xffe999, 0x6ee7b7]
  },
  {
    id: 'steelPulse',
    label: 'Steel Pulse',
    swatches: [0xe2e8f0, 0x94a3b8, 0x475569, 0x0ea5e9]
  },
  {
    id: 'sunsetArena',
    label: 'Sunset Arena',
    swatches: [0xfb7185, 0xf97316, 0xfacc15, 0x4ade80]
  }
]);

export const CHAIR_COLOR_OPTIONS = Object.freeze([
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f'
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c'
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318'
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808'
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24'
  }
]);
