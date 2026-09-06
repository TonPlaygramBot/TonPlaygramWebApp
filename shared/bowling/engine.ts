import {
  World,
  Body,
  Sphere,
  Box,
  Vec3,
  Material,
  ContactMaterial,
  GSSolver
} from 'cannon-es';
import {
  newPlayer,
  frameIndex,
  availablePins,
  recordRoll,
  type ScorePlayer
} from './scoring.js';

export const LANE = Object.freeze({
  y: 0.08,
  halfWidth: 1.56,
  foulZ: 4.55,
  pinZ: -10.75,
  ballR: 0.18
});
export const PIN_POSITIONS = [
  [0, 0],
  [-0.32, -0.56],
  [0.32, -0.56],
  [-0.64, -1.12],
  [0, -1.12],
  [0.64, -1.12],
  [-0.96, -1.68],
  [-0.32, -1.68],
  [0.32, -1.68],
  [0.96, -1.68]
];
export type ThrowInput = {
  power: number;
  releaseX: number;
  targetX: number;
  hook: number;
};
export type Pose = {
  p: [number, number, number];
  q: [number, number, number, number];
  visible: boolean;
};
export type BowlingState = {
  phase: 'ready' | 'approach' | 'rolling' | 'return' | 'over';
  phaseTime: number;
  time: number;
  players: ScorePlayer[];
  active: number;
  turn: number;
  winner: number | null;
  pins: Pose[];
  standing: boolean[];
  ball: Pose;
  gutter: boolean;
  intent: ThrowInput | null;
  message: string;
  lastShot: {
    turn: number;
    seat: number;
    pins: number;
    strike: boolean;
    spare: boolean;
  } | null;
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const pose = (p: [number, number, number]): Pose => ({
  p,
  q: [0, 0, 0, 1],
  visible: true
});
export function validThrow(input: unknown): input is ThrowInput {
  if (!input || typeof input !== 'object') return false;
  const x = input as ThrowInput;
  return (
    Object.keys(x).every((k) =>
      ['power', 'releaseX', 'targetX', 'hook'].includes(k)
    ) &&
    [x.power, x.releaseX, x.targetX, x.hook].every(
      (n) => typeof n === 'number' && Number.isFinite(n)
    ) &&
    x.power >= 0.08 &&
    x.power <= 1 &&
    Math.abs(x.releaseX) <= 1.1 &&
    Math.abs(x.targetX) <= 1.6 &&
    Math.abs(x.hook) <= 0.8
  );
}
export function swipeInput(
  width: number,
  height: number,
  sx: number,
  sy: number,
  x: number,
  y: number
): ThrowInput {
  // Coordinates are relative to the visible canvas: up charges; screen left stays lane left.
  const power = clamp((sy - y) / Math.max(150, height * 0.3), 0, 1);
  return {
    power,
    releaseX: clamp(((sx / width) * 2 - 1) * 1.1, -1.1, 1.1),
    targetX: clamp(((x / width) * 2 - 1) * 1.6, -1.6, 1.6),
    hook: clamp((x - sx) / Math.max(120, width * 0.6), -0.8, 0.8)
  };
}

/** One fixed-step authoritative simulation shared by browser AI and the match server. */
export class BowlingMatch {
  state: BowlingState;
  private world: World | null = null;
  private pinBodies: (Body | null)[] = [];
  private ballBody: Body | null = null;
  private accumulator = 0;
  private settleAge = 0;
  private ai: boolean;
  private difficulty: number;
  private seed: number;
  private nextStanding: boolean[] = [];
  constructor(
    options: {
      names?: string[];
      ai?: boolean;
      difficulty?: number;
      seed?: number;
    } = {}
  ) {
    this.ai = options.ai !== false;
    this.difficulty = clamp(Math.floor(options.difficulty ?? 1), 0, 2);
    this.seed = (options.seed ?? 1234567) >>> 0;
    this.state = {
      phase: 'ready',
      phaseTime: 0,
      time: 0,
      players: (options.names ?? ['You', 'AI bowler'])
        .slice(0, 2)
        .map(newPlayer),
      active: 0,
      turn: 1,
      winner: null,
      pins: [],
      standing: Array(10).fill(true),
      ball: pose([0.34, 1.02, 7.15]),
      gutter: false,
      intent: null,
      message: 'Swipe up to bowl',
      lastShot: null
    };
    if (this.state.players.length !== 2) throw Error('two_players_required');
    this.rack(this.state.standing);
  }
  private random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  aiInput(): ThrowInput {
    const standing = PIN_POSITIONS.filter((_, i) => this.state.standing[i]);
    const target =
      standing.length === 10
        ? 0.16
        : standing.reduce((s, p) => s + p[0], 0) / Math.max(1, standing.length);
    const error = [0.7, 0.32, 0.12][this.difficulty];
    return {
      power: clamp(0.78 + (this.random() - 0.5) * 0.28, 0.08, 1),
      releaseX: 0.2,
      targetX: clamp(target + (this.random() - 0.5) * error * 2, -1.6, 1.6),
      hook: (this.random() - 0.5) * error * 0.3
    };
  }
  throwBall(seat: number, turn: number, input: ThrowInput): void {
    const s = this.state;
    if (s.phase !== 'ready' || turn !== s.turn || seat !== s.active)
      throw Error('not_your_turn');
    if (!validThrow(input)) throw Error('invalid_throw');
    s.intent = { ...input };
    s.phase = 'approach';
    s.phaseTime = 0;
    s.message = 'Approach';
    s.gutter = false;
  }
  end(winner: number | null, message: string) {
    this.state.phase = 'over';
    this.state.winner = winner;
    this.state.message = message;
    this.world = null;
    this.ballBody = null;
    this.pinBodies = [];
  }
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator >= 1 / 120) {
      this.step(1 / 120);
      this.accumulator -= 1 / 120;
    }
  }
  private rack(standing: boolean[]) {
    this.state.standing = [...standing];
    this.state.pins = PIN_POSITIONS.map(([x, z], i) => ({
      ...pose([x, LANE.y, z + LANE.pinZ]),
      visible: standing[i]
    }));
  }
  private launch() {
    const world = new World({
      gravity: new Vec3(0, -9.81, 0),
      allowSleep: true
    });
    (world.solver as GSSolver).iterations = 14;
    const lane = new Material('lane'),
      ball = new Material('ball'),
      pin = new Material('pin');
    world.addContactMaterial(
      new ContactMaterial(lane, ball, { friction: 0.012, restitution: 0.02 })
    );
    world.addContactMaterial(
      new ContactMaterial(lane, pin, { friction: 0.24, restitution: 0.06 })
    );
    world.addContactMaterial(
      new ContactMaterial(ball, pin, { friction: 0.2, restitution: 0.38 })
    );
    world.addContactMaterial(
      new ContactMaterial(pin, pin, { friction: 0.25, restitution: 0.34 })
    );
    const floor = new Body({
      mass: 0,
      material: lane,
      shape: new Box(new Vec3(1.56, 0.1, 10)),
      position: new Vec3(0, LANE.y - 0.1, -4.8)
    });
    world.addBody(floor);
    for (const x of [-1.83, 1.83]) {
      world.addBody(
        new Body({
          mass: 0,
          material: lane,
          shape: new Box(new Vec3(0.27, 0.1, 10)),
          position: new Vec3(x, LANE.y - 0.2, -4.8)
        })
      );
    }
    this.pinBodies = PIN_POSITIONS.map(([x, z], i) => {
      if (!this.state.standing[i]) return null;
      const b = new Body({
        mass: 1.45,
        material: pin,
        position: new Vec3(x, LANE.y + 0.25, z + LANE.pinZ),
        linearDamping: 0.12,
        angularDamping: 0.2,
        sleepSpeedLimit: 0.07,
        sleepTimeLimit: 0.6
      });
      // Flat base plus rounded belly, neck and head. Render roots sit .25 below the centre of mass.
      b.addShape(new Box(new Vec3(0.075, 0.04, 0.075)), new Vec3(0, -0.21, 0));
      b.addShape(new Sphere(0.155), new Vec3(0, 0.07, 0));
      b.addShape(new Sphere(0.095), new Vec3(0, 0.23, 0));
      b.addShape(new Sphere(0.074), new Vec3(0, 0.41, 0));
      world.addBody(b);
      return b;
    });
    const input = this.state.intent!;
    const body = new Body({
      mass: 6.8,
      material: ball,
      shape: new Sphere(LANE.ballR),
      position: new Vec3(
        input.releaseX,
        LANE.y + LANE.ballR + 0.012,
        LANE.foulZ - 0.18
      ),
      linearDamping: 0.018,
      angularDamping: 0.02
    });
    const speed = 8 + input.power * 9.2;
    const dz = LANE.pinZ - (LANE.foulZ - 0.18),
      dx = input.targetX - input.releaseX,
      length = Math.hypot(dx, dz);
    body.velocity.set((dx / length) * speed, 0, (dz / length) * speed);
    body.angularVelocity.set(
      body.velocity.z / LANE.ballR,
      0,
      -body.velocity.x / LANE.ballR
    );
    world.addBody(body);
    this.ballBody = body;
    this.world = world;
    this.settleAge = 0;
    this.state.phase = 'rolling';
    this.state.phaseTime = 0;
    this.state.message = 'Ball rolling';
  }
  private resolve() {
    const s = this.state;
    const up = new Vec3(0, 1, 0);
    const remaining = this.pinBodies.map((body, i) => {
      if (!body || !s.standing[i]) return false;
      const axis = body.quaternion.vmult(up);
      return (
        axis.y > 0.72 &&
        body.position.y > LANE.y + 0.15 &&
        Math.abs(body.position.x) < 1.56 &&
        body.position.z > -13.2
      );
    });
    const pins =
      s.standing.filter(Boolean).length - remaining.filter(Boolean).length;
    const result = recordRoll(s.players[s.active], pins);
    s.lastShot = {
      turn: s.turn,
      seat: s.active,
      pins,
      strike: result.strike,
      spare: result.spare
    };
    s.message = result.strike
      ? 'Strike!'
      : result.spare
        ? 'Spare!'
        : pins === 0
          ? 'Gutter / miss'
          : `${pins} pins`;
    const allDone = s.players.every((p) => frameIndex(p) < 0);
    if (result.ended && !allDone)
      s.active =
        frameIndex(s.players[1 - s.active]) >= 0 ? 1 - s.active : s.active;
    this.nextStanding = allDone
      ? remaining
      : availablePins(s.players[s.active]) === 10
        ? Array(10).fill(true)
        : remaining;
    s.phase = 'return';
    s.phaseTime = 0;
    this.world = null;
    this.ballBody = null;
    this.pinBodies = [];
  }
  private step(dt: number) {
    const s = this.state;
    if (s.phase === 'over') return;
    s.time += dt;
    s.phaseTime += dt;
    if (s.phase === 'ready') {
      if (this.ai && s.active === 1 && s.phaseTime > 1.4)
        this.throwBall(1, s.turn, this.aiInput());
      return;
    }
    if (s.phase === 'approach') {
      if (s.phaseTime >= 1.08) this.launch();
      return;
    }
    if (s.phase === 'return') {
      const t = clamp(s.phaseTime / 1.8, 0, 1);
      s.ball = pose([1.75, LANE.y + 0.7, -12 + 18 * t]);
      s.ball.visible = t > 0.22;
      if (t >= 1) {
        if (s.players.every((p) => frameIndex(p) < 0)) {
          this.end(
            s.players[0].total === s.players[1].total
              ? null
              : s.players[0].total > s.players[1].total
                ? 0
                : 1,
            'Match complete'
          );
        } else {
          this.rack(this.nextStanding);
          s.turn++;
          s.phase = 'ready';
          s.phaseTime = 0;
          s.intent = null;
          s.ball = pose([0.34, 1.02, 7.15]);
          s.message =
            this.ai && s.active === 1 ? 'AI lining up' : 'Swipe up to bowl';
        }
      }
      return;
    }
    const ball = this.ballBody!,
      world = this.world!;
    // Once over a gutter edge, a delivery cannot bounce back into the rack.
    if (Math.abs(ball.position.x) > LANE.halfWidth + 0.015) s.gutter = true;
    if (s.gutter) {
      ball.position.x = Math.sign(ball.position.x || 1) * 1.84;
      ball.velocity.x = 0;
      ball.collisionFilterMask = 0;
      ball.velocity.y = 0;
      ball.position.y = LANE.y + 0.08;
    } else if (ball.position.z < 2.5 && ball.position.z > LANE.pinZ) {
      ball.velocity.x +=
        s.intent!.hook * clamp((2.5 - ball.position.z) / 10, 0, 1) * dt;
    }
    world.step(dt);
    s.ball = {
      p: [ball.position.x, ball.position.y, ball.position.z],
      q: [
        ball.quaternion.x,
        ball.quaternion.y,
        ball.quaternion.z,
        ball.quaternion.w
      ],
      visible: ball.position.z > -14.5
    };
    this.pinBodies.forEach((body, i) => {
      if (!body) return;
      const offset = body.quaternion.vmult(new Vec3(0, -0.25, 0));
      s.pins[i] = {
        p: [
          body.position.x + offset.x,
          body.position.y + offset.y,
          body.position.z + offset.z
        ],
        q: [
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w
        ],
        visible: body.position.y > -2 && body.position.z > -15.5
      };
    });
    const ballDone =
      ball.position.z < -13.6 ||
      ball.position.y < -1 ||
      ball.velocity.length() < 0.12;
    if (ballDone) this.settleAge += dt;
    const moving = this.pinBodies.some(
      (b) =>
        b &&
        (b.velocity.lengthSquared() > 0.025 ||
          b.angularVelocity.lengthSquared() > 0.04)
    );
    if (
      (this.settleAge > 0.7 && !moving) ||
      this.settleAge > 2.6 ||
      s.phaseTime > 8
    )
      this.resolve();
  }
}
