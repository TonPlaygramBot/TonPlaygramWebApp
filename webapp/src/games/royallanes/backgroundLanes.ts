import * as T from 'three';
import { HumanBowler } from './bowlers';
import { RollSimulator } from './simulator';
import { ALL_PINS, APPROACH_MS, chooseAiShot } from './shared/replay.mjs';
import { LANE_SPACING, PIN_COM, pinSpots } from './shared/physicsCore.mjs';
import type { RollReplay } from './types';
import type { BowlingAudio } from './audio';

type Lane = {
  group: T.Group;
  bowler: HumanBowler;
  ball: T.Object3D;
  pins: T.Object3D[];
  lane: number;
  time: number;
  delay: number;
  replay?: RollReplay;
  standing: number[];
  rolls: number;
  busy: boolean;
  lastTime: number;
  step: number;
  cycle: number;
  phase: 'waiting' | 'bowling' | 'return';
};
/** Two independent free-play lanes. One worker, at most one queued roll per lane.
 * Their physics, scores and audio never enter the actual match or network session. */
export class BackgroundLanes {
  readonly group = new T.Group();
  private lanes: Lane[] = [];
  private simulator: RollSimulator | null = null;
  private disposed = false;
  private accumulator = 0;
  private q = new T.Quaternion();
  private otherQ = new T.Quaternion();
  private offset = new T.Vector3();
  constructor(
    prototypes: T.Object3D[],
    ball: T.Object3D,
    pin: T.Object3D,
    private audio: BowlingAudio
  ) {
    this.group.name = 'Royal Lanes: neighbouring bowlers';
    for (const [i, x] of [-LANE_SPACING, LANE_SPACING].entries()) {
      const group = new T.Group();
      group.position.x = x;
      const bowler = new HumanBowler(
        prototypes[i % prototypes.length],
        0xffffff,
        false
      );
      const laneBall = ball.clone(true),
        pins = pinSpots().map((spot) => {
          const p = pin.clone(true);
          p.position.set(spot.x, 0, spot.z);
          group.add(p);
          return p;
        });
      group.add(bowler.root, laneBall);
      this.group.add(group);
      const lane: Lane = {
        group,
        bowler,
        ball: laneBall,
        pins,
        lane: i,
        time: 0,
        delay: i ? 6.5 : 2.5,
        standing: [...ALL_PINS],
        rolls: 0,
        busy: false,
        lastTime: -1,
        step: -1,
        cycle: 0,
        phase: 'waiting'
      };
      this.lanes.push(lane);
      bowler.pose({
        active: true,
        rolling: false,
        elapsed: 0,
        dt: 10,
        watching: false,
        time: 0
      });
      laneBall.position.copy(bowler.ballSocket);
    }
  }
  private prepare(lane: Lane) {
    if (lane.busy || lane.replay || this.disposed) return;
    lane.busy = true;
    try {
      this.simulator ??= new RollSimulator();
    } catch {
      lane.busy = false;
      lane.delay = lane.time + 30;
      return;
    }
    const seed = (lane.cycle * 1587 + lane.lane * 17573 + 91871) % 2147483647;
    let n = seed + 1;
    const random = () => {
      n = (n * 16807) % 2147483647;
      return n / 2147483647;
    };
    void this.simulator
      .run(
        chooseAiShot(lane.standing, lane.lane ? 'casual' : 'club', random),
        lane.standing
      )
      .then((replay) => {
        if (!this.disposed) lane.replay = replay;
      })
      .catch(() => {
        lane.delay = lane.time + 15;
      })
      .finally(() => {
        lane.busy = false;
      });
  }
  update(dt: number, clock: number, camera: T.Vector3) {
    if (this.disposed) return;
    this.accumulator += dt;
    if (this.accumulator < 1 / 30) return;
    dt = this.accumulator;
    this.accumulator = 0;
    for (const lane of this.lanes) {
      lane.time += dt;
      const pan = T.MathUtils.clamp(
          (lane.group.position.x - camera.x) / 5,
          -1,
          1
        ),
        channel = `lane-${lane.lane}`;
      if (lane.phase === 'waiting') {
        if (lane.time >= lane.delay - 1.5) this.prepare(lane);
        if (lane.time >= lane.delay && lane.replay) {
          lane.phase = 'bowling';
          lane.time = 0;
          lane.lastTime = -1;
          lane.step = -1;
        }
      }
      const replay = lane.replay,
        rolling = lane.phase === 'bowling' && !!replay;
      const release = APPROACH_MS / 1000,
        rollTime = lane.time - release;
      const reactionAt = replay ? release + replay.durationMs / 1000 : Infinity;
      const reactionElapsed = rolling ? lane.time - reactionAt : -1;
      lane.bowler.pose({
        active: lane.phase !== 'return',
        rolling,
        elapsed: lane.time,
        dt,
        watching: lane.phase === 'return',
        time: clock,
        releaseSeconds: release,
        reaction:
          replay?.knocked === lane.standing.length
            ? lane.rolls
              ? 'spare'
              : 'strike'
            : replay?.gutter
              ? 'miss'
              : 'neutral',
        reactionElapsed
      });
      if (!rolling || rollTime < 0) {
        lane.ball.visible = lane.phase !== 'return';
        lane.ball.position.copy(lane.bowler.ballSocket);
        this.audio.rolling(channel, 0, 0, pan, false);
        if (rolling) {
          const step = Math.floor((lane.time / release) * 4);
          if (step !== lane.step && step < 4) {
            this.audio.step(pan, 0.18, channel);
            lane.step = step;
          }
        }
      } else if (replay) {
        const index = T.MathUtils.clamp(
            rollTime * replay.hz,
            0,
            replay.frames.length - 1
          ),
          i = Math.floor(index);
        const a = replay.frames[i],
          b = replay.frames[Math.min(i + 1, replay.frames.length - 1)],
          blend = index - i;
        const place = (mesh: T.Object3D, offset: number, pin = false) => {
          mesh.position.set(
            T.MathUtils.lerp(a[offset], b[offset], blend),
            T.MathUtils.lerp(a[offset + 1], b[offset + 1], blend),
            T.MathUtils.lerp(a[offset + 2], b[offset + 2], blend)
          );
          this.q.fromArray(a, offset + 3);
          this.otherQ.fromArray(b, offset + 3);
          mesh.quaternion.slerpQuaternions(this.q, this.otherQ, blend);
          if (pin)
            mesh.position.add(
              this.offset.set(0, -PIN_COM, 0).applyQuaternion(mesh.quaternion)
            );
        };
        lane.ball.visible = true;
        place(lane.ball, 0);
        for (const [id, pin] of lane.pins.entries()) {
          const j = replay.ids.indexOf(id);
          pin.visible = j >= 0;
          if (j >= 0) place(pin, (j + 1) * 7, true);
        }
        if (lane.lastTime < 0 && rollTime < 0.2)
          this.audio.release(pan, 0.35, channel);
        for (const event of replay.events || [])
          if (
            event.time > lane.lastTime &&
            event.time <= rollTime &&
            rollTime - event.time < 0.15
          )
            this.audio.impact(event.strength * 0.3, pan, channel);
        const speed = Math.hypot(b[0] - a[0], b[2] - a[2]) * replay.hz;
        this.audio.rolling(
          channel,
          speed * 0.45,
          Math.abs(lane.ball.position.z - camera.z),
          pan,
          rollTime < replay.durationMs / 1000 && lane.ball.position.z > -20.4
        );
        lane.lastTime = rollTime;
        if (reactionElapsed > 2.2) {
          lane.phase = 'return';
          lane.time = 0;
          this.audio.rolling(channel, 0, 0, pan, false);
        }
      }
      if (lane.phase === 'return' && lane.time > 2.8 && replay) {
        lane.rolls++;
        lane.standing = [...replay.standing];
        if (!lane.standing.length || lane.rolls >= 2) {
          lane.standing = [...ALL_PINS];
          lane.rolls = 0;
        }
        for (const spot of pinSpots()) {
          const pin = lane.pins[spot.id];
          pin.visible = lane.standing.includes(spot.id);
          pin.position.set(spot.x, 0, spot.z);
          pin.quaternion.identity();
        }
        this.audio.sweep(pan, 0.2, channel);
        lane.replay = undefined;
        lane.phase = 'waiting';
        lane.time = 0;
        lane.cycle++;
        lane.delay = 3 + ((lane.cycle * 1.7 + lane.lane) % 4);
      }
    }
  }
  dispose() {
    this.disposed = true;
    this.simulator?.dispose();
    for (const lane of this.lanes) lane.bowler.dispose();
    this.group.removeFromParent();
  }
}
