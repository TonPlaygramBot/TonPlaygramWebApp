import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';

// Match ChessBattleRoyal.jsx's Coffee Table 01 reference, chair footprint and
// grounded HDRI units. Backgammon owns these values and its asset lifecycle.
const MODEL_SCALE = 0.55;
const STOOL_SCALE = 1.5 * 1.05;
const LAYOUT_SCALE = 0.7225 * 0.84;
const SIZE_FACTOR = 0.8 * LAYOUT_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE * SIZE_FACTOR * 0.9;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE * SIZE_FACTOR;
const TABLE_RADIUS = 2.74 * MODEL_SCALE * SIZE_FACTOR;
const TABLE_HEIGHT =
  1.08 * MODEL_SCALE + SEAT_THICKNESS * 0.15 + 0.05 * MODEL_SCALE;
const CHAIR_SCALE = 0.94 * LAYOUT_SCALE;
const CHAIR_WIDTH_SCALE = 1.14;
const CHAIR_CLEARANCE = 0.4 * MODEL_SCALE * 0.95 * 0.4;
const CHAIR_DISTANCE =
  TABLE_RADIUS +
  SEAT_DEPTH / 2 +
  THREE.MathUtils.clamp(
    CHAIR_CLEARANCE + SEAT_DEPTH * 0.1 + 0.02 * MODEL_SCALE,
    0.055 * MODEL_SCALE,
    0.42 * MODEL_SCALE
  ) -
  0.015 * MODEL_SCALE;
const TARGET_CHAIR_SIZE = new THREE.Vector3(
  1.3162499970197679,
  1.9173749900311232,
  1.7001562547683715
);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005;

export const BACKGAMMON_ARENA = Object.freeze({
  tableRadius: TABLE_RADIUS,
  tableDiameter: TABLE_RADIUS * 2,
  tableHeight: TABLE_HEIGHT,
  chairScale: CHAIR_SCALE,
  chairWidthScale: CHAIR_WIDTH_SCALE,
  playerChairDistance: CHAIR_DISTANCE + 0.1 * MODEL_SCALE,
  opponentChairDistance: CHAIR_DISTANCE + 0.06 * MODEL_SCALE,
  seatY: -TARGET_CHAIR_MIN_Y * CHAIR_SCALE,
  roomHalfSpan: TABLE_RADIUS + CHAIR_CLEARANCE + SEAT_DEPTH,
  floorY: 0
});

// Keep the existing board geometry and logical point coordinates together.
// One uniform conversion fits the board, off trays, dice and touch targets to
// the Chess-sized tabletop without changing the phone's screen directions.
export const BACKGAMMON_PLAY_SCALE = TABLE_RADIUS / 1.72;
export const BACKGAMMON_PLAY_Y_OFFSET =
  TABLE_HEIGHT - 1.16 * BACKGAMMON_PLAY_SCALE;
export function backgammonPlayYOffset(surfaceY = TABLE_HEIGHT) {
  return surfaceY - 1.16 * BACKGAMMON_PLAY_SCALE;
}
export function backgammonWorldPoint(
  x: number,
  y: number,
  z: number,
  surfaceY = TABLE_HEIGHT
) {
  return new THREE.Vector3(x, y, z)
    .multiplyScalar(BACKGAMMON_PLAY_SCALE)
    .add(new THREE.Vector3(0, backgammonPlayYOffset(surfaceY), 0));
}
export function createBackgammonPlaySpace(surfaceY = TABLE_HEIGHT) {
  const root = new THREE.Group();
  root.name = 'backgammon-play-space';
  root.scale.setScalar(BACKGAMMON_PLAY_SCALE);
  root.position.y = backgammonPlayYOffset(surfaceY);
  root.updateMatrixWorld(true);
  return root;
}

export function groundBackgammonTable(model: THREE.Object3D, surfaceY: number) {
  const floor = new THREE.Box3().setFromObject(model).min.y;
  if (!Number.isFinite(floor)) return surfaceY;
  model.position.y -= floor;
  model.updateMatrixWorld(true);
  return surfaceY - floor;
}

export function backgammonPedestalScale(shapeId: string) {
  const scales: Record<string, number> = {
    classicOctagon: 0.74,
    hexagonTable: 0.72,
    grandOval: 0.72,
    diamondEdge: 0.7
  };
  return scales[shapeId] ?? 1.14;
}

export function fitBackgammonTable(model: THREE.Object3D) {
  const size = new THREE.Box3()
    .setFromObject(model)
    .getSize(new THREE.Vector3());
  model.scale.multiply(
    new THREE.Vector3(
      size.x > 0 ? BACKGAMMON_ARENA.tableDiameter / size.x : 1,
      size.y > 0 ? TABLE_HEIGHT / size.y : 1,
      size.z > 0 ? BACKGAMMON_ARENA.tableDiameter / size.z : 1
    )
  );
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
  model.updateMatrixWorld(true);
}

export function fitBackgammonChair(model: THREE.Object3D) {
  const size = new THREE.Box3()
    .setFromObject(model)
    .getSize(new THREE.Vector3());
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0)
    model.scale.multiplyScalar(
      Math.max(TARGET_CHAIR_SIZE.x, TARGET_CHAIR_SIZE.y, TARGET_CHAIR_SIZE.z) /
        currentMax
    );
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.add(
    new THREE.Vector3(
      -center.x,
      TARGET_CHAIR_MIN_Y - bounds.min.y,
      TARGET_CHAIR_CENTER_Z - center.z
    )
  );
  model.updateMatrixWorld(true);
}

export function createBackgammonChairGroup(
  model: THREE.Object3D,
  seat: number
) {
  const group = new THREE.Group();
  group.name = `backgammon-chair-${seat ? 'top' : 'bottom'}`;
  group.add(model);
  group.scale.set(
    CHAIR_SCALE * CHAIR_WIDTH_SCALE,
    CHAIR_SCALE,
    CHAIR_SCALE * CHAIR_WIDTH_SCALE
  );
  group.position.z = seat
    ? -BACKGAMMON_ARENA.opponentChairDistance
    : BACKGAMMON_ARENA.playerChairDistance;
  group.rotation.y = seat ? 0 : Math.PI;
  group.position.y -= new THREE.Box3().setFromObject(group).min.y;
  group.updateMatrixWorld(true);
  return group;
}

export function backgammonHdriProjection(variant: any = {}) {
  const height = Math.max(variant.cameraHeightM ?? 1.5, 0.9);
  const multiplier =
    typeof variant.groundRadiusMultiplier === 'number'
      ? variant.groundRadiusMultiplier
      : 6;
  return {
    height,
    radius: Math.max(
      BACKGAMMON_ARENA.roomHalfSpan * multiplier,
      height * 2.5,
      24
    ),
    resolution: Math.max(16, Math.floor(variant.groundResolution ?? 256))
  };
}

export function createBackgammonSkybox(
  texture: THREE.Texture,
  variant: any = {}
) {
  const { height, radius, resolution } = backgammonHdriProjection(variant);
  const skybox = new GroundedSkybox(texture, height, radius, resolution);
  skybox.name = 'backgammon-grounded-hdri';
  skybox.position.y = BACKGAMMON_ARENA.floorY + height;
  skybox.frustumCulled = false;
  skybox.renderOrder = -100;
  skybox.material.depthWrite = false;
  skybox.material.depthTest = true;
  return skybox;
}
