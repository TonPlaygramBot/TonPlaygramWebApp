/**
 * Exact numeric declarations and helper bodies extracted from
 * webapp/public/domino-royal-game.js for the actual-rig motion preview.
 * Source SHA-256 at extraction: e0aa7e6702439b0125fee1b7082e11b6d2ddab1cbbcd7c91c6394353c37099a0
 *
 * Preview adaptations are limited to TypeScript annotations and explicit
 * viewport/seat options in place of game globals. Four seats and human seat 0
 * are the defaults. No game initialization or browser dependencies run here.
 * Refresh these extracts if the corresponding production layout changes.
 */
import * as THREE from 'three';

export interface SeatOptions {
  human?: number;
  playerCount?: number;
}

export interface HandLayoutOptions extends SeatOptions {
  isTopDown?: boolean;
}

export interface PrecisionPlacementAnimation {
  start: THREE.Vector3;
  end: THREE.Vector3;
  arc?: number;
}

export const MODEL_SCALE = 0.75;

export const CAMERA_LAYOUT_SCALE = 1;

export const DOMINO_AND_CHAIR_SHRINK_FACTOR = 1;

export const LEGACY_TABLE_SIZE_REDUCTION_FACTOR = 1;

export const TABLE_SHRINK_FACTOR = 1;

export const TABLE_AND_CHAIR_SHRINK_FACTOR = 1;

export const TABLE_SIZE_REDUCTION_FACTOR = 1;

export const TABLE_RADIUS_SCALE = 0.78;

export const TABLE_HEIGHT_SCALE = 1;

export const TABLE_LEFT_RIGHT_SHRINK_FACTOR = 0.9;

export const ARENA_GROWTH = 1.45;

export const TABLE_RADIUS = 3.4 * MODEL_SCALE * TABLE_RADIUS_SCALE;

export const BASE_TABLE_HEIGHT = 0.94 * MODEL_SCALE * TABLE_HEIGHT_SCALE;

export const LEGACY_BASE_TABLE_HEIGHT = BASE_TABLE_HEIGHT;

export const STOOL_SCALE =
  1.3 *
  1.3 *
  1.3 *
  LEGACY_TABLE_SIZE_REDUCTION_FACTOR;

export const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;

export const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;

export const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;

export const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;

export const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;

export const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;

export const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;

export const ARM_DEPTH = SEAT_DEPTH * 0.75;

export const COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;

export const BASE_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;

export const COLUMN_RADIUS_TOP = 0.2 * MODEL_SCALE;

export const COLUMN_RADIUS_BOTTOM = 0.26 * MODEL_SCALE;

export const BASE_RADIUS = 0.72 * MODEL_SCALE;

export const FOOT_RING_RADIUS = 0.52 * MODEL_SCALE;

export const FOOT_RING_TUBE = 0.04 * MODEL_SCALE;

export const CHAIR_GAP = 0.03 * MODEL_SCALE;

export const CHAIR_OUTWARD_OFFSET = 0;

export const CHAIR_RADIUS =
  TABLE_RADIUS + SEAT_DEPTH * 0.5 + CHAIR_GAP + CHAIR_OUTWARD_OFFSET;

export const CHAIR_GLOBAL_PUSHBACK = 0.28 * MODEL_SCALE;

export const SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK = 0.52 * MODEL_SCALE;

export const CHAIR_VISUAL_SCALE = 1.12;

export const CHAIR_VERTICAL_DROP = 0.035 * MODEL_SCALE;

export const CHAIR_BASE_HEIGHT = LEGACY_BASE_TABLE_HEIGHT - SEAT_THICKNESS * 1.1;

export const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;

export const TABLE_HEIGHT_LIFT = 0.025 * MODEL_SCALE * TABLE_HEIGHT_SCALE;

export const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;

export const CAMERA_REFERENCE_TABLE_RADIUS = TABLE_RADIUS;

export const CAMERA_REFERENCE_TABLE_HEIGHT = TABLE_HEIGHT;

export const HUMAN_SEAT_INDEX = 0;

export const CHAIR_SEAT_ANGLES = Object.freeze([
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(0),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(180)
]);

export const SIDE_TABLE_RADIUS_DELTA = TABLE_RADIUS * (1 - TABLE_LEFT_RIGHT_SHRINK_FACTOR);

