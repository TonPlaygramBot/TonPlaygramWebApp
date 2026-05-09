const polyHavenTexture = (assetId, mapName, resolution = '1k') =>
  `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${resolution}/${assetId}/${assetId}_${mapName}_${resolution}.jpg`;

const polyHavenMaterial = (assetId, label, mapNames, options = {}) => ({
  id: assetId,
  label,
  source: options.source || 'Poly Haven',
  license: options.license || 'CC0',
  sourceUrl: options.sourceUrl || `https://polyhaven.com/a/${assetId}`,
  gltf: `https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/${assetId}/${assetId}_1k.gltf`,
  color: polyHavenTexture(assetId, mapNames.color || 'diff'),
  normal: polyHavenTexture(assetId, mapNames.normal || 'nor_gl'),
  roughnessMap: polyHavenTexture(assetId, mapNames.roughness || 'rough'),
  aoMap: mapNames.ao ? polyHavenTexture(assetId, mapNames.ao) : null,
  metalnessMap: mapNames.metalness ? polyHavenTexture(assetId, mapNames.metalness) : null,
  sheen: options.sheen ?? 0.08,
  clearcoat: options.clearcoat ?? 0,
  normalScale: options.normalScale ?? 0.32,
  roughness: options.roughness ?? 0.78,
  metalness: options.metalness ?? 0.02,
  envMapIntensity: options.envMapIntensity ?? 0.45,
  repeat: options.repeat ?? 4,
  microDetail: options.microDetail || 'woven',
  notes: options.notes || ''
});

export const MURLAN_REALISM_SOURCE_NOTES = Object.freeze([
  Object.freeze({
    name: 'Poly Haven',
    license: 'CC0',
    url: 'https://polyhaven.com/license',
    usage: 'Runtime PBR cloth/leather/metal texture maps with direct 1k web delivery.'
  }),
  Object.freeze({
    name: 'ambientCG',
    license: 'CC0',
    url: 'https://docs.ambientcg.com/license/',
    usage: 'Approved source for future packaged PBR material imports and offline texture baking.'
  }),
  Object.freeze({
    name: 'CGBookcase',
    license: 'Free/no restriction library',
    url: 'https://www.cgbookcase.com/',
    usage: 'Approved source for future packaged fabric, grunge, roughness, AO, and wear-condition maps.'
  })
]);

export const MURLAN_REALISM_RENDERING_GUIDE = Object.freeze({
  inspiration: 'NVIDIA DLSS/RTX neural-rendering philosophy',
  principles: Object.freeze([
    'preserve original glTF UVs and add detail through PBR map normalization, anisotropy, and micro detail',
    'prefer temporally stable geometry/material details over shimmering high-frequency overlays',
    'increase perceived sharpness through material contrast, normal detail, AO, and clean roughness response',
    'keep mobile portrait performance safe by sharing cached textures and small procedural detail maps'
  ])
});

export const MURLAN_CHARACTER_MATERIAL_LIBRARY = Object.freeze({
  denim: polyHavenMaterial('denim_fabric', 'royal blue denim', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 4.2, roughness: 0.84, normalScale: 0.34, microDetail: 'twill' }),
  gingham: polyHavenMaterial('gingham_check', 'court gingham cotton', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 3.8, roughness: 0.82, normalScale: 0.28, microDetail: 'woven-check' }),
  hessian: polyHavenMaterial('hessian_230', 'coarse linen hessian', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 3.2, roughness: 0.9, normalScale: 0.48, microDetail: 'coarse-weave' }),
  jacquard: polyHavenMaterial('floral_jacquard', 'royal floral jacquard', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 3.0, roughness: 0.72, normalScale: 0.26, sheen: 0.32, envMapIntensity: 0.58, microDetail: 'embroidered' }),
  fleece: polyHavenMaterial('knitted_fleece', 'knitted fleece', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 5.0, roughness: 0.88, normalScale: 0.38, microDetail: 'knit' }),
  patternedCotton: polyHavenMaterial('fabric_pattern_07', 'patterned noble cotton', { color: 'col_1', normal: 'nor_gl', roughness: 'rough' }, { repeat: 3.4, roughness: 0.8, normalScale: 0.26, microDetail: 'printed' }),
  cottonJersey: polyHavenMaterial('cotton_jersey', 'soft cotton jersey', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 3.8, roughness: 0.86, normalScale: 0.25, microDetail: 'fine-knit' }),
  woolHerringbone: polyHavenMaterial('poly_wool_herringbone', 'noble herringbone wool', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 4.4, roughness: 0.82, normalScale: 0.36, sheen: 0.18, microDetail: 'herringbone' }),
  brownLeather: polyHavenMaterial('brown_leather', 'polished brown leather', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 2.6, roughness: 0.52, metalness: 0.03, clearcoat: 0.18, normalScale: 0.22, envMapIntensity: 0.78, microDetail: 'creased-leather' }),
  whiteLeather: polyHavenMaterial('leather_white', 'white ceremonial leather', { color: 'diff', normal: 'nor_gl', roughness: 'rough' }, { repeat: 2.0, roughness: 0.48, clearcoat: 0.16, normalScale: 0.2, envMapIntensity: 0.72, microDetail: 'smooth-leather' })
});

