import {REGION_BBOX,buildRegionQuery} from '../../src/games/tirana-region/regionCore.mjs';
/** Partition source requests, never the playable world. Boundary ways retain
 * complete nodes and are deduplicated by OSM identity and source version. */
export function acquisitionTiles(bbox=REGION_BBOX,step=.05){
 buildRegionQuery(bbox);
 if(!Number.isFinite(step)||step<.01||step>.1)throw Error('Tile step must be 0.01–0.1 degrees');
 const [w,s,e,n]=bbox,cols=Math.ceil((e-w)/step-1e-9),rows=Math.ceil((n-s)/step-1e-9);
 if(cols*rows>100)throw Error('Acquisition exceeds 100 tiles');
 const round=n=>Number(n.toFixed(8));
 return Array.from({length:rows*cols},(_,i)=>{const col=i%cols,row=Math.floor(i/cols);return {id:`${row}-${col}`,bbox:[round(w+col*step),round(s+row*step),round(Math.min(e,w+(col+1)*step)),round(Math.min(n,s+(row+1)*step))]};});
}
export function mergeAcquisition(parts,{snapshot}={}){
 if(!Array.isArray(parts)||!parts.length)throw Error('No source tiles');
 const elements=new Map(),databaseTimestamps=new Set();
 if(snapshot&&!Number.isFinite(Date.parse(snapshot)))throw Error('Invalid requested snapshot');
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 for(const raw of parts){
  if(!raw||raw.remark||!Array.isArray(raw.elements)||!raw.elements.length)throw Error('Empty or incomplete source tile');
  const date=raw.osm3s?.timestamp_osm_base;
  if(date)databaseTimestamps.add(date); // Database freshness is not the requested historical date.
  for(const e of raw.elements){
   if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<=0)throw Error('Invalid source identity');
   if(snapshot&&e.timestamp&&Date.parse(e.timestamp)>Date.parse(snapshot))throw Error('Element is newer than requested snapshot');
   const key=`${e.type}/${e.id}`,prior=elements.get(key);
   if(prior&&canonical(prior)!==canonical(e))throw Error(`Conflicting source versions: ${key}`);
   elements.set(key,e);
  }
 }
 return {version:.6,generator:'TonPlaygram regional acquisition',acquisition:{snapshot,databaseTimestamps:[...databaseTimestamps]},elements:[...elements.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.id-b.id)};
}
