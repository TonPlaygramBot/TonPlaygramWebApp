import * as THREE from 'three';

const CUSHION_SHADOW_GREY = '#666a72';

const TABLE_PARTS = [
  'cloth',
  'cushion',
  'topWoodRail',
  'sideWoodApron',
  'pocketCup',
  'cornerPocketPlate',
  'middlePocketPlate',
  'verticalCornerRim',
  'baseCornerBlock',
  'leg',
  'baseFoot',
  'lowerTrim',
  'railSight',
  'underside'
];

const PART_TO_CONTROL = {
  cloth: 'cloth',
  cushion: 'cushion',
  topWoodRail: 'topWoodRail',
  sideWoodApron: 'metalAccent',
  pocketCup: 'jaws',
  cornerPocketPlate: 'metalAccent',
  middlePocketPlate: 'metalAccent',
  verticalCornerRim: 'metalAccent',
  baseCornerBlock: 'legBase',
  leg: 'legBase',
  baseFoot: 'metalAccent',
  lowerTrim: 'metalAccent',
  railSight: 'metalAccent',
  underside: 'legBase'
};

export const POOL_ROYALE_SHOWOOD_CONTROL_PARTS = [
  'cloth',
  'cushion',
  'metalAccent',
  'jaws',
  'topWoodRail',
  'legBase'
];

export const POOL_ROYALE_SHOWOOD_CONTROL_META = {
  cloth: { label: 'Field cloth', description: 'Only the flat playfield surface.' },
  cushion: {
    label: 'Cushions',
    description:
      'Reference Showood mapping: matched green or black rubber while preserving the GLB cushion texture.'
  },
  metalAccent: {
    label: 'Rail sights + side strip + feet',
    description: 'One gold/chrome control for sights, side apron strip, vertical rims, trims, plates, and feet.'
  },
  jaws: { label: 'Jaws', description: 'Pocket jaws / cups: black or brown.' },
  topWoodRail: { label: 'Top rail frame', description: 'Main top wood rail frame.' },
  legBase: { label: 'Legs + base', description: 'Legs and lower base blocks together, separate from metal accents.' }
};

export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = {
  cloth: {
    a: { label: 'Green field', color: '#0a7b33', metalness: 0, roughness: 1, envMapIntensity: 0.16 },
    b: { label: 'Blue field', color: '#0d4fb8', metalness: 0, roughness: 1, envMapIntensity: 0.16 }
  },
  cushion: {
    a: { label: 'Matched green', color: '#064f22', metalness: 0, roughness: 0.88, envMapIntensity: 0.55 },
    b: { label: 'Black rubber', color: '#050505', metalness: 0, roughness: 0.86, envMapIntensity: 0.55 }
  },
  metalAccent: {
    a: { label: 'Gold', color: '#d8b23d', metalness: 0.98, roughness: 0.06, envMapIntensity: 6.8, clearcoat: 1, clearcoatRoughness: 0.03 },
    b: { label: 'Chrome', color: '#d7dde7', metalness: 1, roughness: 0.055, envMapIntensity: 7.2, clearcoat: 1, clearcoatRoughness: 0.025 }
  },
  jaws: {
    a: { label: 'Black jaws', color: '#020202', metalness: 0, roughness: 0.96, envMapIntensity: 0.14 },
    b: { label: 'Brown jaws', color: '#2a1207', metalness: 0, roughness: 0.88, envMapIntensity: 0.26 }
  },
  topWoodRail: {
    a: { label: 'Walnut frame', color: '#5a2608', metalness: 0.02, roughness: 0.38, envMapIntensity: 1.35, clearcoat: 0.42, clearcoatRoughness: 0.18 },
    b: { label: 'Black frame', color: '#070605', metalness: 0.04, roughness: 0.28, envMapIntensity: 1.75, clearcoat: 0.7, clearcoatRoughness: 0.1 }
  },
  legBase: {
    a: { label: 'Brown legs/base', color: '#3d1706', metalness: 0.02, roughness: 0.52, envMapIntensity: 1, clearcoat: 0.2, clearcoatRoughness: 0.36 },
    b: { label: 'Black legs/base', color: '#070504', metalness: 0.04, roughness: 0.4, envMapIntensity: 1.22, clearcoat: 0.32, clearcoatRoughness: 0.26 }
  }
};

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: 'a',
  cushion: 'a',
  metalAccent: 'a',
  jaws: 'a',
  topWoodRail: 'a',
  legBase: 'b'
});

