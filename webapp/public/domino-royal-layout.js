/**
 * Furniture dimensions from the Domino Royal motion review in PR #25963
 * (33a816ed03bba59812e3f4010f100d3becc8fc4a).
 *
 * Keep the scene and the review on the same geometry. THREE and
 * RoundedBoxGeometry are injected so this file also runs in node geometry tests.
 * Materials belong to the caller; each invocation owns its new geometries.
 */
const MODEL_SCALE = 0.75;
const TABLE_RADIUS = 3.4 * MODEL_SCALE * 0.78;
const STOOL_SCALE = 1.3 * 1.3 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT = 0.94 * MODEL_SCALE - SEAT_THICKNESS * 1.1;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.025 * MODEL_SCALE;
const TABLE_OUTER_RADIUS = TABLE_RADIUS * 1.08;
const TABLE_TOP_DEPTH = 0.06 * MODEL_SCALE;
const CHAIR_RADIUS = TABLE_RADIUS + SEAT_DEPTH * 0.5 + 0.03 * MODEL_SCALE;
const CHAIR_GLOBAL_PUSHBACK = 0.28 * MODEL_SCALE;
const SIDE_RADIUS = CHAIR_RADIUS - TABLE_RADIUS * (1 - 0.9) +
  CHAIR_GLOBAL_PUSHBACK - 0.34 * MODEL_SCALE;

export const DOMINO_REFERENCE_LAYOUT = Object.freeze({
  MODEL_SCALE,
  TABLE_RADIUS,
  TABLE_HEIGHT,
  TABLE_OUTER_RADIUS,
  TABLE_INNER_RADIUS: TABLE_OUTER_RADIUS * 0.84,
  CLOTH_RADIUS: TABLE_OUTER_RADIUS * 0.72,
  CLOTH_TOP: TABLE_HEIGHT,
  TABLE_TOP_DEPTH,
  TABLE_BASE_Y: TABLE_HEIGHT - TABLE_TOP_DEPTH,
  TABLE_LEFT_RIGHT_SHRINK_FACTOR: 0.9,
  TABLE_OCTAGON_ROTATION: Math.PI / 8,
  STOOL_SCALE,
  SEAT_WIDTH,
  SEAT_DEPTH,
  SEAT_THICKNESS,
  CHAIR_BASE_HEIGHT,
  STOOL_HEIGHT,
  BACK_HEIGHT: 0.68 * MODEL_SCALE * STOOL_SCALE,
  BACK_THICKNESS: 0.08 * MODEL_SCALE * STOOL_SCALE,
  ARM_HEIGHT: 0.3 * MODEL_SCALE * STOOL_SCALE,
  ARM_THICKNESS: 0.125 * MODEL_SCALE * STOOL_SCALE,
  ARM_DEPTH: SEAT_DEPTH * 0.75,
  CHAIR_RADIUS,
  CHAIR_SEAT_ANGLES: Object.freeze([Math.PI / 2, 0, Math.PI * 1.5, Math.PI]),
  CHAIR_SEAT_RADII: Object.freeze([
    CHAIR_RADIUS + CHAIR_GLOBAL_PUSHBACK + 0.52 * MODEL_SCALE,
    SIDE_RADIUS,
    CHAIR_RADIUS + CHAIR_GLOBAL_PUSHBACK + 0.16 * MODEL_SCALE,
    SIDE_RADIUS
  ]),
  CAMERA_FOV: 48,
  CAMERA_TARGET: Object.freeze([
    0,
    TABLE_HEIGHT + 0.08 * MODEL_SCALE + 0.22 * MODEL_SCALE - 0.01 * MODEL_SCALE + 0.3,
    0.15
  ]),
  LEGACY_DOMINO_HUMAN_HEIGHT: 1.13
});

function addPart(THREE, group, name, geometry, material, x, y, z) {
  const part = new THREE.Mesh(geometry, material);
  part.name = `domino-reference-${name}`;
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  group.add(part);
  group.parts[name] = part;
  return part;
}

