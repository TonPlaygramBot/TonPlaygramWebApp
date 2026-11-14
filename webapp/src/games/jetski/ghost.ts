import { RACE_LIMIT, wrapAngle, type Racer } from './simulation.mjs';

export const GHOST_INTERVAL = 0.1;

type GhostFrame = [x: number, z: number, heading: number, height: number];
export type GhostPose = Pick<Racer, 'x' | 'z' | 'heading' | 'height'>;
export type GhostRun = { time: number; frames: GhostFrame[] };

export function ghostKey(trackId: string, craftId: string) {
  return `jetski.ghost.v1.${trackId}.${craftId}`;
}

export function readGhost(raw: string): GhostRun | null {
  try {
    const { time, frames } = JSON.parse(raw) ?? {};
    if (
      Number.isFinite(time) && time > 0 &&
      Array.isArray(frames) && frames.length >= 2 &&
      frames.length <= Math.ceil(RACE_LIMIT / GHOST_INTERVAL) + 1 &&
      frames.every((frame) =>
        Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite)
      )
    ) return { time, frames };
  } catch {}
  return null;
}

export function ghostFrame(pose: GhostPose): GhostFrame {
  return [pose.x, pose.z, pose.heading, pose.height].map(
    (value) => Math.round(value * 1000) / 1000
  ) as GhostFrame;
}

export function replayGhost(run: GhostRun | null, elapsed: number): GhostPose | null {
  if (!run) return null;
  const index = elapsed / GHOST_INTERVAL;
  const before = run.frames[Math.floor(index)];
  if (!before) return null;
  const after = run.frames[Math.ceil(index)] ?? before;
  const alpha = index - Math.floor(index);
  return {
    x: before[0] + (after[0] - before[0]) * alpha,
    z: before[1] + (after[1] - before[1]) * alpha,
    heading: before[2] + wrapAngle(after[2] - before[2]) * alpha,
    height: before[3] + (after[3] - before[3]) * alpha
  };
}
