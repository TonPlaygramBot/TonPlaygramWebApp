import { parentPort } from 'node:worker_threads';
import { simulateRoll } from '../../webapp/src/games/royallanes/shared/replay.mjs';
parentPort.on('message', ({ id, payload }) => {
  try {
    parentPort.postMessage({ id, replay: simulateRoll(payload) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
