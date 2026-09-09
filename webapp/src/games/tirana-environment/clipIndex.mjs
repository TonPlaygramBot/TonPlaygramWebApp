/** Precompute polygon envelopes once. Original order is retained for clipping;
 * this changes startup work, never the mapped coordinates or material choices. */
export function createClipIndex(polygons,cellSize=128){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid clipping cell size');
  const entries=polygons.map((polygon,index)=>{
    const ring=polygon?.[0];if(!Array.isArray(ring)||!ring.length)throw Error('Missing clipping ring');
    const bounds=[Infinity,Infinity,-Infinity,-Infinity];
    for(const p of ring){if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1]))throw Error('Invalid clipping coordinate');bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);}
    return {polygon,index,bounds};
  });
  const cells=new Map(),large=[];
  for(const entry of entries){const b=entry.bounds,x0=Math.floor(b[0]/cellSize),x1=Math.floor(b[2]/cellSize),z0=Math.floor(b[1]/cellSize),z1=Math.floor(b[3]/cellSize);
    if((x1-x0+1)*(z1-z0+1)>4096){large.push(entry.index);continue;}
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x}:${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry.index);}
  }
  return bounds=>{
    if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>bounds[2]||bounds[1]>bounds[3])throw Error('Invalid clipping query');
    const x0=Math.floor(bounds[0]/cellSize),x1=Math.floor(bounds[2]/cellSize),z0=Math.floor(bounds[1]/cellSize),z1=Math.floor(bounds[3]/cellSize);
    const ids=new Set(large);
    if((x1-x0+1)*(z1-z0+1)>4096)entries.forEach(e=>ids.add(e.index));
    else for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const i of cells.get(`${x}:${z}`)||[])ids.add(i);
    return [...ids].sort((a,b)=>a-b).filter(i=>{const b=entries[i].bounds;return b[2]>=bounds[0]&&b[0]<=bounds[2]&&b[3]>=bounds[1]&&b[1]<=bounds[3];}).map(i=>entries[i].polygon);
  };
}
