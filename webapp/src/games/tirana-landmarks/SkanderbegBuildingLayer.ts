import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';
import {blenderGroup} from '../tirana-landmark-rebuild/geometry';
import distantGeometry from './skanderbeg-building-far.mjs';
import {resolveSkanderbegBuilding, SKANDERBEG_BUILDING} from './skanderbegBuilding.mjs';

const BASE = '/assets/tirana-streets/skanderbeg-building/';

/** A complete Blender silhouette is immediate. Near glass, balcony fittings,
 * planting and surface maps stream independently of gameplay startup. */
export class SkanderbegBuildingLayer {
  readonly group = new T.Group();
  readonly ready: Promise<void> = Promise.resolve();
  private readonly far = blenderGroup(distantGeometry);
  private near?: T.Group;
  private pending = false;
  private disposed = false;
  private retryAt = 0;
  private textureGeneration = 0;
  private readonly textures = new Set<T.Texture>();

  constructor(private readonly loadAssets = true) {
    this.group.name = 'Tirana Skanderbeg Building';
    const placement = resolveSkanderbegBuilding(WORLD);
    if (!placement) { this.group.visible = false; return; }
    this.group.position.set(placement.x, placement.groundY, placement.z);
    this.group.rotation.y = placement.yaw;
    this.group.userData = {...placement, assetErrors: [] as string[]};
    this.far.name = 'Skanderbeg Building · Blender distant silhouette';
    this.far.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      o.castShadow = false;
      const material = o.material as T.MeshStandardMaterial;
      // Distant glass stays opaque: correct depth and no costly sorting.
      material.roughness = .65;
    });
    this.group.add(this.far);
  }

  update(viewer: {x:number;z:number}, battery = false) {
    if (this.disposed || !this.group.visible) return;
    const distance = Math.hypot(viewer.x-this.group.position.x, viewer.z-this.group.position.z);
    const nearDistance = battery ? SKANDERBEG_BUILDING.batteryNearDistance : SKANDERBEG_BUILDING.nearDistance;
    // Hysteresis prevents geometry flicker while standing at the LOD boundary.
    const close = distance < nearDistance * (this.near?.visible ? 1.12 : 1);
    this.far.visible = !close || !this.near;
    if (this.near) this.near.visible = close;
    if (!this.loadAssets || !close || this.near || this.pending || performance.now() < this.retryAt) return;
    this.pending = true;
    void new GLTFLoader().loadAsync(BASE+'skanderbeg-building-near.glb').then(({scene}) => {
      if (this.disposed) { disposeWeaponResources([scene]); return; }
      scene.name = 'Skanderbeg Building · detailed Blender exterior';
      scene.visible = false; // Next update reconciles with the current viewer.
      scene.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        o.castShadow = true; o.receiveShadow = true;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const material of materials) {
          if (material instanceof T.MeshStandardMaterial && material.name === 'recessed-glazing') {
            material.userData.environmentWindow = true;
          }
        }
      });
      this.near = scene; this.group.add(scene);
      this.loadConcreteMaps(scene);
    }).catch(() => {
      this.group.userData.assetErrors.push('skanderbeg-building-near.glb');
      this.retryAt = performance.now()+30000;
    }).finally(() => { this.pending = false; });
  }

  private loadConcreteMaps(scene:T.Group) {
    const generation = ++this.textureGeneration;
    const concrete:T.MeshStandardMaterial[] = [];
    scene.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof T.MeshStandardMaterial && m.name === 'porcelain') concrete.push(m);
      }
    });
    for (const [file, kind] of [['concrete-normal.jpg','normal'],['concrete-arm.jpg','arm']] as const) {
      new T.TextureLoader().load(BASE+file, texture => {
        if (this.disposed || generation !== this.textureGeneration) { texture.dispose(); return; }
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.flipY = false; texture.anisotropy = 2;
        this.textures.add(texture);
        for (const material of concrete) {
          if (kind === 'normal') { material.normalMap = texture; material.normalScale.set(.12,.12); }
          else { material.roughnessMap = texture; material.roughness = .88; }
          material.needsUpdate = true;
        }
      }, undefined, () => { this.group.userData.assetErrors.push(file); });
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.textureGeneration;
    this.group.removeFromParent();
    disposeWeaponResources([this.group]);
    // The resource helper owns material maps; include any map completed before
    // a material was attached only once through the same traversal above.
    this.textures.clear();
    this.group.clear();
  }
}