/** The returned group uses unit scale and has its seat surface at STOOL_HEIGHT. */
export function createReferenceChair(THREE, RoundedBoxGeometry, { fabric, metal }) {
  const P = DOMINO_REFERENCE_LAYOUT;
  const chair = new THREE.Group();
  chair.name = 'domino-reference-chair';
  chair.parts = {};
  chair.userData.dominoReferenceLayout = true;
  addPart(THREE, chair, 'seat',
    new RoundedBoxGeometry(P.SEAT_WIDTH, P.SEAT_THICKNESS, P.SEAT_DEPTH, 2, 0.06),
    fabric, 0, P.STOOL_HEIGHT - P.SEAT_THICKNESS / 2, 0);
  addPart(THREE, chair, 'back',
    new RoundedBoxGeometry(P.SEAT_WIDTH, P.BACK_HEIGHT, P.BACK_THICKNESS, 2, 0.05),
    fabric, 0, P.STOOL_HEIGHT + P.BACK_HEIGHT / 2, -P.SEAT_DEPTH * 0.45);
  for (const side of [-1, 1]) {
    addPart(THREE, chair, side < 0 ? 'leftArm' : 'rightArm',
      new RoundedBoxGeometry(P.ARM_THICKNESS, P.ARM_THICKNESS, P.ARM_DEPTH, 2, 0.03),
      metal, side * P.SEAT_WIDTH * 0.49, P.STOOL_HEIGHT + P.ARM_HEIGHT, 0);
  }
  return chair;
}

/** The tabletop is centered on the board; the felt keeps the reference width. */
export function createReferenceTable(THREE, { wood, cloth, metal }) {
  const P = DOMINO_REFERENCE_LAYOUT;
  const table = new THREE.Group();
  table.name = 'domino-reference-table';
  table.parts = {};
  table.userData.dominoReferenceLayout = true;
  const top = addPart(THREE, table, 'top',
    new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS, P.TABLE_TOP_DEPTH, 8),
    wood, 0, P.CLOTH_TOP - P.TABLE_TOP_DEPTH / 2, 0);
  top.rotation.y = P.TABLE_OCTAGON_ROTATION;
  top.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  const felt = addPart(THREE, table, 'felt',
    new THREE.CylinderGeometry(P.CLOTH_RADIUS, P.CLOTH_RADIUS, 0.014, 8),
    cloth, 0, P.CLOTH_TOP + 0.006, 0);
  felt.rotation.y = P.TABLE_OCTAGON_ROTATION;
  const rail = addPart(THREE, table, 'rail',
    new THREE.TorusGeometry(P.TABLE_INNER_RADIUS, 0.018, 5, 8),
    metal, 0, P.CLOTH_TOP + 0.015, 0);
  rail.rotation.set(Math.PI / 2, 0, P.TABLE_OCTAGON_ROTATION);
  rail.scale.x = P.TABLE_LEFT_RIGHT_SHRINK_FACTOR;
  addPart(THREE, table, 'pedestal',
    new THREE.CylinderGeometry(P.TABLE_OUTER_RADIUS * 0.34, P.TABLE_OUTER_RADIUS * 0.48,
      P.TABLE_HEIGHT * 0.58, 24),
    wood, 0, P.TABLE_BASE_Y - P.TABLE_HEIGHT * 0.29, 0);
  return table;
}

/** Seat order: local player, right opponent, opposite opponent, left opponent. */
export function getReferenceSeatBasis(THREE, index = 0) {
  const P = DOMINO_REFERENCE_LAYOUT;
  const seat = ((Number.isFinite(index) ? Math.trunc(index) : 0) % 4 + 4) % 4;
  const angle = P.CHAIR_SEAT_ANGLES[seat];
  const radius = P.CHAIR_SEAT_RADII[seat];
  const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  const forward = position.clone().normalize().negate();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  return { position, forward, right, angle, radius };
}

