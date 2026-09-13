/*! @license GPL-3.0-only — adapted from tailuge/billiards; see vendor/tailuge/NOTICE.md. */
import { Vector2, Vector3, type Mesh } from 'three';
import { Ball, State } from './vendor/tailuge/model/ball';
import { Table } from './vendor/tailuge/model/table';
import { OutcomeType } from './vendor/tailuge/model/outcome';
import { R, maxPower, setmu } from './vendor/tailuge/model/physics/constants';
import { TableGeometry } from './vendor/tailuge/view/tablegeometry';
import { PocketGeometry } from './vendor/tailuge/view/pocketgeometry';
import { Respot } from './vendor/tailuge/utils/respot';

export interface RoyalBall {
  id: string;
  pos: Vector2;
  vel: Vector2;
  active: boolean;
  mesh?: Mesh;
  shadow?: Mesh;
  spin?: Vector2;
  pendingSpin?: Vector2;
  omega?: Vector3;
  lift?: number;
  liftVel?: number;
}
export interface TableSize {
  width: number;
  length: number;
  radius: number;
}
export const COLOURS = [
  'CUE',
  'YELLOW',
  'GREEN',
  'BROWN',
  'BLUE',
  'PINK',
  'BLACK'
] as const;
export function ballColour(id: string): string {
  return id.toLowerCase().startsWith('red') ? 'RED' : id.toUpperCase();
}
let configuredSize = '';
export function configureTailuge(size: TableSize): number {
  const scale = size.radius / R;
  const key = `${size.width}:${size.length}:${size.radius}`;
  if (key === configuredSize) return scale;
  configuredSize = key;
  // Upstream's X axis runs down the table; Royal's Z (Vector2.y) runs down it.
  TableGeometry.X = size.length / (2 * scale);
  TableGeometry.Y = size.width / (2 * scale);
  TableGeometry.tableX = TableGeometry.X - R;
  TableGeometry.tableY = TableGeometry.Y - R;
  TableGeometry.hasPockets = true;
  setmu(0.007);
  PocketGeometry.scaleToRadius(R);
  return scale;
}
export function tailugePockets(size: TableSize) {
  const scale = configureTailuge(size);
  // Royal order: top-left, top-right, bottom-left, bottom-right, middle-left/right.
  return [1, 0, 5, 4, 3, 2].map((index, i) => {
    const p = PocketGeometry.pocketCenters[index];
    return {
      id: ['TL', 'TR', 'BL', 'BR', 'TM', 'BM'][i],
      pos: new Vector2(p.pos.y * scale, p.pos.x * scale),
      radius: p.radius * scale
    };
  });
}

