/** Original, decorative facade kit. Placement uses existing footprints. */
export const AD_BRANDS=Object.freeze([
  {id:'lana',title:'KAFE LANA',line:'Kafe e mirë. Çdo ditë.',accent:'#b96537',background:'#1e332e',product:'coffee'},
  {id:'drita',title:'FURRË DRITA',line:'Bukë e ngrohtë · Çdo mëngjes',accent:'#d5a447',background:'#512f27',product:'bread'},
  {id:'lagjja',title:'MARKETI I LAGJES',line:'Të freskëta, pranë shtëpisë.',accent:'#8ca96e',background:'#233d38',product:'produce'},
  {id:'velo',title:'VELO TIRANA',line:'Lëviz lirshëm. Zbulo qytetin.',accent:'#db744c',background:'#253946',product:'bicycle'}
].map(Object.freeze));
export const stableHash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function distanceToSegment(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/l)):0;return Math.hypot(p.x-a[0]-dx*t,p.z-a[1]-dz*t);}
function validPoint(p){return Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);}
export function facadeSites(world,excluded=new Set()){
  const cells=new Map();for(const r of world.roads||[]){if(!validPoint(r.a)||!validPoint(r.b))continue;const pad=(Number(r.w)||6)/2+22;
    for(let x=Math.floor((Math.min(r.a[0],r.b[0])-pad)/128);x<=Math.floor((Math.max(r.a[0],r.b[0])+pad)/128);x++)for(let z=Math.floor((Math.min(r.a[1],r.b[1])-pad)/128);z<=Math.floor((Math.max(r.a[1],r.b[1])+pad)/128);z++){const k=`${x},${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(r);}}
  const result=[];
  for(const b of world.buildings||[]){
    // Leave named landmarks and authored replacement buildings unchanged.
    if(excluded.has(String(b.id))||b.name?.trim()||!Array.isArray(b.p)||b.p.length<3||b.p.some(p=>!validPoint(p)))continue;
    const p=b.p,area=p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v[0]*q[1]-q[0]*v[1];},0);if(Math.abs(area)<1)continue;
    const h=Number(b.h);if(!Number.isFinite(h)||h<6)continue;
    let best;
    for(let i=0;i<p.length;i++){const a=p[i],q=p[(i+1)%p.length],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);if(length<5)continue;
      const mid={x:(a[0]+q[0])/2,z:(a[1]+q[1])/2},nx=(area>0?dz:-dz)/length,nz=(area>0?-dx:dx)/length;
      const roads=cells.get(`${Math.floor(mid.x/128)},${Math.floor(mid.z/128)}`)||[];
      let distance=Infinity;for(const r of roads){const d=distanceToSegment(mid,r.a,r.b),out=distanceToSegment({x:mid.x+nx,z:mid.z+nz},r.a,r.b);if(out<d&&d>(Number(r.w)||0)/2+.3)distance=Math.min(distance,d);}
      if(distance>22)continue;
      const candidate={id:String(b.id),x:mid.x+nx*.045,z:mid.z+nz*.045,yaw:Math.atan2(nx||0,nz||0),width:Math.min(5.5,length-.8),height:h,distance,variant:stableHash(b.id)%AD_BRANDS.length};
      if(!best||distance<best.distance-1e-8||Math.abs(distance-best.distance)<=1e-8&&(candidate.x<best.x||candidate.x===best.x&&candidate.z<best.z))best=candidate;
    }if(best)result.push(best);
  }return result.sort((a,b)=>a.id.localeCompare(b.id));
}
/** Grid query avoids a world-wide sort each frame; chosen slots have a hard cap. */
export function createSiteIndex(sites,cellSize=128){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid spatial cell size');
  const cells=new Map();
  for(const input of sites){
    if(!input||![input.x,input.z].every(Number.isFinite))throw Error('Invalid facade site coordinate');
    const site=Object.freeze({...input,id:String(input.id)}),key=`${Math.floor(site.x/cellSize)},${Math.floor(site.z/cellSize)}`;
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(site);
  }
  return (viewer,radius=240,limit=48)=>{
    if(!viewer||![viewer.x,viewer.z,radius,limit].every(Number.isFinite)||radius<0||limit<1)return [];
    const hits=[],visit=list=>{for(const s of list||[]){const d=Math.hypot(s.x-viewer.x,s.z-viewer.z);if(d<=radius)hits.push({s,d});}};
    const x0=Math.floor((viewer.x-radius)/cellSize),x1=Math.floor((viewer.x+radius)/cellSize),z0=Math.floor((viewer.z-radius)/cellSize),z1=Math.floor((viewer.z+radius)/cellSize);
    // Sparse fallback keeps huge finite radii/coordinates from scanning empty cells
    // or entering a loop whose floating-point counter can no longer advance.
    if(![x0,x1,z0,z1].every(Number.isSafeInteger)||(x1-x0+1)*(z1-z0+1)>Math.max(1,cells.size*2)){
      for(const list of cells.values())visit(list);
    }else for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)visit(cells.get(`${x},${z}`));
    return hits.sort((a,b)=>a.d-b.d||a.s.id.localeCompare(b.s.id)).slice(0,Math.min(96,Math.floor(limit))).map(h=>h.s);
  };
}
