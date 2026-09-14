import * as THREE from 'three';
import * as P from './domino-royal-motion-helpers';

export type DominoReviewView = 'hands' | 'table';
export type DominoReviewMotion = 'hold' | 'place' | 'draw' | 'knock' | 'opening';
export interface DominoReviewCameraAction {
  kind?: DominoReviewMotion;
  sourceSeat?: number;
  /** Actual hand/finger/forearm positions, including room for their skin surface. */
  activePoints?: THREE.Vector3[];
}

/** Review-only camera; all production scene and rack transforms stay untouched. */
export function fitDominoReviewCamera(
  camera: THREE.PerspectiveCamera,
  view: DominoReviewView,
  aspect: number,
  { kind = 'hold', sourceSeat = 1, activePoints = [] }: DominoReviewCameraAction = {}
) {
  camera.aspect = Math.max(.25, aspect);
  if (view === 'hands' && kind !== 'opening') {
    const rack = P.computeHandSlotPosition(sourceSeat, 3, 7);
    const [seatX, seatZ] = P.layoutSeat(P.getVisualSeatIndex(sourceSeat));
    const outward = new THREE.Vector3(seatX, 0, seatZ).normalize();
    const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
    const direction = outward.clone().negate().addScaledVector(tangent, .68).add(new THREE.Vector3(0, .50, 0)).normalize();
    const anchors: THREE.Vector3[] = [];
    const includeBox = (point: THREE.Vector3, x: number, y: number, z: number) => {
      for (const dx of [-x, x]) for (const dy of [-y, y]) for (const dz of [-z, z]) {
        anchors.push(point.clone().add(new THREE.Vector3(dx, dy, dz)));
      }
    };
    for (const index of [0, 3, 6]) includeBox(P.computeHandSlotPosition(sourceSeat, index, 7), .19, .28, .19);
    for (const side of [-1, 1]) anchors.push(rack.clone().addScaledVector(outward, .45).addScaledVector(tangent, side * .57).add(new THREE.Vector3(0, .65, 0)));
    if (kind === 'place' || kind === 'draw') {
      // Fit the complete production travel, including the difficult central
      // landing and far-stock pickup. Camera framing never changes a tile.
      const farStock = new THREE.Vector3(0, P.CLOTH_TOP + .006, .45 * P.CLOTH_RADIUS);
      const start = kind === 'place' ? rack : farStock;
      const end = kind === 'place' ? new THREE.Vector3(0, P.CHAIN_TILE_Y, 0) : P.computeHandSlotPosition(sourceSeat, 7, 8);
      for (let index = 0; index <= 24; index++) {
        includeBox(P.resolvePrecisionPlacementPosition({ start, end, arc: P.PLACE_ANIM_ARC }, index / 24), .29, .26, .29);
      }
    }
    if (kind === 'knock') {
      const [x, z] = P.layoutSeat(P.getVisualSeatIndex(sourceSeat));
      const outward = new THREE.Vector3(x, 0, z).normalize();
      const right = new THREE.Vector3(outward.z, 0, -outward.x).negate();
      const contact = outward.multiplyScalar(P.CLOTH_RADIUS * .7).addScaledVector(right, P.DOMINO_WIDTH * 1.3);
      contact.y = P.CLOTH_TOP + .05;
      includeBox(contact, .25, .3, .25);
    }
    anchors.push(...activePoints);
    const target = kind === 'hold'
      ? rack.clone().addScaledVector(outward, .10).add(new THREE.Vector3(0, .25, 0))
      : new THREE.Box3().setFromPoints(anchors).getCenter(new THREE.Vector3());
    camera.fov = 40;
    camera.updateProjectionMatrix();
    // Solve the perspective bounds directly so live finger framing is cheap
    // enough to update during playback on portrait phones.
    camera.position.copy(target).add(direction);
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
    let distance = 1.6;
    for (const point of anchors) {
      const local = point.clone().applyMatrix4(camera.matrixWorldInverse);
      distance = Math.max(distance,
        1 + local.z + Math.abs(local.x) / (.9 * halfFov * camera.aspect),
        1 + local.z + Math.abs(local.y) / (.87 * halfFov),
        1 + local.z + camera.near + .01);
    }
    camera.position.copy(target).addScaledVector(direction, distance + .01);
    camera.updateMatrixWorld(true);
    return camera;
  }
  camera.fov = P.CAMERA_FOV;
  camera.updateProjectionMatrix();
  const target = P.CAMERA_TARGET.clone().add(new THREE.Vector3(0, .3, .15));
  const direction = new THREE.Vector3(.3, .62, .79).normalize();
  const anchors: THREE.Vector3[] = [];
  for (let seat = 0; seat < 4; seat++) {
    const basis = P.seatBasisForIndex(seat), head = basis.position.clone().addScaledVector(basis.forward, .22); head.y = 2.28;
    for (const side of [-1, 1]) { anchors.push(head.clone().add(new THREE.Vector3(side * .48, .36, 0))); anchors.push(P.computeHandSlotPosition(seat, side < 0 ? 0 : 6, 7)); }
  }
  for (const x of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) for (const z of [-P.TABLE_OUTER_RADIUS, P.TABLE_OUTER_RADIUS]) anchors.push(new THREE.Vector3(x, P.CLOTH_TOP, z));
  for (let distance = 5.5; distance <= 20; distance += .15) {
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateMatrixWorld(true);
    if (anchors.every((point) => { const ndc = point.clone().project(camera); return Math.abs(ndc.x) <= .92 && Math.abs(ndc.y) <= .91; })) break;
  }
  return camera;
}
