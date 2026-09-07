import type { Shot } from './types';
export class RollSimulator {
  private worker = new Worker(
    new URL('./simulation.worker.ts', import.meta.url),
    { type: 'module' }
  );
  private seq = 0;
  private pending = new Map<
    number,
    {
      resolve: (r: any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const job = this.pending.get(data.id);
      if (!job) return;
      this.pending.delete(data.id);
      clearTimeout(job.timer);
      data.error ? job.reject(Error(data.error)) : job.resolve(data.replay);
    };
    this.worker.onerror = () =>
      this.fail('Bowling simulation could not start.');
  }
  run(shot: Shot, standing: number[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('Bowling simulation timed out.'));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, payload: { shot, standing } });
    });
  }
  private fail(message: string) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error(message));
    }
    this.pending.clear();
  }
  dispose() {
    this.worker.terminate();
    this.fail('Session closed.');
  }
}
