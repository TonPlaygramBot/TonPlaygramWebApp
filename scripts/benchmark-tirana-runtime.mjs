// CPU simulation only: this does not measure rendering, GPU time or phone FPS.
// Compare the same scenario against another checkout with --source-root PATH.
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {values}=parseArgs({options:{'source-root':{type:'string'},frames:{type:'string',default:'600'},warmup:{type:'string',default:'120'}}});
const root=resolve(values['source-root']||fileURLToPath(new URL('../',import.meta.url)));
const frames=Number(values.frames),warmup=Number(values.warmup);
if(!Number.isInteger(frames)||frames<1||!Number.isInteger(warmup)||warmup<0)throw new Error('Use positive frames and nonnegative warmup counts.');
const {createState,stepState}=await import(pathToFileURL(resolve(root,'webapp/src/games/tiranastreets/shared/engine.mjs')));
const start=performance.now(),state=createState([{id:'local',name:'Benchmark'}],'free-roam','solo');
const startupMs=performance.now()-start,samples=[];
for(let i=0;i<warmup+frames;i++){
  const before=performance.now();stepState(state,1/60);const ms=performance.now()-before;
  if(i>=warmup)samples.push(ms);
}
samples.sort((a,b)=>a-b);
const quantile=p=>samples[Math.min(samples.length-1,Math.ceil(p*samples.length)-1)];
const summary={node:process.version,scenario:'Stationary player at free-roam spawn, full city population, 60 Hz simulation',warmup,frames,
  npcs:state.npcs.length,traffic:state.traffic.length,policeUnits:state.units.length,startupMs,
  meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,medianMs:quantile(.5),p95Ms:quantile(.95),p99Ms:quantile(.99),maxMs:quantile(1),
  over16ms:samples.filter(v=>v>1000/60).length};
if(![...state.npcs,...state.traffic,...state.units,...Object.values(state.players)].every(a=>Number.isFinite(a.x)&&Number.isFinite(a.z)))throw new Error('Non-finite actor pose');
process.stdout.write(JSON.stringify(summary,null,2)+'\n');
