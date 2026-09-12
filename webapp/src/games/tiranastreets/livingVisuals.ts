import {IMPORTED_BY_ID} from './shared/importedAssets.mjs';
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  prepareWeaponScene, releaseBatchedSourceGeometry,
  clearWeaponInstance, disposeWeaponResources,
} from "./weaponModelResources";
import { WEAPON_BY_ID } from "./shared/weapons.mjs";
import type { State, Player, NPC } from "./shared/engine.mjs";

const BASE = "/assets/tirana-streets/living/";
// Same Ludo IDs. Unavailable CDN models use the creator's downloadable CC0 pack.
export const WEAPON_MODEL_VARIANTS: Record<string, string> = {
  polyPistol01Attack: "q-pistol",
  polyRevolver01Attack: "smith",
  polyRevolver02Attack: "smith",
  polyShotgun01Attack: "q-shotgun",
  polyShotgun02Attack: "q-shotgun",
  polyShotgun03Attack: "q-shotgun",
  polySawedOff01Attack: "q-shotgun",
  polySmg01Attack: "q-smg",
  polyAssaultRifle01Attack: "q-rifle",
  polyRobotLargeGunAttack: "q-rifle",
  polyRobotFlyingGunAttack: "q-smg",
  polyBazooka01Attack: "launcher",
  polyGrenadeLauncher01Attack: "launcher",
  polyDynamiteBomb01Attack: "grenade",
  polyMolotov01Attack: "grenade",
  polyGasTank01Attack: "grenade",
  polyHandGrenade01Attack: "grenade",
};
export const weaponModelFile = (model: string) =>
  IMPORTED_BY_ID.has(model) ? model : WEAPON_MODEL_VARIANTS[model] || model;
