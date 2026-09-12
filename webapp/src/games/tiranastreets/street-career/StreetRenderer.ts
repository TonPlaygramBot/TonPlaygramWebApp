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
/** Local career only. Reuses the original driving renderer and the newer shared
 * city details without editing map coordinates, physics or paid-match actors. */
export class StreetRenderer extends CityRenderer {
  readonly humans = new SharedHumans();
  readonly bodyRig: FirstPersonBody;
  simulation?: StreetSimulation;
  settings: StreetSettings = { ...DEFAULT_SETTINGS };
  private streetSampleStamp = performance.now();
  private samples: number[] = [];
  metrics = { p95: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
  readonly details: ReturnType<typeof attachEnhancements>;
  constructor(root: HTMLDivElement) {
    super(root);
    this.preserveVehicleInterior = true;
    this.bodyRig = new FirstPersonBody(this.scene);
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
    this.bodyRig.update(actor, p, sim.body, state.elapsed, dt, car);
    return true;
  }
  protected override presentFirstPerson(state: State, id: string, dt: number) {
    const sim = this.simulation;
    if (!sim) return false;
    const p = state.players[id],
      b = sim.body,
      car = state.cars.find((c) => c.id === p.carId);
    if (car) {
      const eye = driverEye(car);
      this.camera.position.set(eye.x, eye.y, eye.z);
    } else {
      const bob = b.grounded
        ? Math.sin(b.gait * 2) * 0.012 * this.settings.headBob
        : 0;
      this.camera.position.set(p.x, b.y + b.eye + bob, p.z);
    }
    const d = direction3(this.yaw, this.pitch);
    this.camera.lookAt(
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
      actor.group.position.set(car.x, 0.03, car.z);
      actor.group.rotation.set(0, car.heading + Math.PI, 0);
    }
  }
  protected override beforeDraw(_state: State | null, _id: string, dt: number) {
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
        ? { ...state, npcs: visible.filter((n) => !this.humans.has(n.id)) }
        : null,
      id,
      dt,
      lobby
    );
  }
  override destroy() {
    if (this.disposed) return;
    this.bodyRig.dispose();
    this.humans.dispose();
    this.details.dispose();
    super.destroy();
  }
}
