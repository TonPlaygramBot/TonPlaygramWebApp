import { WeaponShop, SHOP_DISPLAYS } from './weaponShop';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WEAPON_BY_ID } from './shared/weapons.mjs';
import type { State, Player, NPC } from './shared/engine.mjs';

const BASE = '/assets/tirana-streets/living/';
// Same Ludo IDs. Unavailable CDN models use the creator's downloadable CC0 pack.
export const WEAPON_MODEL_VARIANTS: Record<string, string> = {
  polyPistol01Attack: 'q-pistol',
  polyRevolver01Attack: 'smith',
  polyRevolver02Attack: 'smith',
  polyShotgun01Attack: 'q-shotgun',
  polyShotgun02Attack: 'q-shotgun',
  polyShotgun03Attack: 'q-shotgun',
  polySawedOff01Attack: 'q-shotgun',
  polySmg01Attack: 'q-smg',
  polyAssaultRifle01Attack: 'q-rifle',
  polyRobotLargeGunAttack: 'q-rifle',
  polyRobotFlyingGunAttack: 'q-smg',
  polyBazooka01Attack: 'launcher',
  polyGrenadeLauncher01Attack: 'launcher',
  polyDynamiteBomb01Attack: 'grenade',
  polyMolotov01Attack: 'grenade',
  polyGasTank01Attack: 'grenade',
  polyHandGrenade01Attack: 'grenade'
};
export const weaponModelFile = (model: string) =>
  WEAPON_MODEL_VARIANTS[model] || model;