export const SIDE_PLAYER_TABLE_PULL_IN = 0.34 * MODEL_SCALE;

export const CHAIR_SEAT_RADII = Object.freeze([
  CHAIR_RADIUS + CHAIR_GLOBAL_PUSHBACK + SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK,
  CHAIR_RADIUS -
    SIDE_TABLE_RADIUS_DELTA +
    CHAIR_GLOBAL_PUSHBACK -
    SIDE_PLAYER_TABLE_PULL_IN,
  CHAIR_RADIUS + CHAIR_GLOBAL_PUSHBACK + 0.16 * MODEL_SCALE,
  CHAIR_RADIUS -
    SIDE_TABLE_RADIUS_DELTA +
    CHAIR_GLOBAL_PUSHBACK -
    SIDE_PLAYER_TABLE_PULL_IN
]);

export const ARENA_WALL_HEIGHT = 3.6 * 1.3;

export const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;

export const ARENA_WALL_INNER_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 2.4;

export const CARPET_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 2.2;

export const FLOOR_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 3.2;

export const CAMERA_TARGET_LIFT = 0.08 * MODEL_SCALE;

export const CAMERA_TARGET_EXTRA = 0.22 * MODEL_SCALE;

export const CAMERA_FOV = 48;

export const CAMERA_NEAR = 0.1;

export const CAMERA_FAR = 5000;

export const CAMERA_MIN_POLAR = 0.92;

export const CAMERA_MAX_POLAR = 1.22;

export const CAMERA_INITIAL_PHI = THREE.MathUtils.lerp(
  CAMERA_MIN_POLAR,
  CAMERA_MAX_POLAR,
  0.35
);

export const CAMERA_BASE_RADIUS = CAMERA_REFERENCE_TABLE_RADIUS;

export const CAMERA_MIN_RADIUS = CAMERA_BASE_RADIUS * 0.45;

export const CAMERA_MAX_RADIUS = CAMERA_BASE_RADIUS * 3.2;

export const CAMERA_DEFAULT_AZIMUTH =
  CHAIR_SEAT_ANGLES[HUMAN_SEAT_INDEX] ?? Math.PI / 2;

export const CAMERA_LATERAL_OFFSET = {
  portrait: 0 * CAMERA_LAYOUT_SCALE,
  landscape: 0 * CAMERA_LAYOUT_SCALE
};

export const CAMERA_REAR_OFFSET = {
  portrait: 0.18 * CAMERA_LAYOUT_SCALE,
  landscape: 0.46 * CAMERA_LAYOUT_SCALE
};

export const CAMERA_HEIGHT_BOOST = {
  portrait: 2.38 * CAMERA_LAYOUT_SCALE,
  landscape: 0.96 * CAMERA_LAYOUT_SCALE
};

export const CAMERA_PORTRAIT_LOOKDOWN_EXTRA = 0.01 * MODEL_SCALE;

export const CAMERA_LOOK_YAW_LIMIT = THREE.MathUtils.degToRad(26);

export const CAMERA_LOOK_YAW_DRAG_FACTOR = -0.0055;

export const CAMERA_LOOK_PITCH_LIMIT = THREE.MathUtils.degToRad(16);

export const CAMERA_LOOK_MIN_PITCH = -CAMERA_LOOK_PITCH_LIMIT;

export const CAMERA_LOOK_PITCH_DRAG_FACTOR = -0.0038;

export const CAMERA_LOOK_YAW_RECENTER_SPEED = 0.055;

export const CAMERA_TARGET = new THREE.Vector3(
  0,
  CAMERA_REFERENCE_TABLE_HEIGHT +
    CAMERA_TARGET_LIFT +
    CAMERA_TARGET_EXTRA -
    CAMERA_PORTRAIT_LOOKDOWN_EXTRA,
  0
);

export const CAMERA_TOPDOWN_RADIUS = CAMERA_REFERENCE_TABLE_RADIUS * 2.35;

export const CAMERA_TOPDOWN_MIN_RADIUS = CAMERA_REFERENCE_TABLE_RADIUS * 1.2;

export const CAMERA_TOPDOWN_MAX_RADIUS = CAMERA_REFERENCE_TABLE_RADIUS * 3.6;

export const CAMERA_TOPDOWN_MIN_POLAR = THREE.MathUtils.degToRad(2);

