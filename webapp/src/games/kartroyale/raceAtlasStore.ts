type Point={x:number;z:number};
export type AtlasSnapshot={player:(Point&{heading:number})|undefined;points:Point[];name:string;stamp:number};
let snapshot:AtlasSnapshot={player:undefined,points:[],name:'Tirana city atlas',stamp:0},last=0;
const listeners=new Set<()=>void>();
export const subscribeAtlas=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const readAtlas=()=>snapshot;
export function publishAtlas(x:number,z:number,track:{name:string;points:Point[]}){
 const now=performance.now();if(now-last<250)return;last=now;
 const before=snapshot.player,dx=before?x-before.x:0,dz=before?z-before.z:0;
 snapshot={player:{x,z,heading:Math.hypot(dx,dz)>.2?Math.atan2(-dx,-dz):before?.heading||0},points:track.points,name:track.name,stamp:now};listeners.forEach(fn=>fn());
}

export function clearAtlas(){snapshot={...snapshot,player:undefined,stamp:0};last=0;listeners.forEach(fn=>fn());}
