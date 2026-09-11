import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Track } from './simulation.mjs';
import { occupied } from './tiranaScenery';
import {
  ALBANIAN_FORCES_CHARACTERS,
  albanianForcesAssetUrl
} from './albanianForcesCatalog.mjs';
type Post = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  root?: T.Group;
  mixer?: T.AnimationMixer;
  attempted: boolean;
};
/** Nearby, non-colliding officials. One LOD request at a time; owns all resources. */
export class AlbanianForcesLayer {
  readonly group = new T.Group();
  private posts: Post[] = [];
  private disposed = false;
  private loading = false;
  constructor(track: Track) {
    this.group.name = 'Albanian Forces race officials';
    ALBANIAN_FORCES_CHARACTERS.forEach((id, index) => {
      const start = Math.floor(
        (track.points.length * index) / ALBANIAN_FORCES_CHARACTERS.length
      );
      for (let offset = 0; offset < 30; offset++) {
        const p = track.points[(start + offset) % track.points.length];
        const side = index % 2 ? -1 : 1;
        const distance = track.width / 2 + 4;
        const x = p.x - Math.cos(p.yaw) * distance * side;
        const z = p.z + Math.sin(p.yaw) * distance * side;
        if (
          occupied(x, z) ||
          track.points.some(
            (q) => Math.hypot(q.x - x, q.z - z) < track.width / 2 + 1.5
          )
        )
          continue;
        this.posts.push({
          id,
          x,
          z,
          yaw: Math.atan2(p.x - x, p.z - z),
          attempted: false
        });
        break;
      }
    });
  }
  update(x: number, z: number, dt: number, performanceMode: boolean) {
    if (this.disposed) return;
    const radius = performanceMode ? 45 : 75;
    for (const post of this.posts) {
      const nearby = Math.hypot(post.x - x, post.z - z) < radius;
      if (post.root) {
        post.root.visible = nearby;
        if (nearby) post.mixer?.update(Math.min(dt, 0.1));
      } else if (nearby && !post.attempted && !this.loading) {
        post.attempted = true;
        this.loading = true;
        void new GLTFLoader()
          .loadAsync(albanianForcesAssetUrl(post.id, true))
          .then((gltf) => {
            if (this.disposed) {
              disposeForcesModel(gltf.scene);
              return;
            }
            const root = gltf.scene;
            const bounds = new T.Box3().setFromObject(root);
            const scale = 1.85 / Math.max(0.01, bounds.max.y - bounds.min.y);
            root.scale.setScalar(scale);
            root.position.set(post.x, -bounds.min.y * scale, post.z);
            root.rotation.y = post.yaw;
            root.traverse((o) => {
              if (o instanceof T.Mesh) {
                o.castShadow = false;
                o.receiveShadow = true;
              }
            });
            post.root = root;
            post.mixer = new T.AnimationMixer(root);
            const idle = gltf.animations.find((a) => a.name === 'Idle');
            if (idle) post.mixer.clipAction(idle).play();
            root.visible = false;
            this.group.add(root);
          })
          .catch((error) => {
            console.warn(`Race official ${post.id} could not load`, error);
          })
          .finally(() => {
            this.loading = false;
          });
      }
    }
  }
  dispose() {
    this.disposed = true;
    this.group.removeFromParent();
    for (const post of this.posts) {
      post.mixer?.stopAllAction();
      if (post.root) {
        post.mixer?.uncacheRoot(post.root);
        disposeForcesModel(post.root);
      }
    }
    this.group.clear();
    this.posts = [];
  }
}
export function disposeForcesModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  const textures = new Set<T.Texture>(),
    skeletons = new Set<T.Skeleton>();
  root.traverse((o) => {
    if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
    if (!(o instanceof T.Mesh)) return;
    geometries.add(o.geometry);
    for (const material of Array.isArray(o.material)
      ? o.material
      : [o.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    }
  });
  skeletons.forEach((s) => s.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