const KEEP_TEXTURE_PARTS = new Set(['cushion', 'topWoodRail', 'leg', 'baseCornerBlock', 'underside']);
const FINE_PARTS = new Set([
  'pocketCup',
  'cornerPocketPlate',
  'middlePocketPlate',
  'verticalCornerRim',
  'baseCornerBlock',
  'lowerTrim',
  'railSight',
  'underside'
]);

export function normalizePoolRoyaleShowoodPalette(palette = {}) {
  return POOL_ROYALE_SHOWOOD_CONTROL_PARTS.reduce((acc, control) => {
    acc[control] = palette?.[control] === 'b' ? 'b' : POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE[control];
    return acc;
  }, {});
}

function optionForPart(part, palette) {
  return POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS[PART_TO_CONTROL[part]][palette[PART_TO_CONTROL[part]]];
}

function patchTexture(texture, isColorTexture = false) {
  if (!texture) return;
  if (isColorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
}

function patchMaterial(material) {
  [material.map, material.emissiveMap, material.lightMap].forEach((texture) => patchTexture(texture, true));
  [material.normalMap, material.bumpMap, material.roughnessMap, material.metalnessMap, material.aoMap, material.alphaMap].forEach((texture) => patchTexture(texture));
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
}

function snapshotMaterial(material) {
  return {
    color: material.color?.clone?.() ?? new THREE.Color('#ffffff'),
    emissive: material.emissive?.clone?.() ?? new THREE.Color('#000000'),
    metalness: material.metalness ?? 0,
    roughness: material.roughness ?? 0.55,
    envMapIntensity: material.envMapIntensity ?? 1,
    clearcoat: material.clearcoat ?? 0,
    clearcoatRoughness: material.clearcoatRoughness ?? 0,
    map: material.map ?? null,
    normalMap: material.normalMap ?? null,
    bumpMap: material.bumpMap ?? null,
    roughnessMap: material.roughnessMap ?? null,
    metalnessMap: material.metalnessMap ?? null,
    aoMap: material.aoMap ?? null,
    emissiveMap: material.emissiveMap ?? null,
    lightMap: material.lightMap ?? null,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent,
    opacity: material.opacity
  };
}

function restoreMaterial(material) {
  const snap = material.userData?.originalSnapshot;
  if (!snap) return;
  material.color.copy(snap.color);
  material.emissive?.copy?.(snap.emissive);
  material.metalness = snap.metalness;
  material.roughness = snap.roughness;
  material.envMapIntensity = snap.envMapIntensity;
  material.clearcoat = snap.clearcoat;
  material.clearcoatRoughness = snap.clearcoatRoughness;
  material.map = snap.map;
  material.normalMap = snap.normalMap;
  material.bumpMap = snap.bumpMap;
  material.roughnessMap = snap.roughnessMap;
  material.metalnessMap = snap.metalnessMap;
  material.aoMap = snap.aoMap;
  material.emissiveMap = snap.emissiveMap;
  material.lightMap = snap.lightMap;
  material.alphaMap = snap.alphaMap;
  material.transparent = snap.transparent;
  material.opacity = snap.opacity;
  material.depthWrite = true;
}

function clearMaps(material) {
  material.map = null;
  material.normalMap = null;
  material.bumpMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.aoMap = null;
  material.emissiveMap = null;
  material.lightMap = null;
  material.alphaMap = null;
}

function cloneWorking(raw) {
  const source = raw || new THREE.MeshPhysicalMaterial();
  const material = new THREE.MeshPhysicalMaterial({
    name: source.name || 'source_material',
    color: source.color ? source.color.clone() : new THREE.Color('#ffffff'),
    emissive: source.emissive ? source.emissive.clone() : new THREE.Color('#000000'),
    map: source.map ?? null,
    normalMap: source.normalMap ?? null,
    bumpMap: source.bumpMap ?? null,
    roughnessMap: source.roughnessMap ?? null,
    metalnessMap: source.metalnessMap ?? null,
    aoMap: source.aoMap ?? null,
    emissiveMap: source.emissiveMap ?? null,
    lightMap: source.lightMap ?? null,
    alphaMap: source.alphaMap ?? null,
    roughness: typeof source.roughness === 'number' ? source.roughness : 0.55,
    metalness: typeof source.metalness === 'number' ? source.metalness : 0,
    transparent: source.transparent,
    opacity: source.opacity
  });
  material.clearcoat = typeof source.clearcoat === 'number' ? source.clearcoat : 0;
  material.clearcoatRoughness = typeof source.clearcoatRoughness === 'number' ? source.clearcoatRoughness : 0.18;
  material.userData.originalSnapshot = snapshotMaterial(material);
  patchMaterial(material);
  return material;
}

function colorFlags(material) {
  const color = material.color instanceof THREE.Color ? material.color : new THREE.Color('#ffffff');
  return {
    green: color.g > color.r * 1.14 && color.g > color.b * 1.08 && color.g > 0.11,
    black: color.r < 0.11 && color.g < 0.11 && color.b < 0.11,
    brown: color.r > color.b * 1.12 && color.g > color.b * 0.48 && color.r > 0.07 && color.g < color.r * 0.9,
    gold: color.r > 0.42 && color.g > 0.29 && color.b < 0.25 && color.r >= color.g * 0.88,
    light: color.r > 0.72 && color.g > 0.72 && color.b > 0.62
  };
}

function cleanName(value) {
  return (value || 'unnamed').replace(/\s+/g, '_').toLowerCase();
}

function makeSlotKey(mesh, sourceMaterialIndex, material) {
  return `${cleanName(mesh.name)}::slot_${sourceMaterialIndex}::${cleanName(material.name)}`;
}

function materialIndexAtOffset(geometry, offset) {
  if (!geometry.groups.length) return 0;
  return geometry.groups.find((item) => offset >= item.start && offset < item.start + item.count)?.materialIndex ?? 0;
}

function triangleWorld(mesh, geometry, aIndex, bIndex, cIndex) {
  const position = geometry.attributes.position;
  const a = new THREE.Vector3().fromBufferAttribute(position, aIndex).applyMatrix4(mesh.matrixWorld);
  const b = new THREE.Vector3().fromBufferAttribute(position, bIndex).applyMatrix4(mesh.matrixWorld);
  const c = new THREE.Vector3().fromBufferAttribute(position, cIndex).applyMatrix4(mesh.matrixWorld);
  const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
  const normal = new THREE.Vector3()
    .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
    .normalize()
    .transformDirection(mesh.matrixWorld);
  return { center, normal };
}

function spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize) {
  const { center, normal } = triangleWorld(mesh, geometry, aIndex, bIndex, cIndex);
  const relX = Math.abs(center.x - tableCenter.x) / Math.max(tableSize.x * 0.5, 0.001);
  const relZ = Math.abs(center.z - tableCenter.z) / Math.max(tableSize.z * 0.5, 0.001);
  const relY = (center.y - tableBox.min.y) / Math.max(tableSize.y, 0.001);
  const xIsLongAxis = tableSize.x >= tableSize.z;
  const longN = xIsLongAxis ? relX : relZ;
  const shortN = xIsLongAxis ? relZ : relX;
  const upFace = normal.y > 0.33;
  const sideFace = Math.abs(normal.x) > 0.25 || Math.abs(normal.z) > 0.25;
  const downFace = normal.y < -0.33;
  return { relY, longN, shortN, upFace, sideFace, downFace };
}

