import clipping from 'polygon-clipping';

function closed(ring) {
  const first=ring[0],last=ring.at(-1);
  return first && (first[0]!==last[0] || first[1]!==last[1])?[...ring,first]:ring;
}

function bounds(ring) {
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  for (const [x,z] of ring) {
    minX=Math.min(minX,x); maxX=Math.max(maxX,x);
    minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z);
  }
  return [minX,minZ,maxX,maxZ];
}

function snapRing(ring) {
  const out=[];
  for(const point of ring) {
    const [x,y]=point.map(n=>Math.round(n*1000)/1000),prev=out.at(-1);
    if (!prev || x!==prev[0] || y!==prev[1])out.push([x,y]);
  }
  if(out.length>1&&out[0][0]===out.at(-1)[0]&&out[0][1]===out.at(-1)[1])out.pop();
  return new Set(out.map(p=>p.join(','))).size>=3?closed(out):null;
}

export function clipParkSurfaces(parkRings, cutRings) {
  const cuts=cutRings.filter(p=>p.length>=3).map(p=>({ring:closed(p),box:bounds(p)}));
  const polygons=[],failures=[];
  let retries=0;
  for(const [index,ring] of parkRings.entries()){
    if(ring.length<3)continue;
    const [x,z,xx,zz]=bounds(ring);
    const nearby=cuts.filter(({box:[a,b,c,d]})=>a<=xx&&b<=zz&&c>=x&&d>=z).map(({ring})=>ring);
    const park=closed(ring);
    if(!nearby.length){polygons.push([park]);continue;}
    try {
      polygons.push(...clipping.difference([park],...nearby.map(p=>[p])));
    } catch {
      // Retry only the problematic polygon on a millimetre grid. Keep every
      // successful park; never fall back to an uncut surface across a road.
      retries++;
      try {
        const fixed=snapRing(park);
        if(!fixed)throw Error('Degenerate source polygon');
        polygons.push(...clipping.difference([fixed],...nearby.map(snapRing).filter(Boolean).map(p=>[p])));
      } catch(e) {
        failures.push({index,message:String(e)});
      }
    }
  }
  return {polygons, failures, retries};
}