export const CAMERA_TOPDOWN_MAX_POLAR = THREE.MathUtils.degToRad(18);

export const CAMERA_TOPDOWN_ZOOM_WHEEL_FACTOR = 0.0014;

export const CAMERA_TOPDOWN_ZOOM_PINCH_FACTOR = 0.01;

export const CAMERA_3D_ZOOM_WHEEL_FACTOR = 0.0012;

export const CAMERA_3D_ZOOM_PINCH_FACTOR = 0.0042;

export const CAMERA_TOPDOWN_FRAMING = Object.freeze({
  portrait: { right: 0, forward: 0 },
  landscape: { right: 0, forward: 0 }
});

export const CAMERA_TURN_FOCUS_LERP = 0.07;

export const CAMERA_TURN_SEAT_WEIGHT = 0.46;

export const CAMERA_TURN_SIDE_SEAT_EXTRA_WEIGHT = 0.14;

export const CAMERA_TURN_SIDE_SEAT_SCREEN_OFFSET = 0.2 * MODEL_SCALE;

export const CAMERA_DOMINO_FOCUS_HOLD_MS = 1250;

export const UP = new THREE.Vector3(0, 1, 0);

export const TABLE_PLAYFIELD_SIDE_EXPANSION = 1.08;

export const LEGACY_DOMINO_HUMAN_HEIGHT = 1.13;

export const TABLE_OUTER_RADIUS = TABLE_RADIUS * TABLE_PLAYFIELD_SIDE_EXPANSION;

export const TABLE_INNER_RADIUS = TABLE_OUTER_RADIUS * 0.84;

export const CLOTH_RADIUS = TABLE_OUTER_RADIUS * 0.72;

export const TABLE_TOP_DEPTH = 0.06 * MODEL_SCALE * TABLE_HEIGHT_SCALE;

export const RIM_THICK = 0.08 * MODEL_SCALE;

export const TABLE_BASE_Y = TABLE_HEIGHT - TABLE_TOP_DEPTH;

export const CLOTH_TOP = TABLE_HEIGHT;

export const RAIL_TOP = CLOTH_TOP + 0.04 * MODEL_SCALE;

export const SCALE = MODEL_SCALE * 0.92;

export const DOMINO_SHRINK_FACTOR = 1;

export const DOMINO_EXTRA_SHRINK_FACTOR = 0.54;

export const DOMINO_SIZE_BOOST = 1.77;

export const DOMINO_SCALE =
  1.5 *
  1.26 *
  DOMINO_SHRINK_FACTOR *
  DOMINO_EXTRA_SHRINK_FACTOR *
  DOMINO_SIZE_BOOST;

export const DOMINO_HEIGHT_ADJUST = 0.9;

export const DOMINO_WORLD_SCALE = SCALE * DOMINO_SCALE;

export const DOMINO_WIDTH = DOMINO_WORLD_SCALE * 0.1;

export const DOMINO_LENGTH = DOMINO_WORLD_SCALE * (0.016 / 0.22) * 2;

export const DOUBLE_END_SHIFT = Math.max(0, (DOMINO_LENGTH - DOMINO_WIDTH) / 2);

export const DOMINO_CHAIN_GAP = DOMINO_LENGTH * 0.0025;

export const DOMINO_HAND_GAP = DOMINO_WIDTH + DOMINO_CHAIN_GAP;

export const PLAYER_HAND_TILE_SCALE = 0.9;

export const HUMAN_PLAYER_HAND_TILE_SCALE = 0.74;

export const PLAYER_HAND_GAP_SCALE = 0.5;

export const PLAYER_HAND_MIN_GAP_SCALE = 0.76;

export const PLAYER_HAND_OPPONENT_MIN_GAP_SCALE = 0.8;

export const PLAYER_HAND_OUTWARD_OFFSET = DOMINO_WIDTH * 4.16;

export const PLAYER_HAND_OPPONENT_OUTWARD_EXTRA = DOMINO_WIDTH * -0.3;

export const PLAYER_HAND_SIDE_OUTWARD_EXTRA = DOMINO_WIDTH * -0.44;

export const PLAYER_HAND_TOP_OUTWARD_EXTRA = DOMINO_WIDTH * 0.4;

