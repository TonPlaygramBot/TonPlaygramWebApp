import * as THREE from 'three';
import { createRestoredSeatedHumanActor } from '../../pages/Games/shared/seatedHumanActors';
import { createSnakeHumanInteraction, worldPoint } from '../../utils/snakeHumanInteraction';
import { ROYAL_DICE_READ_MS } from '../../utils/royalDiceMotion';
import { createSnakeDiceInteraction, SNAKE_DICE_PRESENTATION_MS } from '../../utils/snakeDiceInteraction';
import { prepareSnakeFirearm, snakeWeaponProfile } from '../../utils/snakeWeaponGrip';
import { createSnakeFirearmAnimation } from '../../utils/snakeFirearmAnimation';
import { createSnakeBoardScene, getDiceOrientationQuaternion, computeDiceThrowLayout, SNAKE_SCENE_DIMENSIONS as D } from '../../components/SnakeBoard3D';

export const REVIEW_WEAPONS = ['polyAssaultRifle01Attack', 'polyPistol01Attack', 'polyShotgun01Attack'];
export function createSnakeInteractionScene(assets: Record<string, object>, seat = 0, weaponId = REVIEW_WEAPONS[0]) {
  const scene = new THREE.Scene();
  const yaw = seat * Math.PI / 2;
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  const camera = new THREE.PerspectiveCamera(38, 360 / 470, 0.01, 40);
  camera.position.copy(point(4.8, 3.7, -1.5)); camera.lookAt(point(0.2, 1.35, 1.9));
  scene.add(new THREE.HemisphereLight('#edf6ff', '#667163', 2.1));
  const key = new THREE.DirectionalLight('#fff2d9', 3); key.position.set(2, 6, -3); scene.add(key);
  const mesh = (geometry: THREE.BufferGeometry, color: string, position: THREE.Vector3) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.68 }));
    object.position.copy(position); scene.add(object); return object;
  };
  mesh(new THREE.CylinderGeometry(D.tableRadius, D.tableRadius, 0.16, 64), '#395d50', new THREE.Vector3(0, D.tableHeight - 0.08, 0));
  mesh(new THREE.CylinderGeometry(D.tableRadius + 0.06, D.tableRadius + 0.06, 0.13, 64), '#694b32', new THREE.Vector3(0, D.tableHeight - 0.17, 0));
  const boardGroup = new THREE.Group(); scene.add(boardGroup);
  boardGroup.scale.set(D.footprintScale, D.boardScale, D.footprintScale);
  boardGroup.position.y = D.tableHeight - 0.01;
  const board = createSnakeBoardScene(boardGroup, new THREE.Vector3(0, D.tableHeight, 0), null);
  const chair = new THREE.Group(); scene.add(chair);
  chair.position.copy(point(0, D.chairBaseHeight, D.chairRadius + (seat === 0 ? D.bottomChairExtra : 0))); chair.rotation.y = Math.PI + yaw;
  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: '#5c4230' }));
  chair.add(seatMesh);
  const template = new THREE.ObjectLoader().parse(assets.avatar);
  const restored = createRestoredSeatedHumanActor(template, chair, { targetHeight: 1.13, seatHeight: D.seatHeight })!;
  const human = createSnakeHumanInteraction(restored.actor)!;
  const anchor = new THREE.Object3D(); anchor.position.y = D.avatarAnchorHeight; chair.add(anchor);
  const nextSeat = (seat + 3) % 4, nextYaw = nextSeat * Math.PI / 2;
  const nextChair = new THREE.Group(); scene.add(nextChair);
  nextChair.position.set(0, D.chairBaseHeight, D.chairRadius + (nextSeat === 0 ? D.bottomChairExtra : 0)).applyAxisAngle(THREE.Object3D.DEFAULT_UP, nextYaw);
  nextChair.rotation.y = Math.PI + nextYaw;
  const receiver = createSnakeHumanInteraction(createRestoredSeatedHumanActor(template, nextChair, { targetHeight: 1.13, seatHeight: D.seatHeight })!.actor)!;
  const nextAnchor = new THREE.Object3D(); nextAnchor.position.y = D.avatarAnchorHeight; nextChair.add(nextAnchor);
  const anchors = []; anchors[seat] = anchor; anchors[nextSeat] = nextAnchor;
  const nextLayout = computeDiceThrowLayout({ ...board, seatAnchors: anchors, getSeatHuman: () => receiver }, nextSeat, 1);
  const layout = computeDiceThrowLayout({ ...board, seatAnchors: anchors, getSeatHuman: () => human }, seat, 1);
  const die = board.diceSet[0]; die.position.copy(layout.basePositions[0]);
  const dieRest = die.position.clone();
  const weapon = prepareSnakeFirearm(new THREE.ObjectLoader().parse(assets[weaponId]), weaponId,
    human.unit * snakeWeaponProfile(weaponId).lengthInArms);
  weapon.rotation.x = Math.PI / 2; weapon.rotation.y = yaw;
  weapon.position.copy(point(0.65, 0.92, 2.05)); scene.add(weapon);
  const token = mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.25, 20), '#efb947', point(-0.35, 0.94, 0.5));
  const target = worldPoint(token);
  let motion: { update: (now: number) => boolean; dispose: () => void; duration?: number } | null = null;
  let kind = 'dice', secondThrow = false;
  const secondStart = SNAKE_DICE_PRESENTATION_MS + ROYAL_DICE_READ_MS;
  const duration = () => kind === 'dice' ? secondStart + SNAKE_DICE_PRESENTATION_MS : motion?.duration ?? 0;
  const start = (next: string) => {
    motion?.dispose(); human.reset(); receiver.reset(); secondThrow = false; kind = next; die.position.copy(dieRest); die.quaternion.copy(getDiceOrientationQuaternion(1));
    if (kind === 'dice') {
      motion = createSnakeDiceInteraction(die, nextLayout.basePositions[0].clone(), { human, startedAt: 0, target: getDiceOrientationQuaternion(6), height: 0.13 });
    } else {
      motion = createSnakeFirearmAnimation({ scene, weaponId, parkedWeapon: weapon, origin: worldPoint(weapon), target, victims: [token], human, startedAt: 0 });
    }
    if (kind === 'dice') { camera.position.set(5, 5.5, 7); camera.lookAt(0, 0.85, 0); }
    else { camera.position.copy(point(4.8, 3.7, -1.5)); camera.lookAt(point(0.2, 1.35, 1.9)); }
    nextChair.visible = kind === 'dice';
    motion.update(0);
    return duration();
  };
  return { scene, camera, human, receiver, die, weapon, token, start, duration,
    update(time: number) {
      if (kind === 'dice' && time >= secondStart && !secondThrow) {
        motion?.update(SNAKE_DICE_PRESENTATION_MS); motion?.dispose();
        motion = createSnakeDiceInteraction(die, dieRest.clone(), { human: receiver, startedAt: secondStart, target: getDiceOrientationQuaternion(3) });
        secondThrow = true;
      }
      motion?.update(time);
      return time >= duration();
    },
    dispose() {
      motion?.dispose(); human.dispose(); receiver.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { const m = object as THREE.Mesh; if (m.geometry) geometries.add(m.geometry);
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => materials.add(mat)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    }
  };
}