function classifyTriangle(mesh, geometry, material, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize) {
  const name = `${mesh.name || ''} ${material.name || ''}`.toLowerCase();
  const s = spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize);
  const flags = colorFlags(material);

  const namedCloth = /cloth|felt|fabric|surface|bed|slate/i.test(name);
  const namedCushion = /cushion|rubber|bumper|railrubber/i.test(name);
  const namedPocket = /pocket|hole|drop|net|liner|leather|cup/i.test(name);
  const namedHardware = /trim|bezel|ring|metal|chrome|brass|gold|plate|cap|rim|guard|insert|hardware|bolt|screw/i.test(name);
  const namedSight = /sight|diamond|marker|dot|inlay/i.test(name);
  const namedWood = /wood|walnut|rail|apron|leg|base|frame|cabinet|corner|showood|support/i.test(name);
  const metalish = material.metalness > 0.16 || material.clearcoat > 0.58 || flags.gold;

  const high = s.relY > 0.54;
  const veryTop = s.relY > 0.65;
  const low = s.relY <= 0.16;
  const sideMiddlePocketZone = high && s.longN < 0.255 && s.shortN > 0.69;
  const cornerPocketZone = high && s.longN > 0.68 && s.shortN > 0.66;
  const anyPocketZone = sideMiddlePocketZone || cornerPocketZone;
  const centralCloth = high && s.upFace && s.longN < 0.61 && s.shortN < 0.53;
  const cushionBand = high && (s.longN > 0.52 || s.shortN > 0.49) && (s.longN < 0.9 || s.shortN < 0.9);
  const topRailBand = high && (s.longN > 0.58 || s.shortN > 0.535);
  const topRailNonPocket = topRailBand && !anyPocketZone;
  const topRailSideVerticalRimZone = s.sideFace && !s.upFace && s.relY > 0.46 && s.relY < 0.96 && s.longN > 0.6 && s.shortN > 0.58;
  const underRailSightCornerRimZone = s.sideFace && !s.upFace && s.relY > 0.36 && s.relY < 0.76 && s.longN > 0.67 && s.shortN > 0.52;
  const outsideBaseCornerRimZone = s.sideFace && s.relY > 0.08 && s.relY < 0.78 && s.longN > 0.72 && s.shortN > 0.54;
  const outerMostVerticalCorner = s.sideFace && s.relY > 0.1 && s.relY < 0.8 && s.longN > 0.8 && s.shortN > 0.68;
  const baseCornerZone = s.sideFace && s.relY > 0.12 && s.relY < 0.64 && ((s.longN > 0.1 && s.longN < 0.56 && s.shortN < 0.36) || (s.longN > 0.58 && s.shortN > 0.56)) && !(underRailSightCornerRimZone || topRailSideVerticalRimZone);
  const legZone = s.sideFace && s.relY > 0.14 && s.relY < 0.62 && s.longN < 0.62 && s.shortN < 0.58;
  const railSightDownBand = s.sideFace && !s.upFace && !anyPocketZone && s.relY > 0.44 && s.relY < 0.72 && (s.longN > 0.54 || s.shortN > 0.48) && !(topRailSideVerticalRimZone || underRailSightCornerRimZone || outsideBaseCornerRimZone || outerMostVerticalCorner || baseCornerZone || legZone);
  const sideLowerTrimZone = s.sideFace && s.relY > 0.18 && s.relY < 0.44 && (s.longN > 0.54 || s.shortN > 0.54);
  const hardwareCandidate = namedHardware || metalish || ((flags.black || flags.gold || flags.light) && !flags.green && !flags.brown && !namedWood);
  const pocketInteriorCandidate = namedPocket || (flags.black && anyPocketZone && (s.downFace || s.sideFace || s.relY < 0.79) && !hardwareCandidate);

  if (namedCloth) return 'cloth';
  if (namedCushion) return 'cushion';
  if (namedSight && high) return 'railSight';
  if (pocketInteriorCandidate) return 'pocketCup';
  if (namedPocket && hardwareCandidate && sideMiddlePocketZone) return 'middlePocketPlate';
  if (namedPocket && hardwareCandidate && cornerPocketZone) return 'cornerPocketPlate';
  if (hardwareCandidate && sideMiddlePocketZone && !flags.green && !flags.brown) return 'middlePocketPlate';
  if (hardwareCandidate && cornerPocketZone && !flags.green && !flags.brown) return 'cornerPocketPlate';
  if (flags.green && centralCloth) return 'cloth';
  if (flags.green && cushionBand) return 'cushion';
  if (topRailSideVerticalRimZone || underRailSightCornerRimZone || outsideBaseCornerRimZone || outerMostVerticalCorner) return 'verticalCornerRim';
  if (hardwareCandidate && topRailNonPocket && s.upFace && !flags.brown && !flags.green) return 'railSight';
  if (low) return 'baseFoot';
  if (s.downFace && s.relY < 0.5) return 'underside';
  if ((flags.brown || namedWood) && baseCornerZone) return 'baseCornerBlock';
  if (baseCornerZone) return 'baseCornerBlock';
  if (legZone && (flags.brown || namedWood || !hardwareCandidate)) return 'leg';
  if (hardwareCandidate && sideLowerTrimZone && !flags.green) return 'lowerTrim';
  if (railSightDownBand && !flags.green) return 'sideWoodApron';
  if (veryTop && (s.upFace || topRailBand) && !flags.green) return 'topWoodRail';
  if (high && s.sideFace && !flags.green && !anyPocketZone) return 'sideWoodApron';
  return 'sideWoodApron';
}

