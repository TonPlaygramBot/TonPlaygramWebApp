import { collectWeapon } from '../shared/cityPopulation.mjs';
import { weaponPose } from './weaponPose.mjs';
import {
  advanceState,
  control,
  emptyInput,
  movePlayer,
  MISSIONS,
  FREE_ROAM,
  interact
} from '../shared/engine.mjs';
import { WEAPON_BY_ID } from '../shared/weapons.mjs';
import { harm, reportCrime } from '../shared/cityLife.mjs';
import { StreetWorld, direction3, pointAlong, rayBox } from './spatialCore.mjs';
import { createBody, stepMotor, cancelActions, MOTOR } from './playerCore.mjs';
import {
  carPoint,
  exitPoint,
  takeVehicle,
  vehicleAnchors
} from './vehicleCore.mjs';
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const defaults = {
  x: 0,
  y: 0,
  yaw: 0,
  pitch: 0,
  fast: false,
  brake: false,
  fire: false,
  seq: 1
};
export const TUTORIAL = [
  ['move', 'Move with the left stick'],
  ['look-down', 'Drag down to see your body'],
  ['sprint', 'Toggle SPRINT, then move'],
  ['jump', 'Tap JUMP while moving'],
  ['crouch', 'Tap CROUCH, then stand'],
  ['punch', 'Try a PUNCH'],
  ['kick', 'Try a KICK'],
  ['equip', 'Draw your weapon'],
  ['aim', 'Toggle AIM'],
  ['fire', 'Hold FIRE · drag it to look'],
  ['reload', 'Tap RELOAD'],
  ['enter', 'Look at a nearby car and enter'],
  ['drive', 'Use the pedals and left stick'],
  ['exit', 'Brake to a stop, then exit']
];
/** Owns player intent, action timelines and adapters into the existing city loop.
 * All timers are simulation seconds; presentation never commits gameplay. */
