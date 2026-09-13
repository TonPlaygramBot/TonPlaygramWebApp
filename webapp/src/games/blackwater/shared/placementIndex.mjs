import {footprintDistance} from '../../tiranastreets/shared/architecture.mjs';

/** Static segment BVH; nearest results and source-order ties match the full scan. */
export function nearestRoadIndex(roads) {
  const bounds=items=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const v of items){minX=Math.min(minX,v.minX);maxX=Math.max(maxX,v.maxX);minZ=Math.min(minZ,v.minZ);maxZ=Math.max(maxZ,v.maxZ);}return {minX,maxX,minZ,maxZ};};
  const build=items=>{
    const b=bounds(items);
    if(items.length<=8)return {...b,items};
    const axis=b.maxX-b.minX>=b.maxZ-b.minZ?'X':'Z';
    items.sort(axis==='X'?(a,c)=>(a.minX+a.maxX)-(c.minX+c.maxX):(a,c)=>(a.minZ+a.maxZ)-(c.minZ+c.maxZ));
    const mid=items.length>>1;return {...b,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const tree=roads.length?build(roads.map((road,index)=>({road,index,minX:Math.min(road.a[0],road.b[0]),maxX:Math.max(road.a[0],road.b[0]),minZ:Math.min(road.a[1],road.b[1]),maxZ:Math.max(road.a[1],road.b[1])}))):null;
  return (x,z)=>{
    let best,distance=Infinity,order=Infinity;
    const lower=n=>Math.hypot(Math.max(n.minX-x,0,x-n.maxX),Math.max(n.minZ-z,0,z-n.maxZ));
    const visit=n=>{
      if(lower(n)>distance+1e-9)return;
      if(n.items){for(const {road:r,index} of n.items){
        const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],l=dx*dx+dz*dz;
        const t=l?Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/l)):0;
        const px=r.a[0]+dx*t,pz=r.a[1]+dz*t,d=Math.hypot(x-px,z-pz);
        if(d<distance||d===distance&&index<order){distance=d;order=index;best={x:px,z:pz,road:r,distance:d};}
      }}else{
        const a=lower(n.left),b=lower(n.right);if(a<=b){visit(n.left);visit(n.right);}else{visit(n.right);visit(n.left);}
      }
    };
    if(tree)visit(tree);return best;
  };
}

/** Conservative broad phase. Keep the existing polygon/hole and circle tests. */
export function placementObstacleIndex(obstacles,size=80) {
  const cells=new Map();
  const add=o=>{
    const radius=Math.hypot(o.w,o.d)/2;
    const xs=o.footprint?.map(p=>p[0]),zs=o.footprint?.map(p=>p[1]);
    const minX=xs?Math.min(...xs):o.x-radius,maxX=xs?Math.max(...xs):o.x+radius;
    const minZ=zs?Math.min(...zs):o.z-radius,maxZ=zs?Math.max(...zs):o.z+radius;
    for(let ix=Math.floor(minX/size);ix<=Math.floor(maxX/size);ix++)for(let iz=Math.floor(minZ/size);iz<=Math.floor(maxZ/size);iz++){
      const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);
    }
  };
  obstacles.forEach(add);
  return {add,clear(x,z,r=.5){
    const seen=new Set();
    for(let ix=Math.floor((x-r)/size);ix<=Math.floor((x+r)/size);ix++)for(let iz=Math.floor((z-r)/size);iz<=Math.floor((z+r)/size);iz++)for(const o of cells.get(ix+','+iz)||[]){
      if(seen.has(o))continue;seen.add(o);
      if(o.footprint?footprintDistance(x,z,o.footprint,o.holes)<r:Math.hypot(x-o.x,z-o.z)<Math.hypot(o.w,o.d)/2+r)return false;
    }
    return true;
  }};
}