/** The sole live solver. Royal meshes and network/replay snapshots remain presentation data. */
export class TailugePhysics {
  readonly scale: number;
  readonly table: Table;
  readonly views = new Map<Ball, RoyalBall>();
  readonly pockets: ReturnType<typeof tailugePockets>;
  constructor(
    readonly size: TableSize,
    balls: RoyalBall[]
  ) {
    this.scale = configureTailuge(size);
    this.pockets = tailugePockets(size);
    const ordered = [...balls].sort((a, b) => {
      const rank = (id: string) =>
        ballColour(id) === 'RED'
          ? 7
          : COLOURS.indexOf(ballColour(id) as (typeof COLOURS)[number]);
      return rank(a.id) - rank(b.id);
    });
    const models = ordered.map((view, index) => {
      const ball = new Ball(
        new Vector3(),
        undefined,
        undefined,
        undefined,
        index
      );
      this.views.set(ball, view);
      return ball;
    });
    this.table = new Table(models);
    this.syncFromViews();
  }
  syncFromViews() {
    configureTailuge(this.size);
    for (const [ball, view] of this.views) {
      ball.pos.set(
        view.pos.y / this.scale,
        view.pos.x / this.scale,
        view.active ? 0 : -10 * R
      );
      ball.setStationary();
      ball.state = view.active ? State.Stationary : State.InPocket;
    }
  }
  previewSpeed(power: number) {
    return (maxPower * Math.max(0, Math.min(1, power)) * this.scale) / 60;
  }
  powerForDistance(distance: number) {
    // Sliding transfers about 5/7 of launch speed into rolling. Leave a little
    // arrival speed for the pocket, instead of the old per-tick .35-.9 range.
    return Math.max(
      0.08,
      Math.min(
        0.8,
        Math.sqrt(Math.max(0, distance / this.scale) * 2 * 0.007 * 9.8) /
          ((5 / 7) * maxPower) +
          0.035
      )
    );
  }
  strike(dir: { x: number; y: number }, power: number, spin = { x: 0, y: 0 }) {
    this.syncFromViews();
    this.table.outcome = [];
    this.table.time = 0;
    const cue = this.table.cueball;
    const speed = maxPower * Math.max(0, Math.min(1, power));
    const aim = new Vector3(dir.y, dir.x, 0).normalize();
    cue.vel.copy(aim).multiplyScalar(speed);
    // Angular velocity in upstream's Z-up space. Topspin > 0 rolls forward.
    cue.rvel
      .set(-aim.y, aim.x, 0)
      .multiplyScalar((speed / R) * Math.max(-1, Math.min(1, spin.y)));
    cue.rvel.z = (-Math.max(-1, Math.min(1, spin.x)) * speed) / R;
    cue.state = State.Sliding;
    for (const view of this.views.values()) {
      view.lift = 0;
      view.liftVel = 0;
      view.spin?.set(0, 0);
      view.pendingSpin?.set(0, 0);
      view.omega?.set(0, 0, 0);
    }
    this.copyToViews(0);
  }
  step(seconds: number) {
    configureTailuge(this.size);
    const start = this.table.outcome.length;
    // Subdivide the existing 120 Hz clock to 480 Hz for high-speed knuckle contacts.
    const steps = Math.max(1, Math.ceil(seconds * 480));
    for (let i = 0; i < steps; i++) this.table.advance(seconds / steps);
    this.copyToViews(seconds);
    return this.table.outcome.slice(start).map((event) => ({
      type: event.type,
      ball: this.views.get(event.ballA!)!,
      other: this.views.get(event.ballB!)!,
      speed: event.incidentSpeed,
      pocket:
        event.type === OutcomeType.Pot
          ? this.pockets.reduce((best, p) =>
              p.pos.distanceTo(this.views.get(event.ballA!)!.pos) <
              best.pos.distanceTo(this.views.get(event.ballA!)!.pos)
                ? p
                : best
            ).id
          : undefined
    }));
  }
  copyToViews(seconds: number, centerY?: number, shadowY?: number) {
    for (const [ball, view] of this.views) {
      view.pos.set(ball.pos.y * this.scale, ball.pos.x * this.scale);
      view.vel.set(
        (ball.vel.y * this.scale) / 60,
        (ball.vel.x * this.scale) / 60
      );
      view.active = ball.onTable();
      if (centerY !== undefined && view.mesh) {
        view.mesh.visible = ball.state !== State.InPocket;
        view.mesh.position.set(
          view.pos.x,
          centerY + ball.pos.z * this.scale,
          view.pos.y
        );
        const axis = new Vector3(ball.rvel.y, ball.rvel.z, ball.rvel.x);
        if (axis.lengthSq() > 0)
          view.mesh.rotateOnWorldAxis(
            axis.clone().normalize(),
            axis.length() * seconds
          );
        if (view.shadow) {
          view.shadow.visible = ball.onTable();
          view.shadow.position.set(
            view.pos.x,
            shadowY ?? centerY - this.size.radius,
            view.pos.y
          );
        }
      }
    }
  }
  allStationary() {
    return this.table.allStationary();
  }
  halt() {
    for (const b of this.table.balls) if (b.onTable()) b.setStationary();
    this.copyToViews(0);
  }
  respot(view: RoyalBall, spots: Record<string, number[]>) {
    this.syncFromViews();
    const ball = [...this.views].find(([, v]) => v === view)?.[0];
    if (!ball) return;
    const candidates = [
      spots[view.id.toLowerCase()],
      ...['black', 'pink', 'blue', 'brown', 'green', 'yellow'].map(
        (c) => spots[c]
      )
    ].filter(Boolean);
    const target = candidates.map(
      (p) => new Vector3(p[1] / this.scale, p[0] / this.scale, 0)
    );
    const free = target.find((p) => !this.table.overlapsAny(p, ball));
    if (free) {
      ball.pos.copy(free);
      ball.setStationary();
    } else Respot.respotBehind(target[0], ball, this.table);
    view.active = true;
    view.pos.set(ball.pos.y * this.scale, ball.pos.x * this.scale);
    view.vel.set(0, 0);
  }
}
