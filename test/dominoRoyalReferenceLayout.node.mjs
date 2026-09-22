import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../webapp/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  DOMINO_REFERENCE_LAYOUT as L,
  createReferenceChair,
  createReferenceTable,
  getReferenceSeatBasis,
  getReferenceTableCameraAnchors,
  fitReferenceTableCamera
} from '../webapp/public/domino-royal-layout.js';

const EPS = 2e-6;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= EPS,
  `${label}: expected ${expected}, received ${actual}`);
const bounds = (object) => new THREE.Box3().setFromObject(object, true);
const materials = {
  wood: new THREE.MeshStandardMaterial(),
  cloth: new THREE.MeshStandardMaterial(),
  fabric: new THREE.MeshStandardMaterial(),
  metal: new THREE.MeshStandardMaterial()
};
const table = () => createReferenceTable(THREE, materials);
const chair = () => createReferenceChair(THREE, RoundedBoxGeometry, materials);

test('layout constants and occupied-seat anchors cannot drift through mutation', () => {
  assert.ok(Object.isFrozen(L));
  assert.ok(Object.isFrozen(L.CHAIR_SEAT_ANGLES));
  assert.ok(Object.isFrozen(L.CHAIR_SEAT_RADII));
  assert.ok(Object.isFrozen(L.CAMERA_TARGET));
  assert.throws(() => { L.CHAIR_SEAT_RADII[0] = 99; }, TypeError);
  close(L.LEGACY_DOMINO_HUMAN_HEIGHT, 1.13, 'human scale input');
});

test('tabletop retains the reference surface height, thickness and centered position', () => {
  const top = bounds(table().parts.top);
  const center = top.getCenter(new THREE.Vector3());
  close(top.max.y, 0.70892025, 'tabletop surface');
  close(top.min.y, 0.66392025, 'tabletop underside');
  close(center.x, 0, 'tabletop center x');
  close(center.z, 0, 'tabletop center z');
});

test('rotated tabletop keeps the exact compressed reference footprint', () => {
  const top = bounds(table().parts.top);
  // Independently recorded bounds of the PR preview octagon, including its
  // local width compression before its 22.5 degree rotation.
  close(top.max.x, 1.8442713995726332, 'tabletop right edge');
  close(top.min.x, -1.8442713995726332, 'tabletop left edge');
  close(top.max.z, 1.9846041013781452, 'tabletop near edge');
  close(top.min.z, -1.9846041013781452, 'tabletop far edge');
});

test('felt retains its own uncompressed octagonal footprint and visible elevation', () => {
  const felt = bounds(table().parts.felt);
  close(felt.max.x, 1.4289149529922647, 'felt right edge');
  close(felt.max.z, 1.4289149529922647, 'felt near edge');
  close(felt.min.x, -felt.max.x, 'felt centered horizontally');
  close(felt.max.y, 0.72192025, 'felt surface');
  close(felt.min.y, 0.70792025, 'felt underside');
});

test('reference pedestal meets the underside of the tabletop', () => {
  const furniture = table();
  const pedestal = bounds(furniture.parts.pedestal);
  close(pedestal.max.y, bounds(furniture.parts.top).min.y, 'pedestal/table join');
  close(pedestal.min.y, 0.252746505, 'pedestal bottom');
  close(pedestal.max.x, 1.0310976, 'pedestal widest radius');
});

test('chair seat has reference dimensions and aligns with the seated-human hips anchor', () => {
  const seat = bounds(chair().parts.seat);
  const size = seat.getSize(new THREE.Vector3());
  close(size.x, 1.482975, 'seat width');
  close(size.z, 1.5653625, 'seat depth');
  close(size.y, 0.1482975, 'seat thickness');
  close(seat.max.y, 0.69017025, 'seated-human hips anchor');
  close(0.70892025 - seat.max.y, 0.01875, 'tabletop above seat');
});

test('chair back and both armrests keep the reference height and symmetrical spacing', () => {
  const furniture = chair();
  const back = bounds(furniture.parts.back);
  const left = bounds(furniture.parts.leftArm);
  const right = bounds(furniture.parts.rightArm);
  close(back.max.y, 1.81064025, 'back upper edge');
  close(back.min.y, 0.69017025, 'back lower edge');
  close(back.getSize(new THREE.Vector3()).z, 0.13182, 'back thickness');
  close(left.getCenter(new THREE.Vector3()).y, 1.18449525, 'left arm height');
  close(right.getCenter(new THREE.Vector3()).y, 1.18449525, 'right arm height');
  close(left.min.x, -right.max.x, 'symmetric outer arm edges');
  close(left.max.x, -right.min.x, 'symmetric inner arm edges');
});