function isCushionShadowTriangle(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize) {
  const s = spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize);
  return s.downFace && s.relY > 0.46 && s.relY < 0.84 && ((s.longN > 0.6 && s.longN < 0.95) || (s.shortN > 0.42 && s.shortN < 0.88));
}

function createSlotStat() {
  return { total: 0, dominantPart: 'sideWoodApron', dominantRatio: 1, parts: Object.fromEntries(TABLE_PARTS.map((part) => [part, 0])) };
}

function updateSlotStat(stats, sourceSlot, part) {
  const stat = stats.get(sourceSlot) ?? createSlotStat();
  stat.total += 1;
  stat.parts[part] = (stat.parts[part] || 0) + 1;
  stat.dominantPart = TABLE_PARTS.reduce((best, item) => ((stat.parts[item] || 0) > (stat.parts[best] || 0) ? item : best), stat.dominantPart);
  stat.dominantRatio = stat.total > 0 ? (stat.parts[stat.dominantPart] || 0) / stat.total : 1;
  stats.set(sourceSlot, stat);
}

function resolvePart(triangle, slotStats) {
  const stat = slotStats.get(triangle.sourceSlot);
  if (!stat) return triangle.part;
  if (FINE_PARTS.has(triangle.part) && triangle.part !== stat.dominantPart) return triangle.part;
  const mixedClothCushion = (stat.parts.cloth || 0) > 0 && (stat.parts.cushion || 0) > 0;
  if (mixedClothCushion && (triangle.part === 'cloth' || triangle.part === 'cushion')) return triangle.part;
  if ((triangle.part === 'cloth' || triangle.part === 'cushion') && stat.dominantRatio >= 0.88) return stat.dominantPart;
  return stat.dominantRatio >= 0.965 ? stat.dominantPart : triangle.part;
}

