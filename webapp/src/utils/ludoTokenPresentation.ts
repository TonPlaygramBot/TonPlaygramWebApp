import * as THREE from 'three';

// Optional CDN models must never prevent a board from getting playable pieces.
export async function withLudoTokenAssets<T>(assets: Promise<T>, timeoutMs = 2500): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      assets.catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function hasVisibleLudoToken(token: THREE.Object3D | null): boolean {
  if (!token) return false;
  let visibleMesh = false;
  token.traverseVisible((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')?.count) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((material) => material.visible && (!material.transparent || material.opacity > 0))) visibleMesh = true;
  });
  if (!visibleMesh) return false;
  const size = new THREE.Box3().setFromObject(token).getSize(new THREE.Vector3());
  return size.toArray().every((dimension) => Number.isFinite(dimension) && dimension > 1e-6);
}

// Local geometry keeps all six selectable chess silhouettes visible offline.
// The origin is the bottom of the base, matching the imported piece convention.
export function createFallbackLudoToken(type: string, color: THREE.ColorRepresentation, height = 0.09, diameter = 0.054) {
  const group = new THREE.Group();
  group.name = 'LudoTokenFallback';
  const material = {
    color, emissive: color, emissiveIntensity: 0.12, roughness: 0.38, metalness: 0.12
  };
  const add = (geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    // Selection stores/restores each mesh's material separately.
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(material));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const profile = [[0, 0], [.46, 0], [.5, .05], [.5, .13], [.38, .2], [.29, .25], [.17, .5], [.27, .59], [.28, .64], [0, .64]];
  add(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24));
  const key = ({ pawn: 'p', rook: 'r', castle: 'r', knight: 'n', horse: 'n', bishop: 'b', queen: 'q', king: 'k' } as Record<string, string>)[type] || type;
  if (key === 'r') {
    add(new THREE.CylinderGeometry(.34, .29, .2, 24), 0, .7);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const block = add(new THREE.BoxGeometry(.17, .16, .17), Math.cos(angle) * .25, .84, Math.sin(angle) * .25);
      block.rotation.y = -angle;
    }
  } else if (key === 'n') {
    const shape = new THREE.Shape();
    shape.moveTo(-.24, .59);
    [[.24, .59], [.2, .78], [.31, .86], [.28, .98], [.09, 1.04], [.02, 1.2], [-.07, 1.08], [-.18, 1.08], [-.29, .86]].forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const head = new THREE.ExtrudeGeometry(shape, { depth: .25, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2, steps: 1 });
    head.translate(0, 0, -.125);
    add(head);
  } else if (key === 'k') {
    add(new THREE.SphereGeometry(.22, 20, 12), 0, .76).scale.y = .7;
    add(new THREE.BoxGeometry(.11, .3, .11), 0, 1);
    add(new THREE.BoxGeometry(.33, .1, .11), 0, 1.04);
  } else if (key === 'q') {
    add(new THREE.CylinderGeometry(.3, .2, .23, 24), 0, .75);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      add(new THREE.SphereGeometry(.065, 10, 8), Math.cos(angle) * .26, .91, Math.sin(angle) * .26);
    }
    add(new THREE.SphereGeometry(.09, 16, 10), 0, .96);
  } else if (key === 'b') {
    add(new THREE.SphereGeometry(.23, 20, 16), 0, .81).scale.y = 1.35;
    add(new THREE.SphereGeometry(.075, 12, 8), 0, 1.12);
  } else {
    add(new THREE.SphereGeometry(.26, 24, 16), 0, .85);
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.scale.set(diameter / size.x, height / size.y, diameter / size.z);
  group.userData.isFallbackToken = true;
  return group;
}

type Tile = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Glow = {
  age: number;
  color: THREE.Color;
  baseColor: THREE.Color;
  baseEmissive: THREE.Color;
  baseIntensity: number;
  layers: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
};
const glows = new WeakMap<Tile, Glow>();
export const LUDO_TILE_GLOW_SECONDS = 0.8;

function createGlow(tile: Tile): Glow {
  tile.geometry.computeBoundingBox();
  const bounds = tile.geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const layers = [1.035, 1.14, 1.28].map((scale, index) => {
    const x = size.x / 2, z = size.z / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-x * scale, -z * scale);
    shape.lineTo(x * scale, -z * scale);
    shape.lineTo(x * scale, z * scale);
    shape.lineTo(-x * scale, z * scale);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-x * .95, -z * .95);
    hole.lineTo(-x * .95, z * .95);
    hole.lineTo(x * .95, z * .95);
    hole.lineTo(x * .95, -z * .95);
    hole.closePath();
    shape.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide
    }));
    ring.name = 'LudoTileLandingGlow';
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, bounds.max.y + .0008 + index * .0001, center.z);
    ring.raycast = () => {};
    ring.visible = false;
    tile.add(ring);
    return ring;
  });
  return { age: LUDO_TILE_GLOW_SECONDS, color: new THREE.Color(), baseColor: tile.material.color.clone(),
    baseEmissive: tile.material.emissive.clone(), baseIntensity: tile.material.emissiveIntensity, layers };
}

function paintGlow(tile: Tile, glow: Glow) {
  const strength = Math.pow(Math.max(0, 1 - glow.age / LUDO_TILE_GLOW_SECONDS), 1.5);
  tile.material.color.copy(glow.baseColor).lerp(glow.color, strength);
  tile.material.emissive.copy(glow.baseEmissive).lerp(glow.color, strength);
  tile.material.emissiveIntensity = glow.baseIntensity + .85 * strength;
  glow.layers.forEach((layer, index) => {
    layer.visible = strength > 0;
    layer.material.color.copy(glow.color);
    layer.material.opacity = [.85, .25, .08][index] * strength;
  });
  tile.userData.boardTile.isHighlighted = strength > 0;
}

export function setLudoTileHighlight(tile: Tile | null, active: boolean, color?: THREE.ColorRepresentation | null) {
  if (!tile?.material?.emissive || !tile.userData.boardTile) return;
  let glow = glows.get(tile);
  if (!glow && !active) return;
  if (!glow) { glow = createGlow(tile); glows.set(tile, glow); }
  glow.age = active ? 0 : LUDO_TILE_GLOW_SECONDS;
  if (active) glow.color.set(color ?? tile.userData.boardTile.baseColor ?? 0xffffff);
  paintGlow(tile, glow);
}

export function updateLudoTileGlow(tile: Tile | null, deltaSeconds: number) {
  const glow = tile && glows.get(tile);
  if (!tile || !glow || glow.age >= LUDO_TILE_GLOW_SECONDS) return;
  glow.age = Math.min(LUDO_TILE_GLOW_SECONDS, glow.age + Math.max(0, deltaSeconds));
  paintGlow(tile, glow);
}
