import * as T from 'three';
import { geometryOnly } from './gltf-geometry.mjs';
import { LandscapeVisuals } from '../src/games/tiranastreets/landscapeVisuals';
import { CityFacades, CITY_DETAILS } from '../src/games/tiranastreets/cityVisuals';
import { StreetVisuals } from '../src/games/tiranastreets/streetVisuals';
import { RIVER_PATHS, RAILINGS } from '../src/games/tiranastreets/shared/landscape.mjs';
import { STREET_PROPS } from '../src/games/tiranastreets/shared/streetDressing.mjs';
import { pavementHeight } from '../src/games/tiranastreets/shared/streetLayout.mjs';
import { WORLD } from '../src/games/tiranastreets/shared/world.mjs';
const ctx = new Proxy(
  {},
  {
    get: (_, key) =>
      ['measureText'].includes(String(key)) ? () => ({ width: 100 }) : () => {},
    set: () => true
  }
);
(globalThis as any).document = {
  createElement: () => ({ width: 512, height: 512, getContext: () => ctx })
};
T.TextureLoader.prototype.load = function () {
  return new T.Texture();
};
(globalThis as any).ProgressEvent = class {};
const landscape = new LandscapeVisuals();
const buildings = await geometryOnly('tirana-buildings.glb');
const facades = new CityFacades(buildings.scene);
const furniture = await geometryOnly('street-furniture.glb');
const kit = await geometryOnly('street-kit.glb');
furniture.scene.add(kit.scene);
const streets = new StreetVisuals(furniture.scene, []);
facades.update({ x: -59.39, z: 126.25 }, 1, false);
landscape.update({ x: -59.39, z: 126.25 }, 1, false);
streets.update(new T.Vector3(-59.39, 1.9, 126.25), 1, 'auto');
let meshes = 0,
  instances = 0;
for (const group of [landscape.group, facades.group, streets.group])
  group.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    meshes++;
    const p = o.geometry.getAttribute('position');
    if (!p || !Array.from(p.array).every(Number.isFinite))
      throw Error('Non-finite mesh ' + o.name);
    if (o instanceof T.InstancedMesh) {
      instances += o.count;
      if (!Array.from(o.instanceMatrix.array).every(Number.isFinite))
        throw Error('Non-finite instance');
    }
  });
// Ground must have an opening above the recessed river, while the water/bank remains below road level.
const line = RIVER_PATHS[0].line,
  a = line[4],
  b = line[5],
  x = (a[0] + b[0]) / 2,
  z = (a[1] + b[1]) / 2;
landscape.group.updateMatrixWorld(true);
const ray = new T.Raycaster(new T.Vector3(x, 10, z), new T.Vector3(0, -1, 0));
const hits = ray
  .intersectObjects(landscape.group.children, false)
  .filter((h) => !(h.object instanceof T.InstancedMesh));
if (!hits.length || hits[0].point.y > -0.9)
  throw Error('Ground masks recessed river ' + hits.map((h) => h.point.y));
console.log(
  JSON.stringify({
    meshes,
    instances,
    buildingPlacements: CITY_DETAILS.length,
    railings: RAILINGS.length,
    riverSurfaceY: hits[0].point.y,
    blenderModels: buildings.scene.children.map((o) => o.name)
  })
);

// Check the final Draco-decoded paving, including its real winding and transforms.
const network = kit.scene.getObjectByName('pavement_network');
if (!network) throw Error('Missing pavement network');
network.updateWorldMatrix(true, true);
const paving = network.children.filter(
  (o) => o instanceof T.Mesh && o.name.startsWith('pavers')
);
const down = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
const surfaceAt = (x: number, z: number) => {
  down.ray.origin.set(x, 8, z);
  return down.intersectObjects(paving, false);
};
let checks = 0;
for (const prop of STREET_PROPS.filter((p) => p.name !== 'manhole_cover')) {
  const result = surfaceAt(prop.x, prop.z);
  if (!result.length)
    throw Error('No pavement under ' + prop.name + ' ' + prop.x + ',' + prop.z);
  if (Math.abs(result[0].point.y - pavementHeight(prop.x, prop.z)) > 0.035)
    throw Error('Visual/physical pavement mismatch ' + prop.name);
  checks++;
}
for (const r of WORLD.roads
  .filter((r) => !r.walk)
  .filter((_, i) => i % 25 === 0)) {
  const x = (r.a[0] + r.b[0]) / 2,
    z = (r.a[1] + r.b[1]) / 2;
  if (surfaceAt(x, z).length) throw Error('Paving covers traffic lane');
}
for (const r of RIVER_PATHS)
  for (let i = 1; i < r.line.length; i++) {
    const x = (r.line[i - 1][0] + r.line[i][0]) / 2,
      z = (r.line[i - 1][1] + r.line[i][1]) / 2;
    const bridge = WORLD.roads.some(
      (road) =>
        road.bridge &&
        Math.hypot(
          (road.a[0] + road.b[0]) / 2 - x,
          (road.a[1] + road.b[1]) / 2 - z
        ) < 50
    );
    if (!bridge && surfaceAt(x, z).length) throw Error('Paving covers river');
  }
for (const name of ['tree_plane', 'tree_linden', 'tree_cypress']) {
  const count = (o: T.Object3D) => {
    let n = 0;
    o.traverse((m) => {
      if (m instanceof T.Mesh)
        n +=
          (m.geometry.index?.count ||
            m.geometry.getAttribute('position').count) / 3;
    });
    return n;
  };
  const close = furniture.scene.getObjectByName(name)!,
    far = furniture.scene.getObjectByName(name + '_lod')!;
  if (!far || count(far) >= count(close) * 0.6)
    throw Error('Tree LOD does not reduce geometry');
}
console.log(
  JSON.stringify({
    pavementHeightChecks: checks,
    compressedStreetKit: true,
    treeLODReduction: 'over 40 percent'
  })
);
