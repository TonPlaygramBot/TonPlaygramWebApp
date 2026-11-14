import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { nearest, sample, type Track } from './simulation.mjs';

const ASSETS = '/assets/jetski-royal';
type Placement = {
  x: number;
  y: number;
  z: number;
  heading: number;
  length: number;
  height: number;
  depth: number;
};

// Course-side distances leave an open recovery lane between the buoys and rocks.
const SHORELINES: Record<string, {
  points: number[];
  sides: number[];
  distance: number;
  scale: number;
  height: number;
}> = {
  ksamil: { points: [10, 24, 50, 66, 109, 120, 164, 205, 219], sides: [-1], distance: 39, scale: 36, height: 11 },
  dhermi: { points: [0, 12, 24, 36, 48, 60, 72, 84, 96, 108], sides: [1], distance: 42, scale: 48, height: 24 },
  harbor: { points: [51, 68, 85, 102, 119, 136], sides: [1], distance: 39, scale: 32, height: 8 },
  karaburun: { points: [122, 134, 146, 158, 170, 182, 194, 206, 218, 230, 0], sides: [-1], distance: 55, scale: 53, height: 31 },
  koman: { points: [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228], sides: [-1, 1], distance: 42, scale: 43, height: 34 }
};

function addInstances(group: T.Group, asset: T.Group, placements: Placement[]) {
  asset.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(asset);
  const size = bounds.getSize(new T.Vector3());
  const center = bounds.getCenter(new T.Vector3());
  const fit = new T.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);
  const transform = new T.Object3D();
  const matrix = new T.Matrix4();
  asset.traverse((part) => {
    if (!(part instanceof T.Mesh)) return;
    const instances = new T.InstancedMesh(part.geometry, part.material, placements.length);
    placements.forEach((p, i) => {
      transform.position.set(p.x, p.y, p.z);
      transform.rotation.y = p.heading;
      transform.scale.set(p.length / size.x, p.height / size.y, p.depth / size.z);
      transform.updateMatrix();
      matrix.copy(transform.matrix).multiply(fit).multiply(part.matrixWorld);
      instances.setMatrixAt(i, matrix);
    });
    group.add(instances);
  });
}

export async function buildCoastalScenery(loader: GLTFLoader, track: Track) {
  const shoreline = SHORELINES[track.id];
  const hasBoats = track.id === 'harbor' || track.id === 'ksamil';
  const [rock, boat] = await Promise.all([
    loader.loadAsync(`${ASSETS}/coast-scan.glb`),
    hasBoats ? loader.loadAsync(`${ASSETS}/fishing-boat.glb`) : null
  ]);
  const group = new T.Group();
  group.name = `${track.name} shoreline`;
  const formations = shoreline.sides.flatMap((side) =>
    shoreline.points.map((index, i) => {
      const distance = shoreline.distance + (i % 3) * 4;
      const point = sample(track, index, side * distance);
      const length = shoreline.scale + (i % 4) * 5;
      const depth = shoreline.scale * 0.48;
      return {
        ...point,
        heading: point.heading + Math.PI / 2 + side * 0.2,
        y: -2.6,
        length,
        height: shoreline.height * (0.85 + (i % 5) * 0.12),
        depth
      };
    }).filter((p) =>
      nearest(track, p.x, p.z).distance > track.width + Math.hypot(p.length, p.depth) * 0.5
    )
  );
  addInstances(group, rock.scene, formations);
  if (boat) {
    addInstances(group, boat.scene, (track.id === 'harbor' ? [16, 22, 29, 35] : [38, 134]).map((index, i) => {
      const point = sample(track, index, track.width + 17 + (i % 2) * 6);
      return {
        ...point,
        heading: -point.heading + 0.35,
        y: -0.72,
        length: 8.7,
        height: 4.14,
        depth: 3.48
      };
    }));
  }
  return group;
}
