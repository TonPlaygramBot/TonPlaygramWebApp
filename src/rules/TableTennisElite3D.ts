/*
 * Advanced Table Tennis 3D logic inspired by top-rated Android games.
 * Implements modular systems for physics, input, AI, scoring, and match orchestration.
 */

// Core math utilities
export class Vector3 {
  constructor(public x: number, public y: number, public z: number) {}

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  add(other: Vector3): this {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  subtract(other: Vector3): this {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }

  multiplyScalar(value: number): this {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): this {
    const len = this.length() || 1;
    return this.multiplyScalar(1 / len);
  }

  clampLength(max: number): this {
    const len = this.length();
    if (len > max) {
      this.multiplyScalar(max / len);
    }
    return this;
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
}

export enum SpinType {
  None = 'NONE',
  Top = 'TOP',
  Back = 'BACK',
  SideLeft = 'SIDE_LEFT',
  SideRight = 'SIDE_RIGHT',
  Cork = 'CORK'
}

export enum ShotStyle {
  Smash = 'SMASH',
  Flick = 'FLICK',
  Drive = 'DRIVE',
  Chop = 'CHOP',
  Serve = 'SERVE',
  Lob = 'LOB',
  Block = 'BLOCK'
}

export enum RallyPhase {
  ServePreparation = 'SERVE_PREPARATION',
  Serve = 'SERVE',
  Rally = 'RALLY',
  PointOver = 'POINT_OVER',
  Timeout = 'TIMEOUT'
}

export enum PlayerHand {
  Left = 'LEFT',
  Right = 'RIGHT'
}

export type InputAction =
  | { type: 'SWING'; direction: Vector3; intensity: number; spin: SpinType; style: ShotStyle }
  | { type: 'SERVE_TOSS'; direction: Vector3; strength: number }
  | { type: 'MOVE'; delta: Vector3 }
  | { type: 'TIMEOUT' };

export type SurfaceMaterial = 'ACRYLIC' | 'WOOD' | 'CONCRETE';

export interface TableConfig {
  width: number;
  length: number;
  height: number;
  netHeight: number;
  surface: SurfaceMaterial;
  netElasticity: number;
  friction: number;
  bounceRestitution: number;
}

export interface BallState {
  position: Vector3;
  velocity: Vector3;
  spin: Vector3;
  contactCount: number;
  lastHitBy: 'A' | 'B' | null;
  onTable: boolean;
  lastBounceSide: 'A' | 'B' | null;
}

export interface PlayerState {
  id: 'A' | 'B';
  name: string;
  score: number;
  stamina: number;
  focus: number;
  hand: PlayerHand;
  anticipation: number;
  reactionTime: number;
  fatigueRate: number;
  racquetSweetSpot: number;
  reach: number;
  paddleAngle: number;
  spinControl: number;
  preferredStyles: ShotStyle[];
}

export interface MatchSettings {
  pointsToWin: number;
  gamesToWin: number;
  serveAlternateEvery: number;
  maxTimeouts: number;
  rallyTimeoutSeconds: number;
  aiDifficulty: 'CASUAL' | 'PRO' | 'MASTER';
  windResistance: number;
  humidity: number;
}

export interface CrowdMood {
  excitement: number;
  pressure: number;
  silence: number;
}

export interface TelemetryEvent {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface RallySnapshot {
  phase: RallyPhase;
  ball: BallState;
  playerA: PlayerState;
  playerB: PlayerState;
  serving: 'A' | 'B';
  rallyCount: number;
  gameScore: { A: number; B: number };
  matchScore: { A: number; B: number };
  timeoutRemaining: { A: number; B: number };
}

export interface Prediction {
  landingPosition: Vector3;
  timeToBounce: number;
  willHitNet: boolean;
  willLandOut: boolean;
}

export interface AIIntent {
  style: ShotStyle;
  spin: SpinType;
  aim: Vector3;
  power: number;
  safeMargin: number;
}

export interface RallyOutcome {
  nextServer: 'A' | 'B';
  pointWinner: 'A' | 'B';
  reason: string;
  resetBall: BallState;
}

const GRAVITY = new Vector3(0, -9.81, 0);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomRange(min: number, max: number): number {
  return lerp(min, max, Math.random());
}

function now(): number {
  return Date.now();
}

export class SpinProfile {
  constructor(public type: SpinType, public rpm: number) {}

  toAngularVelocity(): Vector3 {
    const rad = (Math.PI * 2 * this.rpm) / 60;
    switch (this.type) {
      case SpinType.Top:
        return new Vector3(0, 0, rad);
      case SpinType.Back:
        return new Vector3(0, 0, -rad);
      case SpinType.SideLeft:
        return new Vector3(0, rad, 0);
      case SpinType.SideRight:
        return new Vector3(0, -rad, 0);
      case SpinType.Cork:
        return new Vector3(rad, 0, 0);
      default:
        return Vector3.zero();
    }
  }
}

export class WindModel {
  constructor(private intensity: number, private turbulence: number) {}

  getForce(velocity: Vector3): Vector3 {
    const dragCoefficient = 0.47; // sphere
    const area = 0.0014; // m^2 for ping pong ball
    const airDensity = 1.225 * (1 - this.turbulence * 0.1);
    const speed = velocity.length();
    const dragMagnitude = 0.5 * airDensity * speed * speed * dragCoefficient * area * this.intensity;
    const direction = velocity.clone().normalize().multiplyScalar(-1);
    const swirl = new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-1, 1)).multiplyScalar(
      this.turbulence * 0.05
    );
    return direction.multiplyScalar(dragMagnitude).add(swirl);
  }
}

export class BounceResolver {
  constructor(private table: TableConfig) {}