test('four chair centers match the reference occupied-seat positions and face the table', () => {
  const expected = [[0, 3.39418125], [2.55028125, 0], [0, -3.12418125], [-2.55028125, 0]];
  for (let index = 0; index < 4; index++) {
    const basis = getReferenceSeatBasis(THREE, index);
    const furniture = chair();
    furniture.position.copy(basis.position);
    furniture.lookAt(new THREE.Vector3());
    furniture.updateMatrixWorld(true);
    const center = bounds(furniture.parts.seat).getCenter(new THREE.Vector3());
    close(center.x, expected[index][0], `seat ${index} x`);
    close(center.z, expected[index][1], `seat ${index} z`);
    close(bounds(furniture.parts.seat).max.y, 0.69017025, `seat ${index} height`);
    close(furniture.getWorldDirection(new THREE.Vector3()).dot(basis.forward), 1, `seat ${index} direction`);
    close(basis.forward.dot(basis.right), 0, `seat ${index} perpendicular basis`);
    const backCenter = bounds(furniture.parts.back).getCenter(new THREE.Vector3());
    assert.ok(backCenter.sub(center).dot(basis.forward) < 0, `seat ${index} back faces away from table`);
  }
});

test('seat lookup wraps safely and returns independent vectors', () => {
  close(getReferenceSeatBasis(THREE, -1).radius, 2.55028125, 'negative seat wraps');
  close(getReferenceSeatBasis(THREE, 4).radius, 3.39418125, 'overflow seat wraps');
  close(getReferenceSeatBasis(THREE, NaN).radius, 3.39418125, 'invalid seat defaults');
  const mutated = getReferenceSeatBasis(THREE, 0);
  mutated.position.set(99, 99, 99);
  close(getReferenceSeatBasis(THREE, 0).position.z, 3.39418125, 'new basis is independent');
});

test('builders share caller-owned materials but allocate independent geometry and serializable metadata', () => {
  const a = table();
  const b = table();
  const c = chair();
  assert.equal(a.parts.top.material, materials.wood);
  assert.equal(a.parts.felt.material, materials.cloth);
  assert.equal(a.parts.rail.material, materials.metal);
  assert.equal(c.parts.seat.material, materials.fabric);
  assert.notEqual(a.parts.top.geometry, b.parts.top.geometry);
  assert.doesNotThrow(() => JSON.stringify(a.userData));
  assert.doesNotThrow(() => a.clone());
  assert.equal(a.children.length, 4);
  assert.equal(c.children.length, 4);
});

test('reference table camera contains occupied players and racks in portrait and landscape', () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
    for (const seatIndices of [[0, 2], [0, 1, 2, 3]]) {
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
      const { position, target } = fitReferenceTableCamera(THREE, camera, { seatIndices });
      close(camera.fov, 48, 'reference field of view');
      close(target.y, 1.22642025, 'reference camera target height');
      close(target.z, 0.15, 'reference camera target depth');
      close(position.distanceTo(camera.position), 0, 'returned camera position');
      const direction = position.clone().sub(target).normalize();
      close(direction.dot(new THREE.Vector3(0.3, 0.62, 0.79).normalize()), 1, 'reference view direction');
      const anchors = getReferenceTableCameraAnchors(THREE, seatIndices);
      assert.ok(anchors.length > seatIndices.length * 4 + 4, 'furniture extends the original head/rack anchors');
      for (const anchor of anchors) {
        const projected = anchor.clone().project(camera);
        assert.ok(Math.abs(projected.x) <= 0.92 + EPS,
          `${width}x${height}, ${seatIndices.length} players: horizontal bounds ${projected.x}`);
        assert.ok(Math.abs(projected.y) <= 0.91 + EPS,
          `${width}x${height}, ${seatIndices.length} players: vertical bounds ${projected.y}`);
        assert.ok(projected.z > -1 && projected.z < 1, 'anchor remains in front of the camera');
      }
    }
  }
});

test('camera fitting keeps every actual chair vertex within the padded viewport', () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
    for (const seatIndices of [[0, 2], [0, 1, 2, 3]]) {
      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 5000);
      fitReferenceTableCamera(THREE, camera, { seatIndices });
      for (const seat of seatIndices) {
        const furniture = chair();
        furniture.position.copy(getReferenceSeatBasis(THREE, seat).position);
        furniture.lookAt(new THREE.Vector3());
        furniture.updateMatrixWorld(true);
        for (const mesh of furniture.children) {
          const vertices = mesh.geometry.attributes.position;
          for (let index = 0; index < vertices.count; index++) {
            const projected = new THREE.Vector3().fromBufferAttribute(vertices, index)
              .applyMatrix4(mesh.matrixWorld).project(camera);
            assert.ok(Math.abs(projected.x) <= 0.92 + EPS && Math.abs(projected.y) <= 0.91 + EPS,
              `${width}x${height}, ${seatIndices.length} players: seat ${seat} ${mesh.name} must remain visible`);
            assert.ok(projected.z > -1 && projected.z < 1, 'chair vertex remains in front of camera');
          }
          mesh.geometry.dispose();
        }
      }
    }
  }
});
