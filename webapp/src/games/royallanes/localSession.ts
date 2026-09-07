import {
  createBowlingMatch,
  activePlayer,
  beginShot,
  startReplay,
  completeRoll,
  nextTurn,
  openTurn,
  publicBowlingMatch
} from './shared/match.mjs';
import { chooseAiShot } from './shared/replay.mjs';
import { RollSimulator } from './simulator';
import type { BowlingSession, MatchView, Shot } from './types';
export class LocalBowlingSession implements BowlingSession {
  localId = 'you';
  private match: any;
  private simulator = new RollSimulator();
  private listeners = new Set<(s: MatchView) => void>();
  private timer: ReturnType<typeof setInterval>;
  private time = Date.now();
  private previous = performance.now();
  private paused = false;
  private closed = false;
  private aiAt = 0;
  private lastHeartbeat = 0;
  constructor(
    name: string,
    private difficulty: string,
    private onError: (e: string) => void
  ) {
    this.match = createBowlingMatch([
      { id: 'you', name },
      {
        id: 'ai',
        name:
          difficulty === 'pro'
            ? 'Alex · Pro AI'
            : difficulty === 'casual'
              ? 'Alex · Casual AI'
              : 'Alex · Club AI'
      }
    ]);
    this.match.phase = 'countdown';
    this.match.startsAt = this.time + 1800;
    this.timer = setInterval(this.tick, 50);
    document.addEventListener('visibilitychange', this.visibility);
  }
  private visibility = () => {
    this.previous = performance.now();
    if (!document.hidden && !this.closed) this.emit();
  };
  private emit() {
    const view = {
      ...publicBowlingMatch(this.match),
      serverNow: this.time
    } as MatchView;
    this.listeners.forEach((fn) => fn(view));
  }
  subscribe(fn: (s: MatchView) => void) {
    this.listeners.add(fn);
    fn({
      ...publicBowlingMatch(this.match),
      serverNow: this.time
    } as MatchView);
    return () => this.listeners.delete(fn);
  }
  async roll(shot: Shot, turnId: number) {
    return this.perform(this.localId, shot, turnId);
  }
  private async perform(id: string, shot: Shot, turnId: number) {
    const accepted = beginShot(this.match, id, { shot, turnId });
    if (!accepted.ok) throw Error(accepted.error);
    this.emit();
    try {
      const replay = await this.simulator.run(accepted.shot!, accepted.standing!);
      if (this.closed) return;
      startReplay(this.match, replay, this.time);
      this.emit();
    } catch (e) {
      if (!this.closed) {
        openTurn(this.match, this.time);
        this.match.turnDeadline = 0;
        this.emit();
        this.onError(e instanceof Error ? e.message : 'Could not bowl.');
      }
    }
  }
  private tick = () => {
    const now = performance.now();
    const dt = Math.min(200, now - this.previous);
    this.previous = now;
    if (this.closed || this.paused || document.hidden) return;
    this.time += dt;
    const m = this.match;
    if (m.phase === 'countdown' && this.time >= m.startsAt) {
      openTurn(m, this.time);
      m.turnDeadline = 0;
      this.emit();
    }
    if (m.phase === 'rolling' && this.time >= m.roll.endsAt) {
      completeRoll(m, this.time);
      this.emit();
    }
    if (m.phase === 'result' && this.time >= m.readyAt) {
      nextTurn(m, this.time);
      m.turnDeadline = 0;
      this.aiAt = 0;
      this.emit();
    }
    if (m.phase === 'aiming' && activePlayer(m).id === 'ai') {
      if (!this.aiAt) this.aiAt = this.time + 1500;
      if (this.time >= this.aiAt) {
        this.aiAt = 0;
        void this.perform(
          'ai',
          chooseAiShot(activePlayer(m).standing, this.difficulty),
          m.turnId
        ).catch((e) => this.onError(e.message));
      }
    }
    if (
      this.time - this.lastHeartbeat > 1000 &&
      ['aiming', 'countdown'].includes(m.phase)
    ) {
      this.lastHeartbeat = this.time;
      this.emit();
    }
  };
  setPaused(value: boolean) {
    this.paused = value;
    this.previous = performance.now();
    this.emit();
  }
  dispose() {
    this.closed = true;
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.visibility);
    this.simulator.dispose();
    this.listeners.clear();
  }
}
