/** Visual typology, not a cadastral inventory. Dates never come from OSM edit time. */
export const housingSeed = id => Array.from(String(id)).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
export function housingEra(building,tags=building.tags||{}) {
  if (building.special || building.part || tags['building:part'] || tags.amenity || tags.office || tags.tourism || tags.historic || tags.construction || tags.building==='construction') return null;
  if (!['apartments','residential'].includes(tags.building)) return null;
  const date=tags.start_date||tags['building:year']||tags.year_of_construction;
  const year=typeof date==='string'&&/^\d{4}(?:$|[-s])/.test(date)?Number(date.slice(0,4)):null;
  if(year!==null&&(year<1945||year>1990))return null;
  const levels=Number(tags['building:levels'])||building.levels||building.h/3.2;
  const roof=tags['roof:shape']||building.roofShape;
  if(roof&&roof!=='flat')return null;
  if(!(building.h>=8&&building.h<=26&&levels>=3&&levels<=7))return null;
  const area=Math.abs(building.p.reduce((s,a,i)=>{const b=building.p[(i+1)%building.p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
  if(area<95)return null;
  return {era:'1945–1990',confidence:year===null?'typology-estimate':'source-date',year,
    basis:year===null?'Residential use, 3–7 levels and compatible roof; construction date unverified':`OSM construction date: ${date}`};
}
export function insideRoof(x,z,polygon,holes=[]) {
  const inside=p=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;};
  return inside(polygon)&&!holes.some(inside);
}
export function roofClearance(x,z,polygon,holes=[]) {
  if(!insideRoof(x,z,polygon,holes))return 0;
  let distance=Infinity;
  for(const ring of [polygon,...holes])for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return distance;
}
/** Spread 5–7 tanks inside the real roof; holes, setbacks and edges stay clear. */
export function rooftopTanks(b) {
  const seed=housingSeed(b.id),count=5+seed%3,candidates=[];
  const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
  const minX=Math.min(...xs),minZ=Math.min(...zs),maxX=Math.max(...xs),maxZ=Math.max(...zs);
  for(let x=minX+1;x<maxX;x+=1.7)for(let z=minZ+1;z<maxZ;z+=1.7)
    if(roofClearance(x,z,b.p,b.holes)>=1.05)candidates.push({x,z});
  const result=[];
  if(!candidates.length)return result;
  result.push(candidates.splice(seed%candidates.length,1)[0]);
  while(result.length<count&&candidates.length){
    let best=-1,score=-1;
    candidates.forEach((p,i)=>{const d=Math.min(...result.map(q=>Math.hypot(p.x-q.x,p.z-q.z)));if(d>score){score=d;best=i;}});
    if(score<1.7)break;
    result.push(candidates.splice(best,1)[0]);
  }
  return result.map((p,i)=>({...p,y:b.h,radius:.61,height:1.35+(seed+i)%3*.15,black:(seed+i)%3===0}));
}
