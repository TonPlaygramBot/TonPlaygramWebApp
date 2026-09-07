import { BowlingPhysics } from './shared/physics.mjs';
import { simulateRoll } from './shared/replay.mjs';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      replay: simulateRoll(data.payload, BowlingPhysics)
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : 'roll_failed'
    });
  }
};
