import { exitPoint } from './vehicleCore.mjs';
import { reportCrime } from '../shared/cityLife.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';
import { direction3, pointAlong } from './spatialCore.mjs';

/** Fixed-step gameplay. Rendering consumes events; it never decides damage. */
export class CombatSimulation {
  constructor(sim) {
    this.sim = sim;
    this.missiles = [];
    this.fires = new Map();
    this.serial = 0;
  }
  emit(kind, point, extra = {}) {
    const s = this.sim.state;
    s.effects.push({ id: ++s.effectSeq, at: s.elapsed, kind, x: point.x, y: point.y, z: point.z,
      toX: point.x, toY: point.y, toZ: point.z, owner: 'local', weapon: '', ...extra });
  }
  launch(aircraft, yaw, pitch) {
    const now = this.sim.state.elapsed;
    if (now < aircraft.nextMissile || !aircraft.missiles || this.missiles.length >= 8) return false;
    const d = direction3(yaw, pitch);
    const clearance = this.sim.world.cast(aircraft, d, 5, this.sim.cars());
    const from = pointAlong(aircraft, d, Math.min(5, clearance.kind === 'air' ? 5 : Math.max(0, clearance.distance - .2)));
    reportCrime(this.sim.state, this.sim.player, 65);
    aircraft.nextMissile = now + .8;
    aircraft.missiles--;
    this.missiles.push({ id: ++this.serial, ...from, direction: d, age: 0, owner: aircraft.pilot });
    this.emit('launch', from, { weapon: aircraft.kind + 'Missile' });
    return true;
  }
  damageVehicle(car, amount, owner = this.sim.player) {
    if (car.destroyed) return;
    if (owner === this.sim.player && car.driver !== owner.id) reportCrime(this.sim.state, owner, car.forceVehicle ? 70 : 25);
    car.health = Math.max(0, (car.health ?? 140) - amount);
    if (car.health <= 55 && !this.fires.has(car.id)) {
      car.burning = true;
      this.fires.set(car.id, { car, owner, until: this.sim.state.elapsed + 25, tick: 0 });
      this.emit('ignite', { ...car, y: groundHeight(car.x, car.z) + .8 });
    }
    if (car.health > 0) return;
    car.destroyed = true;
    car.speed = car.vx = car.vz = 0;
    const driver = this.sim.state.players[car.driver];
    if (driver) {
      this.sim.damage(driver, 100, owner);driver.carId=null;
      const exit=exitPoint(this.sim.state,car,this.sim.world);
      if(exit){driver.x=exit.x;driver.z=exit.z;}
      if(driver===this.sim.player)Object.assign(this.sim.body,{interaction:driver.health>0?'free':'dead',action:null,y:groundHeight(driver.x,driver.z)+.08,vx:0,vy:0,vz:0});
    }
    car.driver = null;
    this.emit('vehicle-explosion', { ...car, y: groundHeight(car.x, car.z) + .8 }, { radius: 7 });
    // A single transition produces one blast. Wrecks cannot explode repeatedly.
    this.blast({ x: car.x, y: groundHeight(car.x, car.z) + .8, z: car.z }, 7, 70, owner, car.id);
  }
  impact(hit, amount = 32, explosive = false) {
    const car = this.sim.cars().find(c => c.id === hit.objectId);
    if (car) this.damageVehicle(car, amount);
    if (!explosive) return;
    this.emit('blast', hit.point, { radius: 11 });
    if (hit.kind === 'wall') {
      const section = this.sim.world.fracture(hit.objectId, hit.point, 3.2);
      if (section) this.emit('fracture', section, { radius: section.radius, objectId: hit.objectId });
    }
    this.blast(hit.point, 11, 100, this.sim.player, car?.id);
  }
  blast(point, radius, amount, owner, ignoreCar) {
    const sim = this.sim;
    for (const n of [...sim.state.npcs, ...Object.values(sim.state.players)]) {
      const target = { x: n.x, y: (n === sim.player ? sim.body.y : n.y ?? groundHeight(n.x,n.z)) + .9, z: n.z };
      const distance = Math.hypot(target.x-point.x,target.y-point.y,target.z-point.z);
      if (n.health > 0 && distance < radius && sim.world.clear(point, target))
        sim.damage(n, amount * (1 - distance / (radius * 1.2)), owner);
    }
    for (const car of sim.cars()) {
      if (car.id === ignoreCar || car.destroyed) continue;
      const target = { x: car.x, y: groundHeight(car.x,car.z)+.9, z: car.z };
      const d = Math.hypot(car.x-point.x,target.y-point.y,car.z-point.z);
      if (d < radius && sim.world.clear(point,target)) this.damageVehicle(car, amount*(1-d/(radius*1.2)), owner);
    }
  }
  step(dt) {
    for (let i = this.missiles.length-1; i >= 0; i--) {
      const m = this.missiles[i];
      const travel = 95 * dt;
      const hit = this.sim.world.cast(m, m.direction, travel, this.sim.cars());
      m.age += dt;
      if (hit.kind !== 'air') {
        // Move the blast slightly away from the surface so cover rays start outside it.
        hit.point = pointAlong(hit.point, m.direction, -.12);
        this.impact(hit, 160, true);
        this.missiles.splice(i, 1);
      } else if (m.age > 8) this.missiles.splice(i, 1);
      else Object.assign(m, pointAlong(m, m.direction, travel));
    }
    for (const [id, fire] of this.fires) {
      if (this.sim.state.elapsed > fire.until) { fire.car.burning = false; this.fires.delete(id); continue; }
      fire.tick += dt;
      if (fire.tick >= .5) {
        fire.tick -= .5;
        this.damageVehicle(fire.car, 5, fire.owner);
        const p = this.sim.player;
        if (p.health > 0 && !p.aircraftId && Math.hypot(p.x-fire.car.x,p.z-fire.car.z)<3.2)
          this.sim.damage(p, 3, fire.owner);
      }
    }
  }
}
