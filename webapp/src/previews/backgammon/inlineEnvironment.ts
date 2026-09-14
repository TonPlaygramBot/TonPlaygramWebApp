import * as THREE from 'three';
import {
  BACKGAMMON_ARENA,
  fitBackgammonChair,
  createBackgammonChairGroup,
  groundBackgammonTable,
  backgammonPedestalScale
} from '../../games/backgammon/arenaLayout.ts';
import {
  createMurlanStyleTable,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
// Preview-only furniture. Production uses environment.ts and Murlan's complete
// model/HDRI catalogue. This scene performs no external asset requests.
export function disposeBackgammonObject(root: THREE.Object3D) {
  root.traverse((node: any) => {
    node.geometry?.dispose();
    (Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : []
    ).forEach((material: any) => material.dispose());
  });
  root.removeFromParent();
}
export function createBackgammonEnvironment({
  scene,
  fallbackChair,
  onTableSurfaceChange
}: any) {
  const { tableRadius, tableHeight } = BACKGAMMON_ARENA;
  const group = new THREE.Group();
  scene.add(group);
  let table: any = null;
  const chairs: THREE.Group[] = [];
  return {
    table(option: any) {
      if (table) disposeBackgammonObject(table.group);
      const shape =
        TABLE_SHAPE_OPTIONS.find(
          (shape: any) => shape.id === option.proceduralShapeId
        ) ?? TABLE_SHAPE_OPTIONS[0];
      const settings = {
        arena: group,
        tableRadius,
        tableHeight,
        pedestalHeightScale: backgammonPedestalScale(shape.id),
        shapeOption: shape,
        textures: false
      };
      table = createMurlanStyleTable(settings);
      onTableSurfaceChange(groundBackgammonTable(table.group, table.surfaceY));
    },
    finish() {},
    hdri() {},
    chairs(option: any) {
      chairs.forEach(disposeBackgammonObject);
      chairs.length = 0;
      for (const seat of [0, 1]) {
        const model = fallbackChair(
          option.primary || option.seatColor,
          option.legColor
        );
        fitBackgammonChair(model);
        const chair = createBackgammonChairGroup(model, seat);
        group.add(chair);
        chairs.push(chair);
      }
    },
    dispose() {
      disposeBackgammonObject(group);
    }
  };
}
