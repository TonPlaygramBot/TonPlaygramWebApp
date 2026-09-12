import {EAST} from './data.mjs';
import {groundHeight} from './terrainCore.mjs';
const raw=EAST.cable.find(c=>c.id==='way/103710384');
if(!raw||raw.points.length<2)throw Error('Dajti Ekspres source line missing');
export const CABLE_SOURCE='https://www.openstreetmap.org/way/103710384';
export const CABLE_DURATION=900; // operator: approximately fifteen minutes.
const nodes=raw.points.map(([x,z],i)=>({x,z,y:groundHeight(x,z)+(i===0||i===raw.points.length-1?6:20)}));
// Heights and sag are explicit engineering-style art estimates, not surveyed
// tower heights. Solve clearance against the SAME terrain used by collision.
for(let i=0;i<nodes.length-1;i++){
 const a=nodes[i],b=nodes[i+1],steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/5);let lift=0;
 for(let j=1;j<steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;lift=Math.max(lift,groundHeight(x,z)+6-(a.y+(b.y-a.y)*t-1.4*4*t*(1-t)));}
 if(lift>0){if(i>0)a.y+=lift;if(i+1<nodes.length-1)b.y+=lift;}
}
export const CABLE_NODES=nodes;
const path=[];
for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],count=Math.max(2,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/6));for(let j=0;j<count;j++){const t=j/count;path.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t-1.4*4*t*(1-t)});}}
path.push({...nodes.at(-1)});
const distances=[0];for(let i=1;i<path.length;i++)distances.push(distances.at(-1)+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y,path[i].z-path[i-1].z));
export const CABLE_LENGTH=distances.at(-1);
export const CABLE_STATIONS=[{id:'dajti-lower',name:'Dajti Ekspres · Linzë',...nodes[0]},{id:'dajti-upper',name:'Dajti Ekspres · Dajt',...nodes.at(-1)}];
export const CABLE_PYLONS=(raw.pylons||[]).map(p=>({id:p.id,...nodes.find(n=>n.x===p.point[0]&&n.z===p.point[1])}));
export function cablePoint(fraction,returning=false){
 const t=Math.max(0,Math.min(1,returning?1-fraction:fraction)),d=t*CABLE_LENGTH;let lo=0,hi=distances.length-1;
 while(lo+1<hi){const m=(lo+hi)>>1;if(distances[m]<d)lo=m;else hi=m;}
 const a=path[lo],b=path[hi],u=(d-distances[lo])/(distances[hi]-distances[lo]||1),dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,side=returning?-1:1;
 return{x:a.x+dx*u+dz/l*2.1*side,y:a.y+(b.y-a.y)*u-3.43,z:a.z+dz*u-dx/l*2.1*side,yaw:Math.atan2(-dx,-dz)+(returning?Math.PI:0)};
}
export function dismountCandidates(index){const s=CABLE_STATIONS[index];return [9,13,19,27].flatMap(r=>Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,x=s.x+Math.cos(a)*r,z=s.z+Math.sin(a)*r;return{x,z,y:groundHeight(x,z)+.08};}));}