  resolve(ball: BallState): { bounced: boolean; netContact: boolean; landedSide: 'A' | 'B' | null } {
    let bounced = false;
    let netContact = false;
    let landedSide: 'A' | 'B' | null = null;
    if (!ball.onTable) return { bounced, netContact, landedSide };

    // Check table collision
    if (ball.position.y <= this.table.height) {
      bounced = true;
      const before = ball.velocity.clone();
      ball.position.y = this.table.height + 0.001;
      ball.velocity.y = -before.y * this.table.bounceRestitution;
      // Apply friction to planar motion
      ball.velocity.x *= 1 - this.table.friction;
      ball.velocity.z *= 1 - this.table.friction;
      // Determine side based on z axis (player A is negative side)
      landedSide = ball.position.z <= 0 ? 'A' : 'B';
      ball.lastBounceSide = landedSide;
    }

    // Check net collision (at y = netHeight, x axis across width)
    const halfWidth = this.table.width / 2;
    const nearNet = Math.abs(ball.position.z) < 0.05 && ball.position.y <= this.table.netHeight + 0.02;
    if (nearNet && Math.abs(ball.position.x) <= halfWidth) {
      netContact = true;
      ball.velocity.z *= -this.table.netElasticity;
      ball.spin = ball.spin.multiplyScalar(0.7);
    }

    return { bounced, netContact, landedSide };
  }
}

export class InputBuffer {
  private queue: InputAction[] = [];

  push(action: InputAction) {
    this.queue.push(action);
  }

  consume(type?: InputAction['type']): InputAction | null {
    if (this.queue.length === 0) return null;
    if (!type) return this.queue.shift() ?? null;
    const index = this.queue.findIndex((a) => a.type === type);
    if (index === -1) return null;
    const [action] = this.queue.splice(index, 1);
    return action ?? null;
  }

  clear() {
    this.queue.length = 0;
  }
}

export class CrowdSystem {
  private mood: CrowdMood = { excitement: 0.3, pressure: 0.2, silence: 0.5 };

  applyEvent(event: 'ACE' | 'LONG_RALLY' | 'EDGE' | 'LUCKY_NET' | 'TIMEOUT') {
    switch (event) {
      case 'ACE':
        this.mood.excitement = clamp(this.mood.excitement + 0.2, 0, 1);
        this.mood.pressure = clamp(this.mood.pressure + 0.1, 0, 1);
        this.mood.silence = 0.1;
        break;
      case 'LONG_RALLY':
        this.mood.excitement = clamp(this.mood.excitement + 0.15, 0, 1);
        this.mood.pressure = clamp(this.mood.pressure + 0.05, 0, 1);
        this.mood.silence = clamp(this.mood.silence - 0.1, 0, 1);
        break;
      case 'EDGE':
      case 'LUCKY_NET':
        this.mood.pressure = clamp(this.mood.pressure + 0.2, 0, 1);
        this.mood.excitement = clamp(this.mood.excitement + 0.05, 0, 1);
        break;
      case 'TIMEOUT':
        this.mood.silence = clamp(this.mood.silence + 0.2, 0, 1);
        break;
    }
  }

