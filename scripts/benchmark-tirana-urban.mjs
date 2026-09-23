/** CPU-only cold import, initial population and steady simulation sample.
 * Run identical Node/runtime conditions against two checkouts. This does not
 * create WebGL, render a frame or measure a mobile device's FPS. */
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||process.cwd()),start=performance.now();
const {createState,advanceState}=await import(pathToFileURL(root+'/webapp/src/games/tiranastreets/shared/engine.mjs'));
const {WORLD}=await import(pathToFileURL(root+'/webapp/src/games/tiranastreets/shared/world.mjs'));
const imported=performance.now();
const state=createState([{id:'local',name:'Player'}],'free-roam');
const spawned=performance.now();
for(let i=0;i<30;i++)advanceState(state,1/60);
const times=[];
for(let i=0;i<120;i++){const t=performance.now();advanceState(state,1/60);times.push(performance.now()-t);}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({importMs:Math.round(imported-start),spawnMs:Math.round(spawned-imported),simulationMedianMs:+times[60].toFixed(2),simulationP95Ms:+times[114].toFixed(2),roads:WORLD.roads.length,buildings:WORLD.buildings.length,traffic:state.traffic.length,npcs:state.npcs.length,rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
