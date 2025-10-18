import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';
import {
  applyWoodTextures,
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID,
  DEFAULT_WOOD_GRAIN_ID,
  disposeMaterialWithWood
} from './woodMaterials.js';

const DEFAULT_TABLE_BASE_OPTION = Object.freeze({
  id: 'obsidian',
  label: 'Bazë Obsidian',
  baseColor: '#141414',
  columnColor: '#0b0d10',
  trimColor: '#1f232a',
  metalness: 0.75,
  roughness: 0.35
});

const DEFAULT_TABLE_WOOD_OPTION = Object.freeze({
  id: 'walnutHeritage',
  label: 'Arre Heritage',
  presetId: 'walnut',
  grainId: 'heritagePlanks'
});

const DEFAULT_TABLE_CLOTH_OPTION = Object.freeze({
  id: 'emerald',
  label: 'Rrobë Smerald',
  feltTop: '#0f6a2f',
  feltBottom: '#054d24',
  emissive: '#021a0b'
});

const DEFAULT_TABLE_SHAPE_OPTION = Object.freeze({
  id: 'classicOctagon',
  label: 'Oktagon Klasik',
  type: 'polygon',
  sides: 8,
  innerScale: 0.78,
  rimInnerScale: 0.73,
  trimOuterScale: 1.04,
  trimInnerScale: 0.9,
  segments: 8
});

export function createRegularPolygonShape(sides = 8, radius = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function createCircularShape(radius = 1, segments = 48) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  shape.closePath();
  return shape;
}

function createOvalShape(radius = 1, widthScale = 1, heightScale = 0.68, segments = 48) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius * widthScale;
    const y = Math.sin(angle) * radius * heightScale;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function createRacetrackShape(radius = 1, widthScale = 1, heightScale = 0.62, cornerScale = 0.32, segments = 48) {
  const halfWidth = radius * widthScale;
  const halfHeight = radius * heightScale;
  const cornerRadius = Math.min(halfHeight, halfWidth) * cornerScale;
  const segmentCount = Math.max(4, segments);
  const arcSegments = Math.floor(segmentCount / 4);
  const shape = new THREE.Shape();

  const drawArc = (cx, cy, startAngle, endAngle) => {
    for (let i = 0; i <= arcSegments; i += 1) {
      const t = startAngle + ((endAngle - startAngle) * i) / arcSegments;
      const x = cx + Math.cos(t) * cornerRadius;
      const y = cy + Math.sin(t) * cornerRadius;
      shape.lineTo(x, y);
    }
  };

  shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
  shape.lineTo(halfWidth - cornerRadius, -halfHeight);
  drawArc(halfWidth - cornerRadius, -halfHeight + cornerRadius, -Math.PI / 2, 0);
  shape.lineTo(halfWidth, halfHeight - cornerRadius);
  drawArc(halfWidth - cornerRadius, halfHeight - cornerRadius, 0, Math.PI / 2);
  shape.lineTo(-halfWidth + cornerRadius, halfHeight);
  drawArc(-halfWidth + cornerRadius, halfHeight - cornerRadius, Math.PI / 2, Math.PI);
  shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
  drawArc(-halfWidth + cornerRadius, -halfHeight + cornerRadius, Math.PI, (Math.PI * 3) / 2);
  shape.closePath();
  return shape;
}

function scaleShape(shape, scaleX = 1, scaleY = 1) {
  const scaled = shape.clone();
  scaled.scale(scaleX, scaleY);
  return scaled;
}

function computeShapeRadius(shape) {
  const { shape: points } = shape.extractPoints(64);
  return points.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);
}

function resolveShapeConfiguration(option = {}) {
  return {
    ...DEFAULT_TABLE_SHAPE_OPTION,
    ...option
  };
}