  decay(delta: number) {
    const rate = delta * 0.02;
    this.mood.excitement = clamp(this.mood.excitement - rate, 0, 1);
    this.mood.pressure = clamp(this.mood.pressure - rate * 0.5, 0, 1);
    this.mood.silence = clamp(this.mood.silence + rate * 0.2, 0, 1);
  }

  snapshot(): CrowdMood {
    return { ...this.mood };
  }
}

export class TelemetryRecorder {
  private events: TelemetryEvent[] = [];

  track(type: string, payload: Record<string, unknown> = {}) {
    this.events.push({ timestamp: now(), type, payload });
  }

  flush(): TelemetryEvent[] {
    const copy = [...this.events];
    this.events.length = 0;
    return copy;
  }
}

export class FatigueModel {
  applyFatigue(player: PlayerState, rallyLength: number, crowd: CrowdMood) {
    const fatigue = rallyLength * player.fatigueRate * (1 + crowd.pressure * 0.2);
    player.stamina = clamp(player.stamina - fatigue, 0, 1);
    player.focus = clamp(player.focus - fatigue * 0.8, 0, 1);
  }

  recover(player: PlayerState, deltaTime: number) {
    const recovery = deltaTime * (0.1 + player.focus * 0.1);
    player.stamina = clamp(player.stamina + recovery, 0, 1);
    player.focus = clamp(player.focus + recovery * 0.5, 0, 1);
  }
}

export class PredictionEngine {
  constructor(private table: TableConfig) {}

  predictLanding(ball: BallState): Prediction {
    const clone = {
      position: ball.position.clone(),
      velocity: ball.velocity.clone(),
      spin: ball.spin.clone()
    };
    const step = 0.005;
    let time = 0;
    let willHitNet = false;
    while (time < 5) {
      // Integrate motion with simple spin Magnus effect approximation
      const magnus = clone.spin.cross(clone.velocity).multiplyScalar(0.0004);
      clone.velocity.add(GRAVITY.clone().multiplyScalar(step)).add(magnus.multiplyScalar(step));
      clone.position.add(clone.velocity.clone().multiplyScalar(step));
      time += step;
      if (Math.abs(clone.position.z) < 0.05 && clone.position.y <= this.table.netHeight + 0.02) {
        willHitNet = true;
      }
      if (clone.position.y <= this.table.height) {
        const landingPosition = clone.position.clone();
        const willLandOut = Math.abs(landingPosition.x) > this.table.width / 2 || Math.abs(landingPosition.z) > this.table.length / 2;
        return { landingPosition, timeToBounce: time, willHitNet, willLandOut };
      }
    }
    return {
      landingPosition: clone.position,
      timeToBounce: time,
      willHitNet,
      willLandOut: true
    };
  }
}

export class PhysicsEngine {
  private wind: WindModel;
  private bounce: BounceResolver;

  constructor(private table: TableConfig, settings: MatchSettings) {
    this.wind = new WindModel(settings.windResistance, settings.humidity);
    this.bounce = new BounceResolver(table);
  }

  step(ball: BallState, deltaTime: number): { net: boolean; bounce: boolean; side: 'A' | 'B' | null } {
    // Apply forces
    const gravityForce = GRAVITY.clone().multiplyScalar(deltaTime);
    const dragForce = this.wind.getForce(ball.velocity).multiplyScalar(deltaTime);
    const magnus = ball.spin.cross(ball.velocity).multiplyScalar(0.0005 * deltaTime);
    ball.velocity.add(gravityForce).add(dragForce).add(magnus);

    // Integrate position
    ball.position.add(ball.velocity.clone().multiplyScalar(deltaTime));

    // Apply slight spin decay
    ball.spin.multiplyScalar(1 - deltaTime * 0.05);

    const collision = this.bounce.resolve(ball);
    return { net: collision.netContact, bounce: collision.bounced, side: collision.landedSide };
  }
}

export class ServeSystem {
  private tossStrength = 3;

  constructor(private table: TableConfig) {}

