export const mobileUrbanFpsAssets = {
  weapon: {
    rifleGlb: '/assets/games/mobile-urban-fps/weapons/aged-rifle.glb',
    normal:
      '/assets/games/mobile-urban-fps/weapons/worn_blued_steel_normal.webp',
    roughness:
      '/assets/games/mobile-urban-fps/weapons/oily_scratched_roughness.webp',
    metallic: '/assets/games/mobile-urban-fps/weapons/rusty_metallic.webp',
    woodAlbedo:
      '/assets/games/mobile-urban-fps/weapons/cracked_varnished_wood.webp'
  },
  hands: {
    armsGlb: '/assets/games/mobile-urban-fps/characters/tactical-arms.glb',
    gloveNormal:
      '/assets/games/mobile-urban-fps/characters/dirty_leather_glove_normal.webp'
  },
  enemies: {
    soldierGlb: '/assets/games/mobile-urban-fps/enemies/urban-soldier-lod0.glb',
    soldierLod1Glb:
      '/assets/games/mobile-urban-fps/enemies/urban-soldier-lod1.glb',
    clothNormal: '/assets/games/mobile-urban-fps/enemies/worn_cloth_normal.webp'
  },
  city: {
    buildingGlb: '/assets/games/mobile-urban-fps/city/modular-building-kit.glb',
    road: '/assets/games/mobile-urban-fps/materials/asphalt_wet_dry_1k.webp',
    roadNormal:
      '/assets/games/mobile-urban-fps/materials/asphalt_normal_1k.webp',
    concrete:
      '/assets/games/mobile-urban-fps/materials/stained_concrete_1k.webp',
    brick: '/assets/games/mobile-urban-fps/materials/dirty_brick_1k.webp',
    metal: '/assets/games/mobile-urban-fps/materials/edge_worn_metal_1k.webp',
    glass:
      '/assets/games/mobile-urban-fps/materials/dusty_reflective_glass_1k.webp',
    propsGlb: '/assets/games/mobile-urban-fps/city/urban-cover-props.glb'
  },
  audio: {
    shoot: '/assets/games/mobile-urban-fps/audio/rifle-shot.ogg',
    reload: '/assets/games/mobile-urban-fps/audio/rifle-reload.ogg',
    hit: '/assets/games/mobile-urban-fps/audio/hit-marker.ogg',
    enemyAttack: '/assets/games/mobile-urban-fps/audio/enemy-attack.ogg'
  }
} as const;

export const assetSourceNotes = [
  'Replace placeholder paths with CC0/CC-BY GLB and PBR texture packs from Poly Haven, AmbientCG, CGBookcase, Kenney, Quaternius, Sketchfab CC, OpenGameArt, ShareTextures, or 3DTextures.',
  'Keep mobile texture variants around 512px-1024px, prefer KTX2/Basis where supported, and ship LOD GLB variants for enemies and city modules.'
];