export const PLAYER_HAND_SIDE_EDGE_OUTWARD_EXTRA = DOMINO_WIDTH * -0.03;

export const HUMAN_PLAYER_HAND_OUTWARD_OFFSET = DOMINO_WIDTH * 4.34;

export const PLAYER_HAND_VERTICAL_RAISE = DOMINO_WIDTH * 3.84;

export const PLAYER_HAND_OPPONENT_VERTICAL_EXTRA = DOMINO_WIDTH * 1.02;

export const PLAYER_HAND_CENTER_VERTICAL_DROP = DOMINO_WIDTH * 2.42;

export const HUMAN_HAND_OUTWARD_OFFSET = DOMINO_WIDTH * 4.42;

export const HUMAN_HAND_VERTICAL_OFFSET = DOMINO_WIDTH * 0.0;

export const HUMAN_BOTTOM_EXTRA_OUTWARD = DOMINO_WIDTH * 1.48;

export const HUMAN_BOTTOM_EXTRA_RAISE = DOMINO_WIDTH * 3.94;

export const HUMAN_BOTTOM_HAND_GAP_SCALE = 0.88;

export const DOMINO_DOUBLE_NEIGHBOR_EXTRA_GAP = 0;

export const DOMINO_OPENING_DOUBLE_SIDE_GAP = DOMINO_LENGTH * 0.11;

export const TILE_UP_H = 0.2 * DOMINO_WORLD_SCALE * DOMINO_HEIGHT_ADJUST;

export const TILE_UP_HALF = TILE_UP_H / 2;

export const CHAIN_EDGE_PADDING = Math.max(0.12, DOMINO_LENGTH * 0.38);

export const CHAIN_CLAMP_MARGIN = Math.max(DOMINO_CHAIN_GAP * 1.5, DOMINO_LENGTH * 0.06);

export const XMAX = CLOTH_RADIUS - CHAIN_EDGE_PADDING;

export const ZMAX = CLOTH_RADIUS - CHAIN_EDGE_PADDING;

export const DOMINO_LIFT_OFFSET = DOMINO_WIDTH * 0.035;

export const HAND_Y = RAIL_TOP + TILE_UP_HALF - DOMINO_WIDTH * 0.03 + DOMINO_LIFT_OFFSET;

export const CHAIN_TILE_Y = CLOTH_TOP + DOMINO_WIDTH * 0.02 + DOMINO_LIFT_OFFSET;

export const DRAW_ANIM_DURATION = 760;

export const OPENING_SHUFFLE_ANIM_DURATION = 3200;

export const OPENING_DEAL_ANIM_DURATION = 680;

export const KNOCK_DURATION = 820;

export const KNOCK_CONTACT_PHASE = 0.56;

export const PLACE_ANIM_DURATION = 1450;

export const PLACE_ANIM_PICK_HOLD = 0.18;

export const PLACE_ANIM_LIFT_END = 0.34;

export const PLACE_ANIM_CARRY_END = 0.74;

export const PLACE_ANIM_LOWER_END = 0.92;

export const PLACE_ANIM_ARC = 0.075;

export function getHumanHandCountScale(count: number) {
  return Math.min(1, 7 / Math.max(7, Number(count) || 7));
}

export function getDominoHandScale(seatIndex: number, count: number, { human = 0 }: SeatOptions = {}) {
  return seatIndex === human
    ? HUMAN_PLAYER_HAND_TILE_SCALE * getHumanHandCountScale(count)
    : PLAYER_HAND_TILE_SCALE;
}

export function layoutSeat(idx: number): [number, number, number] {
  const EDGE = CLOTH_RADIUS;
  const MARGIN = EDGE * 0.16;
  const horizontalEdge = EDGE * TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  const horizontalMargin = MARGIN * TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  const south = [0, EDGE - MARGIN, 0];
  const east = [horizontalEdge - horizontalMargin, 0, Math.PI / 2];
  const north = [0, -(EDGE - MARGIN), Math.PI];
  const west = [-(horizontalEdge - horizontalMargin), 0, -Math.PI / 2];
  const seats = [south, east, north, west];
  return seats[idx % seats.length] as [number, number, number];
}

