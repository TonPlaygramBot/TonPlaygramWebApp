import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD as CENTRAL_WORLD } from '../tiranastreets/shared/centralWorld.mjs';
import type { WORLD } from '../tiranastreets/shared/world.mjs';
import { EnvironmentMaterials } from '../tirana-environment/EnvironmentMaterials';
import {
  BANK_LEVEL,
  BANK_WIDTH,
  BED_LEVEL,
  WATER_LEVEL,
  bankGeometry,
  riverRing,
  surfaceGeometry
} from '../tirana-environment/riverGeometry';
import { roadRing } from '../tirana-environment/roadSurfaceCore.mjs';
import { CITY_SOURCE } from '../tirana-city-source/sourceData.mjs';
import { facadeEdges, mappedTrees } from '../tirana-city-source/sourceCore.mjs';
import { BRIDGE, bridgeDeckHeight } from '../tirana-tabakeve/quarterCore.mjs';
import { NativeLandmarkLayer } from '../tirana-landmarks/NativeLandmarkLayer';
import { resolveNativeLandmarks } from '../tirana-landmarks/nativeLocations.mjs';
import { LANA_CHANNEL, LANA_RISE, lanaChannelDistance } from './lanaCourse.mjs';

const world: typeof WORLD = CENTRAL_WORLD;
const isNear = (p: number[], radius: number) =>
  lanaChannelDistance(p[0], p[1]) < radius;
const asVector = ([x, z]: number[]) => new T.Vector2(x, -z);

function addBatch(
  group: T.Group,
  parts: T.BufferGeometry[],
  material: T.Material,
  name: string
) {
  if (!parts.length) return;
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  group.add(mesh);
}

export async function buildLanaScenery(loader: GLTFLoader) {
  const [railAsset, mosqueAsset] = await Promise.all([
    loader.loadAsync('/assets/tirana-streets/environment/roadside-rail.glb'),
    loader.loadAsync('/assets/tirana-streets/landmark-rebuild/namazgah-far.glb')
  ]);
  const group = new T.Group();
  group.name = 'Tirana Streets · central Lana River';
  // Keep the city coordinate system. The water is 0.5 m above the street
  // game's art-directed water datum; zero remains the race surface.
  group.position.y = -WATER_LEVEL - LANA_RISE;
  const surfaces = new EnvironmentMaterials();
  const concrete = surfaces.create('rough_concrete', 0xb1b0a1);
  const asphalt = surfaces.create('asphalt_02', 0x666c68);
  const pavement = surfaces.create('concrete_pavement', 0xcec7b5);
  const grass = new T.MeshStandardMaterial({ color: 0x778557, roughness: 1 });

  const ring = riverRing(LANA_CHANNEL);
  const end = LANA_CHANNEL.line.at(-1)!;
  // One ground plane with a real opening, so street level never clips the water.
  addBatch(
    group,
    [
      surfaceGeometry(
        [
          [
            [end[0] - 300, -500],
            [1050, -500],
            [1050, 1070],
            [end[0] - 300, 1070]
          ],
          ring
        ],
        -0.045
      )
    ],
    grass,
    'Lana city ground'
  );
  addBatch(
    group,
    [surfaceGeometry([riverRing(LANA_CHANNEL, 0.15)], BED_LEVEL)],
    concrete,
    'Lana river bed'
  );
  for (const side of [-1, 1]) {
    const edge = (side * LANA_CHANNEL.width) / 2;
    const middle = edge + side * 2.6;
    // Meet the raised race surface at the original mapped channel edge.
    addBatch(
      group,
      [
        bankGeometry(
          LANA_CHANNEL,
          edge,
          WATER_LEVEL + LANA_RISE - 0.025,
          middle,
          -1.6
        )
      ],
      concrete,
      'Lana concrete embankment'
    );
    addBatch(
      group,
      [
        bankGeometry(
          LANA_CHANNEL,
          middle,
          -1.6,
          edge + side * BANK_WIDTH,
          BANK_LEVEL
        )
      ],
      grass,
      'Lana planted banks'
    );
  }
  addMappedRoads(group, concrete, asphalt, pavement, railAsset.scene);
  addMappedBuildings(group, mosqueAsset.scene);
  addMappedTrees(group);
  return group;
}