  prepareToss(ball: BallState, direction: Vector3, strength: number) {
    const upward = clamp(strength, 0.5, 2) * this.tossStrength;
    ball.velocity = direction.normalize().multiplyScalar(0.1);
    ball.velocity.y = upward;
    ball.spin = Vector3.zero();
    ball.onTable = true;
    ball.lastHitBy = null;
  }

  strikeServe(ball: BallState, player: PlayerState, style: ShotStyle, spinType: SpinType) {
    const basePower = style === ShotStyle.Serve ? 8 : 6;
    const control = player.spinControl * 0.5 + player.focus * 0.5;
    const direction = new Vector3(randomRange(-0.1, 0.1), randomRange(0.05, 0.1), style === ShotStyle.Serve ? 1 : 0.8);
    const power = basePower * clamp(player.stamina + 0.3, 0.3, 1.2);
    ball.velocity = direction.normalize().multiplyScalar(power);
    ball.spin = new SpinProfile(spinType, 80 + control * 400).toAngularVelocity();
    ball.lastHitBy = player.id;
  }
}

export class AIStateMachine {
  private mode: 'PASSIVE' | 'CONTROL' | 'ATTACK' = 'CONTROL';
  private lastDecision = 0;

  constructor(private settings: MatchSettings) {}

  decideIntent(ball: BallState, player: PlayerState, prediction: Prediction, rallyCount: number): AIIntent {
    const nowMs = now();
    if (nowMs - this.lastDecision > 1200) {
      this.mode = this.computeMode(player, rallyCount, prediction);
      this.lastDecision = nowMs;
    }
    const aggression = this.settings.aiDifficulty === 'MASTER' ? 0.8 : this.settings.aiDifficulty === 'PRO' ? 0.55 : 0.3;
    const risk = clamp(aggression + (1 - player.stamina) * 0.4 + (1 - player.focus) * 0.3, 0.1, 0.95);
    const style = this.selectStyle(risk, prediction, rallyCount);
    const spin = this.selectSpin(style, risk);
    const aim = this.computeAim(prediction, risk, player);
    const power = clamp(0.6 + risk * 0.7, 0.4, 1.3);
    return { style, spin, aim, power, safeMargin: clamp(0.15 - risk * 0.05, 0.05, 0.2) };
  }

  private computeMode(player: PlayerState, rallyCount: number, prediction: Prediction) {
    if (player.stamina < 0.25) return 'PASSIVE';
    if (rallyCount > 14 && !prediction.willHitNet) return 'ATTACK';
    return player.focus > 0.6 ? 'ATTACK' : 'CONTROL';
  }

  private selectStyle(risk: number, prediction: Prediction, rallyCount: number): ShotStyle {
    if (prediction.willHitNet && risk > 0.5) return ShotStyle.Lob;
    if (rallyCount < 3) return ShotStyle.Drive;
    if (risk > 0.75) return ShotStyle.Smash;
    if (risk > 0.5) return ShotStyle.Chop;
    return ShotStyle.Block;
  }

  private selectSpin(style: ShotStyle, risk: number): SpinType {
    switch (style) {
      case ShotStyle.Smash:
        return risk > 0.8 ? SpinType.Top : SpinType.None;
      case ShotStyle.Chop:
        return SpinType.Back;
      case ShotStyle.Drive:
        return risk > 0.5 ? SpinType.Top : SpinType.None;
      case ShotStyle.Lob:
        return SpinType.Cork;
      default:
        return SpinType.SideLeft;
    }
  }

  private computeAim(prediction: Prediction, risk: number, player: PlayerState): Vector3 {
    const horizontalTarget = prediction.landingPosition.clone();
    horizontalTarget.x += randomRange(-0.2, 0.2) * (1 - player.focus);
    horizontalTarget.z = player.id === 'A' ? randomRange(0.15, 0.4) : randomRange(-0.4, -0.15);
    horizontalTarget.y = 0.1 + risk * 0.1;
    return horizontalTarget;
  }
}

export class RacketCollisionSystem {
  constructor(private table: TableConfig) {}