// The review frames a seven-tile rack at both ends. These are the same rack
// dimensions used by the game, restricted to the upright opening layout.
function getReferenceRackEdge(THREE, seat, side) {
  const P = DOMINO_REFERENCE_LAYOUT;
  const worldScale = MODEL_SCALE * 0.92 * 1.5 * 1.26 * 0.54 * 1.77;
  const width = worldScale * 0.1;
  const length = worldScale * (0.016 / 0.22) * 2;
  const human = seat === 0;
  const spanEdge = length * 0.82 * (human ? 0.76 : 0.8) * 3;
  const offset = side * spanEdge * (human ? 0.88 : 1);
  const handY = P.CLOTH_TOP + 0.04 * MODEL_SCALE + worldScale * 0.09 + width * 0.005;
  const edge = P.CLOTH_RADIUS * 0.84;
  if (human) {
    return new THREE.Vector3(offset, handY + width * (3.84 + 3.94), edge + width * (4.42 + 4.34 + 1.48));
  }
  const y = handY + width * (3.84 - 2.42 + 1.02);
  if (seat === 2) return new THREE.Vector3(offset, y, -edge - width * (4.16 - 0.3 + 0.4));
  return new THREE.Vector3((seat === 1 ? 1 : -1) * (edge * 0.9 + width * (4.16 - 0.3 - 0.44 - 0.03)), y, offset);
}

/** Stable bounds from the reference review, without foot poses changing framing. */
export function getReferenceTableCameraAnchors(THREE, seatIndices = [0, 1, 2, 3]) {
  const P = DOMINO_REFERENCE_LAYOUT;
  const anchors = [];
  for (const seat of new Set(seatIndices)) {
    const basis = getReferenceSeatBasis(THREE, seat);
    const head = basis.position.clone().addScaledVector(basis.forward, 0.22);
    head.y = 2.28;
    for (const side of [-1, 1]) {
      anchors.push(head.clone().add(new THREE.Vector3(side * 0.48, 0.36, 0)));
      anchors.push(getReferenceRackEdge(THREE, seat, side));
    }
    // The old review fitted only heads and racks; its wide chair backs could
    // escape the portrait sides or landscape bottom. Include each furniture
    // part's corners while preserving the same view direction and target.
    const chairBoxes = [
      [0, P.STOOL_HEIGHT - P.SEAT_THICKNESS / 2, 0,
        P.SEAT_WIDTH, P.SEAT_THICKNESS, P.SEAT_DEPTH],
      [0, P.STOOL_HEIGHT + P.BACK_HEIGHT / 2, -P.SEAT_DEPTH * 0.45,
        P.SEAT_WIDTH, P.BACK_HEIGHT, P.BACK_THICKNESS],
      ...[-1, 1].map((side) => [side * P.SEAT_WIDTH * 0.49,
        P.STOOL_HEIGHT + P.ARM_HEIGHT, 0, P.ARM_THICKNESS, P.ARM_THICKNESS, P.ARM_DEPTH])
    ];
    for (const [x, y, z, width, height, depth] of chairBoxes) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const point = basis.position.clone()
          .addScaledVector(basis.right, x + sx * width / 2)
          .addScaledVector(basis.forward, z + sz * depth / 2);
        point.y = y + sy * height / 2;
        anchors.push(point);
      }
    }
  }
  for (const x of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) {
    for (const z of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) {
      anchors.push(new THREE.Vector3(x, P.CLOTH_TOP, z));
    }
  }
  return anchors;
}

/** Apply the review's table view to the camera's current viewport aspect. */
export function fitReferenceTableCamera(THREE, camera, { seatIndices = [0, 1, 2, 3] } = {}) {
  const P = DOMINO_REFERENCE_LAYOUT;
  camera.aspect = Math.max(0.25, Number.isFinite(camera.aspect) ? camera.aspect : 1);
  camera.fov = P.CAMERA_FOV;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(...P.CAMERA_TARGET);
  const direction = new THREE.Vector3(0.3, 0.62, 0.79).normalize();
  const anchors = getReferenceTableCameraAnchors(THREE, seatIndices);
  for (let distance = 5.5; distance <= 20; distance += 0.15) {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    if (anchors.every((point) => {
      const projected = point.clone().project(camera);
      return Math.abs(projected.x) <= 0.92 && Math.abs(projected.y) <= 0.91;
    })) break;
  }
  return { position: camera.position.clone(), target };
}
