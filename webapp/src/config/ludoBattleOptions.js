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
    description: 'Perimeter missile orbit with a spear-like terminal strike.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f680.png'
  },
  {
    id: 'droneAttack',
    label: 'Drone Attack',
    description: 'Attack drone sweep adapted from Chess Battle Royal scale.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f6f8.png'
  },
  {
    id: 'fighterJetAttack',
    label: 'Fighter Jet Attack',
    description: 'Fast fighter jet strike with right-hand red launch button trigger.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u2708_fe0f.png'
  },
  {
    id: 'helicopterAttack',
    label: 'Helicopter Strike',
    description: 'Attack helicopter run that launches twin missiles after button press.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f681.png'
  },
  {
    id: 'mrtkGunAttack',
    label: 'MRTK Gun',
    description: 'Mixed Reality Toolkit gun pickup with sequential fallback source loading.',
    thumbnail:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f52b.png'
  },
  {
    id: 'pistolHolsterAttack',
    label: 'Pistol Holster',
    description: 'Pistol-in-holster sidearm animation using original source model fallback URLs.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f45d.png'
  },
  {
    id: 'fpsGunAttack',
    label: 'FPS Gun',
    description: 'FPS-styled firearm takedown using open-source scene model fallbacks.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'glockSidearmAttack',
    label: 'Glock Sidearm',
    description: 'Pick the Glock from the table, aim, and fire before taking the tile.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f52b.png'
  },
  {
    id: 'pistolSidearmAttack',
    label: 'Pistol Sidearm',
    description: 'Classic pistol takedown with right-hand pickup using original GLB textures.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f52b.png'
  },
  {
    id: 'assaultRifleAttack',
    label: 'Assault Rifle',
    description: 'AR burst capture with short aim hold and original GLB texture materials.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'uziSprayAttack',
    label: 'Uzi Spray',
    description: 'Fast SMG capture variation inspired by Tirana 2040 Uzi loadout.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f525.png'
  },
  {
    id: 'ak47VolleyAttack',
    label: 'AK-47 Volley',
    description: 'Heavy AK volley using Gunify AK47 GLTF textures with original material maps preserved.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f525.png'
  },
  {
    id: 'krsvBurstAttack',
    label: 'KRSV Burst',
    description: 'KRSV firearm burst using Gunify GLTF textures/material mapping.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f525.png'
  },
  {
    id: 'smithSidearmAttack',
    label: 'Smith Sidearm',
    description: 'Smith sidearm takedown with original Gunify texture maps.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f52b.png'
  },
  {
    id: 'mosinMarksmanAttack',
    label: 'Mosin Marksman',
    description: 'Mosin long-range strike using Gunify GLTF textures and preserved materials.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'sigsauerTacticalAttack',
    label: 'SigSauer Tactical',
    description: 'SigSauer tactical burst using Gunify GLTF texture/material files.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f52b.png'
  },
  {
    id: 'grenadeBlastAttack',
    label: 'Grenade Blast',
    description: 'Grenade capture with preserved GLB textures and quick throw/pickup pacing.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f4a3.png'
  },
  {
    id: 'shotgunBlastAttack',
    label: 'Shotgun Blast',
    description: 'Short-range tactical shotgun blast with fast pickup timing.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'sniperShotAttack',
    label: 'Sniper Shot',
    description: 'Precision long-barrel sniper takedown sequence.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'smgBurstAttack',
    label: 'SMG Burst',
    description: 'Compact SMG burst animation with controlled recoil.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f525.png'
  },
  {
    id: 'compactCarbineAttack',
    label: 'Compact Carbine',
    description: 'Open-source compact carbine-style pickup and burst capture animation.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
  },
  {
    id: 'marksmanDmrAttack',
    label: 'Marksman DMR',
    description: 'Open-source designated marksman rifle attack with controlled right-hand aim.',
    thumbnail: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f3af.png'
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
    id: 'rpm-67d411',
    label: 'RPM 67d411',
    description: 'Ready Player Me public avatar seated with the same Ludo rig logic and motion set.',
    modelUrls: [
      'https://models.readyplayer.me/67d411b30787acbf58ce58ac.glb',
      'https://api.readyplayer.me/v1/avatars/67d411b30787acbf58ce58ac.glb',
      'https://avatars.readyplayer.me/67d411b30787acbf58ce58ac.glb'
    ],
    source: 'Ready Player Me public GLB',
    license: 'Check Ready Player Me terms'
  },
  {
    id: 'rpm-67f433',
    label: 'RPM 67f433',
    description: 'Ready Player Me public avatar aligned to default seated scale/orientation for Ludo.',
    modelUrls: [
      'https://models.readyplayer.me/67f433b69dc08cf26d2cf585.glb',
      'https://api.readyplayer.me/v1/avatars/67f433b69dc08cf26d2cf585.glb',
      'https://avatars.readyplayer.me/67f433b69dc08cf26d2cf585.glb'
    ],
    source: 'Ready Player Me public GLB',
    license: 'Check Ready Player Me terms'
  },
  {
    id: 'rpm-67e1b5',
    label: 'RPM 67e1b5',
    description: 'Ready Player Me public avatar using the same seated helper offsets and animation logic.',
    modelUrls: [
      'https://models.readyplayer.me/67e1b51ae11c93725e4395c9.glb',
      'https://api.readyplayer.me/v1/avatars/67e1b51ae11c93725e4395c9.glb',
      'https://avatars.readyplayer.me/67e1b51ae11c93725e4395c9.glb'
    ],
    source: 'Ready Player Me public GLB',
    license: 'Check Ready Player Me terms'
  },
  {
    id: 'webgl-vietnam-human',
    label: 'Vietnam Human',
    description: 'Open WebGL GLB humanoid seated with the same Ludo scale/orientation/motion rig.',
    modelUrls: ['https://raw.githubusercontent.com/hmthanh/3d-human-model/main/TranThiNgocTham.glb'],
    source: 'hmthanh/3d-human-model GitHub',
    license: 'Check repository license'
  },
  {
    id: 'webgl-human-body-a',
    label: 'Human Body A',
    description: 'Open WebGL GLB body variant using the same seated character animation logic.',
    modelUrls: ['https://raw.githubusercontent.com/msorkhpar/3d-human-model-vite/main/body.glb'],
    source: 'msorkhpar/3d-human-model-vite GitHub',
    license: 'Check repository license'
  },
  {
    id: 'webgl-human-body-b',
    label: 'Human Body B',
    description: 'Open WebGL GLB body variant matched to default seated sizing/orientation.',
    modelUrls: ['https://raw.githubusercontent.com/bddicken/humanbody/main/body.glb'],
    source: 'bddicken/humanbody GitHub',
    license: 'Check repository license'
  },
  {
    id: 'webgl-ai-teacher',
    label: 'AI Teacher',
    description: 'Open-source AI Teacher avatar adapted to the default seated pose pipeline.',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar.glb'],
    source: 'Surbh77/AI-teacher GitHub',
    license: 'Check repository license'
  },
  {
    id: 'webgl-ai-teacher-1',
    label: 'AI Teacher 1',
    description: 'Second AI Teacher avatar using the same seated helpers and interaction logic.',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar1.glb'],
    source: 'Surbh77/AI-teacher GitHub',
    license: 'Check repository license'
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
