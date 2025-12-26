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
  label: 'Obsidian Base',
  baseColor: '#141414',
  columnColor: '#0b0d10',
  trimColor: '#1f232a',
  metalness: 0.75,
  roughness: 0.35
});

const DEFAULT_TABLE_WOOD_OPTION = Object.freeze({
  id: 'oakEstate',
  label: 'Lis Estate',
  presetId: 'oak',
  grainId: 'estateBands'
});

export const DEFAULT_TABLE_CLOTH_OPTION = Object.freeze({
  id: 'emerald',
  label: 'Emerald Cloth',
  feltTop: '#0f6a2f',
  feltBottom: '#054d24',
  emissive: '#021a0b'
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

function createOvalShape(width, height, segments = 48) {
  const shape = new THREE.Shape();
  const halfSegments = Math.max(12, segments);
  for (let i = 0; i <= halfSegments; i += 1) {
    const angle = (i / halfSegments) * Math.PI * 2;
    const x = Math.cos(angle) * (width / 2);
    const y = Math.sin(angle) * (height / 2);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function createRoundedRectangleShape(width, height, radius, segments = 16) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const cornerRadius = Math.min(radius, hw, hh);
  shape.moveTo(-hw + cornerRadius, hh);
  shape.lineTo(hw - cornerRadius, hh);
  shape.absarc(hw - cornerRadius, hh - cornerRadius, cornerRadius, Math.PI / 2, 0, true);
  shape.lineTo(hw, -hh + cornerRadius);
  shape.absarc(hw - cornerRadius, -hh + cornerRadius, cornerRadius, 0, -Math.PI / 2, true);
  shape.lineTo(-hw + cornerRadius, -hh);
  shape.absarc(-hw + cornerRadius, -hh + cornerRadius, cornerRadius, -Math.PI / 2, -Math.PI, true);
  shape.lineTo(-hw, hh - cornerRadius);
  shape.absarc(-hw + cornerRadius, hh - cornerRadius, cornerRadius, -Math.PI, -Math.PI / 2, true);
  shape.closePath();
  return shape;
}

function createDiamondShape(width, height) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  shape.moveTo(0, hh);
  shape.lineTo(hw, 0);
  shape.lineTo(0, -hh);
  shape.lineTo(-hw, 0);
  shape.closePath();
  return shape;
}

function scaleShape2D(shape, scaleX, scaleY, divisions = 64) {
  if (!shape) return null;
  const pointsData = shape.extractPoints(divisions);
  const transform = (point) => new THREE.Vector2(point.x * scaleX, point.y * scaleY);
  const scaledShape = new THREE.Shape(pointsData.shape.map(transform));
  pointsData.holes?.forEach((holePoints) => {
    const hole = new THREE.Path(holePoints.map(transform));
    scaledShape.holes.push(hole);
  });
  return scaledShape;
}

function getShapeOutlinePoints(shape, divisions = 128) {
  if (!shape?.extractPoints) return [];
  const pointsData = shape.extractPoints(divisions);
  const outline = pointsData?.shape ?? [];
  return outline.map((pt) => new THREE.Vector2(pt.x, pt.y));
}

function createDirectionalRadiusSampler(points, fallbackRadius) {
  const usablePoints = Array.isArray(points) && points.length > 0 ? points : null;
  return (direction) => {
    const dir = direction instanceof THREE.Vector3
      ? new THREE.Vector2(direction.x, direction.z)
      : direction instanceof THREE.Vector2
        ? direction.clone()
        : new THREE.Vector2(direction?.x ?? 0, direction?.y ?? 0);
    if (dir.lengthSq() === 0) {
      return fallbackRadius;
    }
    dir.normalize();
    let max = -Infinity;
    usablePoints?.forEach((pt) => {
      const projection = pt.dot(dir);
      if (projection > max) {
        max = projection;
      }
    });
    if (!Number.isFinite(max) || max <= 0) {
      return fallbackRadius;
    }
    return max;
  };
}

export const TABLE_SHAPE_OPTIONS = Object.freeze([
  {
    id: 'classicOctagon',
    label: 'Oktagon Klasik',
    preview: {
      clipPath:
        'polygon(50% 0%, 80% 10%, 100% 40%, 100% 60%, 80% 90%, 50% 100%, 20% 90%, 0% 60%, 0% 40%, 20% 10%)'
    },
    createShapes: ({ radius }) => {
      const topShape = createRegularPolygonShape(8, radius);
      const feltShape = createRegularPolygonShape(8, radius * 0.8);
      const rimInnerShape = scaleShape2D(feltShape, 0.96, 0.96);
      return { topShape, feltShape, rimInnerShape };
    }
  },
  {
    id: 'grandOval',
    label: 'Oval Grand',
    preview: {
      borderRadius: '50% / 35%'
    },
    createShapes: ({ radius }) => {
      const width = radius * 2.1;
      const height = radius * 1.45;
      const topShape = createOvalShape(width, height, 64);
      const feltShape = createOvalShape(width * 0.82, height * 0.82, 64);
      const rimInnerShape = scaleShape2D(feltShape, 0.97, 0.97);
      return { topShape, feltShape, rimInnerShape };
    }
  },
  {
    id: 'diamondEdge',
    label: 'Diamant Edge',
    preview: {
      borderRadius: '18%'
    },
    createShapes: ({ radius, scaleFactor }) => {
      const factor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : radius / 0.9 || 1;
      const outerHalf = 0.95 * factor;
      const clothHalf = 0.7 * factor;
      const innerHalf = 0.76 * factor;
      const topShape = createRoundedRectangleShape(outerHalf * 2, outerHalf * 2, 0.12 * factor);
      const feltShape = createRoundedRectangleShape(clothHalf * 2, clothHalf * 2, 0.08 * factor);
      const rimInnerShape = createRoundedRectangleShape(innerHalf * 2, innerHalf * 2, 0.1 * factor);
      return { topShape, feltShape, rimInnerShape, feltRadius: clothHalf };
    }
  }
]);

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

export function makeRoughClothTexture(size, topHex, bottomHex, anisotropy = 8) {
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

  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 12;
  const scaledRepeat = baseRepeat * 30 * 6 * 4;
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
  shapeOption = TABLE_SHAPE_OPTIONS[0],
  rotationY = 0
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

  const shapeData = shapeOption?.createShapes?.({
    radius: tableRadius,
    height: tableHeight,
    ThreeNamespace,
    scaleFactor
  });
  const topShape = shapeData?.topShape ?? createRegularPolygonShape(8, tableRadius);
  const feltShape = shapeData?.feltShape ?? createRegularPolygonShape(8, tableRadius * 0.8);
  const rimInnerShape = shapeData?.rimInnerShape ?? scaleShape2D(feltShape, 0.97, 0.97);
  const feltRadius = shapeData?.feltRadius ?? tableRadius * (0.72 / 0.9);
  const curveSegments = Math.max(1, Math.round((shapeOption?.curveSegments ?? 32) / 4));

  const outerOutline = getShapeOutlinePoints(topShape, curveSegments * 8);
  const innerOutline = getShapeOutlinePoints(rimInnerShape, curveSegments * 8);
  const outerRadiusSampler = createDirectionalRadiusSampler(outerOutline, tableRadius);
  const innerRadiusSampler = createDirectionalRadiusSampler(innerOutline, feltRadius);

  const tableGroup = new ThreeNamespace.Group();
  const topGeometry = new ThreeNamespace.ExtrudeGeometry(topShape, {
    depth: woodDepth,
    bevelEnabled: true,
    bevelThickness: woodDepth * 0.45,
    bevelSize: woodDepth * 0.45,
    bevelSegments: 2,
    curveSegments
  });
  topGeometry.rotateX(-Math.PI / 2);
  const topMesh = new ThreeNamespace.Mesh(topGeometry, topWoodMat);
  topMesh.position.y = tableY;
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  tableGroup.add(topMesh);

  const feltGeometry = new ThreeNamespace.ShapeGeometry(feltShape, curveSegments * 4);
  feltGeometry.rotateX(-Math.PI / 2);
  const feltMesh = new ThreeNamespace.Mesh(feltGeometry, surfaceMat);
  feltMesh.position.y = tableY + clothRise;
  feltMesh.receiveShadow = true;
  tableGroup.add(feltMesh);

  const rimOuter = topShape.clone();
  const rimInner = rimInnerShape.clone();
  rimOuter.holes = [rimInner];
  const rimGeometry = new ThreeNamespace.ExtrudeGeometry(rimOuter, {
    depth: rimDepth,
    bevelEnabled: true,
    bevelThickness: rimDepth * 0.32,
    bevelSize: rimDepth * 0.32,
    bevelSegments: 2,
    curveSegments
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

  const trimGeometry = new ThreeNamespace.CylinderGeometry(tableRadius * 0.985, tableRadius, trimHeight, 64, 1, false);
  const trimMesh = new ThreeNamespace.Mesh(trimGeometry, trimMat);
  trimMesh.position.y = tableY - trimOffset;
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  tableGroup.add(trimMesh);

  const normalizedRotation = Number.isFinite(rotationY) ? rotationY : 0;
  tableGroup.position.y = 0;
  if (normalizedRotation !== 0) {
    tableGroup.rotation.y = normalizedRotation;
  }
  arena.add(tableGroup);

  const upAxis = new ThreeNamespace.Vector3(0, 1, 0);
  const inverseRotationQuat = new ThreeNamespace.Quaternion().setFromAxisAngle(upAxis, -normalizedRotation);
  const toLocalDirection = (direction) => {
    if (direction instanceof ThreeNamespace.Vector3) {
      const clone = direction.clone();
      if (clone.lengthSq() === 0) {
        return new ThreeNamespace.Vector2(0, 1);
      }
      clone.applyQuaternion(inverseRotationQuat);
      return new ThreeNamespace.Vector2(clone.x, clone.z);
    }
    if (direction instanceof ThreeNamespace.Vector2) {
      const vec3 = new ThreeNamespace.Vector3(direction.x, 0, direction.y).applyQuaternion(inverseRotationQuat);
      return new ThreeNamespace.Vector2(vec3.x, vec3.z);
    }
    const x = Number(direction?.x) || 0;
    const y = Number(direction?.y) || 0;
    if (x === 0 && y === 0) {
      return new ThreeNamespace.Vector2(0, 1);
    }
    return new ThreeNamespace.Vector2(x, y);
  };

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
    radius: tableRadius,
    feltRadius,
    dispose,
    materials: tableParts,
    shapeId: shapeOption?.id || 'classicOctagon',
    rotationY: Number.isFinite(rotationY) ? rotationY : 0,
    getOuterRadius: (direction) => {
      const local = toLocalDirection(direction);
      return outerRadiusSampler(local);
    },
    getInnerRadius: (direction) => {
      const local = toLocalDirection(direction);
      const outer = outerRadiusSampler(local);
      const inner = innerRadiusSampler(local);
      if (!Number.isFinite(inner) || inner <= 0) {
        return outer * 0.85;
      }
      if (inner >= outer) {
        return outer * 0.85;
      }
      return inner;
    }
  };
}

export const DEFAULT_MURLAN_TABLE_OPTIONS = Object.freeze({
  wood: DEFAULT_TABLE_WOOD_OPTION,
  cloth: DEFAULT_TABLE_CLOTH_OPTION,
  base: DEFAULT_TABLE_BASE_OPTION,
  shape: TABLE_SHAPE_OPTIONS[0]
});
