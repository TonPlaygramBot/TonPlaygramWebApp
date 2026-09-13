import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {pocketWeapon,isPocketWeapon} from '../PocketWeapons';
import { weaponPose, weaponAnchors } from './weaponPose.mjs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Actor } from '../cityBaseRenderer';
import type { Player, Car } from '../shared/engine.mjs';
import type { BodyState } from './StreetSimulation.mjs';
import { weaponModelUrl } from '../livingVisuals';
import {calibrateWeaponModel, hideAuthoredWeaponHands} from '../weaponCalibration';
import { WEAPON_BY_ID } from '../shared/weapons.mjs';
import {
  prepareWeaponScene,
  releaseBatchedSourceGeometry,
  disposeWeaponResources
} from '../weaponModelResources';
import { direction3 } from './spatialCore.mjs';
import { carPoint, vehicleAnchors } from './vehicleCore.mjs';
import {humanoidBones, headBoneIndices, solveHumanoidLimb, HumanoidLegPose} from './humanoidRig.mjs';
const v = new T.Vector3(),
  q = new T.Quaternion();
/** Rig-specific head masking, without scaling bones or hiding an entire skin.
 * One body + one skeleton supplies BOTH legs and arms. Original full geometry
 * draws only into the shadow map, so there are no doubled arms or body shadows. */