export const weaponModelUrl = (model:string) => IMPORTED_BY_ID.get(weaponModelFile(model))?.localUrl || BASE + weaponModelFile(model) + ".glb";
export class LivingVisuals {
  group = new THREE.Group();
  private models = new Map<string, THREE.Group>();
  private loading = new Set<string>();
  private failed = new Set<string>();
  private holders = new Map<string, { group: THREE.Group; weapon: string }>();
  private tracers: THREE.LineSegments;
  private marks: THREE.InstancedMesh;
  private shop = new THREE.Group();
  private dealerLabel: THREE.Sprite | null = null;
  private disposed = false;
  private stamp = 0;
  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(48 * 6), 3),
    );
    this.tracers = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xffd783,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.tracers.frustumCulled = false;
    this.group.add(this.tracers);
    this.marks = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffb657,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      48,
    );
    this.marks.count = 0;
    this.marks.frustumCulled = false;
    this.group.add(this.marks);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3, 48),
      new THREE.MeshBasicMaterial({
        color: 0xd2f566,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.11;
    this.shop.add(ring);
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.95, 0.75),
      new THREE.MeshStandardMaterial({
        color: 0x314239,
        metalness: 0.45,
        roughness: 0.6,
      }),
    );
    counter.position.set(0, 0.48, 1.6);
    counter.castShadow = true;
    this.shop.add(counter);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.16, 3),
      new THREE.MeshStandardMaterial({ color: 0x566347, roughness: 0.85 }),
    );
    canopy.position.y = 2.65;
    canopy.castShadow = true;
    this.shop.add(canopy);
    for (const x of [-1.7, 1.7]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x606861, metalness: 0.6 }),
      );
      pole.position.set(x, 1.3, 1);
      this.shop.add(pole);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#14291f";
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = "#d2f566";
    c.font = "bold 34px sans-serif";
    c.textAlign = "center";
    c.fillText("ARBEN · ARSENAL", 256, 60);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.dealerLabel = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture }),
    );
    this.dealerLabel.position.set(0, 3.1, 0);
    this.dealerLabel.scale.set(4.8, 0.9, 1);
    this.shop.add(this.dealerLabel);
    this.group.add(this.shop);
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
    let source: THREE.Group | undefined;
    let prepared: THREE.Group | undefined;
    try {
      const gltf = await new GLTFLoader().loadAsync(weaponModelUrl(name));
      source = gltf.scene;
      if (this.disposed) {
        this.disposeModel(source);
        source = undefined;
        return;
      }
      prepared = prepareWeaponScene(source);
      // A separate normalization frame preserves imported root transforms.
      const result = new THREE.Group();
      result.add(prepared);
      result.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
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
      const longest = Math.max(extent.x, extent.y, extent.z);
      if (!Number.isFinite(longest) || longest <= 0.0001)
        throw new Error("Weapon glTF has invalid or empty bounds");
      const scale = 0.8 / longest;
      result.scale.setScalar(scale);
      result.position.copy(center.multiplyScalar(-scale));
      const wrapper = new THREE.Group();
      wrapper.add(result);
      if (prepared !== source) releaseBatchedSourceGeometry(source);
      this.models.set(name, wrapper);
      source = undefined;
      prepared = undefined;
    } catch (error) {
      disposeWeaponResources([source, prepared].filter(
        (root): root is THREE.Group => root !== undefined,
      ));
      if (!this.disposed) {
        this.failed.add(name);
        console.warn("Tirana weapon asset unavailable:", name, error);
      }
    } finally {
      this.loading.delete(name);
    }
  }
  pose(id: string, actor: THREE.Group, entity: Player | NPC, time: number) {
    if (this.disposed) return;
    const weapon = entity.weapon || "",
      config = WEAPON_BY_ID.get(weapon),
      name = config ? weaponModelFile(config.model) : "";
    let holder = this.holders.get(id);
    if (!holder) {
      holder = { group: new THREE.Group(), weapon: "" };
      actor.add(holder.group);
      this.holders.set(id, holder);
    }
    if (holder.group.parent !== actor) actor.add(holder.group);
    if (holder.weapon !== name) {
      clearWeaponInstance(holder.group);
      holder.weapon = "";
      const model = name ? this.models.get(name) : undefined;
      if (model) {
        holder.group.add(cloneSkeleton(model));
        holder.weapon = name;
      }
    }
    if (name && !this.models.has(name)) void this.load(name);
    // Never display yesterday's gun using the newly selected weapon's stats.
    holder.group.visible = !!name && holder.weapon === name && entity.health > 0 && !("motion" in entity && entity.motion === "drive");
    const shot =
      "nextShot" in entity &&
      typeof entity.nextShot === "number" &&
      entity.nextShot - time > 0.01;
    const reload = "reloadAt" in entity && entity.reloadAt > time;
    holder.group.scale.setScalar(
      config?.category === "sidearm" ? 0.5 : config?.radius ? 0.85 : 1,
    );
    const aiming=!("anim" in entity) || entity.anim==="aim";
    holder.group.position.set(-0.22, aiming?1.3:1.02, (aiming?.43:.3) - (shot ? 0.05 : 0));
    holder.group.rotation.set(reload ? -0.65 : aiming?0:.5, 0.05, 0);
    const w = actor.getObjectByName("mixamorigRightArm"),
      left = actor.getObjectByName("mixamorigLeftArm");
    // Layer an aiming pose over the locomotion mixer, never edit shared skeletons.
    if (name && entity.health > 0) {
      if (w) w.rotation.set(-0.85, 0, -0.45);
      if (left) left.rotation.set(-0.7, 0, 0.65);
    }
  }
  update(state: State, target: Player | undefined) {
    if (this.disposed) return;
    this.shop.position.set(state.shop.x, 0, state.shop.z);
    this.shop.visible=!state.shops?.length;
    if (this.dealerLabel)
      this.dealerLabel.visible =
        !target ||
        Math.hypot(target.x - state.shop.x, target.z - state.shop.z) < 110;
    const attr = this.tracers.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const temp = new THREE.Object3D();
    let count = 0,
      marks = 0;
    for (const e of state.effects) {
      const age = state.elapsed - e.at;
      if (age < 0 || age > 0.2 || count >= 48) continue;
      if (e.kind === "shot") {
        attr.setXYZ(count * 2, e.x, e.y ?? 1.2, e.z);
        attr.setXYZ(count * 2 + 1, e.toX, e.toY ?? 1.1, e.toZ);
        count++;
      }
      if ((e.kind === "explosion" || e.kind === "hit") && marks < 48) {
        temp.position.set(e.toX, e.toY ?? 1, e.toZ);
        temp.scale.setScalar(e.kind === "explosion" ? 1 + age * 14 : 0.18);
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
  retryFailedAssets() {
    if (!this.disposed) this.failed.clear();
  }
  forget(id: string) {
    const holder = this.holders.get(id);
    if (holder) {
      clearWeaponInstance(holder.group);
      holder.group.removeFromParent();
    }
    this.holders.delete(id);
  }
  private disposeModel(root: THREE.Object3D) {
    disposeWeaponResources([root]);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of [...this.holders.keys()]) this.forget(id);
    disposeWeaponResources([this.group, ...this.models.values()]);
    this.models.clear();
    this.failed.clear();
    this.loading.clear();
    this.group.clear();
    this.group.removeFromParent();
  }
}
