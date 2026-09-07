import { Worker } from 'node:worker_threads';
/** Isolate collision solving from Socket.IO's event loop; bound both CPU and queued work. */
export function createBowlingSimulationPool({
  size = 2,
  maxQueue = 32,
  timeoutMs = 20_000
} = {}) {
  const workers = [],
    queue = [];
  let nextId = 0,
    closed = false;
  const spawn = () => {
    const slot = {
      worker: new Worker(
        new URL('./bowlingSimulation.worker.mjs', import.meta.url)
      ),
      job: null
    };
    workers.push(slot);
    slot.worker.on('message', (message) => {
      if (!slot.job || message.id !== slot.job.id) return;
      const job = slot.job;
      slot.job = null;
      clearTimeout(job.timer);
      message.error
        ? job.reject(Error(message.error))
        : job.resolve(message.replay);
      drain();
    });
    const fail = (error) => {
      const index = workers.indexOf(slot);
      if (index < 0) return;
      workers.splice(index, 1);
      if (slot.job) {
        clearTimeout(slot.job.timer);
        slot.job.reject(error);
      }
      void slot.worker.terminate();
      if (!closed) drain();
    };
    slot.worker.on('error', fail);
    slot.worker.on('exit', (code) => {
      if (workers.includes(slot))
        fail(Error(`simulation_worker_stopped_${code}`));
    });
    return slot;
  };
  function drain() {
    if (closed) return;
    while (queue.length) {
      let slot = workers.find((w) => !w.job);
      if (!slot && workers.length < size) slot = spawn();
      if (!slot) return;
      const job = queue.shift();
      slot.job = job;
      job.timer = setTimeout(() => {
        const index = workers.indexOf(slot);
        if (index < 0 || slot.job !== job) return;
        workers.splice(index, 1);
        slot.job = null;
        job.reject(Error('simulation_timeout'));
        void slot.worker.terminate();
        drain();
      }, timeoutMs);
      job.timer.unref?.();
      slot.worker.postMessage({ id: job.id, payload: job.payload });
    }
  }
  return {
    simulate(payload) {
      if (closed) return Promise.reject(Error('simulation_closed'));
      if (queue.length >= maxQueue)
        return Promise.reject(Error('simulation_busy'));
      return new Promise((resolve, reject) => {
        queue.push({ id: ++nextId, payload, resolve, reject, timer: null });
        drain();
      });
    },
    async close() {
      closed = true;
      for (const job of queue.splice(0)) job.reject(Error('simulation_closed'));
      await Promise.all(
        workers.splice(0).map(async (slot) => {
          if (slot.job) {
            clearTimeout(slot.job.timer);
            slot.job.reject(Error('simulation_closed'));
          }
          await slot.worker.terminate();
        })
      );
    }
  };
}