function buildTableShape(option, radius) {
  const config = resolveShapeConfiguration(option);
  const segments = Math.max(4, config.segments ?? 32);
  let topShape;
  switch (config.type) {
    case 'circle':
      topShape = createCircularShape(radius, segments);
      break;
    case 'oval':
      topShape = createOvalShape(radius, config.widthScale ?? 1, config.heightScale ?? 0.68, segments);
      break;
    case 'racetrack':
      topShape = createRacetrackShape(
        radius,
        config.widthScale ?? 1,
        config.heightScale ?? 0.62,
        config.cornerScale ?? 0.32,
        segments
      );
      break;
    case 'polygon':
    default:
      topShape = createRegularPolygonShape(Math.max(3, config.sides ?? 8), radius);
      break;
  }

  let feltShape;
  let rimInnerShape;
  if (config.type === 'polygon') {
    const sides = Math.max(3, config.sides ?? 8);
    feltShape = createRegularPolygonShape(sides, radius * (config.innerScale ?? 0.75));
    rimInnerShape = createRegularPolygonShape(sides, radius * (config.rimInnerScale ?? 0.7));
  } else if (config.type === 'circle') {
    feltShape = createCircularShape(radius * (config.innerScale ?? 0.7), segments);
    rimInnerShape = createCircularShape(radius * (config.rimInnerScale ?? 0.64), segments);
  } else if (config.type === 'oval') {
    feltShape = createOvalShape(
      radius * (config.innerScale ?? 0.68),
      config.widthScale ?? 1,
      config.heightScale ?? 0.68,
      segments
    );
    rimInnerShape = createOvalShape(
      radius * (config.rimInnerScale ?? 0.62),
      config.widthScale ?? 1,
      config.heightScale ?? 0.68,
      segments
    );
  } else {
    feltShape = createRacetrackShape(
      radius * (config.innerScale ?? 0.7),
      config.widthScale ?? 1,
      config.heightScale ?? 0.62,
      config.cornerScale ?? 0.32,
      segments
    );
    rimInnerShape = createRacetrackShape(
      radius * (config.rimInnerScale ?? 0.64),
      config.widthScale ?? 1,
      config.heightScale ?? 0.62,
      config.cornerScale ?? 0.32,
      segments
    );
  }

  const rimOuterShape = topShape.clone();
  const trimOuterShape = scaleShape(topShape, config.trimOuterScale ?? 1.04, config.trimOuterScale ?? 1.04);
  const trimInnerShape = scaleShape(topShape, config.trimInnerScale ?? 0.9, config.trimInnerScale ?? 0.9);

  const feltRadius = computeShapeRadius(feltShape);
  const boundingRadius = computeShapeRadius(topShape);

  return {
    config,
    segments,
    topShape,
    feltShape,
    rimOuterShape,
    rimInnerShape,
    trimOuterShape,
    trimInnerShape,
    feltRadius,
    radius: boundingRadius
  };
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function makeRoughClothTexture(size, topHex, bottomHex, anisotropy = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, topHex);
  gradient.addColorStop(1, bottomHex ?? topHex);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const highlight = adjustHexColor(topHex, 0.12);
  const shadow = adjustHexColor(bottomHex ?? topHex, -0.12);

  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      ctx.globalAlpha = 0.04 + Math.random() * 0.04;
      ctx.fillStyle = Math.random() > 0.5 ? highlight : shadow;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const centerGradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.6);
  centerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  centerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = centerGradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 12;
  const scaledRepeat = baseRepeat * 30 * 3;
  texture.repeat.set(scaledRepeat, scaledRepeat);
  texture.anisotropy = anisotropy;
  applySRGBColorSpace(texture);
  texture.needsUpdate = true;
  return texture;
}

function resolveWoodComponents(option) {
  const fallbackPreset = WOOD_FINISH_PRESETS.find((preset) => preset.id === 'walnut') || WOOD_FINISH_PRESETS[0];
  const preset = (option?.presetId && WOOD_FINISH_PRESETS.find((p) => p.id === option.presetId)) || fallbackPreset;
  const fallbackGrain =
    WOOD_GRAIN_OPTIONS_BY_ID?.[DEFAULT_WOOD_GRAIN_ID] || WOOD_GRAIN_OPTIONS?.[0];
  const grain = (option?.grainId && WOOD_GRAIN_OPTIONS_BY_ID?.[option.grainId]) || fallbackGrain;
  return { preset, grain };
}

function applyWoodSelectionToMaterials(topMat, rimMat, option) {
  const { preset, grain } = resolveWoodComponents(option);
  const sharedOptions = {
    hue: preset.hue,
    sat: preset.sat,
    light: preset.light,
    contrast: preset.contrast,
    roughnessBase: 0.16,
    roughnessVariance: 0.28
  };
  const sharedKey = `murlan-wood-${option?.id ?? preset.id}`;
  if (topMat) {
    applyWoodTextures(topMat, {
      ...sharedOptions,
      repeat: grain?.frame?.repeat ?? grain?.rail?.repeat ?? { x: 0.24, y: 0.38 },
      rotation: grain?.frame?.rotation ?? 0,
      textureSize: grain?.frame?.textureSize,
      sharedKey
    });
  }
  if (rimMat) {
    applyWoodTextures(rimMat, {
      ...sharedOptions,
      repeat: grain?.rail?.repeat ?? grain?.frame?.repeat ?? { x: 0.12, y: 0.62 },
      rotation: grain?.rail?.rotation ?? 0,
      textureSize: grain?.rail?.textureSize,
      sharedKey
    });
  }
}