export function maskHead(root: T.Object3D) {
  const owned: { mesh:T.SkinnedMesh; source:T.BufferGeometry; shadow:T.SkinnedMesh; geometry: T.BufferGeometry; materials: T.Material[] }[] = [];
  const skins: T.SkinnedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.SkinnedMesh && o.visible) skins.push(o);
  });
  for (const mesh of skins) {
    const index = mesh.geometry.getIndex(),
      skinIndex = mesh.geometry.getAttribute('skinIndex'),
      weight = mesh.geometry.getAttribute('skinWeight');
    if (!skinIndex || !weight) continue;
    const headBones = headBoneIndices(mesh.skeleton);
    const isHead = (i: number) => {
      let total = 0;
      for (let j = 0; j < 4; j++)
        if (headBones.has(skinIndex.getComponent(i, j)))
          total += weight.getComponent(i, j);
      return total > 0.3;
    };
    const count = index?.count || mesh.geometry.getAttribute('position').count,
      indices: number[] = [],
      groups: {start:number;count:number;materialIndex:number}[] = [];
    for (let i = 0; i < count; i += 3) {
      const a = index ? index.getX(i) : i,
        b = index ? index.getX(i + 1) : i + 1,
        c = index ? index.getX(i + 2) : i + 2;
      if (!isHead(a) && !isHead(b) && !isHead(c)) {
        const materialIndex = mesh.geometry.groups.find(g => i >= g.start && i < g.start + g.count)?.materialIndex || 0;
        const last = groups[groups.length - 1];
        if (last && last.materialIndex === materialIndex) last.count += 3;
        else groups.push({start:indices.length,count:3,materialIndex});
        indices.push(a, b, c);
      }
    }
    const source = mesh.geometry,
      geometry = source.clone();
    geometry.setIndex(indices);
    geometry.clearGroups();
    groups.forEach(g => geometry.addGroup(g.start,g.count,g.materialIndex));
    mesh.geometry = geometry;
    mesh.castShadow = false;
    const materials = (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).map((m) => {
      const copy = m.clone();
      copy.colorWrite = false;
      copy.depthWrite = false;
      return copy;
    });
    const shadow = new T.SkinnedMesh(
      source,
      materials.length === 1 ? materials[0] : materials
    );
    shadow.name = 'full-body-shadow-only';
    shadow.skeleton = mesh.skeleton;
    shadow.bindMatrix.copy(mesh.bindMatrix);
    shadow.bindMatrixInverse.copy(mesh.bindMatrixInverse);
    shadow.position.copy(mesh.position);
    shadow.quaternion.copy(mesh.quaternion);
    shadow.scale.copy(mesh.scale);
    shadow.castShadow = true;
    shadow.frustumCulled = false;
    mesh.frustumCulled = false;
    mesh.parent?.add(shadow);
    owned.push({ mesh, source, shadow, geometry, materials });
  }
  return () => {
    for (const r of owned) {
      r.mesh.geometry = r.source;
      r.mesh.castShadow = true;
      r.shadow.removeFromParent();
      r.geometry.dispose();
      r.materials.forEach((m) => m.dispose());
    }
  };
}
const armPose = solveHumanoidLimb;
export class FirstPersonBody {
  private custodyDown = 0;
  readonly weapon = new T.Group();
  readonly errors: string[] = [];
  private drops = new Map<string, T.Group>();
  private actor?: Actor;
  private bones = new Map<string, T.Bone>();
  private rests = new Map<T.Bone, T.Quaternion>();
  private legPose?: HumanoidLegPose;
  private hasLocomotion = false;
  private release?: () => void;
  private aborts = new Set<AbortController>();
  private failed = new Set<string>();
  private models = new Map<string, T.Group>();
  private loading = new Set<string>();
  private requests = new Map<string, Promise<void>>();
  private dead = false;
  private equipped = '';
  private firstPerson = true;
  private gait = 0;
  private motion = '';
  private muzzle = new T.Mesh(
    new T.ConeGeometry(0.035, 0.12, 6),
    new T.MeshBasicMaterial({ color: 0xffe5a6 })
  );
  constructor(private scene: T.Scene) {
    this.weapon.name = 'first-person-held-weapon';
    scene.add(this.weapon);
    this.muzzle.rotation.x = Math.PI / 2;
    this.muzzle.position.z = 0.48;
    this.muzzle.visible = false;
    this.weapon.add(this.muzzle);
  }
  private bind(actor: Actor, firstPerson: boolean) {
    if (this.actor === actor) {
      if (this.firstPerson !== firstPerson) {
        this.release?.();
        this.release = firstPerson ? maskHead(actor.group) : undefined;
        this.firstPerson = firstPerson;
      }
      return;
    }
    this.release?.();
    this.actor = actor;
    this.bones = humanoidBones(actor.group);
    this.rests.clear();
    actor.group.traverse((o) => {
      if (o instanceof T.Bone) {
        this.rests.set(o, o.quaternion.clone());
      }
    });
    this.legPose = new HumanoidLegPose(actor.group, this.bones);
    this.hasLocomotion = Object.values(actor.clips || {Walk:actor.walk, Run:actor.run})
      .some(action => action && /walk|run|sprint/i.test(action.getClip().name));
    this.firstPerson = firstPerson;
    this.release = firstPerson ? maskHead(actor.group) : undefined;
    this.motion = '';
    // Remove horizontal root translation from private clips; physics owns all movement.
    for (const [key, action] of Object.entries(actor.clips || {Idle:actor.idle, Walk:actor.walk, Run:actor.run})) {
      if (!action) continue;
      const clip = action.getClip().clone();
      action.stop();
      const replacement = actor.mixer?.clipAction(clip);
      if (actor.clips && replacement) actor.clips[key] = replacement;
      if (key === 'Idle') actor.idle = replacement;
      if (key === 'Walk') actor.walk = replacement;
      if (key === 'Run') actor.run = replacement;
      for (const track of clip.tracks)
        if (/(?:hips|root).position/i.test(track.name)) {
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = track.values[0];
            track.values[i + 2] = track.values[2];
          }
        }
    }
  }
  private loadWeapon(id: string, model: string) {
    if(isPocketWeapon(id)){if(!this.models.has(id))this.models.set(id,pocketWeapon(id));return Promise.resolve();}
    const existing = this.requests.get(id);
    if (existing) return existing;
    const request = this.fetchWeapon(id, model).finally(() => this.requests.delete(id));
    this.requests.set(id, request);
    return request;
  }
  private async fetchWeapon(id: string, model: string) {
    if (
      this.loading.has(id) ||
      this.models.has(id) ||
      this.failed.has(id) ||
      this.loading.size >= 2 ||
      this.dead
    )
      return;
    this.loading.add(id);
    let source: T.Group | undefined, prepared: T.Group | undefined;
    const abort = new AbortController();
    this.aborts.add(abort);
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const url = new URL(weaponModelUrl(model), window.location.href),
        response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 20 * 1024 * 1024)
        throw Error('Weapon exceeds 20 MB budget');
      const g = await new GLTFLoader().parseAsync(
        bytes,
        new URL('.', url).href
      );
      source = g.scene;
      if (this.dead) {
        disposeWeaponResources([source]);
        return;
      }
      hideAuthoredWeaponHands(source, url.href);
      prepared = prepareWeaponScene(source);
      const wrapper = calibrateWeaponModel(prepared, url.href, weaponAnchors(id).length);
      wrapper.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = false;
          o.frustumCulled = false;
        }
      });
      if (source !== prepared) releaseBatchedSourceGeometry(source);
      this.models.set(id, wrapper);
    } catch (e) {
      disposeWeaponResources(
        [source, prepared].filter((r): r is T.Group => !!r)
      );
      if (!this.dead) {
        this.failed.add(id);
        this.errors.push(`Held weapon ${id}: ${String(e)}`);
      }
    } finally {
      clearTimeout(timer);
      this.aborts.delete(abort);
      this.loading.delete(id);
    }
  }
  async prepare(id: string) {
    const config = WEAPON_BY_ID.get(id);
    if (!config) return;
    while (!this.dead && !this.loading.has(id) && this.loading.size >= 2)
      await Promise.race(this.requests.values());
    await this.loadWeapon(id, config.model);
  }
  cloneWeapon(id: string) { return this.models.get(id)?.clone(true); }
  update(
    actor: Actor,
    p: Player,
    b: BodyState,
    time: number,
    dt: number,
    car?: Car,
    firstPerson = true
  ) {
    this.bind(actor, firstPerson);
    const root = actor.group;
    root.visible = p.health > 0;
    root.position.set(p.x, b.y, p.z);
    root.rotation.set(0, b.yaw + Math.PI, 0);
    root.scale.setScalar(1);
    const down=p.arrest?.phase==='down'||p.arrest?.phase==='backup',seated=p.arrest?.phase==='transport';
    this.custodyDown+=(Number(down)-this.custodyDown)*(1-Math.exp(-dt*10));
    if(this.custodyDown>.001){
      root.rotateX(-Math.PI/2*this.custodyDown);
      root.position.x-=Math.sin(b.yaw)*1.6*this.custodyDown;
      root.position.z-=Math.cos(b.yaw)*1.6*this.custodyDown;
      root.position.y+=.22*this.custodyDown;
    }
    const moving = p.speed > 0.15 && !car && b.grounded,
      motion = moving ? (p.speed > 3 ? (p.weapon && p.weapon!=='punch' ? 'Run_Shoot' : 'Run') : 'Walk') : p.weapon && p.weapon!=='punch' ? (b.aim ? 'Idle_Gun_Pointing' : 'Idle_Gun') : 'Idle';
    if (motion !== this.motion) {
      for (const a of Object.values(actor.clips || {Idle:actor.idle, Walk:actor.walk, Run:actor.run})) a?.fadeOut(0.14);
      const next = actor.clips?.[motion] || (moving ? (p.speed > 3 ? actor.run : actor.walk) : actor.idle);
      next?.reset().fadeIn(0.14).play();
      this.motion = motion;
    }
    actor.mixer?.update(
      dt *
        (moving ? Math.max(0.08, p.speed / (motion.startsWith('Run') ? 5.4 : 1.45)) : 1)
    );
    // Imported player skins may ship only a static pose: use their own bind
    // proportions to animate feet without assuming Mixamo local joint axes.
    if (!this.hasLocomotion) this.legPose?.update(b.gait, moving ? p.speed : 0);
    // Procedural additive fallbacks for clips absent from this audited rig.
    const set = (name: string, x: number, y = 0, z = 0) => {
      const bone = this.bones.get(name);
      if (bone)
        bone.quaternion
          .copy(this.rests.get(bone)!)
          .multiply(q.setFromEuler(new T.Euler(x, y, z)));
    };
    const crouch = b.crouched;
    const hips = this.bones.get('hips');
    if (hips) {
      const shift = crouch || car || seated ? -0.52 : 0;
      root.position.y += shift;
    }
    if (crouch || car || seated) {
      set('leftupleg', car ? -1.35 : -1.3);
      set('rightupleg', car ? -1.35 : -1.3);
      set('leftleg', car ? 1.65 : 2.0);
      set('rightleg', car ? 1.65 : 2.0);
      if (crouch && moving) {
        const wave = Math.sin(b.gait) * 0.25;
        set('leftupleg', -1.3 + wave * 0.4);
        set('rightupleg', -1.3 - wave * 0.4);
      }
    }
    if (!b.grounded) {
      set('leftupleg', -0.24);
      set('rightupleg', 0.18);
      set('leftleg', 0.55);
      set('rightleg', 0.4);
    }
    const a = b.action,
      phase = a ? T.MathUtils.clamp((time - a.start) / a.duration, 0, 1) : 0,
      swing = Math.sin(Math.PI * phase);

    const forward = direction3(b.yaw, b.pitch),
      right = new T.Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw)),
      eye = new T.Vector3(p.x, b.y + b.eye, p.z);
    if (crouch && !car) {
      for (const side of ['left', 'right'] as const) {
        set(side + 'upleg', 0);
        set(side + 'leg', 0);
        const stride = moving
            ? Math.sin(b.gait + (side === 'left' ? 0 : Math.PI)) * 0.16
            : 0,
          point = new T.Vector3(p.x, b.y + 0.13, p.z)
            .addScaledVector(right, side === 'left' ? -0.14 : 0.14)
            .addScaledVector(
              new T.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)),
              stride
            );
        armPose(root, this.bones, side, point, true);
      }
    }
    if (a?.kind === 'kick') {
      set('rightupleg', 0);
      set('rightleg', 0);
      set('rightfoot', 0);
      const target = new T.Vector3(p.x, b.y + 0.16 + 0.66 * swing, p.z)
        .addScaledVector(right, 0.14)
        .addScaledVector(
          new T.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)),
          0.12 + 0.67 * swing
        );
      armPose(root, this.bones, 'right', target, true);
    }
    const local = (x: number, y: number, z: number) =>
      eye
        .clone()
        .addScaledVector(right, x)
        .addScaledVector(v.set(forward.x, forward.y, forward.z), z)
        .add(new T.Vector3(0, y, 0));
    const pose = weaponPose(p, b);
    const reload = a?.kind === 'reload',
      wall = T.MathUtils.clamp((0.8 - b.wall) / 0.6, 0, 1),
      armed = !!p.weapon && p.weapon !== 'punch';
    let left = local(-0.22, -0.28, 0.31),
      r = local(0.22, -0.28, 0.31);
    if (armed) {
      const offset = b.aim ? 0 : 0.15,
        low =
          -(b.aim ? pose.anchors.sight.y : 0.16) -
          wall * 0.27 -
          (reload ? swing * 0.18 : 0);
      r = local(offset, low, 0.34 - wall * 0.2);
      left = local(offset - 0.08, low + 0.02, 0.52 - wall * 0.2);
      if (reload) left = local(-0.19, -0.45, 0.25);
    } else if (b.guard) {
      left = local(-0.13, -0.08, 0.3);
      r = local(0.13, -0.08, 0.3);
    } else if (a?.kind === 'punch') {
      const reach = 0.32 + 0.39 * swing;
      if (a.hand) r = local(0.06, -0.17, reach);
      else left = local(-0.06, -0.17, reach);
    } else if(p.weapon==='punch') {
      left=local(-.18,-.18,.3);r=local(.18,-.18,.3);
    } else if(p.arrest&&p.arrest.phase!=='pursuit') {
      left=local(-.07,-.28,.35);r=local(.07,-.28,.35);
    }
    if (a?.kind === 'entering' || a?.kind === 'interacting') {
      r = local(0.13, -0.22, 0.3 + 0.35 * swing);
    }
    if (car) {
      const seat = carPoint(car, vehicleAnchors(car).seat);
      root.position.y = groundHeight(car.x,car.z)+vehicleAnchors(car).eye.y - 1.62;
      root.position.x = seat.x;
      root.position.z = seat.z;
      const wheel = carPoint(car, vehicleAnchors(car).wheel),
        wheelRight = new T.Vector3(
          Math.cos(car.heading),
          0,
          -Math.sin(car.heading)
        ),
        turn = -(car.steering || 0) * 1.7;
      left = new T.Vector3(wheel.x, wheel.y, wheel.z).addScaledVector(
        wheelRight,
        -0.18 * Math.cos(turn)
      );
      r = new T.Vector3(wheel.x, wheel.y, wheel.z).addScaledVector(
        wheelRight,
        0.18 * Math.cos(turn)
      );
      left.y -= 0.18 * Math.sin(turn);
      r.y += 0.18 * Math.sin(turn);
      root.rotation.y = car.heading + Math.PI;
    }
    const weaponRotation = new T.Quaternion().setFromEuler(new T.Euler(
      -pose.pitch + (reload ? swing * .6 : 0), b.yaw + Math.PI,
      reload ? swing * .25 : 0, 'YXZ'));
    const weaponOrigin = new T.Vector3(pose.origin.x, pose.origin.y - (reload ? swing * .18 : 0), pose.origin.z);
    if (armed && !car) {
      const socket = (point: {x:number;y:number;z:number}) => new T.Vector3(point.x, point.y, point.z).applyQuaternion(weaponRotation).add(weaponOrigin);
      r = socket(pose.anchors.rightGrip);
      if (!reload) left = socket(pose.anchors.leftSupport);
    }
    // Arm bones return to rest before solving; the lower-body mixer stays intact.
    for (const side of ['left', 'right'] as const) {
      set(side + 'arm', 0);
      set(side + 'forearm', 0);
      set(side + 'hand', 0);
    }
    if (WEAPON_BY_ID.get(p.weapon)?.category === 'melee' && p.weapon !== 'punch') {
      left = local(-.26,-.55,.06);
      if(a?.kind==='punch')r=local(.12,-.2,.3+.42*swing);
    }
    armPose(root, this.bones, 'left', left);
    armPose(root, this.bones, 'right', r);
    for (const [name, bone] of this.bones)
      if (/hand(index|middle|ring|pinky|thumb)/.test(name)) {
        const curl = armed
          ? 0.8
          : b.guard
            ? 1.1
            : a?.kind === 'interacting'
              ? 0.18
              : 1.2;
        bone.quaternion
          .copy(this.rests.get(bone)!)
          .multiply(q.setFromEuler(new T.Euler(curl, 0, 0)));
      }
    const config = WEAPON_BY_ID.get(p.weapon);
    if (config) void this.loadWeapon(p.weapon, config.model);
    if (
      (this.equipped !== p.weapon && this.models.has(p.weapon)) ||
      (!p.weapon && this.equipped)
    ) {
      for (const child of [...this.weapon.children])
        if (child !== this.muzzle) child.removeFromParent();
      this.equipped = p.weapon;
      const model = this.models.get(p.weapon);
      if (model) this.weapon.add(model);
    }
    this.weapon.visible =
      armed && !car && this.models.has(p.weapon) && p.health > 0;
    this.weapon.position.set(
      pose.origin.x,
      pose.origin.y - (reload ? swing * 0.18 : 0),
      pose.origin.z
    );
    this.weapon.rotation.set(
      -pose.pitch + (reload ? swing * 0.6 : 0),
      b.yaw + Math.PI,
      reload ? swing * 0.25 : 0,
      'YXZ'
    );
    this.weapon.position.addScaledVector(v.set(forward.x,forward.y,forward.z), -b.recoil);
    if(isPocketWeapon(p.weapon)){
      const throwing=config?.category==='throwable';
      const t=throwing?Math.max(0,Math.min(1,1-(p.nextShot-time)/(config?.interval||1))):1;
      if(throwing){r=local(.19,-.3,.28+Math.sin(t*Math.PI)*.3);armPose(root,this.bones,'right',r);this.weapon.position.copy(r);}
      this.weapon.visible=throwing&&!car&&p.health>0;
    }
    if (config?.category === 'melee') {
      this.weapon.rotation.x += a?.kind === 'punch' ? -.75 * swing : .2;
      const grip = pose.anchors.rightGrip;
      this.weapon.position.copy(r).sub(new T.Vector3(grip.x,grip.y,grip.z).applyQuaternion(this.weapon.quaternion));
    }
    this.muzzle.position.set(
      pose.anchors.muzzle.x,
      pose.anchors.muzzle.y,
      pose.anchors.muzzle.z
    );
    this.muzzle.visible =
      config?.category !== 'melee' && config?.category !== 'throwable' &&
      time < p.nextShot &&
      time >= p.nextShot - (config?.interval || 0.1) &&
      time < p.nextShot - (config?.interval || 0.1) + 0.05;
    if (firstPerson && b.aim && pose.anchors.zoom>1 && !reload && wall===0) this.weapon.visible=false;
    this.gait = b.gait;
  }
  syncLoot(
    loot: { id: string; weapon: string; x: number; y: number; z: number }[],
    claimed: Set<string>
  ) {
    const wanted = new Set(
      loot
        .filter((l) => !claimed.has(l.id))
        .slice(-32)
        .map((l) => l.id)
    );
    for (const [id, root] of this.drops)
      if (!wanted.has(id)) {
        root.removeFromParent();
        this.drops.delete(id);
      }
    for (const drop of loot) {
      if (!wanted.has(drop.id) || this.drops.has(drop.id)) continue;
      const w = WEAPON_BY_ID.get(drop.weapon);
      if (!w) continue;
      void this.loadWeapon(w.id, w.model);
      const source = this.models.get(w.id);
      if (!source) continue;
      const root = source.clone(true);
      root.name = 'loot:' + drop.id;
      root.position.set(drop.x, drop.y, drop.z);
      root.rotation.set(0, 1.1, Math.PI / 2);
      this.scene.add(root);
      this.drops.set(drop.id, root);
    }
  }
  dispose() {
    this.dead = true;
    for (const abort of this.aborts) abort.abort();
    this.aborts.clear();
    for (const root of this.drops.values()) root.removeFromParent();
    this.drops.clear();
    this.release?.();
    this.weapon.removeFromParent();
    disposeWeaponResources([...this.models.values()]);
    this.models.clear();
    this.muzzle.geometry.dispose();
    this.muzzle.material.dispose();
  }
}