export const MURLAN_ROYAL_STYLE_PROFILES = Object.freeze([
  Object.freeze({
    id: 'albanian-court-tailor',
    label: 'Albanian Court Tailor',
    skinTone: 0xd9a27d,
    hairColor: 0x24150f,
    eyeColor: 0x2f5d7c,
    lipTint: 0xa45d56,
    makeup: 'soft-royal',
    ageDetail: 0.22,
    facialHair: 'clean',
    jewelry: 'antiqueGold',
    garments: Object.freeze({
      upper: Object.freeze({ material: 'cottonJersey', tint: 0xf1f5f9, repeat: 3.8, trim: 'antiqueGold', stitch: 0xdbc08a }),
      lower: Object.freeze({ material: 'woolHerringbone', tint: 0x2f3748, repeat: 4.2, stitch: 0x8090aa }),
      accent: Object.freeze({ material: 'brownLeather', tint: 0x7b4d2f, repeat: 2.6, trim: 'antiqueGold' }),
      shoes: Object.freeze({ material: 'whiteLeather', tint: 0xdfe5ea, repeat: 2.0 })
    })
  }),
  Object.freeze({
    id: 'ruby-casino-noble',
    label: 'Ruby Casino Noble',
    skinTone: 0xc78f68,
    hairColor: 0x14100c,
    eyeColor: 0x5a3d2b,
    lipTint: 0x8d5148,
    makeup: 'warm-matte',
    ageDetail: 0.28,
    facialHair: 'mustache',
    jewelry: 'darkGunmetal',
    garments: Object.freeze({
      upper: Object.freeze({ material: 'gingham', tint: 0xb7375d, repeat: 3.8, trim: 'darkGunmetal', stitch: 0xf0c6d0 }),
      lower: Object.freeze({ material: 'denim', tint: 0x243e70, repeat: 4.4, stitch: 0x8fb0d8 }),
      accent: Object.freeze({ material: 'hessian', tint: 0xf4d7a1, repeat: 3.2, trim: 'antiqueGold' }),
      shoes: Object.freeze({ material: 'brownLeather', tint: 0x3b2518, repeat: 2.2 })
    })
  }),
  Object.freeze({
    id: 'emerald-silk-duchess',
    label: 'Emerald Silk Duchess',
    skinTone: 0xe0b18d,
    hairColor: 0x2c1b12,
    eyeColor: 0x406a45,
    lipTint: 0xb45f6d,
    makeup: 'emerald-liner',
    ageDetail: 0.18,
    facialHair: 'clean',
    jewelry: 'antiqueGold',
    garments: Object.freeze({
      upper: Object.freeze({ material: 'jacquard', tint: 0x2f7d60, repeat: 3.2, trim: 'antiqueGold', stitch: 0xc9b06d }),
      lower: Object.freeze({ material: 'woolHerringbone', tint: 0x202a36, repeat: 4.5, stitch: 0x708090 }),
      accent: Object.freeze({ material: 'whiteLeather', tint: 0xf6eadb, repeat: 2.2, trim: 'antiqueGold' }),
      shoes: Object.freeze({ material: 'brownLeather', tint: 0x5b3926, repeat: 2.0 })
    })
  }),
  Object.freeze({
    id: 'violet-jacquard-king',
    label: 'Violet Jacquard King',
    skinTone: 0xb87957,
    hairColor: 0x3a2418,
    eyeColor: 0x364f7d,
    lipTint: 0x7e4641,
    makeup: 'none',
    ageDetail: 0.38,
    facialHair: 'beard-shadow',
    jewelry: 'antiqueGold',
    garments: Object.freeze({
      upper: Object.freeze({ material: 'jacquard', tint: 0x7c3f88, repeat: 3.2, trim: 'antiqueGold', stitch: 0xd9b46e }),
      lower: Object.freeze({ material: 'denim', tint: 0x1f335f, repeat: 4.5, stitch: 0x8292c4 }),
      accent: Object.freeze({ material: 'gingham', tint: 0xe3c16f, repeat: 4.0, trim: 'darkGunmetal' }),
      shoes: Object.freeze({ material: 'brownLeather', tint: 0x2e1c12, repeat: 2.2 })
    })
  })
]);

export const MURLAN_TRIM_MATERIALS = Object.freeze({
  antiqueGold: Object.freeze({ color: 0xd4af37, roughness: 0.34, metalness: 0.82, envMapIntensity: 0.95 }),
  darkGunmetal: Object.freeze({ color: 0x303946, roughness: 0.42, metalness: 0.72, envMapIntensity: 0.75 }),
  pearl: Object.freeze({ color: 0xf4eee3, roughness: 0.24, metalness: 0.05, envMapIntensity: 0.9 })
});

export function resolveMurlanStyleProfile(theme, seatIndex = 0) {
  if (theme?.realismProfile) {
    const matched = MURLAN_ROYAL_STYLE_PROFILES.find((profile) => profile.id === theme.realismProfile);
    if (matched) return matched;
  }
  return MURLAN_ROYAL_STYLE_PROFILES[Math.abs(seatIndex) % MURLAN_ROYAL_STYLE_PROFILES.length];
}

export function resolveMurlanGarment(profile, slot) {
  return profile?.garments?.[slot] || profile?.garments?.upper || MURLAN_ROYAL_STYLE_PROFILES[0].garments.upper;
}

export function resolveMurlanMaterial(materialId) {
  return MURLAN_CHARACTER_MATERIAL_LIBRARY[materialId] || MURLAN_CHARACTER_MATERIAL_LIBRARY.denim;
}
