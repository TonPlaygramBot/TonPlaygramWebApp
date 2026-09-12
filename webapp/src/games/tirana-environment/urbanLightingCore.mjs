import {insideRing} from './surfaceCore.mjs';

// Authored spacing on recorded road segments; not a surveyed lamp inventory.
export function streetLampPlacements(world) {
  const size=80,bins=new Map(),occupied=new Map(),out=[];
  const key=(x,z)=>`${Math.floor(x/size)}:${Math.floor(z/size)}`;
  for(const b of world.buildings||[]){
    const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
    for(let x=Math.floor(Math.min(...xs)/size);x<=Math.floor(Math.max(...xs)/size);x++)
      for(let z=Math.floor(Math.min(...zs)/size);z<=Math.floor(Math.max(...zs)/size);z++){
        const k=`${x}:${z}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
      }
  }
  for(const r of world.roads||[]){
    if(r.walk||r.tunnel||r.w<5)continue;
    const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);if(len<24)continue;
    const yaw=Math.atan2(dx,dz),nx=dz/len,nz=-dx/len;
    for(let d=14,i=0;d<len-7;d+=32,i++){
      const side=i%2?-1:1,x=r.a[0]+dx*d/len+nx*side*(r.w/2+1.45),z=r.a[1]+dz*d/len+nz*side*(r.w/2+1.45);
      if((bins.get(key(x,z))||[]).some(b=>insideRing([x,z],b.p)))continue;
      let close=false;
      for(let gx=Math.floor(x/size)-1;gx<=Math.floor(x/size)+1;gx++)for(let gz=Math.floor(z/size)-1;gz<=Math.floor(z/size)+1;gz++)
        if((occupied.get(`${gx}:${gz}`)||[]).some(p=>Math.hypot(p.x-x,p.z-z)<23))close=true;
      if(close)continue;
      const p={x,z,yaw:yaw+(side>0?Math.PI:0),height:6.4,road:r.name||''};
      const k=key(x,z);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(p);out.push(p);
    }
  }
  return out;
}
export function largeBuildingAprons(world,pad=3) {
  const rings=[];
  for(const b of world.buildings||[]){
    if(b.minHeight>1||b.tags?.building==='construction')continue;
    const area=Math.abs(b.p.reduce((s,p,i)=>{const q=b.p[(i+1)%b.p.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
    if(b.h<18&&area<350)continue;
    // Each edge creates a bounded paving strip, including concave footprints.
    for(let i=0;i<b.p.length;i++){
      const a=b.p[i],c=b.p[(i+1)%b.p.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);if(length<.1)continue;
      const nx=-dz/length*pad,nz=dx/length*pad;
      rings.push([[a[0]+nx,a[1]+nz],[c[0]+nx,c[1]+nz],[c[0]-nx,c[1]-nz],[a[0]-nx,a[1]-nz]]);
    }
  }
  return rings;
}
export function urbanLightLevel(environment,kind='street') {
  const dark=Math.max(environment.night||0,(1-(environment.daylight??1))*.8);
  const hour=environment.hour??12;
  if(kind==='business')return dark*(hour>=6&&hour<23?1:.16);
  if(kind==='apartment')return dark*(hour<5?.28:1);
  return dark;
}
