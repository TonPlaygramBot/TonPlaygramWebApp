/** Surface identity comes from a tag or a documented place, never road width. */
export function pavingProfile(tags={}) {
  const surface=tags.surface;
  if(['paving_stones','sett','cobblestone','paving_stones:30'].includes(surface))return {kind:surface==='paving_stones'?'stone-pavers':'setts',source:'OSM surface tag',verifiedMaterial:true};
  if(['asphalt','concrete','concrete:plates','compacted','gravel','grass','ground'].includes(surface))return {kind:surface,source:'OSM surface tag',verifiedMaterial:true};
  return {kind:'unknown',source:'No surface survey/tag; preserve existing material',verifiedMaterial:false};
}
export function insideRing(point,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function polygonHas(point,polygon){return insideRing(point,polygon[0])&&!polygon.slice(1).some(h=>insideRing(point,h));}
export function seededParkPoints(polygons,{spacing=12,limit=160,excluded=()=>false}={}){
  if(!Number.isFinite(spacing)||spacing<2||!Number.isInteger(limit)||limit<0||limit>4096)throw Error('Invalid vegetation budget');
  const out=[];let seed=6129,scanned=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(const polygon of polygons){const outer=polygon[0];if(!outer||outer.length<3)continue;const xs=outer.map(p=>p[0]),zs=outer.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
    if(![x0,x1,z0,z1].every(Number.isFinite)||(x1-x0)*(z1-z0)>1e8)continue;
    for(let z=z0+spacing/2;z<z1;z+=spacing)for(let x=x0+spacing/2;x<x1;x+=spacing){if(out.length>=limit||++scanned>20000)return out;const p=[x+(random()-.5)*spacing*.5,z+(random()-.5)*spacing*.5];if(polygonHas(p,polygon)&&!excluded(p[0],p[1]))out.push({x:p[0],z:p[1],scale:.85+random()*.3});}
  }return out;
}
export function roadCorridor(r,pad=0){if(!r||!Array.isArray(r.a)||!Array.isArray(r.b)||!Number.isFinite(r.w)||r.w<=0)return null;const [x,z]=r.a,[xx,zz]=r.b,dx=xx-x,dz=zz-z,len=Math.hypot(dx,dz);if(!Number.isFinite(len)||len<.01)return null;const d=r.w/2+pad,nx=dz/len*d,nz=-dx/len*d;return [[x+nx,z+nz],[xx+nx,zz+nz],[xx-nx,zz-nz],[x-nx,z-nz],[x+nx,z+nz]];}
export const PAVING_REFERENCES=Object.freeze([{id:'square',kind:'regional-natural-stone',source:'https://akt.gov.al/en/attractions/Skanderbeg-Square/',status:'Material family documented; tile pattern authored, not a surveyed texture map'}]);