  tryHitBall(ball: BallState, player: PlayerState, intent: AIIntent | InputAction): boolean {
    const paddleReach = player.reach + player.stamina * 0.3;
    const paddleHeight = this.table.height + 0.15;
    const offset = player.id === 'A' ? -0.2 : 0.2;
    const idealPosition = new Vector3(offset, paddleHeight, player.id === 'A' ? -0.4 : 0.4);
    const distance = ball.position.clone().subtract(idealPosition).length();
    if (distance > paddleReach) return false;

    const style = 'style' in intent ? intent.style : ShotStyle.Drive;
    const spinType = 'spin' in intent ? intent.spin : SpinType.None;
    const direction = new Vector3(ball.position.x * 0.2, 0.12, player.id === 'A' ? 1 : -1);
    const power = 'power' in intent ? intent.power : 0.8;
    const sweetSpot = clamp(player.racquetSweetSpot - distance * 0.05, 0.4, 1);
    const focusBoost = clamp(player.focus * 0.3, 0, 0.3);
    const combinedPower = power * (0.7 + sweetSpot + focusBoost);
    ball.velocity = direction.normalize().multiplyScalar(7 * combinedPower);
    if (style === ShotStyle.Smash) ball.velocity.y += 2;
    if (style === ShotStyle.Lob) ball.velocity.y += 3;
    const spinMagnitude = 50 + player.spinControl * 300 + power * 100;
    ball.spin = new SpinProfile(spinType, spinMagnitude).toAngularVelocity();
    ball.lastHitBy = player.id;
    ball.contactCount += 1;
    return true;
  }
}

export class RallyOrchestrator {
  private rallyCount = 0;
  private lastHitAt = now();
  private longRallyThreshold = 12;

  constructor(
    private physics: PhysicsEngine,
    private predictor: PredictionEngine,
    private racketSystem: RacketCollisionSystem,
    private crowd: CrowdSystem,
    private telemetry: TelemetryRecorder,
    private fatigue: FatigueModel
  ) {}

  resetRally() {
    this.rallyCount = 0;
    this.lastHitAt = now();
  }

  update(
    ball: BallState,
    players: { A: PlayerState; B: PlayerState },
    phase: RallyPhase,
    delta: number,
    settings: MatchSettings
  ): { phase: RallyPhase; bounceSide: 'A' | 'B' | null; net: boolean } {
    const collision = this.physics.step(ball, delta);
    if (collision.bounce) {
      this.rallyCount += 1;
      this.fatigue.applyFatigue(players.A, this.rallyCount, this.crowd.snapshot());
      this.fatigue.applyFatigue(players.B, this.rallyCount, this.crowd.snapshot());
      if (this.rallyCount === this.longRallyThreshold) {
        this.crowd.applyEvent('LONG_RALLY');
        this.telemetry.track('long_rally', { length: this.rallyCount });
      }
    }

    const timeSinceLastHit = (now() - this.lastHitAt) / 1000;
    if (timeSinceLastHit > settings.rallyTimeoutSeconds) {
      return { phase: RallyPhase.Timeout, bounceSide: collision.side, net: collision.net };
    }
    return { phase, bounceSide: collision.side, net: collision.net };
  }

  registerHit() {
    this.lastHitAt = now();
  }

  getRallyCount(): number {
    return this.rallyCount;
  }

  evaluateOutcome(ball: BallState, table: TableConfig): RallyOutcome | null {
    if (!ball.onTable) return null;
    const outOfBounds = Math.abs(ball.position.x) > table.width / 2 || Math.abs(ball.position.z) > table.length / 2;
    if (outOfBounds) {
      const pointWinner = ball.lastHitBy === 'A' ? 'B' : 'A';
      return this.pointResult(pointWinner, 'OUT');
    }
    if (ball.contactCount >= 2) {
      const pointWinner = ball.lastHitBy === 'A' ? 'B' : 'A';
      return this.pointResult(pointWinner, 'DOUBLE_CONTACT');
    }
    if (ball.lastBounceSide && ball.lastBounceSide === ball.lastHitBy) {
      const pointWinner = ball.lastHitBy === 'A' ? 'B' : 'A';
      return this.pointResult(pointWinner, 'WRONG_SIDE');
    }
    return null;
  }

