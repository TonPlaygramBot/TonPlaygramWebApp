import {weaponAnchors} from './weaponPose.mjs';
import {PocketVisuals} from '../PocketVisuals';
import {beginCityFrame} from '../renderSettings';
import {alignVehicle} from '../../tirana-east/terrainTransforms';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import { driverEye, driverFov, driverDirection, driverUp } from '../shared/driverView.mjs';
import * as T from 'three';
import type { Actor } from '../cityBaseRenderer';
import { FirstPersonBody } from './FirstPersonBody';
import type { StreetSimulation } from './StreetSimulation.mjs';
import { DEFAULT_SETTINGS, type StreetSettings } from './settings';
import { direction3 } from './spatialCore.mjs';
import { CityRenderer } from '../renderer';
import type { State } from '../shared/engine.mjs';
import type { attachEnhancements } from '../../tirana-expansion/WorldEnhancements';
import { SharedHumans } from './SharedHumans';
import { nearbyHumans } from './humanRoster.mjs';
import { forceCharacterFor } from '../shared/albanianForces.mjs';
import { CombatEffects } from '../CombatEffects';
import { SurfaceImpactMarks } from '../SurfaceImpactMarks';
import { vehicleDamageAppearance } from './vehicleDamageAppearance.mjs';
import { MissileVisuals } from '../MissileVisuals';
/** Local career only. Reuses the original driving renderer and the newer shared
 * city details without editing map coordinates, physics or paid-match actors. */
