/**
 * Pure placement math for the shared Tirana map. No model downloads, rendering,
 * guessed coordinates, road snapping, axis swaps, or non-uniform model scaling.
 * Projection matches webapp/scripts/build-tirana-map.py exactly (before rounding).
 */
export type Point = Readonly<{ x: number; z: number }>;
export type GeoWorld = Readonly<{
  origin: readonly [number, number]; // latitude, longitude
  bounds: readonly [number, number, number, number]; // minX, minZ, maxX, maxZ
  landmarks: readonly Readonly<{ id: string; x: number; z: number }>[];
}>;
export type Location =
  | Readonly<{ kind: 'geographic'; latitude: number; longitude: number; source: string }>
  | Readonly<{ kind: 'world-landmark'; landmarkId: string; source: string }>;
export type LandmarkAsset = Readonly<{
  id: string;
  landmarkId: string; // physical landmark identity, not a particular model listing
  modelUrl: string;
  location: Location;
  metresPerUnit: number;
  yawRadians: number;
  groundHeightM: number;
  anchorInModel: readonly [number, number, number];
  rights: Readonly<{ approved: boolean; license: string; attribution: string; source: string }>;
}>;
export type Placement = Readonly<{
  id: string;
  landmarkId: string;
  modelUrl: string;
  anchor: Readonly<{ x: number; y: number; z: number }>;
  position: Readonly<{ x: number; y: number; z: number }>;
  uniformScale: number;
  yawRadians: number;
}>;
const METRES_PER_DEGREE = 111320;
const finite = (value: number, name: string) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
};
function checkWorld(world: GeoWorld) {
  if (world.origin.length !== 2 || world.bounds.length !== 4)
    throw new Error('Invalid map origin or bounds dimensions');
  const [latitude, longitude] = world.origin;
  finite(latitude, 'Origin latitude');
  finite(longitude, 'Origin longitude');
  if (Math.abs(latitude) >= 90 || Math.abs(longitude) > 180)
    throw new Error('Invalid map origin');
  world.bounds.forEach((value) => finite(value, 'Map bound'));
  if (world.bounds[0] >= world.bounds[2] || world.bounds[1] >= world.bounds[3])
    throw new Error('Invalid map bounds');
}
export function project(world: GeoWorld, latitude: number, longitude: number): Point {
  checkWorld(world);
  finite(latitude, 'Latitude');
  finite(longitude, 'Longitude');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('Invalid geographic coordinate');
  return {
    x: (longitude - world.origin[1]) * METRES_PER_DEGREE * Math.cos(world.origin[0] * Math.PI / 180),
    z: (world.origin[0] - latitude) * METRES_PER_DEGREE
  };
}
export function unproject(world: GeoWorld, point: Point) {
  checkWorld(world);
  finite(point.x, 'Map x');
  finite(point.z, 'Map z');
  return {
    latitude: world.origin[0] - point.z / METRES_PER_DEGREE,
    longitude: world.origin[1] + point.x / (METRES_PER_DEGREE * Math.cos(world.origin[0] * Math.PI / 180))
  };
}
export function inBounds(world: GeoWorld, point: Point): boolean {
  checkWorld(world);
  finite(point.x, 'Map x');
  finite(point.z, 'Map z');
  return point.x >= world.bounds[0] && point.x <= world.bounds[2]
    && point.z >= world.bounds[1] && point.z <= world.bounds[3];
}
export function resolveLocation(world: GeoWorld, location: Location): Point {
  checkWorld(world);
  if (!location.source?.trim()) throw new Error('Location needs a traceable source');
  if (location.kind === 'geographic') return project(world, location.latitude, location.longitude);
  if (location.kind !== 'world-landmark') throw new Error('Unsupported location kind');
  const matches = world.landmarks.filter((item) => item.id === location.landmarkId);
  if (matches.length !== 1) throw new Error(`Unresolved or ambiguous landmark: ${location.landmarkId}`);
  const { x, z } = matches[0];
  return { x: finite(x, 'Landmark x'), z: finite(z, 'Landmark z') };
}
export function placeAsset(world: GeoWorld, asset: LandmarkAsset, mapOrigin: Point = { x: 0, z: 0 }): Placement {
  if (!asset.id?.trim() || !asset.landmarkId?.trim()) throw new Error('Missing asset or landmark identity');
  if (!asset.rights?.approved || !asset.rights.license?.trim()
    || !asset.rights.attribution?.trim() || !asset.rights.source?.trim())
    throw new Error('Asset rights and attribution have not been approved');
  // Only self-hosted GLBs from the dedicated asset directory. A listing URL is not a mesh.
  if (!/^\/assets\/tirana-landmarks\/[A-Za-z0-9_-]+\.glb$/.test(asset.modelUrl))
    throw new Error('A local, acquired GLB is required');
  const scale = finite(asset.metresPerUnit, 'Metres per model unit');
  if (scale <= 0) throw new Error('Metres per model unit must be positive');
  const yaw = finite(asset.yawRadians, 'Model yaw');
  finite(asset.groundHeightM, 'Ground height');
  finite(mapOrigin.x, 'Game origin x');
  finite(mapOrigin.z, 'Game origin z');
  if (asset.anchorInModel.length !== 3) throw new Error('Model anchor needs three coordinates');
  asset.anchorInModel.forEach((value) => finite(value, 'Model anchor'));
  const location = resolveLocation(world, asset.location);
  if (!inBounds(world, location)) throw new Error('Landmark lies outside this Tirana map; do not relocate it');
  const anchor = {
    x: location.x - mapOrigin.x,
    y: asset.groundHeightM,
    z: location.z - mapOrigin.z
  };
  const [px, py, pz] = asset.anchorInModel;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    id: asset.id,
    landmarkId: asset.landmarkId,
    modelUrl: asset.modelUrl,
    anchor,
    position: {
      x: anchor.x - scale * (px * c + pz * s),
      y: anchor.y - scale * py,
      z: anchor.z - scale * (-px * s + pz * c)
    },
    uniformScale: scale,
    yawRadians: yaw
  };
}
/** A preflight plan, not proof that a GLB exists, renders correctly, or has suitable collision. */
export function planPlacements(world: GeoWorld, assets: readonly LandmarkAsset[], mapOrigin: Point = { x: 0, z: 0 }) {
  const ids = new Set<string>(), landmarks = new Set<string>();
  return assets.map((asset) => {
    if (ids.has(asset.id) || landmarks.has(asset.landmarkId))
      throw new Error(`Duplicate model or physical landmark: ${asset.id}`);
    ids.add(asset.id);
    landmarks.add(asset.landmarkId);
    return placeAsset(world, asset, mapOrigin);
  });
}

export type GamePlacementContext =
  | Readonly<{ game: 'tiranastreets' | 'kartroyale' }>
  | Readonly<{ game: 'blackwater'; mapOrigin: Point }>;

/** Pass BlackWater's existing ORIGIN from its caller; never import its entire
 * simulation/layout into the other two games just to obtain a translation. */
export function planGamePlacements(
  world: GeoWorld,
  assets: readonly LandmarkAsset[],
  context: GamePlacementContext
) {
  switch (context.game) {
    case 'tiranastreets':
    case 'kartroyale':
      return planPlacements(world, assets);
    case 'blackwater':
      if (!context.mapOrigin) throw new Error('BlackWater requires its existing map ORIGIN');
      return planPlacements(world, assets, context.mapOrigin);
    default:
      throw new Error('Unsupported Tirana game');
  }
}
