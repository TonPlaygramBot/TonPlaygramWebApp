/** Retain partially built cells as the viewer moves; cancel only obsolete work.
 * Dependencies are submitted before details. Generators release partial buffers
 * in finally blocks when cancelled or disposed. */
export class CellWorkQueue {
  jobs = new Map();
  sync(tasks) {
    const next=new Map();
    for(const task of tasks)next.set(task.key,this.jobs.get(task.key)||task.create());
    for(const [key,job] of this.jobs)if(!next.has(key))job.return();
    this.jobs=next;
  }
  run(budget,maxSteps,clock=()=>performance.now()) {
    const start=clock();let steps=0;
    for(const [key,job] of this.jobs){
      while(clock()-start<budget&&steps++<maxSteps){if(job.next().done){this.jobs.delete(key);break;}}
      if(clock()-start>=budget||steps>=maxSteps)break;
    }
  }
  get length(){return this.jobs.size;}
  dispose(){for(const job of this.jobs.values())job.return();this.jobs.clear();}
}