export class StreetSimulation {
  constructor(state, world = new StreetWorld()) {
    this.state = state;
    this.world = world;
    this.body = createBody(state.players.local.heading);
    this.intent = { ...defaults, yaw: this.body.yaw };
    this.events = [];
    this.eventSeq = 0;
    this.state.pickups ??= [];
    this.claimed = new Set();
    this.approved = -1;
    this.paused = false;
    this.settings = { aimAssist: false };
    this.mission = MISSIONS.find((m) => m.id === state.missionId) || FREE_ROAM;
    this.job = {
      parcel: false,
      vehicleId: null,
      defend: 0,
      stage: 0,
      tutorial: []
    };
    this.hooks = {
      movePlayer: (s, p, dt) => this.move(s, p, dt),
      afterLife: (s, dt) => this.afterLife(s, dt),
      canAdvanceObjective: (s, p, m) => this.canAdvance(p, m),
      life: {
        clear: (a, c) =>
          this.world.clear(
            {
              x: a.x,
              y:
                a.id === 'local'
                  ? this.body.y + this.body.eye
                  : (a.y || 0) + 1.55,
              z: a.z
            },
            {
              x: c.x,
              y:
                c.id === 'local'
                  ? this.body.y + this.body.eye
                  : (c.y || 0) + 1.55,
              z: c.z
            }
          ),
        firePlayer: () => this.fire(),
        damageAmount: (target, amount, attacker) =>
          this.guardDamage(target, amount, attacker),
        onDamage: (target, attacker) => this.damaged(target, attacker),
        recovering: (n) => state.elapsed < (n.hitUntil || 0),
        track: (n, p) => this.track(n, p)
      }
    };
  }
  get loot() { return this.state.pickups || []; }
  get player() {
    return this.state.players.local;
  }
  cars() {
    return [...this.state.cars, ...this.state.traffic, ...this.state.units];
  }
  event(kind, data = {}) {
    this.events.push({
      id: ++this.eventSeq,
      at: this.state.elapsed,
      kind,
      ...data
    });
    if (this.events.length > 64) this.events.shift();
    if (
      TUTORIAL.some((t) => t[0] === kind) &&
      !this.body.tutorial.includes(kind)
    ) {
      this.body.tutorial.push(kind);
      this.job.tutorial = [...this.body.tutorial];
    }
  }
  setIntent(raw) {
    this.intent = {
      ...defaults,
      ...raw,
      x: clamp(Number(raw.x) || 0, -1, 1),
      y: clamp(Number(raw.y) || 0, -1, 1),
      yaw: Number.isFinite(raw.yaw) ? raw.yaw : 0,
      pitch: clamp(Number(raw.pitch) || 0, -1.48, 1.3)
    };
    this.body.yaw = this.intent.yaw;
    this.body.pitch = this.intent.pitch;
    if (this.body.pitch < -0.95) this.eventOnce('look-down');
  }
  eventOnce(kind) {
    if (!this.body.tutorial.includes(kind)) this.event(kind);
  }
  pause() {
    this.paused = true;
    cancelActions(this.player, this.body);
    this.intent = { ...defaults, yaw: this.body.yaw, pitch: this.body.pitch };
    control(this.state, 'local', {
      ...emptyInput(),
      seq: this.player.input.seq + 1
    });
  }
  resume() {
    this.paused = false;
    this.intent = { ...defaults, yaw: this.body.yaw, pitch: this.body.pitch };
  }
  eye() {
    return {
      x: this.player.x,
      y: this.body.y + this.body.eye,
      z: this.player.z
    };
  }
  step(dt) {
    if (this.paused) return;
    control(this.state, 'local', {
      ...this.intent,
      seq: this.player.input.seq + 1
    });
    advanceState(this.state, dt, this.hooks);
  }
  move(s, p, dt) {
    const b = this.body;
    if (p.id !== 'local') {
      movePlayer(s, p, dt);
      return;
    }
    if (p.health <= 0 || p.failed || p.finished) {
      if (b.interaction !== 'dead') {
        cancelActions(p, b);
        b.interaction = 'dead';
        this.event('dead');
      }
      return;
    }
    if (b.interaction === 'dead') {
      cancelActions(p, b);
      b.interaction = 'free';
      b.y = 0.08;
      b.vy = 0;
      b.grounded = true;
      this.event('respawn');
    }
    if (p.carId) {
      b.interaction = b.action?.kind === 'exiting' ? 'exiting' : 'driving';
      movePlayer(s, p, dt);
      if (Math.abs(p.speed) > 2) this.eventOnce('drive');
      b.y = 0.08;
      return;
    }
    stepMotor(
      s,
      p,
      b,
      this.intent,
      dt,
      this.world,
      (k) => this.eventOnce(k),
      (amount) => this.damage(p, amount, p)
    );
    if (this.intent.fire && !p.weapon) this.startMelee('punch');
  }
  afterLife(s, dt) {
    const p = this.player,
      b = this.body;
    if (p.health <= 0 || p.failed) return;
    if (b.action) {
      const a = b.action,
        t = s.elapsed - a.start;
      if (a.kind === 'punch' || a.kind === 'kick') {
        if (t >= a.active && !a.committed) {
          a.committed = true;
          this.melee(a);
        }
      }
      if (a.kind === 'vault' && t < a.duration && a.from) {
        const f = Math.min(1, t / a.duration),
          travel = clamp((f - 0.2) / 0.6, 0, 1),
          lift = Math.min(1, f / 0.2, (1 - f) / 0.2),
          next = {
            x: a.from.x + (a.landing.x - a.from.x) * travel,
            z: a.from.z + (a.landing.z - a.from.z) * travel,
            y: a.from.y + (a.landing.y - a.from.y) * travel + lift * 1.1
          };
        if (this.world.clearance(next, b.height)) {
          p.x = next.x;
          p.z = next.z;
          b.y = next.y;
        } else {
          b.action = null;
          b.interaction = 'free';
          b.grounded = false;
        }
      }
      if (a.kind === 'entering' && t < a.duration) {
        const c = this.cars().find((c) => c.id === a.targetId);
        if (c) {
          const door = carPoint(c, vehicleAnchors(c).doors[a.side || 0]);
          const q = { x: p.x, y: b.y, z: p.z };
          this.world.move(
            q,
            (door.x - p.x) * Math.min(1, dt * 8),
            (door.z - p.z) * Math.min(1, dt * 8),
            b.height,
            0
          );
          p.x = q.x;
          p.z = q.z;
        }
      }
      if (t >= a.duration) {
        b.action = null;
        if (a.kind === 'reload') this.event('reload-complete');
        if (a.kind === 'entering') this.finishEnter(a);
        else if (a.kind === 'exiting') this.finishExit(a);
        else if (a.kind === 'interacting') this.finishInteract(a);
        else if (a.kind === 'vault') {
          const q = a.landing;
          if (this.world.clearance(q, b.height)) {
            p.x = q.x;
            p.z = q.z;
            b.y = q.y;
            b.vy = 0;
            b.grounded = true;
          }
          b.interaction = 'free';
        }
        b.combat = p.weapon ? (b.aim ? 'aim' : 'ready') : 'unarmed';
      }
    }
    if (b.combat === 'reload' && !p.reloadAt) {
      b.action = null;
      b.combat = b.aim ? 'aim' : 'ready';
      this.event('reload-complete');
    }
    if (b.combat === 'fire' && s.elapsed >= p.nextShot)
      b.combat = b.aim ? 'aim' : 'ready';
    if (b.guard) {
      b.stamina = Math.max(0, b.stamina - dt * 4);
      if (b.stamina < 1) b.guard = false;
    }
    b.wall = this.world.cast(
      this.eye(),
      direction3(b.yaw, b.pitch),
      1.1,
      this.cars(),
      p.carId || ''
    ).distance;
    if (
      this.mission.id === 'boulevard-defense' &&
      dist(p, this.mission.stops[0]) < 22 &&
      p.health > 0
    )
      this.job.defend = Math.min(12, this.job.defend + dt);
    if (this.job.stage !== p.index) {
      this.job.stage = p.index;
      this.approved = -1;
      this.event('checkpoint', { stage: p.index });
    }
    this.body.lastHealth = p.health;
  }
  damage(target, amount, attacker) {
    harm(this.state, target, amount, attacker, { ...this.hooks.life });
  }
  guardDamage(target, amount, attacker) {
    if (target !== this.player || !this.body.guard || !attacker) return amount;
    const d = direction3(this.body.yaw, 0),
      l = dist(target, attacker);
    if (
      l < 0.01 ||
      ((attacker.x - target.x) * d.x + (attacker.z - target.z) * d.z) / l <
        0.4 ||
      this.body.stamina < 12
    )
      return amount;
    this.body.stamina -= 12;
    this.event('block');
    return amount * 0.25;
  }
  damaged(target, attacker) {
    if (target === this.player) {
      if (this.body.action || target.health <= 0) {
        cancelActions(target, this.body);
        this.body.interaction = target.carId
          ? 'driving'
          : target.health <= 0
            ? 'dead'
            : 'free';
      }
      this.event('hurt');
    } else {
      target.hitUntil = this.state.elapsed + 0.38;
      target.anim = 'hit';
      if (attacker) {
        const l = dist(target, attacker) || 1,
          q = { x: target.x, y: 0.08, z: target.z };
        this.world.move(
          q,
          ((target.x - attacker.x) / l) * 0.32,
          ((target.z - attacker.z) / l) * 0.32,
          1.75,
          0
        );
        target.x = q.x;
        target.z = q.z;
      }
    }
  }