function addMappedRoads(
  group: T.Group,
  concrete: T.Material,
  asphalt: T.Material,
  pavement: T.Material,
  rails: T.Group
) {
  const roads = world.roads.filter(
    (r) => !r.tunnel && [r.a, r.b].some((p) => isNear(p, 145))
  );
  const roadParts: T.BufferGeometry[] = [],
    walkParts: T.BufferGeometry[] = [];
  const bridgeParts: T.BufferGeometry[] = [],
    paintParts: T.BufferGeometry[] = [];
  const railMatrices: T.Matrix4[] = [];
  const railTransform = new T.Object3D();
  for (const road of roads) {
    const [ax, az] = road.a,
      [bx, bz] = road.b;
    const dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz);
    if (length < 0.2) continue;
    const [x, z] = [(ax + bx) / 2, (az + bz) / 2];
    const crossings = road.bridge;
    const ring = roadRing(road);
    if (!ring) continue;
    if (!crossings) {
      // Park paths can terminate partway down the mapped embankment.
      if (!ring.every((p) => !isNear(p, LANA_CHANNEL.width / 2 + BANK_WIDTH)))
        continue;
      (road.walk ? walkParts : roadParts).push(
        surfaceGeometry([ring], road.walk ? 0.075 : 0.09)
      );
      const shoulder = !road.walk && roadRing(road, road.w + 2.5);
      if (
        shoulder &&
        shoulder.every((p) => !isNear(p, LANA_CHANNEL.width / 2 + BANK_WIDTH))
      )
        walkParts.push(surfaceGeometry([shoulder], 0.04));
    } else {
      const yaw = Math.atan2(dx, dz);
      // Lift the race bridge decks locally for hull, rider and chase-camera clearance.
      const deck = 1.28;
      bridgeParts.push(
        new T.BoxGeometry(road.w + (road.walk ? 0 : 2.3), 0.43, length)
          .rotateY(yaw)
          .translate(x, deck - 0.215, z)
      );
      (road.walk ? walkParts : roadParts).push(
        surfaceGeometry([ring], deck + 0.015)
      );
      if (road.w > 4 || road.walk) {
        const half = road.w / 2 + (road.walk ? 0 : 0.94);
        for (const side of [-1, 1]) {
          railTransform.position.set(
            x + (dz / length) * half * side,
            deck,
            z - (dx / length) * half * side
          );
          railTransform.rotation.set(0, yaw + Math.PI / 2, 0);
          railTransform.scale.set(length / 2.6, 1, 1);
          railTransform.updateMatrix();
          railMatrices.push(railTransform.matrix.clone());
        }
      }
    }
    if (!road.walk && road.w >= 6.2 && !crossings) {
      const yaw = Math.atan2(dx, dz);
      for (let d = 3; d < length - 2; d += 8)
        paintParts.push(
          new T.BoxGeometry(0.13, 0.012, 2.3)
            .rotateY(yaw)
            .translate(ax + (dx * d) / length, 0.102, az + (dz * d) / length)
        );
    }
  }
  addBatch(group, roadParts, asphalt, 'Mapped Tirana carriageways');
  addBatch(group, walkParts, pavement, 'Mapped Tirana sidewalks');
  if (paintParts.length)
    addBatch(
      group,
      paintParts,
      new T.MeshStandardMaterial({ color: 0xe9e5cc, roughness: 0.88 }),
      'Tirana road markings'
    );
  addBatch(group, bridgeParts, concrete, 'Mapped bridge decks');
  rails.updateMatrixWorld(true);
  // The loaded material and geometry are shared by the mapped bridge spans.
  rails.traverse((part) => {
    if (!(part instanceof T.Mesh)) return;
    const batch = new T.InstancedMesh(
      part.geometry,
      part.material,
      railMatrices.length
    );
    const matrix = new T.Matrix4();
    railMatrices.forEach((value, index) =>
      batch.setMatrixAt(index, matrix.multiplyMatrices(value, part.matrixWorld))
    );
    batch.name = 'Tirana roadside ironwork';
    batch.receiveShadow = true;
    batch.computeBoundingSphere();
    group.add(batch);
  });

  const arch = new T.Group();
  arch.name = 'Ura e Tabakëve';
  arch.position.set(BRIDGE.x, 0, BRIDGE.z);
  arch.rotation.y = -BRIDGE.yaw;
  const side = new T.Shape();
  const half = BRIDGE.length / 2;
  side.moveTo(-half, 0.02);
  side.lineTo(half, 0.02);
  for (let i = 32; i >= 0; i--) {
    const x = -half + (i / 32) * BRIDGE.length;
    side.lineTo(x, bridgeDeckHeight(x));
  }
  side.closePath();
  for (const [x, radius, height] of [
    [0, 4, 3.5],
    [-7.1, 1.15, 1.5],
    [7.1, 1.15, 1.5]
  ]) {
    const hole = new T.Path();
    hole.absellipse(x, 0.06, radius, height, 0, Math.PI, false, 0);
    hole.closePath();
    side.holes.push(hole);
  }
  const stone = new T.Mesh(
    new T.ExtrudeGeometry(side, {
      depth: BRIDGE.width,
      bevelEnabled: false,
      curveSegments: 14
    }).translate(0, 0, -BRIDGE.width / 2),
    concrete
  );
  stone.receiveShadow = true;
  arch.add(stone);
  group.add(arch);
}