export function applyTableMaterials(parts, { woodOption, clothOption, baseOption }, renderer) {
  if (!parts) return;

  if (baseOption) {
    if (parts.baseMat?.color) {
      parts.baseMat.color.set(baseOption.baseColor);
      if ('metalness' in parts.baseMat && Number.isFinite(baseOption.metalness)) {
        parts.baseMat.metalness = baseOption.metalness;
      }
      if ('roughness' in parts.baseMat && Number.isFinite(baseOption.roughness)) {
        parts.baseMat.roughness = baseOption.roughness;
      }
      parts.baseMat.needsUpdate = true;
    }
    if (parts.trimMat?.color) {
      parts.trimMat.color.set(baseOption.trimColor ?? baseOption.baseColor);
      if ('metalness' in parts.trimMat && Number.isFinite(baseOption.metalness)) {
        parts.trimMat.metalness = Math.min(1, (baseOption.metalness ?? 0.74) + 0.08);
      }
      if ('roughness' in parts.trimMat && Number.isFinite(baseOption.roughness)) {
        parts.trimMat.roughness = Math.max(0.2, (baseOption.roughness ?? 0.34) - 0.1);
      }
      if ('clearcoat' in parts.trimMat) {
        parts.trimMat.clearcoat = 0.58;
      }
      if ('clearcoatRoughness' in parts.trimMat) {
        parts.trimMat.clearcoatRoughness = 0.18;
      }
      parts.trimMat.needsUpdate = true;
    }
  }

  applyWoodSelectionToMaterials(parts.topWoodMat, parts.rimWoodMat, woodOption);

  if (parts.surfaceMat && clothOption) {
    parts.velvetTexture?.dispose?.();
    const tex = makeRoughClothTexture(
      1024,
      clothOption.feltTop,
      clothOption.feltBottom,
      renderer?.capabilities?.getMaxAnisotropy?.() ?? 8
    );
    parts.surfaceMat.map = tex;
    parts.surfaceMat.color?.set?.('#ffffff');
    if (typeof clothOption.roughness === 'number') {
      parts.surfaceMat.roughness = clothOption.roughness;
    }
    if (typeof clothOption.metalness === 'number') {
      parts.surfaceMat.metalness = clothOption.metalness;
    }
    if ('emissive' in parts.surfaceMat) {
      const emissive = clothOption.emissive ?? '#000000';
      parts.surfaceMat.emissive?.set?.(emissive);
    }
    if ('emissiveIntensity' in parts.surfaceMat) {
      const intensity = Number.isFinite(clothOption.emissiveIntensity)
        ? clothOption.emissiveIntensity
        : 0.08;
      parts.surfaceMat.emissiveIntensity = intensity;
    }
    parts.surfaceMat.needsUpdate = true;
    parts.velvetTexture = tex;
  }
}

