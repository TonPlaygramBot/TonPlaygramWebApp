import {alignVehicle} from '../../tirana-east/terrainTransforms';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import { driverEye } from '../shared/driverView.mjs';
import * as T from 'three';
import type { Actor } from '../cityBaseRenderer';
import { FirstPersonBody } from './FirstPersonBody';
import type { StreetSimulation } from './StreetSimulation.mjs';
import { DEFAULT_SETTINGS, type StreetSettings } from './settings';
import { direction3 } from './spatialCore.mjs';
import { CityRenderer } from '../renderer';
import type { State } from '../shared/engine.mjs';
import { attachEnhancements } from '../../tirana-expansion/WorldEnhancements';
import { SharedHumans } from './SharedHumans';
import { nearbyHumans } from './humanRoster.mjs';
import { forceCharacterFor } from '../shared/albanianForces.mjs';
import { CombatEffects } from '../CombatEffects';
/** Local career only. Reuses the original driving renderer and the newer shared
 * city details without editing map coordinates, physics or paid-match actors. */
export class StreetRenderer extends CityRenderer {
  vehicleView:'cockpit'|'chase'='cockpit';
  protected override get cockpitCamera(){return this.vehicleView==='cockpit';}
  private flightHeading?:number;
  readonly humans = new SharedHumans();
  readonly bodyRig: FirstPersonBody;
  readonly combatEffects: CombatEffects;
  private effectState?:State;
  private cutCount=0;
  private missileMeshes:T.InstancedMesh;
  private wreckMaterials=new Map<T.Mesh,{original:T.Material|T.Material[];copies:T.Material[]}>();
  private clearWrecks(){for(const [mesh,saved] of this.wreckMaterials){mesh.material=saved.original;saved.copies.forEach(m=>m.dispose());}this.wreckMaterials.clear();}
  private showWrecks(sim:StreetSimulation){
    const active=new Set<T.Mesh>();
    for(const car of sim.cars())if(car.destroyed){
      this.vehicleVisual(car.id)?.traverse(o=>{
        if(!(o instanceof T.Mesh))return;active.add(o);if(this.wreckMaterials.has(o))return;
        const original=o.material,copies=(Array.isArray(original)?original:[original]).map(m=>{
          const copy=m.clone();if(copy instanceof T.MeshStandardMaterial){copy.color.multiplyScalar(.22);copy.roughness=.95;copy.metalness=.15;copy.emissive.set(0);}
          return copy;
        });
        this.wreckMaterials.set(o,{original,copies});o.material=Array.isArray(original)?copies:copies[0];
      });
    }
    for(const [mesh,saved] of this.wreckMaterials)if(!active.has(mesh)){mesh.material=saved.original;saved.copies.forEach(m=>m.dispose());this.wreckMaterials.delete(mesh);}
  }
  simulation?: StreetSimulation;
  settings: StreetSettings = { ...DEFAULT_SETTINGS };
  private streetSampleStamp = performance.now();
  private samples: number[] = [];
  metrics = { p95: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
  readonly details: ReturnType<typeof attachEnhancements>;
  constructor(root: HTMLDivElement) {
    super(root);
    this.preserveVehicleInterior = true;
    this.ownDetailUpdate=false;
    this.bodyRig = new FirstPersonBody(this.scene);
    this.combatEffects = new CombatEffects(this.scene);
    this.missileMeshes = new T.InstancedMesh(new T.CylinderGeometry(.09,.09,1.1,6),new T.MeshStandardMaterial({color:0xd1d6d7,metalness:.6,roughness:.4}),8);
    this.missileMeshes.count=0;this.missileMeshes.frustumCulled=false;this.scene.add(this.missileMeshes);
    this.camera.near = 0.035;
    this.setFirstPerson(true);
    this.scene.add(this.humans.group);
    this.details = attachEnhancements(this.scene);
    this.details.bindBuildings(this.scene, [
      this.nativeLandmarks.group,
      this.referenceFacades.group,
      this.humans.group
    ]);
  }
  override orbit(dx: number, dy: number) {
    const b = this.simulation?.body,
      scale = this.settings.sensitivity * (b?.aim ? 0.52 : 1);
    this.yaw -= dx * 0.004 * scale;
    this.pitch = T.MathUtils.clamp(this.pitch - dy * 0.004 * scale, -1.48, 1.3);
  }
  protected override presentLocalPlayer(
    actor: Actor,
    state: State,
    id: string,
    dt: number
  ) {
    const sim = this.simulation;
    if (!sim) return false;
    const p = state.players[id],
      car = state.cars.find((c) => c.id === p.carId);
    if(p.aircraftId){actor.group.visible=false;this.bodyRig.weapon.visible=false;return true;}
    this.bodyRig.update(actor, p, sim.body, state.elapsed, dt, car);
    return true;
  }
  protected override presentFirstPerson(state: State, id: string, dt: number) {
    const sim = this.simulation;
    if (!sim) return false;
    const p = state.players[id],
      b = sim.body,
      car = state.cars.find((c) => c.id === p.carId);
    const aircraft=sim.flight.current;
    if(aircraft){
      if(this.flightHeading!==undefined)this.yaw+=Math.atan2(Math.sin(aircraft.heading-this.flightHeading),Math.cos(aircraft.heading-this.flightHeading));
      this.flightHeading=aircraft.heading;
      const d=direction3(this.yaw,T.MathUtils.clamp(this.pitch,-.6,.7));
      const follow=aircraft.kind==='jet'?20:13;
      this.camera.position.set(aircraft.x-d.x*follow,aircraft.y+5-d.y*follow,aircraft.z-d.z*follow);
      this.camera.lookAt(aircraft.x+d.x*40,aircraft.y+d.y*40,aircraft.z+d.z*40);
    } else if (car) {
      this.flightHeading=undefined;
      if(this.vehicleView==='cockpit'){
        const eye = driverEye(car);
        this.camera.position.set(eye.x, eye.y, eye.z);
      }else{
        const target={x:car.x,y:groundHeight(car.x,car.z)+1.4,z:car.z};
        const d=direction3(this.yaw,-.22),distance=car.model==='tirana-bus'?15:8;
        const away={x:-d.x,y:-d.y,z:-d.z};
        const hit=sim.world.cast(target,away,distance,sim.cars(),car.id);
        const safe=Math.max(1,Math.min(distance,hit.distance-.35));
        this.camera.position.set(target.x+away.x*safe,target.y+away.y*safe,target.z+away.z*safe);
        this.camera.lookAt(target.x,target.y,target.z);
      }
    } else {
      const target = new T.Vector3(p.x,b.y+(b.crouched?.65:1.0),p.z);
      const pitch = T.MathUtils.clamp(this.pitch,-.45,.85);
      const direction = direction3(this.yaw,pitch);
      // Metre-scale chase distance keeps head and feet in portrait framing.
      const distance = b.aim ? 2.8 : 4.6;
      const desired = new T.Vector3(-direction.x,-direction.y+.22,-direction.z).normalize();
      if(b.aim)desired.addScaledVector(new T.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)),.65/distance).normalize();
      const origin={x:target.x,y:target.y,z:target.z};
      const ray={x:desired.x,y:desired.y,z:desired.z};
      const hit=sim.world.cast(origin,ray,distance,sim.cars());
      const safe=Math.max(.3,Math.min(distance,hit.distance-.22));
      this.camera.position.copy(target).addScaledVector(desired,safe);
      this.camera.position.y=Math.max(b.y+.24,groundHeight(this.camera.position.x,this.camera.position.z)+.24,this.camera.position.y);
      if(b.aim){const aim=direction3(this.yaw,this.pitch);this.camera.lookAt(p.x+aim.x*25,b.y+b.eye+aim.y*25,p.z+aim.z*25);}else this.camera.lookAt(target);
    }
    const d = direction3(this.yaw, this.pitch);
    if(car&&this.vehicleView==='cockpit')this.camera.lookAt(
      this.camera.position.x + d.x,
      this.camera.position.y + d.y,
      this.camera.position.z + d.z
    );
    const fov = this.settings.fov - (b.aim ? 17 : 0);
    this.camera.fov = T.MathUtils.lerp(
      this.camera.fov,
      fov,
      dt ? Math.min(1, dt * 12) : 1
    );
    this.camera.updateProjectionMatrix();
    return true;
  }
  protected override presentVehicle(
    actor: Actor,
    state: State,
    carId: string,
    dt: number
  ) {
    const vehicle=state.cars.find(c=>c.id===carId)||state.traffic.find(c=>c.id===carId);
    if(vehicle)alignVehicle(actor.group,vehicle.heading+Math.PI);
    const action = this.simulation?.body.action,
      active =
        action?.targetId === carId &&
        (action.kind === 'entering' || action.kind === 'exiting'),
      value = active
        ? Math.sin(
            Math.PI *
              T.MathUtils.clamp(
                (state.elapsed - action!.start) / action!.duration,
                0,
                1
              )
          )
        : 0;
    const side = action?.side || 0;
    for (const [index, name] of [
      'BodyDoorLColor1',
      'BodyDoorRColor1'
    ].entries()) {
      const door = actor.group.getObjectByName(name);
      if (!door) continue;
      if (door.userData.restYaw === undefined)
        door.userData.restYaw = door.rotation.y;
      door.rotation.y =
        door.userData.restYaw +
        (index === 0 ? 1 : -1) * (index === side ? value : 0) * 0.85;
    }
    const wheel = actor.group.getObjectByName('InteriorSteeringCylinder'),
      car = state.cars.find((c) => c.id === carId);
    if (wheel && car) {
      if (wheel.userData.restZ === undefined)
        wheel.userData.restZ = wheel.rotation.z;
      wheel.rotation.z = wheel.userData.restZ - car.steering * 0.55;
    }
  }
  protected override presentDrivenCar(actor: Actor, state: State, id: string) {
    const p = state.players[id],
      car = state.cars.find((c) => c.id === p.carId);
    if (car) {
      actor.group.position.set(car.x, groundHeight(car.x,car.z)+0.03, car.z);
      actor.group.rotation.set(0, car.heading + Math.PI, 0);
      alignVehicle(actor.group,car.heading+Math.PI);
    }
  }
  protected override beforeDraw(_state: State | null, _id: string, dt: number) {
    const sim=this.simulation;
    if(sim){
      if(this.effectState!==sim.state){this.combatEffects.reset();this.clearWrecks();this.effectState=sim.state;this.cutCount=0;}
      this.combatEffects.consume(sim.state.effects,groundHeight);this.showWrecks(sim);
      if(this.cutCount!==sim.world.fractures.length){
        this.cutCount=sim.world.fractures.length;
        this.combatEffects.fracture(this.scene,sim.world.fractures,[this.humans.group,this.bodyRig.weapon,this.airMobility.group,this.collectionFleet.group]);
      }
      const fires=[...sim.combat.fires.values()].map(f=>({x:f.car.x,z:f.car.z,y:groundHeight(f.car.x,f.car.z)+.8}));
      this.combatEffects.update(dt,this.camera,fires,sim.combat.missiles,this.quality==='battery');
      const dummy=new T.Object3D();
      this.missileMeshes.count=sim.combat.missiles.length;
      sim.combat.missiles.forEach((m,i)=>{dummy.position.set(m.x,m.y,m.z);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(m.direction.x,m.direction.y,m.direction.z));dummy.updateMatrix();this.missileMeshes.setMatrixAt(i,dummy.matrix);});
      this.missileMeshes.instanceMatrix.needsUpdate=true;
    }
    if (this.simulation)
      this.bodyRig.syncLoot(this.simulation.loot.filter(l=>!l.collected).sort((a,b)=>Math.hypot(a.x-this.simulation!.player.x,a.z-this.simulation!.player.z)-Math.hypot(b.x-this.simulation!.player.x,b.z-this.simulation!.player.z)).filter(l=>Math.hypot(l.x-this.simulation!.player.x,l.z-this.simulation!.player.z)<90).slice(0,24), this.simulation.claimed);
    const stamp = performance.now();
    if (dt > 0) {
      this.samples.push(stamp - this.streetSampleStamp);
      if (this.samples.length > 240) this.samples.shift();
    }
    this.streetSampleStamp = stamp;
    const info = this.renderer.info;
    if (this.samples.length % 30 === 0 && this.samples.length) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.metrics = {
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures
      };
    }
  }
  override render(state: State | null, id: string, dt: number, lobby: boolean) {
    if (this.disposed) return;
    const p = state?.players[id];
    this.details.sourceCable.setRide(this.simulation?.cableRide||undefined);
    if (state && p)
      this.humans.update(
        state.npcs.filter((n) => !forceCharacterFor(n)),
        p,
        state.elapsed,
        dt,
        this.quality === 'battery'
      );
    this.details.update(
      state?.elapsed || 0,
      this.camera,
      p,
      this.quality === 'battery'
    );
    // Renderer-only view: authoritative/local simulation retains every real NPC.
    const visible =
      state && p
        ? [
            ...state.npcs.filter((n) => forceCharacterFor(n)),
            ...nearbyHumans(
              state.npcs.filter((n) => !forceCharacterFor(n)),
              p,
              this.quality === 'battery'
            )
          ]
        : [];
    super.render(
      state
        ? { ...state, npcs: visible.filter((n) => forceCharacterFor(n)) }
        : null,
      id,
      dt,
      lobby
    );
  }
  override destroy() {
    if (this.disposed) return;
    this.bodyRig.dispose();
    this.clearWrecks();this.combatEffects.dispose();this.missileMeshes.removeFromParent();this.missileMeshes.geometry.dispose();(this.missileMeshes.material as T.Material).dispose();
    this.humans.dispose();
    super.destroy();
  }
}