export function getVisualSeatIndex(logicalSeatIndex: number, { human = 0, playerCount = 4 }: SeatOptions = {}) {
  const N = playerCount;
  const seatCount = Math.max(1, N | 0);
  const normalized = (logicalSeatIndex - human) % seatCount;
  const relativeSeat = normalized < 0 ? normalized + seatCount : normalized;
  // With two players, seat 1 is the right-hand chair in the four-seat arena.
  // Put the opponent in seat 2 instead so portrait players see the two people
  // directly across from one another: local player at the bottom, opponent at
  // the top.
  if (seatCount === 2 && relativeSeat === 1) return 2;
  return relativeSeat;
}

export function computeHandSlotPosition(
  seatIndex: number,
  slotIndex: number,
  handCount: number,
  { isTopDown = false, human = 0, playerCount = 4 }: HandLayoutOptions = {}
) {
  const visualSeatIndex = getVisualSeatIndex(seatIndex, { human, playerCount });
  const [x0, z0] = layoutSeat(visualSeatIndex);
  const isHuman = seatIndex === human;
  const isSide = visualSeatIndex === 1 || visualSeatIndex === 3;
  const openFlat = isTopDown && isHuman;

  const EDGE_SPAN = CLOTH_RADIUS - 0.28;
  const BASE_GAP = DOMINO_HAND_GAP;
  const minGapScale = isHuman
    ? PLAYER_HAND_MIN_GAP_SCALE
    : PLAYER_HAND_OPPONENT_MIN_GAP_SCALE;
  const MIN_GAP = DOMINO_LENGTH * 0.82 * minGapScale;
  const MAX_SPAN = Math.max(0, EDGE_SPAN * 2 - DOMINO_LENGTH * 0.6);

  const gapBase =
    (openFlat ? BASE_GAP * 1.04 : BASE_GAP * 0.94) * PLAYER_HAND_GAP_SCALE;
  const handVerticalDrop = isHuman ? 0 : PLAYER_HAND_CENTER_VERTICAL_DROP;
  const handY = openFlat
    ? CLOTH_TOP + 0.016
    : HAND_Y + PLAYER_HAND_VERTICAL_RAISE - handVerticalDrop +
      (isHuman ? 0 : PLAYER_HAND_OPPONENT_VERTICAL_EXTRA);
  const safeCount = Math.max(1, handCount | 0);
  const safeSlot = THREE.MathUtils.clamp(slotIndex | 0, 0, safeCount - 1);
  const seatLength = Math.hypot(x0, z0) || 1;
  const handOutwardOffset = isHuman && !openFlat
    ? HUMAN_PLAYER_HAND_OUTWARD_OFFSET
    : PLAYER_HAND_OUTWARD_OFFSET + PLAYER_HAND_OPPONENT_OUTWARD_EXTRA +
      (visualSeatIndex === 2 ? PLAYER_HAND_TOP_OUTWARD_EXTRA : 0) +
      (isSide ? PLAYER_HAND_SIDE_OUTWARD_EXTRA + PLAYER_HAND_SIDE_EDGE_OUTWARD_EXTRA : 0);
  const outwardX = (x0 / seatLength) * handOutwardOffset;
  const outwardZ = (z0 / seatLength) * handOutwardOffset;

  let span = 0;
  let gap = 0;
  if (safeCount > 1) {
    const desiredSpan = gapBase * (safeCount - 1);
    const minSpan = Math.min(MIN_GAP * (safeCount - 1), MAX_SPAN);
    span = Math.min(Math.max(desiredSpan, minSpan), MAX_SPAN);
    if (isHuman && safeCount > 7) {
      const sevenTileSpan = Math.min(Math.max(gapBase * 6, Math.min(MIN_GAP * 6, MAX_SPAN)), MAX_SPAN);
      span = Math.min(span, sevenTileSpan);
    }
    gap = span / (safeCount - 1);
  }

  let start = safeCount > 1 ? -span / 2 : 0;
  if (safeCount > 1) {
    const axisCenter = isSide ? z0 : x0;
    const minLimit = -EDGE_SPAN;
    const maxLimit = EDGE_SPAN;
    const minStart = minLimit - axisCenter;
    const maxStart = maxLimit - axisCenter - span;
    if (minStart <= maxStart) {
      if (start < minStart) start = minStart;
      if (start > maxStart) start = maxStart;
    } else {
      start = (minStart + maxStart) / 2;
    }
  }

  const baseOffset = safeCount > 1 ? start + gap * safeSlot : 0;
  const offset =
    isHuman && !openFlat ? baseOffset * HUMAN_BOTTOM_HAND_GAP_SCALE : baseOffset;

  if (isHuman && !openFlat) {
    const handAnchorZ = z0 + HUMAN_HAND_OUTWARD_OFFSET;
    const humanExtraOutwardX = (x0 / seatLength) * HUMAN_BOTTOM_EXTRA_OUTWARD;
    const humanExtraOutwardZ = (z0 / seatLength) * HUMAN_BOTTOM_EXTRA_OUTWARD;
    return new THREE.Vector3(
      x0 + outwardX + humanExtraOutwardX + offset,
      handY - HUMAN_HAND_VERTICAL_OFFSET + HUMAN_BOTTOM_EXTRA_RAISE,
      handAnchorZ + outwardZ + humanExtraOutwardZ
    );
  }
  if (isSide) {
    return new THREE.Vector3(x0 + outwardX, handY, z0 + outwardZ + offset);
  }
  return new THREE.Vector3(x0 + outwardX + offset, handY, z0 + outwardZ);
}

