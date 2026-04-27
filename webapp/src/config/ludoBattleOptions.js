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

const captureWeaponThumb = (icon = '⚔️', accent = '#0ea5e9') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="18" fill="url(#bg)" />
      <rect x="14" y="14" width="292" height="152" rx="14" fill="rgba(255,255,255,0.08)" />
      <text x="160" y="112" text-anchor="middle" font-size="72">${icon}</text>
    </svg>`
  )}`;

const CAPTURE_WEAPON_SOURCE_THUMBNAILS = Object.freeze({
  glockSidearmAttack: 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/SigSauer.jpg',
  pistolSidearmAttack: 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/Smith.jpeg',
  assaultRifleAttack: 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/AK47.jpeg',
  ak47VolleyAttack:
    'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/AK47.jpeg',
  smithSidearmAttack:
    'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/Smith.jpeg',
  shotgunBlastAttack:
    'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/textures/shotgun_baseColor.png',
  sniperShotAttack:
    'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/images/Mosin.png'
});

export const CAPTURE_ANIMATION_OPTIONS = Object.freeze([
  {
    id: 'missileJavelin',
    label: 'Javelin Missile',
    description: 'Perimeter missile orbit with a spear-like terminal strike.',
    thumbnail: captureWeaponThumb('🚀', '#1d4ed8')
  },
  {
    id: 'droneAttack',
    label: 'Drone Attack',
    description: 'Attack drone sweep adapted from Chess Battle Royal scale.',
    thumbnail: captureWeaponThumb('🛸', '#0ea5e9')
  },
  {
    id: 'fighterJetAttack',
    label: 'Fighter Jet Attack',
    description: 'Fast fighter jet strike with right-hand red launch button trigger.',
    thumbnail: captureWeaponThumb('✈️', '#2563eb')
  },
  {
    id: 'helicopterAttack',
    label: 'Helicopter Strike',
    description: 'Attack helicopter run that launches twin missiles after button press.',
    thumbnail: captureWeaponThumb('🚁', '#0f766e')
  },
  {
    id: 'mrtkGunAttack',
    label: 'MRTK Gun',
    description: 'Mixed Reality Toolkit Gun.glb pickup and burst attack.',
    thumbnail: captureWeaponThumb('🔫', '#075985')
  },
  {
    id: 'pistolHolsterAttack',
    label: 'Pistol Holster',
    description: 'Holstered pistol model from SAM_ASSET-PISTOL-IN-HOLSTER.glb.',
    thumbnail: captureWeaponThumb('🧰', '#0f766e')
  },
  {
    id: 'fpsGunAttack',
    label: 'FPS Gun',
    description: 'FPS Gun scene.gltf pickup with preserved mesh/material shape.',
    thumbnail: captureWeaponThumb('🎯', '#7c3aed')
  },
  {
    id: 'glockSidearmAttack',
    label: 'Glock Sidearm',
    description: 'Pick the Glock from the table, aim, and fire before taking the tile.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.glockSidearmAttack
  },
  {
    id: 'pistolSidearmAttack',
    label: 'Pistol Sidearm',
    description: 'Classic pistol takedown with right-hand pickup using original GLB textures.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.pistolSidearmAttack
  },
  {
    id: 'assaultRifleAttack',
    label: 'Assault Rifle',
    description: 'AR burst capture with short aim hold and original GLB texture materials.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.assaultRifleAttack
  },
  {
    id: 'uziSprayAttack',
    label: 'Uzi Spray',
    description: 'Fast SMG capture variation inspired by Tirana 2040 Uzi loadout.',
    thumbnail: captureWeaponThumb('🔫', '#1e293b')
  },
  {
    id: 'ak47VolleyAttack',
    label: 'AK-47 Volley',
    description: 'Heavy AK volley using Gunify AK47 GLTF textures with original material maps preserved.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.ak47VolleyAttack
  },
  {
    id: 'krsvBurstAttack',
    label: 'KRSV Burst',
    description: 'KRSV firearm burst using Gunify GLTF textures/material mapping.',
    thumbnail: captureWeaponThumb('🎖️', '#6d28d9')
  },
  {
    id: 'smithSidearmAttack',
    label: 'Smith Sidearm',
    description: 'Smith sidearm takedown with original Gunify texture maps.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.smithSidearmAttack
  },
  {
    id: 'mosinMarksmanAttack',
    label: 'Mosin Marksman',
    description: 'Mosin long-range strike using Gunify GLTF textures and preserved materials.',
    thumbnail: captureWeaponThumb('🎯', '#0f172a')
  },
  {
    id: 'sigsauerTacticalAttack',
    label: 'SigSauer Tactical',
    description: 'SigSauer tactical burst using Gunify GLTF texture/material files.',
    thumbnail: captureWeaponThumb('🔫', '#1d4ed8')
  },
  {
    id: 'grenadeBlastAttack',
    label: 'Grenade Blast',
    description: 'Grenade capture with preserved GLB textures and quick throw/pickup pacing.',
    thumbnail: captureWeaponThumb('💣', '#9a3412')
  },
  {
    id: 'shotgunBlastAttack',
    label: 'Shotgun Blast',
    description: 'Short-range tactical shotgun blast with fast pickup timing.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.shotgunBlastAttack
  },
  {
    id: 'sniperShotAttack',
    label: 'Sniper Shot',
    description: 'Precision long-barrel sniper takedown sequence.',
    thumbnail: CAPTURE_WEAPON_SOURCE_THUMBNAILS.sniperShotAttack
  },
  {
    id: 'smgBurstAttack',
    label: 'SMG Burst',
    description: 'Compact SMG burst animation with controlled recoil.',
    thumbnail: captureWeaponThumb('🔫', '#0f172a')
  },
  {
    id: 'compactCarbineAttack',
    label: 'Compact Carbine',
    description: 'Open-source compact carbine-style pickup and burst capture animation.',
    thumbnail: captureWeaponThumb('🪖', '#1f2937')
  },
  {
    id: 'marksmanDmrAttack',
    label: 'Marksman DMR',
    description: 'Open-source designated marksman rifle attack with controlled right-hand aim.',
    thumbnail: captureWeaponThumb('🎯', '#334155')
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