  private pointResult(winner: 'A' | 'B', reason: string): RallyOutcome {
    const resetBall: BallState = {
      position: new Vector3(0, 1, 0),
      velocity: Vector3.zero(),
      spin: Vector3.zero(),
      contactCount: 0,
      lastHitBy: null,
      onTable: true,
      lastBounceSide: null
    };
    this.telemetry.track('point_over', { winner, reason });
    return { nextServer: winner, pointWinner: winner, reason, resetBall };
  }
}

export class ScoreSystem {
  private gameScore = { A: 0, B: 0 };
  private matchScore = { A: 0, B: 0 };
  private serving: 'A' | 'B' = 'A';
  private alternateCounter = 0;
  private timeoutRemaining = { A: 2, B: 2 };

  constructor(private settings: MatchSettings) {}

  getSnapshot() {
    return {
      gameScore: { ...this.gameScore },
      matchScore: { ...this.matchScore },
      serving: this.serving,
      timeoutRemaining: { ...this.timeoutRemaining }
    };
  }

  awardPoint(winner: 'A' | 'B') {
    this.gameScore[winner] += 1;
    this.alternateCounter += 1;
    if (this.alternateCounter >= this.settings.serveAlternateEvery) {
      this.serving = this.serving === 'A' ? 'B' : 'A';
      this.alternateCounter = 0;
    }
    const loser = winner === 'A' ? 'B' : 'A';
    if (this.gameScore[winner] >= this.settings.pointsToWin && Math.abs(this.gameScore[winner] - this.gameScore[loser]) >= 2) {
      this.matchScore[winner] += 1;
      this.gameScore = { A: 0, B: 0 };
    }
  }

  callTimeout(player: 'A' | 'B'): boolean {
    if (this.timeoutRemaining[player] <= 0) return false;
    this.timeoutRemaining[player] -= 1;
    return true;
  }
}

export class PlayerFactory {
  static create(id: 'A' | 'B', name: string, settings: MatchSettings): PlayerState {
    const baseStamina = settings.aiDifficulty === 'MASTER' ? 0.9 : settings.aiDifficulty === 'PRO' ? 0.8 : 0.6;
    const focus = baseStamina - 0.1;
    return {
      id,
      name,
      score: 0,
      stamina: baseStamina,
      focus,
      hand: id === 'A' ? PlayerHand.Left : PlayerHand.Right,
      anticipation: 0.6,
      reactionTime: 0.35,
      fatigueRate: 0.02,
      racquetSweetSpot: 0.8,
      reach: 0.6,
      paddleAngle: 15,
      spinControl: 0.5,
      preferredStyles: [ShotStyle.Drive, ShotStyle.Block]
    };
  }
}

export class GameState {
  ball: BallState;
  players: { A: PlayerState; B: PlayerState };
  rallyPhase: RallyPhase = RallyPhase.ServePreparation;
  crowd: CrowdSystem;
  telemetry: TelemetryRecorder;
  fatigue: FatigueModel;

  constructor(public table: TableConfig, public settings: MatchSettings, names: { A: string; B: string }) {
    this.ball = {
      position: new Vector3(0, table.height + 0.15, -table.length / 4),
      velocity: Vector3.zero(),
      spin: Vector3.zero(),
      contactCount: 0,
      lastHitBy: null,
      onTable: true,
      lastBounceSide: null
    };
    this.players = {
      A: PlayerFactory.create('A', names.A, settings),
      B: PlayerFactory.create('B', names.B, settings)
    };
    this.crowd = new CrowdSystem();
    this.telemetry = new TelemetryRecorder();
    this.fatigue = new FatigueModel();
  }
}

export class TableTennis3DGame {
  private physics: PhysicsEngine;
  private serve: ServeSystem;
  private ai: AIStateMachine;
  private predictor: PredictionEngine;
  private racketSystem: RacketCollisionSystem;
  private rally: RallyOrchestrator;
  private score: ScoreSystem;
  private buffer: InputBuffer;
  private state: GameState;

  constructor(table: TableConfig, settings: MatchSettings, names: { A: string; B: string }) {
    this.physics = new PhysicsEngine(table, settings);
    this.serve = new ServeSystem(table);
    this.ai = new AIStateMachine(settings);
    this.predictor = new PredictionEngine(table);
    this.racketSystem = new RacketCollisionSystem(table);
    const crowd = new CrowdSystem();
    const telemetry = new TelemetryRecorder();
    const fatigue = new FatigueModel();
    this.rally = new RallyOrchestrator(this.physics, this.predictor, this.racketSystem, crowd, telemetry, fatigue);
    this.score = new ScoreSystem(settings);
    this.buffer = new InputBuffer();
    this.state = new GameState(table, settings, names);
  }