function addMappedBuildings(group: T.Group, mosque: T.Group) {
  const colors = [
    0xc9bda7, 0xaebbaf, 0xdfbd9d, 0xe1d2b7, 0x909a96, 0xdab48e, 0xbfa9a6,
    0xcdd3c6
  ];
  const shells = colors.map(() => [] as T.BufferGeometry[]);
  const windows: T.BufferGeometry[] = [];
  for (const b of world.buildings) {
    if (b.p.length < 3 || !b.p.some((p) => isNear(p, 300))) continue;
    if (b.id === '174510408') continue;
    if (b.id === '461375120') {
      const yaw = Math.atan2(-0.8, -0.6);
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      const xs = b.p.map(([x, z]) => x * c - z * s);
      const zs = b.p.map(([x, z]) => x * s + z * c);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const z = (Math.min(...zs) + Math.max(...zs)) / 2;
      mosque.name = b.name;
      mosque.rotation.y = yaw;
      mosque.position.set(x * c + z * s, 0.06, -x * s + z * c);
      group.add(mosque);
      continue;
    }
    const height = b.id === '1255594721' ? 140 : b.h;
    const shape = new T.Shape(b.p.map(asVector));
    for (const hole of b.holes ?? [])
      shape.holes.push(new T.Path(hole.map(asVector)));
    const geo = new T.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1
    }).rotateX(-Math.PI / 2);
    shells[Number(b.id) % colors.length].push(geo);
    for (const e of facadeEdges(b.p)) {
      if (e.length < 5 || e.length > 85 || !isNear([e.x, e.z], 185)) continue;
      for (let y = 3.2; y < height - 1; y += 3.5)
        windows.push(
          new T.BoxGeometry(e.length - 1.4, 1.23, 0.15)
            .rotateY(e.yaw)
            .translate(e.x, y, e.z)
        );
    }
  }
  shells.forEach((parts, i) =>
    addBatch(
      group,
      parts,
      new T.MeshStandardMaterial({ color: colors[i], roughness: 0.85 }),
      'Mapped Tirana building shells'
    )
  );
  addBatch(
    group,
    windows,
    new T.MeshStandardMaterial({
      color: 0x53676a,
      roughness: 0.32,
      metalness: 0.32
    }),
    'Tirana window bands'
  );
  const landmarks = resolveNativeLandmarks(world).landmarks.filter(
    (l) => l.id === 'pyramid'
  );
  group.add(new NativeLandmarkLayer(landmarks).group);
}

function addMappedTrees(group: T.Group) {
  const trees = mappedTrees(world, CITY_SOURCE).filter((tree) => {
    const distance = lanaChannelDistance(tree.x, tree.z);
    return distance > LANA_CHANNEL.width / 2 + BANK_WIDTH && distance < 155;
  });
  const wood = new T.InstancedMesh(
    new T.CylinderGeometry(0.065, 0.14, 1, 6),
    new T.MeshStandardMaterial({ color: 0x736657, roughness: 0.94 }),
    trees.length
  );
  const crowns = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshStandardMaterial({
      color: 0x65824e,
      roughness: 0.96,
      flatShading: true
    }),
    trees.length * 3
  );
  const transform = new T.Object3D();
  const color = new T.Color();
  trees.forEach((tree, i) => {
    const height = tree.height || 8,
      crown = (tree.crown || 4.8) / 2;
    transform.position.set(tree.x, height * 0.34, tree.z);
    transform.scale.set(1, height * 0.68, 1);
    transform.updateMatrix();
    wood.setMatrixAt(i, transform.matrix);
    for (let part = 0; part < 3; part++) {
      const angle = i + part * 2.4;
      transform.position.set(
        tree.x + Math.sin(angle) * crown * 0.42,
        height * (0.71 + part * 0.085),
        tree.z + Math.cos(angle) * crown * 0.42
      );
      transform.scale.set(crown, height * 0.23, crown * 0.85);
      transform.updateMatrix();
      crowns.setMatrixAt(i * 3 + part, transform.matrix);
      crowns.setColorAt(
        i * 3 + part,
        color.setHSL(0.23 + (i % 4) * 0.012, 0.26, 0.64 + (part % 3) * 0.09)
      );
    }
  });
  wood.name = 'Mapped Tirana tree trunks';
  crowns.name = 'Mapped Tirana tree canopy';
  wood.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(wood, crowns);
}