function applyMaterial(material, part, option, cushionShadow = false) {
  restoreMaterial(material);
  if (part === 'cushion' && cushionShadow) {
    material.color.set(CUSHION_SHADOW_GREY);
    material.metalness = 0;
    material.roughness = 0.96;
    material.envMapIntensity = 0.22;
    material.clearcoat = 0;
    material.clearcoatRoughness = 0;
    clearMaps(material);
  } else {
    material.color.set(option.color);
    material.metalness = option.metalness;
    material.roughness = option.roughness;
    material.envMapIntensity = option.envMapIntensity;
    material.clearcoat = option.clearcoat ?? 0;
    material.clearcoatRoughness = option.clearcoatRoughness ?? 0;
    if (!KEEP_TEXTURE_PARTS.has(part)) clearMaps(material);
  }
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.userData.part = part;
  material.userData.cushionShadow = cushionShadow;
  patchMaterial(material);
}

function makePartMaterial(source, part, palette, sourceSlot, meshName, materialName, cushionShadow = false) {
  const material = source.clone();
  material.name = `${source.name || 'source'}__${part}${cushionShadow ? '__shadow' : ''}`;
  material.userData.originalSnapshot = snapshotMaterial(source);
  material.userData.part = part;
  material.userData.sourceSlot = sourceSlot;
  material.userData.meshName = meshName;
  material.userData.materialName = materialName;
  material.userData.cushionShadow = cushionShadow;
  applyMaterial(material, part, optionForPart(part, palette), cushionShadow);
  return material;
}

