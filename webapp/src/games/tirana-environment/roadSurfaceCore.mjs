import clipping from 'polygon-clipping';

export function roadRing(road, width = road.w, extension = .06) {
  const [ax, az] = road.a, [bx, bz] = road.b;
  const length = Math.hypot(bx - ax, bz - az);
  if (length < .01 || !Number.isFinite(width) || width <= 0) return null;
  const ux = (bx - ax) / length, uz = (bz - az) / length;
  const nx = -uz * width / 2, nz = ux * width / 2;
  return [[ax-ux*extension+nx,az-uz*extension+nz], [bx+ux*extension+nx,bz+uz*extension+nz],
    [bx+ux*extension-nx,bz+uz*extension-nz], [ax-ux*extension-nx,az-uz*extension-nz]];
}

/** Index the complete carriageway, including neighbouring cells and bridges.
 * Walkways and building aprons subtract this same mask. No map points move. */
export function roadSurfaceIndex(roads, size = 64) {
  const bins = new Map();
  for (const road of roads) {
    if (road.walk || road.tunnel) continue;
    const ring = roadRing(road, road.w + .04, .1);
    if (!ring) continue;
    const item = {ring:snapRing(ring), bounds: bounds(ring)};
    const [x0,z0,x1,z1] = item.bounds;
    for (let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)
      for (let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++) {
        const key=`${x}:${z}`;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key).push(item);
      }
  }
  return polygon => {
    if (!polygon?.length) return [];
    const [x0,z0,x1,z1] = bounds(polygon[0]), candidates = new Set();
    for(let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)
      for(let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++)
        for(const item of bins.get(`${x}:${z}`)||[])
          if(item.bounds[0]<=x1&&item.bounds[2]>=x0&&item.bounds[1]<=z1&&item.bounds[3]>=z0)candidates.add(item);
    if(!candidates.size)return [polygon];
    if(polygon.length===1&&isConvex(polygon[0])){
      let parts=[polygon[0]];
      for(const item of candidates){parts=parts.flatMap(part=>subtractConvex(part,item.ring));if(!parts.length)break;}
      return parts.map(ring=>[ring]);
    }
    const snapped=polygon.map(snapRing).filter(r=>r.length>=3);if(!snapped.length)return [];
    const masks=[...candidates].map(c=>[c.ring]);
    try{return clipping.difference(snapped,...masks);}
    catch{
      // Coincident OSM edges can upset a multi-mask sweep. Sequential clipping
      // at the same millimetre precision retains the conservative road clearance.
      let result=[snapped];
      for(const mask of masks){if(!result.length)break;result=clipping.difference(result,mask);}
      return result;
    }
  };
}

export function bounds(ring) {
  let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  for(const [x,z] of ring){x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
  return [x0,z0,x1,z1];
}

/** Stable rectangular chunks clip at their boundary; no duplicate cell seams. */
export function splitRoadCells(roads, size = 240) {
  const cells = new Map();
  for(const road of roads){
    if(road.tunnel)continue;
    const ring=roadRing(road,road.w+(road.walk||road.bridge?0:3.8));if(!ring)continue;
    const [x0,z0,x1,z1]=bounds(ring);
    for(let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)for(let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++){
      const key=`${x}:${z}`;
      if(!cells.has(key))cells.set(key,{key,x:x*size+size/2,z:z*size+size/2,roads:[],bounds:[x*size,z*size,(x+1)*size,(z+1)*size]});
      cells.get(key).roads.push(road);
    }
  }
  return cells;
}

function snapRing(ring){
 const out=[];for(const p of ring){const q=p.map(n=>Math.round(n*1000)/1000),last=out.at(-1);if(!last||last[0]!==q[0]||last[1]!==q[1])out.push(q);}
 if(out.length>1&&out[0][0]===out.at(-1)[0]&&out[0][1]===out.at(-1)[1])out.pop();return out;
}
/** Convex rectangle clipping used by the cheap distant road mesh. */
export function clipRingToBounds(ring,box){
 let out=ring;
 for(const [axis,limit,sign] of [[0,box[0],1],[0,box[2],-1],[1,box[1],1],[1,box[3],-1]]){
  const input=out;out=[];if(!input.length)break;
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],insideA=(a[axis]-limit)*sign>=0,insideB=(b[axis]-limit)*sign>=0;
   if(insideA)out.push(a);
   if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
 }
 return out;
}

function signedArea(ring){return ring.reduce((n,a,i)=>{const b=ring[(i+1)%ring.length];return n+a[0]*b[1]-b[0]*a[1];},0)/2;}
function isConvex(ring){
 let sign=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)<1e-7)continue;if(sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross);}return true;
}
function halfPlane(ring,a,b,sign){
 const out=[],distance=p=>((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))*sign;
 for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],d=distance(p),e=distance(q);if(d>=0)out.push(p);if((d>=0)!==(e>=0)){const t=d/(d-e);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
 return out;
}
function subtractConvex(subject,mask){
 const outside=[],sign=signedArea(mask)>0?1:-1;let remaining=subject;
 for(let i=0;i<mask.length&&remaining.length>=3;i++){
  const a=mask[i],b=mask[(i+1)%mask.length],part=halfPlane(remaining,a,b,-sign);
  if(part.length>=3&&Math.abs(signedArea(part))>1e-8)outside.push(part);
  remaining=halfPlane(remaining,a,b,sign);
 }
 return outside;
}
