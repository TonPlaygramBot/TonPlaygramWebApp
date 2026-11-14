import {pocketWeapon,isPocketWeapon} from '../PocketWeapons';
import { weaponPose, weaponAnchors, weaponHandFrame } from './weaponPose.mjs';
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
import { carPoint, vehicleAnchors, steeringWheelContacts, steeringWheelAngle, STEERING_WHEEL_AXIS } from './vehicleCore.mjs';
import {driverUp,driverDirection} from '../shared/driverView.mjs';
import {solveHumanoidGrip,poseHumanoidFist} from './humanoidHands.mjs';
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
  private retryAt = new Map<string,number>();
  private attempts = new Map<string,number>();
  private models = new Map<string, T.Group>();
  private loading = new Set<string>();
  private requests = new Map<string, Promise<void>>();
  private dead = false;
  private equipped = '';
  private firstPerson = true;
  private gait = 0;
  private motion = '';
  private running = false;
  private moving = false;
  private activeMotion?: T.AnimationAction;
  private motionActions: T.AnimationAction[] = [];
  private previousYaw?: number;
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
  setEyeView(firstPerson: boolean) {
    if(this.actor)this.bind(this.actor,firstPerson);
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
    this.activeMotion = undefined;
    this.running = false;
    this.moving = false;
    this.previousYaw = undefined;
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
    this.motionActions = [...new Set(Object.values(actor.clips || {Idle:actor.idle, Walk:actor.walk, Run:actor.run}))]
      .filter((action): action is T.AnimationAction => !!action);
  }
  private loadWeapon(id: string, model: string, priority=false) {
    if(isPocketWeapon(id)){if(!this.models.has(id))this.models.set(id,pocketWeapon(id));return Promise.resolve();}
    const existing = this.requests.get(id);
    if (existing) return existing;
    const operation = this.fetchWeapon(id, model,priority);
    // Rejected optional work is not an in-flight request. A selection made in
    // this same frame must be able to use the reserved transfer slot.
    if (!this.loading.has(id)) return operation;
    const request = operation.finally(() => {
      if (this.requests.get(id) === request) this.requests.delete(id);
    });
    this.requests.set(id, request);
    return request;
  }
  private async fetchWeapon(id: string, model: string, priority=false) {
    if (
      this.loading.has(id) ||
      this.models.has(id) ||
      (this.failed.has(id) && Date.now() < (this.retryAt.get(id) || Infinity)) ||
      // Keep one transfer slot available for the weapon the player selects.
      this.loading.size >= (priority?2:1) ||
      this.dead
    )
      return;
    this.loading.add(id);this.failed.delete(id);
    let source: T.Group | undefined, prepared: T.Group | undefined;
    const abort = new AbortController();
    this.aborts.add(abort);
    const timer = setTimeout(() => abort.abort(), 45000);
    try {
      const url = new URL(weaponModelUrl(model), window.location.href),
        response = await fetch(url, { signal: abort.signal,cache:this.attempts.has(id)?'reload':'default' });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      clearTimeout(timer); // CPU/GPU decoding is not a failed network transfer.
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
      this.retryAt.delete(id);this.attempts.delete(id);
      for(let i=this.errors.length-1;i>=0;i--)if(this.errors[i].startsWith(`Held weapon ${id}:`))this.errors.splice(i,1);
    } catch (e) {
      disposeWeaponResources(
        [source, prepared].filter((r): r is T.Group => !!r)
      );
      if (!this.dead) {
        console.warn('[tirana:load]', {stage:'held-weapon',id,status:'failed'}, e);
        this.failed.add(id);
        const attempt=(this.attempts.get(id)||0)+1;this.attempts.set(id,attempt);
        this.retryAt.set(id,Date.now()+Math.min(30000,1000*2**Math.min(attempt,5)));
        if(!this.errors.some(message=>message.startsWith(`Held weapon ${id}:`)))this.errors.push(`Held weapon ${id}: ${String(e)}`);
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
    await this.loadWeapon(id, config.model,true);
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
    // Resuming a backgrounded tab should not fast-forward a stride or a blend.
    // This is presentation only; the simulation retains its own fixed clock.
    dt = T.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const root = actor.group;
    root.visible = p.health > 0;
    root.position.set(p.x, b.y, p.z);
    const unarmed=!p.weapon||p.weapon==='punch';
    const travelYaw=!firstPerson&&unarmed&&!car&&b.grounded&&p.speed>.15
      ? Math.atan2(-b.vx,-b.vz) : b.yaw;
    const targetYaw = travelYaw + Math.PI;
    const yaw = firstPerson || this.previousYaw === undefined ? targetYaw :
      this.previousYaw + Math.atan2(Math.sin(targetYaw-this.previousYaw), Math.cos(targetYaw-this.previousYaw))*(1-Math.exp(-dt*20));
    root.rotation.set(0, yaw, 0);
    this.previousYaw = yaw;
    root.scale.setScalar(1);
    const down=p.arrest?.phase==='down'||p.arrest?.phase==='backup',seated=p.arrest?.phase==='transport';
    this.custodyDown+=(Number(down)-this.custodyDown)*(1-Math.exp(-dt*10));
    if(this.custodyDown>.001){
      root.rotateX(-Math.PI/2*this.custodyDown);
      root.position.x-=Math.sin(b.yaw)*1.6*this.custodyDown;
      root.position.z-=Math.cos(b.yaw)*1.6*this.custodyDown;
      root.position.y+=.22*this.custodyDown;
    }
    const speed = T.MathUtils.clamp(Number.isFinite(p.speed) ? Math.abs(p.speed) : 0, 0, 12);
    this.moving = speed > (this.moving ? .08 : .18) && !car && b.grounded;
    this.running = this.moving && speed > (this.running ? 2.7 : 3.25);
    const moving = this.moving,
      motion = moving ? (this.running ? (p.weapon && p.weapon!=='punch' ? 'Run_Shoot' : 'Run') : 'Walk') : p.weapon && p.weapon!=='punch' ? (b.aim ? 'Idle_Gun_Pointing' : 'Idle_Gun') : 'Idle';
    const next = actor.clips?.[motion] || (moving ? (this.running ? actor.run || actor.walk : actor.walk || actor.run) : actor.idle);
    if (next !== this.activeMotion) {
      const previous = this.activeMotion;
      const preserveStride = moving && /walk|run|sprint/i.test(previous?.getClip().name || '');
      const phase = preserveStride && previous ? previous.time / Math.max(.001, previous.getClip().duration) : 0;
      for (const action of this.motionActions)
        if (action !== next) action?.fadeOut(.18);
      if (next) {
        next.reset();
        next.time = ((phase % 1 + 1) % 1) * next.getClip().duration;
        next.fadeIn(.18).play();
      }
      this.activeMotion = next;
    }
    this.motion = motion;
    // Scale the walk/run clip, not the mixer's clock: fading must take the same
    // real time at a slow walk as at a sprint. Keep unkeyed IK joints fresh.
    for (const [bone, rest] of this.rests) bone.quaternion.copy(rest);
    // The skeleton faces the camera/weapon while movement may be sideways or
    // backward. Redirect the lower-body stride in the actor's local frame.
    const travelSpeed=Math.hypot(b.vx,b.vz);
    const strideX=moving&&travelSpeed>.08?(Math.cos(yaw)*b.vx-Math.sin(yaw)*b.vz)/travelSpeed:0;
    const strideZ=moving&&travelSpeed>.08?(Math.sin(yaw)*b.vx+Math.cos(yaw)*b.vz)/travelSpeed:1;
    for (const action of this.motionActions) {
      if (!action) continue;
      const name = action.getClip().name;
      const locomotion = /walk|run|sprint/i.test(name);
      action.setEffectiveTimeScale(moving && locomotion ? T.MathUtils.clamp(speed / (/run|sprint/i.test(name) ? 5.4 : 1.45), .15, 2.3) : 1);
    }
    actor.mixer?.update(dt);
    // Imported player skins may ship only a static pose: use their own bind
    // proportions to animate feet without assuming Mixamo local joint axes.
    if (!this.hasLocomotion) this.legPose?.update(b.gait, moving ? speed : 0,strideX,strideZ);
    else if(moving) this.legPose?.redirect(strideX,strideZ);
    // Procedural additive fallbacks for clips absent from this audited rig.
    const set = (name: string, x: number, y = 0, z = 0) => {
      const bone = this.bones.get(name);
      if (bone)
        bone.quaternion
          .copy(this.rests.get(bone)!)
          .multiply(q.setFromEuler(new T.Euler(x, y, z)));
    };
    const crouch = b.crouched,
      // The motor already eases the eye height. Use that same transition for
      // the pelvis, so the player's body does not pop a half metre in one frame.
      crouchBlend = T.MathUtils.clamp((1.62-b.eye)/.68, 0, 1);
    const hips = this.bones.get('hips');
    if (hips) {
      const shift = car || seated ? -.52 : -.52*crouchBlend;
      root.position.y += shift;
    }
    if (crouchBlend > .001 || car || seated) {
      const blend=car||seated?1:crouchBlend;
      set('leftupleg', (car ? -1.35 : -1.3)*blend);
      set('rightupleg', (car ? -1.35 : -1.3)*blend);
      set('leftleg', (car ? 1.65 : 2.0)*blend);
      set('rightleg', (car ? 1.65 : 2.0)*blend);
      if (crouch && moving) {
        const wave = Math.sin(b.gait) * 0.25;
        set('leftupleg', (-1.3 + wave * 0.4)*blend);
        set('rightupleg', (-1.3 - wave * 0.4)*blend);
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
    if (crouchBlend > .001 && !car) {
      for (const side of ['left', 'right'] as const) {
        set(side + 'upleg', 0);
        set(side + 'leg', 0);
        const stride = moving
            ? Math.sin(b.gait + (side === 'left' ? 0 : Math.PI)) * 0.16
            : 0,
          point = new T.Vector3(p.x, b.y + 0.13, p.z)
            .addScaledVector(right, side === 'left' ? -0.14 : 0.14)
            .addScaledVector(
              travelSpeed>.08?new T.Vector3(b.vx/travelSpeed,0,b.vz/travelSpeed):new T.Vector3(-Math.sin(b.yaw),0,-Math.cos(b.yaw)),
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
      const anchors=vehicleAnchors(car),seat=carPoint(car,{...anchors.seat,z:anchors.seat.z-.035});
      const up=driverUp(car),forward=driverDirection(car);
      root.position.set(seat.x,seat.y,seat.z);root.up.set(up.x,up.y,up.z);
      root.lookAt(seat.x+forward.x,seat.y+forward.y,seat.z+forward.z);
      // Seat the actual pelvis, then solve the authored leg lengths into the
      // footwell. Local Euler bends differ across the supplied player rigs.
      if(hips){root.updateWorldMatrix(true,true);root.position.sub(hips.getWorldPosition(new T.Vector3()).sub(new T.Vector3(seat.x,seat.y,seat.z)));}
      for(const side of ['left','right'] as const){
        set(side+'upleg',0);set(side+'leg',0);set(side+'foot',0);
        const pedal=carPoint(car,side==='left'?anchors.leftPedal:anchors.rightPedal);
        armPose(root,this.bones,side,new T.Vector3(pedal.x,pedal.y,pedal.z),true);
      }
      const contact=steeringWheelContacts(car);
      left.set(contact.left.x,contact.left.y,contact.left.z);
      r.set(contact.right.x,contact.right.y,contact.right.z);
    } else root.up.set(0,1,0);
    const weaponRotation = new T.Quaternion().setFromEuler(new T.Euler(
      -pose.pitch + (reload ? swing * .6 : 0), b.yaw + Math.PI,
      reload ? swing * .25 : 0, 'YXZ'));
    const weaponOrigin = new T.Vector3(pose.origin.x, pose.origin.y - (reload ? swing * .18 : 0), pose.origin.z)
      .addScaledVector(v.set(forward.x,forward.y,forward.z),-b.recoil);
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
    const configForGrip=WEAPON_BY_ID.get(p.weapon);
    for(const side of ['left','right'] as const){
      const target=side==='left'?left:r;
      let solved=false;
      if(car){
        const origin=carPoint(car,{x:0,y:0,z:0}),forwardPoint=carPoint(car,{x:0,y:0,z:-1});
        const along=new T.Vector3(forwardPoint.x-origin.x,forwardPoint.y-origin.y,forwardPoint.z-origin.z);
        const inward=new T.Vector3(side==='left'?1:-1,0,0).applyAxisAngle(new T.Vector3(STEERING_WHEEL_AXIS.x,STEERING_WHEEL_AXIS.y,STEERING_WHEEL_AXIS.z),steeringWheelAngle(car));
        const normalPoint=carPoint(car,{x:inward.x,y:inward.y,z:inward.z});
        const normal=new T.Vector3(normalPoint.x-origin.x,normalPoint.y-origin.y,normalPoint.z-origin.z);
        solved=solveHumanoidGrip(root,this.bones,side,target,along,normal,.9);
      }else if(armed&&!(reload&&side==='left')&&!(configForGrip?.category==='melee'&&side==='left')){
        const frame=weaponHandFrame(p.weapon,side);
        const along=new T.Vector3(frame.along.x,frame.along.y,frame.along.z).normalize().applyQuaternion(weaponRotation);
        const normal=new T.Vector3(frame.normal.x,frame.normal.y,frame.normal.z).applyQuaternion(weaponRotation);
        solved=solveHumanoidGrip(root,this.bones,side,target,along,normal,frame.curl);
      }
      if(!solved){
        armPose(root,this.bones,side,target);
        if(!car&&!armed&&(b.guard||a?.kind==='punch'||p.weapon==='punch'))poseHumanoidFist(root,this.bones,side,1);
      }
    }
    // Finger joints for gripping hands are posed in measured anatomical space.
    // Keep the relaxed reload hand open instead of leaving a clenched fist.
    if(reload&&!car)for(const [name,bone] of this.bones)
      if(/^lefthand(index|middle|ring|pinky|thumb)/.test(name))bone.quaternion.copy(this.rests.get(bone)!);
    const config = WEAPON_BY_ID.get(p.weapon);
    if (config) void this.loadWeapon(p.weapon, config.model,true);
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
    this.weapon.position.copy(weaponOrigin);
    this.weapon.rotation.set(
      -pose.pitch + (reload ? swing * 0.6 : 0),
      b.yaw + Math.PI,
      reload ? swing * 0.25 : 0,
      'YXZ'
    );
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
    let attached=0;
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
      if(++attached>=2)break;
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