export function applyPoolRoyaleShowoodReferenceMapping(root, paletteInput = {}) {
  if (!root) return { counts: {} };
  const palette = normalizePoolRoyaleShowoodPalette(paletteInput);
  root.updateMatrixWorld(true);
  const tableBox = new THREE.Box3().setFromObject(root);
  const tableCenter = tableBox.getCenter(new THREE.Vector3());
  const tableSize = tableBox.getSize(new THREE.Vector3());
  const slotStats = new Map();
  const buildData = [];
  const counts = Object.fromEntries(TABLE_PARTS.map((part) => [part, 0]));

  root.traverse((child) => {
    if (!child?.isMesh) return;
    const mesh = child;
    const sourceGeometry = mesh.geometry?.clone?.();
    const position = sourceGeometry?.attributes?.position;
    if (!sourceGeometry || !position) return;
    const sourceMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => cloneWorking(material));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const oldIndex = sourceGeometry.index;
    const totalIndices = oldIndex ? oldIndex.count : position.count;
    const triangles = [];
    for (let i = 0; i + 2 < totalIndices; i += 3) {
      const a = oldIndex ? oldIndex.getX(i) : i;
      const b = oldIndex ? oldIndex.getX(i + 1) : i + 1;
      const c = oldIndex ? oldIndex.getX(i + 2) : i + 2;
      const sourceMaterialIndex = Math.min(materialIndexAtOffset(sourceGeometry, i), sourceMaterials.length - 1);
      const sourceMaterial = sourceMaterials[Math.max(0, sourceMaterialIndex)];
      const sourceSlot = makeSlotKey(mesh, sourceMaterialIndex, sourceMaterial);
      const part = classifyTriangle(mesh, sourceGeometry, sourceMaterial, a, b, c, tableBox, tableCenter, tableSize);
      const cushionShadow = part === 'cushion' && isCushionShadowTriangle(mesh, sourceGeometry, a, b, c, tableBox, tableCenter, tableSize);
      triangles.push({ a, b, c, sourceMaterialIndex, sourceSlot, part, cushionShadow });
      updateSlotStat(slotStats, sourceSlot, part);
    }
    buildData.push({ mesh, sourceGeometry, sourceMaterials, triangles });
  });

  buildData.forEach(({ mesh, sourceGeometry, sourceMaterials, triangles }) => {
    const finalGeometry = sourceGeometry.clone();
    const finalMaterials = [];
    const materialLookup = new Map();
    const finalIndex = [];
    finalGeometry.clearGroups();
    const getMaterialIndex = (sourceMaterialIndex, sourceSlot, part, cushionShadow = false) => {
      const key = `${sourceSlot}::${part}::${cushionShadow ? 'shadow' : 'main'}`;
      if (materialLookup.has(key)) return materialLookup.get(key);
      const source = sourceMaterials[Math.max(0, Math.min(sourceMaterialIndex, sourceMaterials.length - 1))];
      const material = makePartMaterial(source, part, palette, sourceSlot, mesh.name || 'unnamed mesh', source.name || 'unnamed material', cushionShadow);
      const index = finalMaterials.length;
      finalMaterials.push(material);
      materialLookup.set(key, index);
      return index;
    };

    triangles.forEach((triangle) => {
      const part = resolvePart(triangle, slotStats);
      const cushionShadow = part === 'cushion' && triangle.cushionShadow;
      const materialIndex = getMaterialIndex(triangle.sourceMaterialIndex, triangle.sourceSlot, part, cushionShadow);
      const start = finalIndex.length;
      finalIndex.push(triangle.a, triangle.b, triangle.c);
      finalGeometry.addGroup(start, 3, materialIndex);
      counts[part] = (counts[part] || 0) + 1;
    });

    finalGeometry.setIndex(finalIndex);
    finalGeometry.computeBoundingBox();
    finalGeometry.computeBoundingSphere();
    mesh.geometry?.dispose?.();
    mesh.geometry = finalGeometry;
    mesh.material = finalMaterials.length > 1 ? finalMaterials : finalMaterials[0];
  });

  root.userData = {
    ...(root.userData || {}),
    poolRoyaleShowoodReferenceMapping: true,
    poolRoyaleShowoodPalette: palette,
    poolRoyaleShowoodCounts: counts
  };
  return { counts, palette };
}