  getSnapshot(): RallySnapshot {
    const scores = this.score.getSnapshot();
    return {
      phase: this.state.rallyPhase,
      ball: this.state.ball,
      playerA: this.state.players.A,
      playerB: this.state.players.B,
      serving: scores.serving,
      rallyCount: this.rally.getRallyCount(),
      gameScore: scores.gameScore,
      matchScore: scores.matchScore,
      timeoutRemaining: scores.timeoutRemaining
    };
  }

  enqueueInput(action: InputAction) {
    this.buffer.push(action);
  }

  tick(deltaTime: number) {
    const scores = this.score.getSnapshot();
    if (this.state.rallyPhase === RallyPhase.ServePreparation) {
      this.handleServePrep(scores.serving);
    }

    if (this.state.rallyPhase === RallyPhase.Serve) {
      this.handleServe(scores.serving);
    }

    if (this.state.rallyPhase === RallyPhase.Rally || this.state.rallyPhase === RallyPhase.Serve) {
      const { phase, bounceSide, net } = this.rally.update(
        this.state.ball,
        this.state.players,
        this.state.rallyPhase,
        deltaTime,
        this.state.settings
      );
      this.state.rallyPhase = phase;
      const outcome = this.rally.evaluateOutcome(this.state.ball, this.state.table);
      if (net) this.state.crowd.applyEvent('LUCKY_NET');
      if (outcome) {
        this.resolvePoint(outcome);
      } else if (bounceSide && this.state.ball.lastHitBy && bounceSide === this.state.ball.lastHitBy) {
        // Ensure ball bounces on opponent side only
        this.resolvePoint({
          nextServer: this.state.ball.lastHitBy === 'A' ? 'B' : 'A',
          pointWinner: this.state.ball.lastHitBy === 'A' ? 'B' : 'A',
          reason: 'SIDE_FAULT',
          resetBall: this.state.ball
        });
      }
    }

    if (this.state.rallyPhase === RallyPhase.Timeout) {
      this.state.fatigue.recover(this.state.players.A, deltaTime);
      this.state.fatigue.recover(this.state.players.B, deltaTime);
      this.state.crowd.decay(deltaTime);
    }
  }

  private handleServePrep(serving: 'A' | 'B') {
    const toss = this.buffer.consume('SERVE_TOSS');
    if (!toss || toss.type !== 'SERVE_TOSS') return;
    this.serve.prepareToss(this.state.ball, toss.direction, toss.strength);
    this.state.rallyPhase = RallyPhase.Serve;
    this.state.ball.contactCount = 0;
    this.state.ball.lastHitBy = null;
  }

  private handleServe(serving: 'A' | 'B') {
    const player = this.state.players[serving];
    const swing = this.buffer.consume('SWING');
    const aiIntent = this.ai.decideIntent(
      this.state.ball,
      player,
      this.predictor.predictLanding(this.state.ball),
      this.rally.getRallyCount()
    );
    const intent = swing && swing.type === 'SWING' ? swing : aiIntent;
    const hit = this.racketSystem.tryHitBall(this.state.ball, player, intent as AIIntent);
    if (hit) {
      this.rally.registerHit();
      this.state.rallyPhase = RallyPhase.Rally;
    }
  }

  private resolvePoint(outcome: RallyOutcome) {
    this.score.awardPoint(outcome.pointWinner);
    this.state.rallyPhase = RallyPhase.ServePreparation;
    this.state.ball = outcome.resetBall;
    this.rally.resetRally();
    this.state.players[outcome.pointWinner].score += 1;
  }

  callTimeout(player: 'A' | 'B'): boolean {
    if (!this.score.callTimeout(player)) return false;
    this.state.rallyPhase = RallyPhase.Timeout;
    this.state.crowd.applyEvent('TIMEOUT');
    this.state.telemetry.track('timeout', { player });
    return true;
  }

  forceHit(playerId: 'A' | 'B', intent: AIIntent) {
    const player = this.state.players[playerId];
    if (this.racketSystem.tryHitBall(this.state.ball, player, intent)) {
      this.rally.registerHit();
      this.state.rallyPhase = RallyPhase.Rally;
    }
  }
}
