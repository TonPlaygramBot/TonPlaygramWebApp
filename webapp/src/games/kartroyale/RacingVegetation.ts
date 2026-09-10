import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { racingVegetationSites } from './racingVegetationCore.mjs';
import type { VegetationSite } from './racingVegetationCore.mjs';
import { disposeKartSource } from './SuppliedKartModels';

export class RacingVegetation {
  readonly group = new T.Group();
  private dead = false;
  private cells: {
    root: T.Group;
    x: number;
    z: number;
    kind: string;
    lod: boolean;
    count: number;
  }[] = [];
  private textures = new Set<T.Texture>();
  private wind = { value: 0 };
  constructor(
    parks: number[][][][],
    track: { points: readonly any[]; width: number },
    errors: string[]
  ) {
    this.group.name = 'Tirana:glTF-park-trees-and-undergrowth';
    const sites = racingVegetationSites(parks, track);
    this.group.userData.counts = Object.fromEntries(
      Object.entries(sites).map(([key, p]) => [key, p.length])
    );
    new GLTFLoader().load(
      '/assets/tirana-streets/street-furniture.glb',
      (g) => {
        if (this.dead) {
          disposeKartSource(g.scene);
          return;
        }
        g.scene.visible = false;
        this.group.add(g.scene);
        const names = ['tree_plane', 'tree_linden', 'tree_cypress'];
        for (const kind of ['trees', 'shrubs', 'grass', 'flowers'] as const) {
          for (
            let variant = 0;
            variant < (kind === 'trees' ? 3 : 1);
            variant++
          ) {
            const selected = sites[kind].filter((p) => p.variant === variant),
              name =
                kind === 'trees'
                  ? names[variant]
                  : `race_${kind === 'shrubs' ? 'shrub' : kind}`;
            this.batch(g.scene, name, selected, kind, false, errors);
            if (kind === 'trees')
              this.batch(g.scene, name + '_lod', selected, kind, true, errors);
          }
        }
        const bark: T.MeshStandardMaterial[] = [];
        g.scene.traverse((o) => {
          if (o instanceof T.Mesh)
            for (const material of Array.isArray(o.material)
              ? o.material
              : [o.material])
              if (
                material.name === 'Weathered bark' &&
                !bark.includes(material)
              )
                bark.push(material);
        });
        for (const [file, key] of [
          ['bark_brown_02-diff.jpg', 'map'],
          ['bark_brown_02-rough.jpg', 'roughnessMap'],
          ['bark_brown_02-nor_gl.jpg', 'normalMap']
        ] as const) {
          const texture = new T.TextureLoader().load(
            '/assets/tirana-streets/materials/' + file,
            (t) => {
              if (this.dead) {
                t.dispose();
                return;
              }
              t.wrapS = t.wrapT = T.RepeatWrapping;
              if (key === 'map') t.colorSpace = T.SRGBColorSpace;
              bark.forEach((m) => {
                m[key] = t;
                m.normalScale.set(0.35, 0.35);
                m.needsUpdate = true;
              });
            },
            undefined,
            () => {
              if (!this.dead)
                errors.push(`Park bark texture unavailable: ${file}`);
            }
          );
          this.textures.add(texture);
        }
      },
      undefined,
      () => {
        if (!this.dead) errors.push('Tirana vegetation glTF unavailable');
      }
    );
  }
  private batch(
    source: T.Group,
    name: string,
    points: VegetationSite[],
    kind: string,
    lod: boolean,
    errors: string[]
  ) {
    const model = source.getObjectByName(name);
    if (!model) {
      errors.push(`Vegetation node missing: ${name}`);
      return;
    }
    const chunks = new Map<string, VegetationSite[]>();
    points.forEach((p) => {
      const key = `${Math.floor(p.x / 32)}:${Math.floor(p.z / 32)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key)!.push(p);
    });
    model.updateWorldMatrix(true, true);
    const m = new T.Object3D();
    for (const [key, sites] of chunks) {
      const root = new T.Group();
      root.visible = false;
      root.name = `${name}:${key}`;
      this.group.add(root);
      const [x, z] = key.split(':').map(Number);
      this.cells.push({
        root,
        x: x * 32 + 16,
        z: z * 32 + 16,
        kind,
        lod,
        count: sites.length
      });
      model.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        // Share geometry/PBR materials; one batch per model part and spatial cell.
        const material = o.material as T.MeshStandardMaterial;
        if (!material.userData.racingWind) {
          material.userData.racingWind = true;
          material.customProgramCacheKey = () => `tirana-vegetation-wind-v1`;
          material.onBeforeCompile = (shader) => {
            shader.uniforms.racingWind = this.wind;
            shader.vertexShader =
              'uniform float racingWind;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
              float phase = racingWind * 1.45;
              #ifdef USE_INSTANCING
                phase += instanceMatrix[3].x * .13 + instanceMatrix[3].z * .11;
              #endif
              float flex = min(position.y * position.y * .015, .18);
              transformed.x += sin(phase + position.y) * flex;
              transformed.z += cos(phase * .71 + position.y) * flex * .45;`
            );
          };
        }
        const mesh = new T.InstancedMesh(o.geometry, material, sites.length);
        sites.forEach((p, i) => {
          m.position.set(p.x, 0.035, p.z);
          m.scale.setScalar(p.scale);
          m.rotation.set(0, i * 2.399, 0);
          m.updateMatrix();
          mesh.setMatrixAt(
            i,
            new T.Matrix4().multiplyMatrices(m.matrix, o.matrixWorld)
          );
        });
        mesh.receiveShadow = true;
        mesh.castShadow = kind === 'trees' && !lod;
        mesh.computeBoundingSphere();
        mesh.onBeforeRender = () => {
          this.wind.value = performance.now() / 1000;
        };
        root.add(mesh);
      });
    }
  }
  update(viewer?: { x: number; z: number }, battery = false) {
    if (this.dead || !viewer) return;
    for (const c of this.cells) {
      const d = Math.hypot(c.x - viewer.x, c.z - viewer.z);
      const range =
        c.kind === 'trees'
          ? battery
            ? 170
            : 260
          : c.kind === 'grass'
            ? battery
              ? 35
              : 70
            : battery
              ? 55
              : 105;
      const high = !battery && d < 55;
      c.root.visible = d < range + 23 && (c.kind !== 'trees' || c.lod !== high);
      if (c.root.visible)
        c.root.traverse((o) => {
          if (o instanceof T.InstancedMesh)
            o.count =
              battery && c.kind !== 'trees' ? Math.ceil(c.count / 2) : c.count;
        });
    }
  }
  retire() {
    if (this.dead) return;
    this.dead = true;
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
  }
  dispose() {
    this.retire();
    this.group.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    disposeKartSource(this.group);
    this.group.removeFromParent();
  }
}