export function smoothPlacementStep(edge0: number, edge1: number, value: number) {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function resolvePrecisionPlacementPosition(anim: PrecisionPlacementAnimation, t: number) {
  const pickupLift = (anim.arc || PLACE_ANIM_ARC) * 0.85;
  const carryLift = (anim.arc || PLACE_ANIM_ARC) * 1.18;
  const pickup = anim.start.clone();
  pickup.y += pickupLift;
  const carryStart = pickup.clone();
  const carryEnd = anim.end.clone();
  carryEnd.y += carryLift;
  const lowerReady = anim.end.clone();

  if (t < PLACE_ANIM_PICK_HOLD) {
    return anim.start.clone();
  }
  if (t < PLACE_ANIM_LIFT_END) {
    return anim.start.clone().lerp(
      pickup,
      smoothPlacementStep(PLACE_ANIM_PICK_HOLD, PLACE_ANIM_LIFT_END, t)
    );
  }
  if (t < PLACE_ANIM_CARRY_END) {
    const carryT = smoothPlacementStep(PLACE_ANIM_LIFT_END, PLACE_ANIM_CARRY_END, t);
    const pos = carryStart.lerp(carryEnd, carryT);
    pos.y += Math.sin(Math.PI * carryT) * carryLift * 0.28;
    return pos;
  }
  if (t < PLACE_ANIM_LOWER_END) {
    return carryEnd.lerp(
      lowerReady,
      smoothPlacementStep(PLACE_ANIM_CARRY_END, PLACE_ANIM_LOWER_END, t)
    );
  }
  return lowerReady.lerp(
    anim.end,
    smoothPlacementStep(PLACE_ANIM_LOWER_END, 1, t)
  );
}

export function seatBasisForAngle(angle: number, radius = CHAIR_RADIUS) {
  const useAngle = Number.isFinite(angle) ? angle : CAMERA_DEFAULT_AZIMUTH;
  const useRadius = Number.isFinite(radius) ? radius : CHAIR_RADIUS;
  const position = new THREE.Vector3(
    Math.cos(useAngle) * useRadius,
    0,
    Math.sin(useAngle) * useRadius
  );
  const forward = position.clone();
  if (forward.lengthSq() > 0) {
    forward.multiplyScalar(-1 / forward.length());
  } else {
    forward.set(0, 0, -1);
  }
  const right = new THREE.Vector3().crossVectors(UP, forward).normalize();
  if (right.lengthSq() === 0) {
    right.set(1, 0, 0);
  }
  return { position, forward, right };
}

export function seatBasisForIndex(index = 0) {
  const safeIndex = Number.isFinite(index) ? index : 0;
  const angle =
    CHAIR_SEAT_ANGLES[safeIndex % CHAIR_SEAT_ANGLES.length] ??
    CAMERA_DEFAULT_AZIMUTH;
  const radius =
    CHAIR_SEAT_RADII[safeIndex % CHAIR_SEAT_RADII.length] ?? CHAIR_RADIUS;
  return seatBasisForAngle(angle, radius);
}

export function computeDesiredCameraPosition({ isPortrait = true }: { isPortrait?: boolean } = {}) {

  const seat = seatBasisForIndex(HUMAN_SEAT_INDEX);
  const seatHeight = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
  const seatAnchor = seat.position.clone();
  seatAnchor.y = seatHeight;

  const retreat = isPortrait
    ? CAMERA_REAR_OFFSET.portrait
    : CAMERA_REAR_OFFSET.landscape;
  const lateral = isPortrait
    ? CAMERA_LATERAL_OFFSET.portrait
    : CAMERA_LATERAL_OFFSET.landscape;
  const elevation = isPortrait
    ? CAMERA_HEIGHT_BOOST.portrait
    : CAMERA_HEIGHT_BOOST.landscape;

  const desiredPosition = seatAnchor
    .clone()
    .addScaledVector(seat.forward, -retreat)
    .addScaledVector(seat.right, lateral);
  desiredPosition.y = seatHeight + elevation;
  return desiredPosition;
}

/** Readonly production configuration for inspection and preview controls. */
export const PRODUCTION_MOTION_CONSTANTS = Object.freeze({
  MODEL_SCALE,
  CAMERA_LAYOUT_SCALE,
  DOMINO_AND_CHAIR_SHRINK_FACTOR,
  LEGACY_TABLE_SIZE_REDUCTION_FACTOR,
  TABLE_SHRINK_FACTOR,
  TABLE_AND_CHAIR_SHRINK_FACTOR,
  TABLE_SIZE_REDUCTION_FACTOR,
  TABLE_RADIUS_SCALE,
  TABLE_HEIGHT_SCALE,
  TABLE_LEFT_RIGHT_SHRINK_FACTOR,
  ARENA_GROWTH,
  TABLE_RADIUS,
  BASE_TABLE_HEIGHT,
  LEGACY_BASE_TABLE_HEIGHT,
  STOOL_SCALE,
  SEAT_WIDTH,
  SEAT_DEPTH,
  SEAT_THICKNESS,
  BACK_HEIGHT,
  BACK_THICKNESS,
  ARM_HEIGHT,
  ARM_THICKNESS,
  ARM_DEPTH,
  COLUMN_HEIGHT,
  BASE_THICKNESS,
  COLUMN_RADIUS_TOP,
  COLUMN_RADIUS_BOTTOM,
  BASE_RADIUS,
  FOOT_RING_RADIUS,
  FOOT_RING_TUBE,
  CHAIR_GAP,
  CHAIR_OUTWARD_OFFSET,
  CHAIR_RADIUS,
  CHAIR_GLOBAL_PUSHBACK,
  SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK,
  CHAIR_VISUAL_SCALE,
  CHAIR_VERTICAL_DROP,
  CHAIR_BASE_HEIGHT,
  STOOL_HEIGHT,
  TABLE_HEIGHT_LIFT,
  TABLE_HEIGHT,
  CAMERA_REFERENCE_TABLE_RADIUS,
  CAMERA_REFERENCE_TABLE_HEIGHT,
  HUMAN_SEAT_INDEX,
  CHAIR_SEAT_ANGLES,
  SIDE_TABLE_RADIUS_DELTA,
  SIDE_PLAYER_TABLE_PULL_IN,
  CHAIR_SEAT_RADII,
  ARENA_WALL_HEIGHT,
  ARENA_WALL_CENTER_Y,
  ARENA_WALL_INNER_RADIUS,
  CARPET_RADIUS,
  FLOOR_RADIUS,
  CAMERA_TARGET_LIFT,
  CAMERA_TARGET_EXTRA,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_MIN_POLAR,
  CAMERA_MAX_POLAR,
  CAMERA_INITIAL_PHI,
  CAMERA_BASE_RADIUS,
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_DEFAULT_AZIMUTH,
  CAMERA_LATERAL_OFFSET,
  CAMERA_REAR_OFFSET,
  CAMERA_HEIGHT_BOOST,
  CAMERA_PORTRAIT_LOOKDOWN_EXTRA,
  CAMERA_LOOK_YAW_LIMIT,
  CAMERA_LOOK_YAW_DRAG_FACTOR,
  CAMERA_LOOK_PITCH_LIMIT,
  CAMERA_LOOK_MIN_PITCH,
  CAMERA_LOOK_PITCH_DRAG_FACTOR,
  CAMERA_LOOK_YAW_RECENTER_SPEED,
  CAMERA_TARGET,
  CAMERA_TOPDOWN_RADIUS,
  CAMERA_TOPDOWN_MIN_RADIUS,
  CAMERA_TOPDOWN_MAX_RADIUS,
  CAMERA_TOPDOWN_MIN_POLAR,
  CAMERA_TOPDOWN_MAX_POLAR,
  CAMERA_TOPDOWN_ZOOM_WHEEL_FACTOR,
  CAMERA_TOPDOWN_ZOOM_PINCH_FACTOR,
  CAMERA_3D_ZOOM_WHEEL_FACTOR,
  CAMERA_3D_ZOOM_PINCH_FACTOR,
  CAMERA_TOPDOWN_FRAMING,
  CAMERA_TURN_FOCUS_LERP,
  CAMERA_TURN_SEAT_WEIGHT,
  CAMERA_TURN_SIDE_SEAT_EXTRA_WEIGHT,
  CAMERA_TURN_SIDE_SEAT_SCREEN_OFFSET,
  CAMERA_DOMINO_FOCUS_HOLD_MS,
  TABLE_PLAYFIELD_SIDE_EXPANSION,
  LEGACY_DOMINO_HUMAN_HEIGHT,
  TABLE_OUTER_RADIUS,
  TABLE_INNER_RADIUS,
  CLOTH_RADIUS,
  TABLE_TOP_DEPTH,
  RIM_THICK,
  TABLE_BASE_Y,
  CLOTH_TOP,
  RAIL_TOP,
  SCALE,
  DOMINO_SHRINK_FACTOR,
  DOMINO_EXTRA_SHRINK_FACTOR,
  DOMINO_SIZE_BOOST,
  DOMINO_SCALE,
  DOMINO_HEIGHT_ADJUST,
  DOMINO_WORLD_SCALE,
  DOMINO_WIDTH,
  DOMINO_LENGTH,
  DOUBLE_END_SHIFT,
  DOMINO_CHAIN_GAP,
  DOMINO_HAND_GAP,
  PLAYER_HAND_TILE_SCALE,
  HUMAN_PLAYER_HAND_TILE_SCALE,
  PLAYER_HAND_GAP_SCALE,
  PLAYER_HAND_MIN_GAP_SCALE,
  PLAYER_HAND_OPPONENT_MIN_GAP_SCALE,
  PLAYER_HAND_OUTWARD_OFFSET,
  PLAYER_HAND_OPPONENT_OUTWARD_EXTRA,
  PLAYER_HAND_SIDE_OUTWARD_EXTRA,
  PLAYER_HAND_TOP_OUTWARD_EXTRA,
  PLAYER_HAND_SIDE_EDGE_OUTWARD_EXTRA,
  HUMAN_PLAYER_HAND_OUTWARD_OFFSET,
  PLAYER_HAND_VERTICAL_RAISE,
  PLAYER_HAND_OPPONENT_VERTICAL_EXTRA,
  PLAYER_HAND_CENTER_VERTICAL_DROP,
  HUMAN_HAND_OUTWARD_OFFSET,
  HUMAN_HAND_VERTICAL_OFFSET,
  HUMAN_BOTTOM_EXTRA_OUTWARD,
  HUMAN_BOTTOM_EXTRA_RAISE,
  HUMAN_BOTTOM_HAND_GAP_SCALE,
  DOMINO_DOUBLE_NEIGHBOR_EXTRA_GAP,
  DOMINO_OPENING_DOUBLE_SIDE_GAP,
  TILE_UP_H,
  TILE_UP_HALF,
  CHAIN_EDGE_PADDING,
  CHAIN_CLAMP_MARGIN,
  XMAX,
  ZMAX,
  DOMINO_LIFT_OFFSET,
  HAND_Y,
  CHAIN_TILE_Y,
  DRAW_ANIM_DURATION,
  OPENING_SHUFFLE_ANIM_DURATION,
  OPENING_DEAL_ANIM_DURATION,
  KNOCK_DURATION,
  KNOCK_CONTACT_PHASE,
  PLACE_ANIM_DURATION,
  PLACE_ANIM_PICK_HOLD,
  PLACE_ANIM_LIFT_END,
  PLACE_ANIM_CARRY_END,
  PLACE_ANIM_LOWER_END,
  PLACE_ANIM_ARC
} as const);
