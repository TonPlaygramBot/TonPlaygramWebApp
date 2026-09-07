import { simulateRoll } from './shared/replay.mjs';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, replay: simulateRoll(data.payload) });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : 'roll_failed'
    });
  }
};
