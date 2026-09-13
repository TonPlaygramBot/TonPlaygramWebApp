import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitSnakeTableModel } from '../../webapp/src/utils/snakeTableFit';
import { createRestoredSeatedHumanActor } from '../../webapp/src/pages/Games/shared/seatedHumanActors';
import {
  fitSnakeChairModel,
  groundSnakeChair,
  SNAKE_SCENE_DIMENSIONS as D
} from '../../webapp/src/components/SnakeBoard3D';
(globalThis as any).ProgressEvent = class {
  constructor(type, init) {
    Object.assign(this, { type, ...init });
  }
};
async function staticGlb(path: string) {
  const bytes = await readFile(path),
    length = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  delete json.images;
  delete json.textures;
  json.materials = [];
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  json.buffers[0].uri =
    'data:application/octet-stream;base64,' +
    bytes.subarray(28 + length).toString('base64');
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const avatar = await staticGlb(
  'webapp/public/assets/pool-royale/readyplayer.me.glb'
);
const chairTemplate = await staticGlb(
  'webapp/public/assets/snake-table-review/chair.glb'
);
fitSnakeChairModel(chairTemplate);
const skin: THREE.Vector3[] = [],
  chairPoints: THREE.Vector3[] = [];
for (let seat = 0; seat < 4; seat++) {
  const chair = new THREE.Group();
  chair.position
    .set(0, D.chairBaseHeight, D.chairRadius + D.seatClearance)
    .applyAxisAngle(THREE.Object3D.DEFAULT_UP, (seat * Math.PI) / 2);
  chair.rotation.y = Math.PI + (seat * Math.PI) / 2;
  const model = chairTemplate.clone(true);
  chair.add(model);
  groundSnakeChair({ group: chair, model });
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let i = 0; i < m.geometry.attributes.position.count; i++)
      chairPoints.push(
        new THREE.Vector3()
          .fromBufferAttribute(m.geometry.attributes.position, i)
          .applyMatrix4(m.matrixWorld)
      );
  });
  const human = createRestoredSeatedHumanActor(avatar, chair, {
    targetHeight: 1.13,
    seatHeight: D.seatHeight
  })!;
  chair.updateMatrixWorld(true);
  human.actor.traverse((object) => {
    const m = object as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.name.includes('Bottom')) return;
    m.skeleton.update();
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      skin.push(
        m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld)
      );
    }
  });
}
let failed = 0;
const ray = new THREE.Raycaster(),
  down = new THREE.Vector3(0, -1, 0);
for (const { id } of JSON.parse(
  await readFile(
    'webapp/public/assets/snake-table-review/manifest.json',
    'utf8'
  )
)) {
  if (process.env.TABLE_REVIEW_FILTER && id !== process.env.TABLE_REVIEW_FILTER)
    continue;
  const dir = 'webapp/public/assets/snake-table-review/' + id + '/';
  const j = JSON.parse(await readFile(dir + 'scene.gltf', 'utf8'));
  delete j.images;
  delete j.textures;
  j.materials = [];
  for (const m of j.meshes) for (const p of m.primitives) delete p.material;
  for (const b of j.buffers)
    b.uri =
      'data:application/octet-stream;base64,' +
      (await readFile(dir + b.uri)).toString('base64');
  const model = (await new GLTFLoader().parseAsync(JSON.stringify(j), ''))
    .scene;
  const info = fitSnakeTableModel(model, {
    radius: D.tableRadius,
    surfaceY: D.tableHeight,
    groundY: D.chairGroundY,
    assetId: id
  });
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      m.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      (m.geometry as any).boundsTree = new MeshBVH(m.geometry);
      m.raycast = acceleratedRaycast;
      meshes.push(m);
    }
  });
  let penetrations = 0,
    chairPenetrations = 0,
    worst = 0,
    minGap = Infinity;
  for (const p of [...skin, ...chairPoints]) {
    if (p.y < D.chairGroundY || p.y > D.tableHeight + 0.01) continue;
    ray.set(new THREE.Vector3(p.x, D.tableHeight + 0.5, p.z), down);
    for (const m of meshes) {
      const hits = ray
        .intersectObject(m, false)
        .map((h) => h.point.y)
        .filter((y, i, a) => i === 0 || Math.abs(y - a[i - 1]) > 0.0001);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const hi = hits[i],
          lo = hits[i + 1];
        if (p.y < hi - 0.001 && p.y > lo + 0.001) {
          if (chairPoints.includes(p)) chairPenetrations++;
          else penetrations++;
          if (process.env.TABLE_REVIEW_FILTER)
            console.log('CONTACT', p.toArray(), [hi, lo]);
          worst = Math.max(worst, Math.min(hi - p.y, p.y - lo));
        }
        if (p.y > D.chairBaseHeight - 0.05 && hi > D.tableHeight - 0.2)
          minGap = Math.min(minGap, lo - p.y);
      }
    }
  }
  console.log(id, JSON.stringify({ penetrations, chairPenetrations, worst }));
  if (penetrations || chairPenetrations) failed++;
}

if (failed)
  throw new Error(
    `${failed} tables still intersect the original legs or chair meshes`
  );
