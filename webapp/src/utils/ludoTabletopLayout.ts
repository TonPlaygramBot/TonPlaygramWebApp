import * as THREE from 'three';
import { snakeParkingBounds } from './snakeWeaponParking';
import { prepareSnakeFirearm, readSnakeWeaponContacts, snakeWeaponProfile } from './snakeWeaponGrip';

const UP = new THREE.Vector3(0, 1, 0);
export const LUDO_TABLE_GAP = 0.012;
export const LUDO_SURFACE_GAP = 0.002;
type Table = { radius: number; surfaceY: number; getOuterRadius?: (direction: THREE.Vector3) => number };

/** Seat directions are snapped to the board edges, never aimed at a moving token. */
export function ludoTableFrame(board: THREE.Object3D, seat: THREE.Object3D, halfSize: number) {
  const center = board.getWorldPosition(new THREE.Vector3());
  const seatLocal = board.worldToLocal(seat.getWorldPosition(new THREE.Vector3()));
  const localOut = Math.abs(seatLocal.x) > Math.abs(seatLocal.z)
    ? new THREE.Vector3(Math.sign(seatLocal.x), 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(seatLocal.z) || 1);
  const outward = localOut.transformDirection(board.matrixWorld).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(outward.clone().negate(), UP).normalize();
  const bounds = new THREE.Box3(new THREE.Vector3(-halfSize, 0, -halfSize), new THREE.Vector3(halfSize, 0, halfSize)).applyMatrix4(board.matrixWorld);
  const half = Math.max(bounds.getSize(new THREE.Vector3()).x, bounds.getSize(new THREE.Vector3()).z) / 2;
  return { center, outward, right, bounds, half };
}

function supported(box: THREE.Box3, center: THREE.Vector3, table: Table) {
  for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
    const direction = new THREE.Vector3(x - center.x, 0, z - center.z);
    const distance = direction.length();
    if (distance > (table.getOuterRadius?.(direction.normalize()) ?? table.radius) - LUDO_TABLE_GAP) return false;
  }
  return true;
}
function overlaps(a: THREE.Box3, b: THREE.Box3, gap = LUDO_TABLE_GAP) {
  return a.min.x < b.max.x + gap && a.max.x > b.min.x - gap && a.min.z < b.max.z + gap && a.max.z > b.min.z - gap;
}

/** One clear landing/pickup spot on the seated player's right, outside the board. */
export function ludoRightDicePosition(frame: ReturnType<typeof ludoTableFrame>, table: Table, size: number) {
  const { center, outward, right, half } = frame;
  for (let reach = half * 0.8; reach >= 0; reach -= 0.008) {
    const position = center.clone().addScaledVector(right, half + size / 2 + LUDO_TABLE_GAP * 2).addScaledVector(outward, reach);
    position.y = table.surfaceY + size / 2 + LUDO_SURFACE_GAP;
    if (supported(new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(size, size, size)), center, table)) return position;
  }
  return null;
}

/** Use the same authored grip measurements as Snake; +Z muzzle, side flat, grip outside. */
export function prepareLudoParkedWeapon(model: THREE.Object3D, id: string, length: number, reversed = false) {
  if (!snakeWeaponProfile(id).handheld) {
    const visual = new THREE.Group();
    visual.add(model);
    const size = snakeParkingBounds(visual).getSize(new THREE.Vector3());
    visual.scale.setScalar(length / Math.max(size.x, size.y, size.z, 0.001));
    const center = snakeParkingBounds(visual).getCenter(new THREE.Vector3());
    visual.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(visual);
    return wrapper;
  }
  const visual = prepareSnakeFirearm(model, id, length, reversed);
  visual.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)
  ));
  return visual;
}

export function parkLudoWeapon({ holder, frame, table, obstacles = [], dicePositions = [] }: {
  holder: THREE.Object3D; frame: ReturnType<typeof ludoTableFrame>; table: Table;
  obstacles?: THREE.Object3D[]; dicePositions?: THREE.Vector3[];
}) {
  if (!holder.parent || !holder.children.length) return false;
  const original = { position: holder.position.clone(), quaternion: holder.quaternion.clone(), scale: holder.scale.clone() };
  const { center, outward, right, bounds, half } = frame;
  const occupied = [bounds, ...obstacles.filter(o => o !== holder && o.visible).map(snakeParkingBounds),
    ...dicePositions.map(point => new THREE.Box3().setFromCenterAndSize(point, new THREE.Vector3(0.10, 1, 0.10)))];
  holder.position.set(0, 0, 0);
  const worldQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), right.clone().negate());
  holder.quaternion.copy(holder.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
  for (const scale of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5]) {
    holder.scale.setScalar(scale);
    const measured = snakeParkingBounds(holder), middle = measured.getCenter(new THREE.Vector3());
    if (measured.isEmpty()) break;
    const across = Math.abs(outward.x) * (measured.max.x - measured.min.x) + Math.abs(outward.z) * (measured.max.z - measured.min.z);
    for (let reach = half * 0.66; reach >= half * 0.12; reach -= 0.012) {
      const destination = center.clone().addScaledVector(outward, half + across / 2 + LUDO_TABLE_GAP * 2).addScaledVector(right, reach);
      const delta = new THREE.Vector3(destination.x - middle.x, table.surfaceY + LUDO_SURFACE_GAP - measured.min.y, destination.z - middle.z);
      const candidate = measured.clone().translate(delta);
      if (!supported(candidate, center, table) || occupied.some(box => overlaps(candidate, box))) continue;
      holder.position.copy(holder.parent.worldToLocal(holder.getWorldPosition(new THREE.Vector3()).add(delta)));
      holder.updateWorldMatrix(true, true);
      holder.userData.ludoParkedGrip = readSnakeWeaponContacts(holder)?.grip;
      holder.userData.ludoParkingScale = scale;
      return true;
    }
  }
  holder.position.copy(original.position);
  holder.quaternion.copy(original.quaternion);
  holder.scale.copy(original.scale);
  return false;
}
