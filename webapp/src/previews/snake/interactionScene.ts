import * as THREE from 'three';
import { parkSnakeWeapons } from '../../utils/snakeWeaponParking';
import { createRestoredSeatedHumanActor } from '../../pages/Games/shared/seatedHumanActors';
import { createSnakeHumanInteraction, worldPoint } from '../../utils/snakeHumanInteraction';
import { SNAKE_DICE_READ_MS } from '../../utils/snakeDiceInteraction';
import { createSnakeDiceInteraction, SNAKE_DICE_PRESENTATION_MS } from '../../utils/snakeDiceInteraction';
import { createSnakeDiceVisibility } from '../../utils/snakeDiceVisibility';
import { prepareSnakeFirearm, snakeWeaponProfile } from '../../utils/snakeWeaponGrip';
import { createSnakeFirearmAnimation } from '../../utils/snakeFirearmAnimation';
import { createSnakeBoardScene, getDiceOrientationQuaternion, computeDiceThrowLayout, getSnakePortraitCameraState, SNAKE_SCENE_DIMENSIONS as D } from '../../components/SnakeBoard3D';

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
  const tableMesh = new THREE.ObjectLoader().parse(assets.table); scene.add(tableMesh);
  const outline = assets.tableOutline as unknown as number[];
  const table = { radius: D.tableRadius, surfaceY: D.tableHeight, undersideY: Number(assets.tableUnderside),
    getOuterRadius(direction: THREE.Vector3) {
      const index = ((Math.atan2(direction.z, direction.x) / (Math.PI * 2) + 1) % 1) * outline.length;
      const lower = Math.floor(index), blend = index - lower;
      return outline[lower] * (1 - blend) + outline[(lower + 1) % outline.length] * blend;
    }
  };
  const boardGroup = new THREE.Group(); scene.add(boardGroup);
  boardGroup.scale.set(D.footprintScale, D.boardScale, D.footprintScale);
  boardGroup.position.y = D.tableHeight - 0.01;
  const board = createSnakeBoardScene(boardGroup, new THREE.Vector3(0, D.tableHeight, 0), null);
  const chair = new THREE.Group(); scene.add(chair);
  chair.position.copy(point(0, D.chairBaseHeight, D.chairRadius + D.seatClearance)); chair.rotation.y = Math.PI + yaw;
  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: '#5c4230' }));
  chair.add(seatMesh);
  const template = new THREE.ObjectLoader().parse(assets.avatar);
  const restored = createRestoredSeatedHumanActor(template, chair, { targetHeight: 1.13, seatHeight: D.seatHeight })!;
  const human = createSnakeHumanInteraction(restored.actor)!;
  const anchor = new THREE.Object3D(); anchor.position.y = D.avatarAnchorHeight; chair.add(anchor);
  const nextSeat = (seat + 3) % 4, nextYaw = nextSeat * Math.PI / 2;
  const nextChair = new THREE.Group(); scene.add(nextChair);
  nextChair.position.set(0, D.chairBaseHeight, D.chairRadius + D.seatClearance).applyAxisAngle(THREE.Object3D.DEFAULT_UP, nextYaw);
  nextChair.rotation.y = Math.PI + nextYaw;
  const receiver = createSnakeHumanInteraction(createRestoredSeatedHumanActor(template, nextChair, { targetHeight: 1.13, seatHeight: D.seatHeight })!.actor)!;
  const nextAnchor = new THREE.Object3D(); nextAnchor.position.y = D.avatarAnchorHeight; nextChair.add(nextAnchor);
  const anchors = []; anchors[seat] = anchor; anchors[nextSeat] = nextAnchor;
  const nextLayout = computeDiceThrowLayout({ ...board, tableInfo: table, seatAnchors: anchors, getSeatHuman: () => receiver }, nextSeat, 1);
  const layout = computeDiceThrowLayout({ ...board, tableInfo: table, seatAnchors: anchors, getSeatHuman: () => human }, seat, 1);
  const die = board.diceSet[0]; die.position.copy(layout.basePositions[0]);
  const dieRest = die.position.clone();
  const allAnchors = Array.from({ length: 4 }, (_, i) => {
    const a = new THREE.Object3D(); a.position.set(0, 1, D.chairRadius).applyAxisAngle(THREE.Object3D.DEFAULT_UP, i * Math.PI / 2); scene.add(a); return a;
  });
  const parkedWeapons = allAnchors.map((_, i) => {
    const holder = new THREE.Group(); holder.userData.seatIndex = i; scene.add(holder);
    const visual = prepareSnakeFirearm(new THREE.ObjectLoader().parse(assets[weaponId]), weaponId,
      human.unit * snakeWeaponProfile(weaponId).lengthInArms);
    visual.rotation.x = Math.PI / 2; holder.add(visual); return holder;
  });
  const parking = parkSnakeWeapons({ holders: parkedWeapons, anchors: allAnchors, center: new THREE.Vector3(), table,
    obstacles: [board.platformGroup], diceZones: allAnchors.map((_, i) => board.root.localToWorld(computeDiceThrowLayout({ ...board, seatAnchors: allAnchors, tableInfo: table }, i, 1).basePositions[0].clone())) });
  const weapon = parkedWeapons[seat];
  const token = mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.25, 20), '#efb947', point(-0.35, 0.94, 0.5));
  const target = worldPoint(token);
  let motion: { update: (now: number) => boolean; dispose: () => void; duration?: number } | null = null;
  const visibility = () => createSnakeDiceVisibility(camera, [die], [human.actor, receiver.actor, ...parkedWeapons]);
  let sightline: ReturnType<typeof visibility> | null = null;
  let kind = 'dice', secondThrow = false;
  const secondStart = SNAKE_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS;
  const duration = () => kind === 'dice' ? secondStart + SNAKE_DICE_PRESENTATION_MS : motion?.duration ?? 0;
  const start = (next: string) => {
    motion?.dispose(); sightline?.dispose(); sightline = null; human.reset(); receiver.reset(); secondThrow = false; kind = next; die.position.copy(dieRest); die.quaternion.copy(getDiceOrientationQuaternion(1));
    if (kind === 'dice') {
      motion = createSnakeDiceInteraction(die, nextLayout.basePositions[0].clone(), { human, startedAt: 0, target: getDiceOrientationQuaternion(6), height: 0.13 });
    } else {
      motion = createSnakeFirearmAnimation({ scene, weaponId, parkedWeapon: weapon, origin: worldPoint(weapon), target, victims: [token], human, startedAt: 0 });
    }
    if (kind === 'dice') { const state = getSnakePortraitCameraState(); camera.position.copy(state.position); camera.fov = state.fov; camera.lookAt(state.target); sightline = visibility(); }
    else { camera.fov = 38; camera.position.copy(point(4.8, 3.7, -1.5)); camera.lookAt(point(0.2, 1.35, 1.9)); }
    camera.updateProjectionMatrix();
    nextChair.visible = kind === 'dice';
    motion.update(0);
    return duration();
  };
  const showTable = () => {
    motion?.dispose(); motion = null; sightline?.dispose(); sightline = null; human.reset(); receiver.reset(); nextChair.visible = true;
    camera.position.set(4.2, 4.8, 5.4); camera.fov = 48;
    camera.lookAt(0, D.tableHeight, 0); camera.updateProjectionMatrix();
  };
  showTable();
  return { scene, camera, human, receiver, die, weapon, token, parking, parkedWeapons, table, showTable, start, duration,
    update(time: number) {
      if (kind === 'dice' && time >= secondStart && !secondThrow) {
        motion?.update(SNAKE_DICE_PRESENTATION_MS); motion?.dispose();
        motion = createSnakeDiceInteraction(die, dieRest.clone(), { human: receiver, startedAt: secondStart, target: getDiceOrientationQuaternion(3) });
        secondThrow = true;
      }
      motion?.update(time);
      if (kind === 'dice') { camera.lookAt(worldPoint(die)); sightline?.update(time); }
      return time >= duration();
    },
    dispose() {
      motion?.dispose(); sightline?.dispose(); human.dispose(); receiver.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { const m = object as THREE.Mesh; if (m.geometry) geometries.add(m.geometry);
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => materials.add(mat)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    }
  };
}