export class StreetRenderer extends CityRenderer {
  vehicleView:'cockpit'|'chase'='cockpit';
  protected override get cockpitCamera(){return this.vehicleView==='cockpit';}
  private flightHeading?:number;
  readonly humans = new SharedHumans();
  readonly bodyRig: FirstPersonBody;
  readonly combatEffects: CombatEffects;
  private impactMarks=new SurfaceImpactMarks();
  private effectState?:State;
  private cutCount=0;
  private missileMeshes:MissileVisuals;
  private pockets:PocketVisuals;
  private wreckMaterials=new Map<T.Mesh,{original:T.Material|T.Material[];copies:T.Material[]}>();
  private clearWrecks(){for(const [mesh,saved] of this.wreckMaterials){mesh.material=saved.original;saved.copies.forEach(m=>m.dispose());}this.wreckMaterials.clear();}
  private showWrecks(sim:StreetSimulation){
    const active=new Set<T.Mesh>();
    for(const car of sim.cars())if(car.destroyed||(car.health??140)<110){
      this.vehicleVisual(car.id)?.traverse(o=>{
        if(!(o instanceof T.Mesh))return;active.add(o);const existing=this.wreckMaterials.get(o);if(existing){
          const originals=Array.isArray(existing.original)?existing.original:[existing.original];
          existing.copies.forEach((copy,i)=>{const original=originals[i];if(copy instanceof T.MeshStandardMaterial&&original instanceof T.MeshStandardMaterial){const damage=vehicleDamageAppearance(car);copy.color.copy(original.color).multiplyScalar(damage.brightness);copy.roughness=Math.max(original.roughness,damage.roughness);copy.metalness=damage.charred?.15:original.metalness;copy.emissive.copy(original.emissive);if(damage.charred)copy.emissive.set(0);}});return;
        }
        const original=o.material,copies=(Array.isArray(original)?original:[original]).map(m=>{
          const copy=m.clone();if(copy instanceof T.MeshStandardMaterial){const damage=vehicleDamageAppearance(car);copy.color.multiplyScalar(damage.brightness);copy.roughness=Math.max(copy.roughness,damage.roughness);if(damage.charred){copy.metalness=.15;copy.emissive.set(0);}}
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
  private metricFrames = 0;
  private lootAt = -Infinity;
  metrics = { p95: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
  readonly details: ReturnType<typeof attachEnhancements>;
  constructor(root: HTMLDivElement) {
    super(root);
    this.preserveVehicleInterior = true;
    this.ownDetailUpdate=false;
    this.bodyRig = new FirstPersonBody(this.scene);
    this.combatEffects = new CombatEffects(this.scene);
    this.scene.add(this.impactMarks.mesh);
    this.missileMeshes = new MissileVisuals(this.scene);
    this.pockets = new PocketVisuals(this.scene);
    this.airMobility.authoritativeMissiles = true;
    this.camera.near = 0.035;
    this.setFirstPerson(true);
    this.scene.add(this.humans.group);
    this.details = this.cityDetails;
    this.details.bindBuildings(this.scene, [
      this.nativeLandmarks.group,
      this.referenceFacades.group,
      this.humans.group
    ]);
  }
  override orbit(dx: number, dy: number) {
    const b = this.simulation?.body,
      scale = this.settings.sensitivity * (b?.aim ? .65 / weaponAnchors(this.simulation?.player.weapon || '').zoom : 1);
    // Preserve the Career sensitivity while sharing the manual-look timeout.
    super.orbit(dx*scale*2/3,dy*scale);
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
    this.bodyRig.update(actor, p, sim.body, state.elapsed, dt, car, !car || this.vehicleView === 'cockpit');
    return true;
  }
  protected override presentFirstPerson(state: State, id: string, dt: number) {
    const sim = this.simulation;
    if (!sim) return false;
    const p = state.players[id],
      b = sim.body,
      car = state.cars.find((c) => c.id === p.carId);
    this.camera.up.set(0,1,0);
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
      this.flightHeading = undefined;
      // Camera follows the physical player's eyes. Looking down shows the body;
      // aiming never pulls the camera back behind the character.
      this.camera.position.set(p.x, b.y + b.eye, p.z);
      const look = direction3(this.yaw, this.pitch);
      this.camera.lookAt(p.x + look.x, b.y + b.eye + look.y, p.z + look.z);
    }
    const d = car?driverDirection(car,this.yaw,this.pitch):direction3(this.yaw, this.pitch);
    if(car&&this.vehicleView==='cockpit'){const up=driverUp(car);this.camera.up.set(up.x,up.y,up.z);}
    if(car&&this.vehicleView==='cockpit')this.camera.lookAt(
      this.camera.position.x + d.x,
      this.camera.position.y + d.y,
      this.camera.position.z + d.z
    );
    const zoom=b.aim&&!b.action&&b.wall>=.8?weaponAnchors(p.weapon).zoom:1;
    const baseFov=this.settings.fov-(b.aim&&zoom===1?17:0);
    const fov=car&&this.vehicleView==='cockpit'?driverFov(this.camera.aspect):2*Math.atan(Math.tan(baseFov*Math.PI/360)/zoom)*180/Math.PI;
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
      const shock=Math.max(0,(car.crashUntil||0)-state.elapsed);
      actor.group.rotation.z+=Math.sin(shock*40)*shock*.18;
    }
  }
  protected override beforeDraw(_state: State | null, _id: string, dt: number) {
    const sim=this.simulation;
    if(sim){
      if(this.effectState!==sim.state){this.combatEffects.reset();this.impactMarks.reset();this.clearWrecks();this.effectState=sim.state;this.cutCount=0;}
      this.combatEffects.consume(sim.state.effects,groundHeight);this.showWrecks(sim);
      this.impactMarks.update(sim.state.effects,sim.state.elapsed,id=>this.vehicleVisual(id),this.vehicleView==='cockpit'?sim.player.carId||undefined:undefined);
      if(this.cutCount!==sim.world.fractures.length){
        this.cutCount=sim.world.fractures.length;
        this.combatEffects.fracture(this.scene,sim.world.fractures,[this.humans.group,this.bodyRig.weapon,this.airMobility.group,this.collectionFleet.group]);
      }
      const fires=[...sim.combat.fires.values()].map(f=>({x:f.car.x,z:f.car.z,y:groundHeight(f.car.x,f.car.z)+.8}));
      this.combatEffects.update(dt,this.camera,fires,sim.combat.missiles,this.quality==='battery');
      this.missileMeshes.update(sim.combat.missiles);
      this.pockets.update(sim);
    }
    const refreshLoot = performance.now();
    if (this.simulation && refreshLoot - this.lootAt >= 100) {
      this.lootAt = refreshLoot;
      this.bodyRig.syncLoot(this.simulation.loot.filter(l=>!l.collected).sort((a,b)=>Math.hypot(a.x-this.simulation!.player.x,a.z-this.simulation!.player.z)-Math.hypot(b.x-this.simulation!.player.x,b.z-this.simulation!.player.z)).filter(l=>Math.hypot(l.x-this.simulation!.player.x,l.z-this.simulation!.player.z)<90).slice(0,24), this.simulation.claimed);
    }
    const stamp = performance.now();
    if (dt > 0) {
      this.samples.push(stamp - this.streetSampleStamp);
      if (this.samples.length > 240) this.samples.shift();
    }
    this.streetSampleStamp = stamp;
    const info = this.renderer.info;
    if (++this.metricFrames % 30 === 0 && this.samples.length) {
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
    beginCityFrame(this.targetFps);
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
    this.clearWrecks();this.impactMarks.dispose();this.combatEffects.dispose();this.missileMeshes.dispose();this.pockets.dispose();
    this.humans.dispose();
    super.destroy();
  }
}
