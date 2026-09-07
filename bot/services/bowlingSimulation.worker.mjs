import { parentPort } from 'node:worker_threads';
import * as C from 'cannon-es';
import { createBowlingPhysics } from '../../webapp/src/games/royallanes/shared/physicsCore.mjs';
import { simulateRoll } from '../../webapp/src/games/royallanes/shared/replay.mjs';
const BowlingPhysics = createBowlingPhysics(C);
parentPort.on('message', ({ id, payload }) => {
  try {
    parentPort.postMessage({
      id,
      replay: simulateRoll(payload, BowlingPhysics)
    });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