export function createMurlanStyleTable({
  THREE: ThreeNamespace = THREE,
  arena,
  renderer,
  tableRadius = 2.55,
  tableHeight = 0.81,
  woodOption = DEFAULT_TABLE_WOOD_OPTION,
  clothOption = DEFAULT_TABLE_CLOTH_OPTION,
  baseOption = DEFAULT_TABLE_BASE_OPTION,
  shapeOption = DEFAULT_TABLE_SHAPE_OPTION
} = {}) {
  if (!arena) throw new Error('createMurlanStyleTable requires an arena group.');

  const scaleFactor = tableRadius / 0.9;
  const woodDepth = 0.04 * scaleFactor;
  const rimDepth = 0.06 * scaleFactor;
  const trimHeight = 0.08 * scaleFactor;
  const trimOffset = 0.06 * scaleFactor;
  const clothRise = 0.07 * scaleFactor;
  let baseHeight = 0.62 * scaleFactor;
  const tableY = tableHeight - clothRise;

  const minBaseHeight = tableY > 0 ? tableY * 2 : 0;
  if (baseHeight < minBaseHeight) {
    baseHeight = minBaseHeight;
  }

  const baseMat = new ThreeNamespace.MeshPhysicalMaterial({
    color: new ThreeNamespace.Color(baseOption.baseColor),
    metalness: baseOption.metalness ?? 0.74,
    roughness: baseOption.roughness ?? 0.34,
    clearcoat: 0.62,
    clearcoatRoughness: 0.22
  });
  const trimMat = new ThreeNamespace.MeshPhysicalMaterial({
    color: new ThreeNamespace.Color(baseOption.trimColor ?? baseOption.baseColor),
    metalness: Math.min(1, (baseOption.metalness ?? 0.74) + 0.08),
    roughness: Math.max(0.2, (baseOption.roughness ?? 0.34) - 0.1),
    clearcoat: 0.58,
    clearcoatRoughness: 0.18
  });
  const topWoodMat = new ThreeNamespace.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.32,
    clearcoat: 0.68,
    clearcoatRoughness: 0.22,
    sheen: 0.18,
    sheenRoughness: 0.48
  });
  const rimWoodMat = new ThreeNamespace.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.28,
    clearcoat: 0.64,
    clearcoatRoughness: 0.24,
    sheen: 0.16,
    sheenRoughness: 0.5
  });
  const surfaceMat = new ThreeNamespace.MeshStandardMaterial({
    roughness: 0.82,
    metalness: 0.04,
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 0.08
  });

  const shapeSet = buildTableShape(shapeOption, tableRadius);

  const tableGroup = new ThreeNamespace.Group();
  const topGeometry = new ThreeNamespace.ExtrudeGeometry(shapeSet.topShape, {
    depth: woodDepth,
    bevelEnabled: true,
    bevelThickness: woodDepth * 0.45,
    bevelSize: woodDepth * 0.45,
    bevelSegments: 2,
    curveSegments: shapeSet.segments
  });
  topGeometry.rotateX(-Math.PI / 2);
  const topMesh = new ThreeNamespace.Mesh(topGeometry, topWoodMat);
  topMesh.position.y = tableY;
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  tableGroup.add(topMesh);

  const feltGeometry = new ThreeNamespace.ShapeGeometry(shapeSet.feltShape, shapeSet.segments);
  feltGeometry.rotateX(-Math.PI / 2);
  const feltMesh = new ThreeNamespace.Mesh(feltGeometry, surfaceMat);
  feltMesh.position.y = tableY + clothRise;
  feltMesh.receiveShadow = true;
  tableGroup.add(feltMesh);

  const rimOuter = shapeSet.rimOuterShape.clone();
  const rimInner = shapeSet.rimInnerShape.clone();
  rimOuter.holes.push(rimInner);
  const rimGeometry = new ThreeNamespace.ExtrudeGeometry(rimOuter, {
    depth: rimDepth,
    bevelEnabled: true,
    bevelThickness: rimDepth * 0.32,
    bevelSize: rimDepth * 0.32,
    bevelSegments: 2,
    curveSegments: shapeSet.segments
  });
  rimGeometry.rotateX(-Math.PI / 2);
  const rimMesh = new ThreeNamespace.Mesh(rimGeometry, rimWoodMat);
  rimMesh.position.y = tableY + clothRise * 0.36;
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  tableGroup.add(rimMesh);

  const baseGeometry = new ThreeNamespace.CylinderGeometry(0.68 * scaleFactor, 0.95 * scaleFactor, baseHeight, 8, 1, false);
  const baseMesh = new ThreeNamespace.Mesh(baseGeometry, baseMat);
  baseMesh.position.y = tableY - baseHeight / 2;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  tableGroup.add(baseMesh);

  const trimOuter = shapeSet.trimOuterShape.clone();
  const trimInner = shapeSet.trimInnerShape.clone();
  trimOuter.holes.push(trimInner);
  const trimGeometry = new ThreeNamespace.ExtrudeGeometry(trimOuter, {
    depth: trimHeight,
    bevelEnabled: false,
    steps: 1,
    curveSegments: shapeSet.segments
  });
  const trimMesh = new ThreeNamespace.Mesh(trimGeometry, trimMat);
  trimGeometry.rotateX(-Math.PI / 2);
  trimMesh.position.y = tableY - trimOffset - trimHeight / 2;
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  tableGroup.add(trimMesh);

  tableGroup.position.y = 0;
  arena.add(tableGroup);

  const tableParts = {
    baseMat,
    trimMat,
    surfaceMat,
    velvetTexture: null,
    topWoodMat,
    rimWoodMat,
    group: tableGroup
  };

  applyTableMaterials(tableParts, { woodOption, clothOption, baseOption }, renderer);

  const dispose = () => {
    tableParts.velvetTexture?.dispose?.();
    disposeMaterialWithWood(tableParts.topWoodMat);
    disposeMaterialWithWood(tableParts.rimWoodMat);
    tableParts.baseMat?.dispose?.();
    tableParts.trimMat?.dispose?.();
    tableParts.surfaceMat?.map?.dispose?.();
    tableParts.surfaceMat?.dispose?.();
    if (tableGroup.parent) {
      tableGroup.parent.remove(tableGroup);
    }
  };

  return {
    group: tableGroup,
    surfaceY: tableY + clothRise,
    tableHeight,
    radius: shapeSet.radius,
    feltRadius: shapeSet.feltRadius,
    dispose,
    materials: tableParts,
    shapeId: shapeSet.config.id
  };
}

export const DEFAULT_MURLAN_TABLE_OPTIONS = Object.freeze({
  wood: DEFAULT_TABLE_WOOD_OPTION,
  cloth: DEFAULT_TABLE_CLOTH_OPTION,
  base: DEFAULT_TABLE_BASE_OPTION,
  shape: DEFAULT_TABLE_SHAPE_OPTION
});