  track(n, p) {
    const now = this.state.elapsed,
      key = n.id,
      old = this.body.seen[key],
      distance = dist(n, p);
    const clear =
      distance < 65 &&
      this.world.clear(
        { x: n.x, y: 1.55, z: n.z },
        this.eye(),
        this.cars(),
        n.id
      );
    if (clear) {
      if (!old || !old.visible) {
        this.body.seen[key] = {
          x: p.x,
          z: p.z,
          at: now,
          ready: now + 0.45,
          visible: true
        };
        return null;
      }
      Object.assign(old, { x: p.x, z: p.z, at: now });
      return now >= old.ready ? p : null;
    }
    if (old) {
      old.visible = false;
      if (now - old.at < 12) return { ...p, x: old.x, z: old.z };
    }
    // Hearing stores the incident position, never the player's future location.
    if (distance < 35 && now - p.lastCrime < 0.15) {
      this.body.seen[key] = {
        x: p.x,
        z: p.z,
        at: now,
        ready: now + 0.6,
        visible: false
      };
      return null;
    }
    return null;
  }
  candidates() {
    const p = this.player,
      b = this.body,
      eye = this.eye(),
      forward = direction3(b.yaw, b.pitch),
      out = [];
    const add = (id, label, target, range, priority, kind, extra = {}) => {
      const point = { x: target.x, y: target.y ?? 1, z: target.z },
        l = Math.hypot(point.x - eye.x, point.y - eye.y, point.z - eye.z),
        dot =
          ((point.x - eye.x) * forward.x +
            (point.y - eye.y) * forward.y +
            (point.z - eye.z) * forward.z) /
          (l || 1);
      if (
        l > range ||
        dot < 0.05 ||
        !this.world.clear(
          eye,
          point,
          this.cars(),
          kind === 'vehicle' ? target.id : ''
        )
      )
        return;
      out.push({
        id: 'interact',
        label,
        visible: true,
        enabled: true,
        disabledReason: '',
        targetId: id,
        priority,
        mode: 'tap',
        kind,
        score: priority + dot * 5 - l,
        ...extra
      });
    };
    if (p.carId) {
      const car = this.state.cars.find((c) => c.id === p.carId);
      const reason = !car
        ? 'Vehicle unavailable'
        : Math.abs(car.speed) > 2.5
          ? 'Brake before exiting'
          : !exitPoint(this.state, car, this.world)
            ? 'Both exits are blocked'
            : '';
      return [
        {
          id: 'interact',
          label: 'DIL',
          visible: true,
          enabled: !reason,
          disabledReason: reason,
          targetId: p.carId,
          priority: 100,
          mode: 'tap',
          kind: 'exit',
          score: 100
        }
      ];
    }
    const target = this.mission.stops[p.index];
    if (
      target &&
      this.mission.type !== 'race' &&
      this.mission.type !== 'pursuit'
    )
      add(
        'objective:' + p.index,
        this.mission.type === 'delivery'
          ? p.index === 0
            ? 'MERR PAKON'
            : 'DORËZO'
          : 'NXJERRJE',
        { ...target, y: 0.8 },
        7,
        90,
        'objective'
      );
    for (const l of this.loot)
      if (!l.collected && !this.claimed.has(l.id)) {
        const w = WEAPON_BY_ID.get(l.weapon),
          inv = p.inventory[l.weapon];
        add(l.id, 'MERR ARMËN', l, 3.2, 80, 'loot', {
          enabled: !!w && (!inv || inv.reserve < w.magazine * 8),
          disabledReason:
            inv && w && inv.reserve >= w.magazine * 8
              ? 'Ammo capacity reached'
              : ''
        });
      }
    for (const car of [...this.state.cars, ...this.state.traffic]) {
      if (car.driver && car.driver !== 'npc') continue;
      if (dist(p, car) > (car.model==='tirana-bus'?13:5.5)) continue;
      const doors = vehicleAnchors(car).doors.map((d) => carPoint(car, d));
      const side = dist(p, doors[0]) < dist(p, doors[1]) ? 0 : 1;
      const occupied =
        this.state.traffic.includes(car) ||
        car.npcDriver ||
        car.driver === 'npc';
      const reason = b.crouched
        ? 'Stand before entering'
        : !b.grounded
          ? 'Land before entering'
          : Math.abs(car.speed) > 2.5
            ? 'Wait for the car to stop'
            : !this.world.clearance({ ...doors[side], y: 0.08 }, MOTOR.standing)
              ? 'Door is blocked'
              : '';
      add(
        car.id,
        occupied ? 'MERR MAKINËN' : 'HYR',
        { ...doors[side], y: 0.9, id: car.id },
        3.5,
        60,
        'vehicle',
        { enabled: !reason, disabledReason: reason, side, occupied }
      );
    }
    for(const shop of this.state.shops || [this.state.shop])add(shop.id || 'arsenal', 'ARSENAL', shop, 5, 50, 'arsenal');
    return out;
  }
  focus() {
    const candidates = this.candidates().sort((a, b) => b.score - a.score),
      old = candidates.find((c) => c.targetId === this.body.focus),
      best = candidates[0];
    const next = old && best && old.score + 3 >= best.score ? old : best;
    this.body.focus = next?.targetId || null;
    return next;
  }
  resolve() {
    const p = this.player,
      b = this.body,
      driving = !!p.carId,
      dead = p.health <= 0 || p.failed || p.finished,
      busy =
        !!b.action ||
        b.interaction === 'entering' ||
        b.interaction === 'exiting';
    const reason = dead
      ? 'Run ended'
      : this.paused
        ? 'Paused'
        : busy
          ? b.combat === 'reload'
            ? 'Reloading…'
            : 'Finish the current action'
          : '';
    const a = (
      id,
      label,
      visible = true,
      blocked = '',
      mode = 'tap',
      priority = 10
    ) => ({
      id,
      label,
      visible,
      enabled: !reason && !blocked,
      disabledReason: reason || blocked,
      targetId: null,
      priority,
      mode
    });
    const list = [];
    if (!driving) {
      list.push(
        a(
          'jump',
          'JUMP',
          true,
          b.crouched
            ? 'Stand before jumping'
            : !b.grounded &&
                this.state.elapsed - b.groundAt > MOTOR.coyote &&
                b.y - this.world.surface(p.x, p.z, b.y) > 0.32
              ? 'In the air'
              : ''
        ),
        a('crouch', b.crouched ? 'STAND' : 'CROUCH', true, '', 'toggle'),
        a(
          'sprint',
          'SPRINT',
          true,
          b.crouched
            ? 'Stand to sprint'
            : b.stamina < 5
              ? 'Recover stamina'
              : '',
          'toggle'
        )
      );
      if (p.weapon) {
        const w = WEAPON_BY_ID.get(p.weapon),
          inv = p.inventory[p.weapon];
        list.push(
          a('fire', 'FIRE', true, !inv?.ammo ? 'Reload first' : '', 'hold'),
          a('aim', 'AIM', true, '', 'toggle'),
          a(
            'reload',
            'RELOAD',
            !!w && !!inv && (inv.ammo < w.magazine || !!p.reloadAt),
            !inv?.reserve ? 'No spare ammo' : ''
          )
        );
      } else
        list.push(
          a('punch', 'PUNCH', true, '', 'hold'),
          a(
            'kick',
            'KICK',
            true,
            b.stamina < MOTOR.kickCost ? 'Recover stamina' : ''
          ),
          a(
            'guard',
            'GUARD',
            true,
            b.stamina < 12 ? 'Recover stamina' : '',
            'toggle'
          )
        );
      list.push(
        a('holster', p.weapon ? 'HOLSTER' : 'DRAW', true, '', 'toggle')
      );
      const vault = this.world.vault({ ...p, y: b.y }, b.yaw, b.height);
      if (vault)
        list.push(a('vault', 'VAULT', true, !b.grounded ? 'Land first' : ''));
    }
    const focus = this.focus();
    if (focus)
      list.push({
        ...focus,
        enabled: focus.enabled && !reason,
        disabledReason: reason || focus.disabledReason
      });
    return list;
  }
  execute(id, targetId) {
    const descriptor = this.resolve().find((a) => a.id === id && a.visible);
    if (
      !descriptor ||
      !descriptor.enabled ||
      (targetId && descriptor.targetId !== targetId)
    ) {
      this.body.notice =
        descriptor?.disabledReason || 'Target is no longer available';
      return false;
    }
    const p = this.player,
      b = this.body,
      now = this.state.elapsed;
    b.notice = '';
    if (id === 'jump') {
      b.jumpUntil = now + MOTOR.buffer;
      return true;
    }
    if (id === 'crouch') {
      b.crouchWanted = !b.crouchWanted;
      return true;
    }
    if (id === 'sprint') {
      b.sprint = !b.sprint;
      return true;
    }
    if (id === 'aim') {
      b.aim = !b.aim;
      b.combat = b.aim ? 'aim' : 'ready';
      if (b.aim) this.eventOnce('aim');
      return true;
    }
    if (id === 'guard') {
      b.guard = !b.guard;
      return true;
    }
    if (id === 'punch' || id === 'kick') return this.startMelee(id);
    if (id === 'fire') {
      this.fire();
      return true;
    }
    if (id === 'holster') {
      cancelActions(p, b);
      interact(this.state, 'local', 'holster');
      b.combat = p.weapon ? 'ready' : 'unarmed';
      b.action = { kind: 'equip', start: now, duration: 0.28 };
      if (p.weapon) this.eventOnce('equip');
      return true;
    }
    if (id === 'reload') {
      interact(this.state, 'local', 'reload');
      if (p.reloadAt) {
        b.combat = 'reload';
        b.action = {
          kind: 'reload',
          start: now,
          duration: p.reloadAt - now,
          weapon: p.weapon
        };
        this.eventOnce('reload');
        return true;
      }
      return false;
    }
    if (id === 'vault') {
      const landing = this.world.vault({ ...p, y: b.y }, b.yaw, b.height);
      if (!landing) return false;
      b.interaction = 'interacting';
      b.action = {
        kind: 'vault',
        start: now,
        duration: 0.5,
        landing,
        from: { x: p.x, y: b.y, z: p.z }
      };
      this.event('vault');
      return true;
    }
    if (id !== 'interact') return false;
    if (descriptor.kind === 'arsenal') {
      this.event('arsenal');
      return true;
    }
    if (descriptor.kind === 'vehicle') {
      cancelActions(p, b);
      b.interaction = 'entering';
      b.action = {
        kind: 'entering',
        start: now,
        duration: 1.1,
        targetId: descriptor.targetId,
        side: descriptor.side,
        occupied: descriptor.occupied
      };
      this.event('door');
      return true;
    }
    if (descriptor.kind === 'exit') {
      cancelActions(p, b);
      b.interaction = 'exiting';
      b.action = {
        kind: 'exiting',
        start: now,
        duration: 0.7,
        targetId: p.carId
      };
      this.event('door');
      return true;
    }
    b.interaction = 'interacting';
    b.action = {
      kind: 'interacting',
      start: now,
      duration: 0.45,
      targetId: descriptor.targetId
    };
    return true;
  }
  startMelee(kind) {
    const p = this.player,
      b = this.body;
    if (
      this.paused ||
      p.weapon ||
      p.health <= 0 ||
      b.interaction !== 'free' ||
      b.action ||
      (kind === 'kick' && b.stamina < MOTOR.kickCost)
    )
      return false;
    b.guard = false;
    b.combat = 'melee';
    b.combo = (b.combo + 1) % 2;
    b.action = {
      kind,
      start: this.state.elapsed,
      duration: kind === 'kick' ? 0.68 : 0.42,
      active: kind === 'kick' ? 0.27 : 0.16,
      committed: false,
      hand: b.combo
    };
    if (kind === 'kick') b.stamina -= MOTOR.kickCost;
    this.event(kind);
    return true;
  }
  melee(a) {
    const p = this.player,
      b = this.body,
      d = direction3(b.yaw, b.pitch * 0.35),
      range = a.kind === 'kick' ? 2.05 : 1.5,
      origin = { x: p.x, y: b.y + (a.kind === 'kick' ? 0.85 : 1.3), z: p.z };
    let target = null,
      best = range;
    for (const n of this.state.npcs) {
      if (n.health <= 0 || n.kind === 'dealer' || n.motion === 'drive')
        continue;
      const v = { x: n.x - p.x, z: n.z - p.z },
        l = Math.hypot(v.x, v.z);
      if (
        l >= best ||
        l < 0.01 ||
        (v.x * d.x + v.z * d.z) / l < 0.65 ||
        !this.world.clear(origin, { x: n.x, y: 0.9, z: n.z }, this.cars())
      )
        continue;
      best = l;
      target = n;
    }
    if (target) {
      this.damage(target, a.kind === 'kick' ? 30 : 16, p);
      reportCrime(this.state, p, target.kind === 'gang' ? 4 : 55);
      this.event('melee-hit');
    }
  }
  fire() {
    const p = this.player,
      b = this.body,
      w = WEAPON_BY_ID.get(p.weapon),
      inv = p.inventory[p.weapon];
    if (
      this.paused ||
      !w ||
      !inv ||
      p.health <= 0 ||
      p.carId ||
      b.interaction !== 'free' ||
      b.action ||
      p.reloadAt ||
      this.state.elapsed < p.nextShot ||
      !inv.ammo
    )
      return;
    inv.ammo--;
    p.nextShot = this.state.elapsed + w.interval;
    b.combat = 'fire';
    b.recoil = 0.035;
    this.eventOnce('fire');
    this.event('shot', { weapon: w.id });
    const eye = this.eye();
    let d = direction3(b.yaw, b.pitch),
      max = Math.min(250, w.range),
      cars = this.cars();
    if (this.settings.aimAssist) {
      let score = 0.018,
        assist = null;
      for (const n of this.state.npcs) {
        if (n.health <= 0 || n.kind === 'dealer' || n.motion === 'drive')
          continue;
        const to = { x: n.x, y: (n.y || 0.08) + 1.2, z: n.z },
          dx = to.x - eye.x,
          dy = to.y - eye.y,
          dz = to.z - eye.z,
          l = Math.hypot(dx, dy, dz),
          angle = Math.acos(
            clamp((dx * d.x + dy * d.y + dz * d.z) / (l || 1), -1, 1)
          );
        if (l < max && angle < score && this.world.clear(eye, to, cars)) {
          score = angle;
          assist = { x: dx / l, y: dy / l, z: dz / l };
        }
      }
      if (assist) {
        d = {
          x: d.x * 0.85 + assist.x * 0.15,
          y: d.y * 0.85 + assist.y * 0.15,
          z: d.z * 0.85 + assist.z * 0.15
        };
        const l = Math.hypot(d.x, d.y, d.z);
        d = { x: d.x / l, y: d.y / l, z: d.z / l };
      }
    }
    const worldHit = this.world.cast(eye, d, max, cars);
    let target = null,
      hit = worldHit;
    for (const n of this.state.npcs) {
      if (n.health <= 0 || n.kind === 'dealer' || n.motion === 'drive')
        continue;
      const y = n.y || 0.08,
        t = rayBox(
          eye,
          d,
          {
            min: { x: n.x - 0.3, y, z: n.z - 0.3 },
            max: { x: n.x + 0.3, y: y + 1.76, z: n.z + 0.3 }
          },
          hit.distance
        );
      if (t !== null && t < hit.distance) {
        target = n;
        hit = { distance: t, point: pointAlong(eye, d, t), kind: 'actor' };
      }
    }
    // Camera defines intent; the offset muzzle must ALSO have a clear trajectory.
    const muzzle = weaponPose(p, b).muzzle;
    const muzzleTravel = this.world.cast(
      eye,
      { x: muzzle.x - eye.x, y: muzzle.y - eye.y, z: muzzle.z - eye.z },
      1,
      cars
    );
    if (muzzleTravel.distance < 1) {
      hit = { point: muzzleTravel.point, kind: muzzleTravel.kind };
      target = null;
    } else if (!this.world.clear(muzzle, hit.point, cars)) {
      const v = {
          x: hit.point.x - muzzle.x,
          y: hit.point.y - muzzle.y,
          z: hit.point.z - muzzle.z
        },
        l = Math.hypot(v.x, v.y, v.z);
      hit = this.world.cast(
        muzzle,
        { x: v.x / l, y: v.y / l, z: v.z / l },
        l,
        cars
      );
      target = null;
    }
    const state = this.state;
    state.effects.push({
      id: ++state.effectSeq,
      at: state.elapsed,
      kind: w.radius ? 'explosion' : 'shot',
      x: muzzle.x,
      y: muzzle.y,
      z: muzzle.z,
      toX: hit.point.x,
      toY: hit.point.y,
      toZ: hit.point.z,
      owner: p.id,
      weapon: w.id
    });
    if (w.radius) {
      for (const n of [...state.npcs, p]) {
        const center = { x: n.x, y: (n === p ? b.y : 0.08) + 0.85, z: n.z },
          l = Math.hypot(
            center.x - hit.point.x,
            center.y - hit.point.y,
            center.z - hit.point.z
          );
        if (l < w.radius && this.world.clear(hit.point, center, cars))
          this.damage(n, w.damage * (1 - l / (w.radius * 1.3)), p);
      }
    } else if (target) this.damage(target, w.damage, p);
    if (hit.kind !== 'air' && hit.kind !== 'actor')
      state.effects.push({
        id: ++state.effectSeq,
        at: state.elapsed,
        kind: 'hit',
        x: hit.point.x,
        y: hit.point.y,
        z: hit.point.z,
        toX: hit.point.x,
        toY: hit.point.y,
        toZ: hit.point.z,
        owner: p.id,
        weapon: w.id
      });
    reportCrime(
      state,
      p,
      target?.kind === 'gang'
        ? 4
        : target?.kind === 'civilian'
          ? 85
          : target
            ? 60
            : 12
    );
    for (const n of state.npcs)
      if (n.kind === 'civilian' && dist(p, n) < 55)
        n.panicUntil = state.elapsed + 10;
  }
  finishEnter(a) {
    const p = this.player,
      b = this.body,
      c = [...this.state.cars, ...this.state.traffic].find(
        (c) => c.id === a.targetId
      );
    b.interaction = 'free';
    if (
      !c ||
      dist(p, carPoint(c, vehicleAnchors(c).doors[a.side || 0])) > 2.4 ||
      !takeVehicle(this.state, p, c)
    ) {
      b.notice = 'Car is no longer available';
      return;
    }
    b.interaction = 'driving';
    b.yaw = c.heading;
    b.pitch = 0;
    this.intent.yaw = c.heading;
    this.intent.pitch = 0;
    b.crouched = b.crouchWanted = false;
    b.height = MOTOR.standing;
    b.eye = MOTOR.eye;
    this.job.vehicleId = c.id;
    if (a.occupied) reportCrime(this.state, p, 65);
    this.event('enter', { vehicleId: c.id });
  }
  finishExit(a) {
    const p = this.player,
      b = this.body,
      c = this.state.cars.find((c) => c.id === a.targetId),
      point =
        c && Math.abs(c.speed) <= 2.5 && exitPoint(this.state, c, this.world);
    b.interaction = 'driving';
    if (!c || !point) {
      b.notice = 'Brake and leave room beside the car';
      return;
    }
    c.driver = null;
    p.carId = null;
    p.x = point.x;
    p.z = point.z;
    p.speed = 0;
    b.y = point.y;
    b.vy = 0;
    b.grounded = true;
    b.interaction = 'free';
    this.event('exit');
  }
  finishInteract(a) {
    this.body.interaction = 'free';
    const live = this.candidates().find(
      (c) => c.targetId === a.targetId && c.enabled
    );
    if (!live) {
      this.body.notice = 'Move closer and try again';
      return;
    }
    if (live.kind === 'loot') {
      const l = this.loot.find((l) => l.id === a.targetId);
      if (!l || this.claimed.has(l.id)) return;
      if(!collectWeapon(this.state,this.player,l.id))return;
      this.claimed.add(l.id);
      this.event('loot', { targetId: l.id });
    } else if (live.kind === 'objective') {
      if (this.mission.type === 'delivery') {
        if (this.player.index > 0 && !this.job.parcel) {
          this.body.notice = 'Collect the parcel first';
          return;
        }
        this.job.parcel = true;
      }
      if (
        this.mission.type === 'combat' &&
        (this.state.objectiveRemaining > 0 ||
          (this.mission.id === 'boulevard-defense' && this.job.defend < 12))
      ) {
        this.body.notice = 'Secure the area first';
        return;
      }
      this.approved = this.player.index;
      this.event('objective', { stage: this.player.index });
    }
  }
  canAdvance(p, m) {
    if (m.type === 'delivery' || m.type === 'combat')
      return this.approved === p.index;
    if (m.type === 'race') return !!p.carId && p.carId === this.job.vehicleId;
    if (m.type === 'pursuit')
      return (
        !!p.carId &&
        p.carId === this.job.vehicleId &&
        (p.index < m.stops.length - 1 || p.wanted === 0)
      );
    return true;
  }
  objective() {
    const p = this.player;
    if (this.mission.id === 'first-shift') {
      const t = TUTORIAL.find(([id]) => !this.body.tutorial.includes(id));
      if (t)
        return {
          title: t[1],
          detail: 'First shift · learn as you go',
          training: true
        };
    }
    const stop = this.mission.stops[p.index];
    return {
      title: stop
        ? `${this.mission.type === 'delivery' ? (p.index ? 'Deliver at' : 'Collect at') : this.mission.type === 'combat' ? 'Secure' : 'Reach'} ${stop.name}`
        : 'Explore Tirana',
      detail:
        this.mission.type === 'delivery'
          ? 'Stop, look at the marker and tap INTERACT'
          : this.mission.type === 'pursuit'
            ? 'Lose the pursuit before the final checkpoint'
            : this.mission.type === 'race'
              ? 'Enter a car and follow the route'
              : this.mission.type === 'combat'
                ? `${this.state.objectiveRemaining ?? this.mission.enemies} opponents · secure extraction`
                : 'Walk, drive, meet Arben',
      training: false
    };
  }
}
