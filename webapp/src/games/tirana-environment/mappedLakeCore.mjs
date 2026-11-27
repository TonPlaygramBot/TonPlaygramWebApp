export const LAKE_PROFILES = Object.freeze({
 'way/249196321':Object.freeze({name:'Liqeni Artificial i Tiranës',color:0x59756e,shore:0x737652,resolution:256,range:23}),
 'way/466431832':Object.freeze({name:'Liqeni i Thatë',color:0x686f56,shore:0x817047,resolution:144,range:13})
});

export function selectMappedLakes(sources) {
 return Object.entries(LAKE_PROFILES).flatMap(([id,profile]) => {
  const area=sources.find(p=>p.id===id);
  const polygons=(area?.polygons||[]).filter(p=>p.outer.length>=3&&p.outer.every(v=>Number.isFinite(v[0])&&Number.isFinite(v[1])));
  return polygons.length?[{id,source:area.source,profile,polygons}]:[];
 });
}

// Rasterize distance only near source edges. Pixels beyond the measured band
// remain saturated; work scales with narrow edge bounds, not every pixel×edge.
export function lakeShoreTexture(polygons, size, range) {
 const rings=polygons.flatMap(p=>[p.outer,...(p.holes||[])]), points=rings.flat();
 const minX=Math.min(...points.map(p=>p[0]))-range, minZ=Math.min(...points.map(p=>p[1]))-range;
 const width=Math.max(...points.map(p=>p[0]))+range-minX, depth=Math.max(...points.map(p=>p[1]))+range-minZ;
 const px=width/size,pz=depth/size, data=new Uint8Array(size*size).fill(255);
 for(const ring of rings) for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz;
  if(!den)continue;
  const left=Math.max(0,Math.floor((Math.min(a[0],b[0])-range-minX)/px));
  const right=Math.min(size-1,Math.ceil((Math.max(a[0],b[0])+range-minX)/px));
  const top=Math.max(0,Math.floor((Math.min(a[1],b[1])-range-minZ)/pz));
  const bottom=Math.min(size-1,Math.ceil((Math.max(a[1],b[1])+range-minZ)/pz));
  for(let iz=top;iz<=bottom;iz++)for(let ix=left;ix<=right;ix++){
   const x=minX+(ix+.5)*px-a[0],z=minZ+(iz+.5)*pz-a[1];
   const t=Math.max(0,Math.min(1,(x*dx+z*dz)/den));
   const d=Math.min(255,Math.round(Math.hypot(x-dx*t,z-dz*t)*255/range));
   const j=iz*size+ix;
   data[j]=Math.min(data[j],d);
  }
 }
 return {data,minX,minZ,width,depth};
}