export class LivingVisuals {
  group = new THREE.Group();
  private models = new Map<string, THREE.Group>();
  private loading = new Set<string>();
  private failed = new Set<string>();
  private holders = new Map<string, { group: THREE.Group; weapon: string }>();
  private tracers: THREE.LineSegments;
  private marks: THREE.InstancedMesh;
  private shopInterior = new WeaponShop();
  private dealerLabel: THREE.Sprite | null = null;
  private disposed = false;
  private stamp = 0;
  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(48 * 6), 3)
    );
    this.tracers = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xffd783,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      })
    );
    this.tracers.frustumCulled = false;
    this.group.add(this.tracers);
    this.marks = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffb657,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      }),
      48
    );
    this.marks.count = 0;
    this.marks.frustumCulled = false;
    this.group.add(this.marks);
    this.group.add(this.shopInterior.group);
    for (const name of new Set(SHOP_DISPLAYS.map((s) => s.model)))
      void this.load(name);
  }
  private async load(name: string) {
    if (
      this.models.has(name) ||
      this.loading.has(name) ||
      this.failed.has(name) ||
      this.disposed
    )
      return;
    this.loading.add(name);
    try {
      const gltf = await new GLTFLoader().loadAsync(BASE + name + '.glb');
      if (this.disposed) {
        this.disposeModel(gltf.scene);
        return;
      }
      // Held weapons are rigid props; merge by material to collapse tiny imported meshes.
      gltf.scene.updateMatrixWorld(true);
      const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
          const source = o.geometry.clone();
          if (o instanceof THREE.SkinnedMesh) {
            o.skeleton.update();
            const position = source.getAttribute('position'),
              vertex = new THREE.Vector3();
            for (let i = 0; i < position.count; i++) {
              o.getVertexPosition(i, vertex);
              position.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
          }
          const geometry = source.applyMatrix4(o.matrixWorld).toNonIndexed();
          if (geometry !== source) source.dispose();
          for (const key of Object.keys(geometry.attributes))
            if (!['position', 'normal', 'uv'].includes(key))
              geometry.deleteAttribute(key);
          if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
          if (!geometry.getAttribute('uv'))
            geometry.setAttribute(
              'uv',
              new THREE.BufferAttribute(
                new Float32Array(geometry.getAttribute('position').count * 2),
                2
              )
            );
          if (!batches.has(o.material)) batches.set(o.material, []);
          batches.get(o.material)!.push(geometry);
        }
      });
      const result = new THREE.Group();
      for (const [material, geos] of batches) {
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        if (merged) {
          const mesh = new THREE.Mesh(merged, material);
          mesh.castShadow = true;
          result.add(mesh);
        }
      }
      const box = new THREE.Box3().setFromObject(result),
        size = box.getSize(new THREE.Vector3());
      // Model long axis follows +Z, matching the source character's facing direction.
      if (size.x > size.z && size.x > size.y) result.rotation.y = -Math.PI / 2;
      else if (size.y > size.z && size.y > size.x)
        result.rotation.x = Math.PI / 2;
      result.updateMatrixWorld(true);
      const rotated = new THREE.Box3().setFromObject(result),
        center = rotated.getCenter(new THREE.Vector3()),
        extent = rotated.getSize(new THREE.Vector3());
      const scale = 0.8 / Math.max(extent.x, extent.y, extent.z);
      result.scale.setScalar(scale);
      result.position.copy(center.multiplyScalar(-scale));
      const wrapper = new THREE.Group();
      wrapper.add(result);
      this.models.set(name, wrapper);
      // Original geometry is no longer used; materials/textures are retained in merged meshes.
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    } catch (error) {
      this.failed.add(name);
      console.warn('Tirana weapon asset unavailable:', name, error);
    } finally {
      this.loading.delete(name);
    }
  }
  pose(id: string, actor: THREE.Group, entity: Player | NPC, time: number) {
    const weapon = entity.weapon || '',
      config = WEAPON_BY_ID.get(weapon),
      name = config ? weaponModelFile(config.model) : '';
    let holder = this.holders.get(id);
    if (!holder) {
      holder = { group: new THREE.Group(), weapon: '' };
      actor.add(holder.group);
      this.holders.set(id, holder);
    }
    holder.group.visible = !!name && entity.health > 0;
    if (name && holder.weapon !== name && this.models.has(name)) {
      holder.group.clear();
      holder.group.add(this.models.get(name)!.clone(true));
      holder.weapon = name;
    } else if (name && !this.models.has(name)) void this.load(name);
    const shot =
      'nextShot' in entity &&
      typeof entity.nextShot === 'number' &&
      entity.nextShot - time > 0.01;
    const reload = 'reloadAt' in entity && entity.reloadAt > time;
    holder.group.scale.setScalar(
      config?.category === 'sidearm' ? 0.5 : config?.radius ? 0.85 : 1
    );
    holder.group.position.set(0.22, 1.15, -0.33 + (shot ? 0.05 : 0));
    const aimPitch = 'input' in entity ? entity.input?.aimPitch || 0 : 0;
    holder.group.rotation.set(reload ? -0.65 : aimPitch, Math.PI - 0.05, 0);
    const bone = (suffix: string) => {
      let match: THREE.Object3D | undefined;
      actor.traverse((o) => {
        if (o.name.replace(/[:_]/g, '').endsWith(suffix)) match = o;
      });
      return match;
    };
    const w = bone('RightArm'),
      left = bone('LeftArm');
    // Layer an aiming pose over the locomotion mixer, never edit shared skeletons.
    if (name && entity.health > 0) {
      if (w) w.rotation.set(-0.85, 0, -0.45);
      if (left) left.rotation.set(-0.7, 0, 0.65);
    }
  }
  update(state: State, target: Player | undefined) {
    this.shopInterior.update(target, this.models);
    const attr = this.tracers.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const temp = new THREE.Object3D();
    let count = 0,
      marks = 0;
    for (const e of state.effects) {
      const age = state.elapsed - e.at;
      if (age < 0 || age > 0.2 || count >= 48) continue;
      if (e.kind === 'shot') {
        attr.setXYZ(count * 2, e.x, e.fromY ?? 1.35, e.z);
        attr.setXYZ(count * 2 + 1, e.toX, e.toY ?? 1.1, e.toZ);
        count++;
      }
      if ((e.kind === 'explosion' || e.kind === 'hit') && marks < 48) {
        temp.position.set(e.toX, e.toY ?? 1.1, e.toZ);
        temp.scale.setScalar(e.kind === 'explosion' ? 1 + age * 14 : 0.18);
        temp.updateMatrix();
        this.marks.setMatrixAt(marks++, temp.matrix);
      }
    }
    this.tracers.geometry.setDrawRange(0, count * 2);
    attr.needsUpdate = true;
    this.marks.count = marks;
    this.marks.instanceMatrix.needsUpdate = true;
    if (state.elapsed < this.stamp - 0.5) {
      for (const h of this.holders.values()) h.group.visible = false;
    }
    this.stamp = state.elapsed;
  }
  forget(id: string) {
    const holder = this.holders.get(id);
    holder?.group.removeFromParent();
    this.holders.delete(id);
  }
  private disposeModel(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const v of Object.values(m))
            if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    this.shopInterior.dispose();
    this.disposeModel(this.group);
    for (const m of this.models.values()) this.disposeModel(m);
    this.tracers.geometry.dispose();
    (this.tracers.material as THREE.Material).dispose();
    this.dealerLabel?.material.map?.dispose();
    this.dealerLabel?.material.dispose();
  }
}
