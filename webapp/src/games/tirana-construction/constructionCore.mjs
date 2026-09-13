/** Source classification is independent of the authored construction stage. */
export function isConstruction(b) {
 const t=b.tags||{};
 return t.building==='construction'||!!(t.construction&&!['no','false','0'].includes(t.construction));
}
export function constructionSeed(id){let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function insideFootprint(p,b){
 const inRing=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a[1]>p[1])!==(c[1]>p[1])&&p[0]<(c[0]-a[0])*(p[1]-a[1])/(c[1]-a[1])+a[0])inside=!inside;}return inside;};
 return inRing(b.p)&&!(b.holes||[]).some(inRing);
}
export function constructionProfile(b){
 if(!isConstruction(b)||!b.p?.length||!Number.isFinite(b.h)||b.h<=0)return null;
 const seed=constructionSeed(b.id),low=b.minHeight||0,height=Math.max(.1,b.h-low);
 const floors=Math.max(1,Math.min(64,Math.round(height/3.2)));
 return {seed,stage:b.constructionStage||['frame','infill','unfinished'][seed%3],floors,pitch:height/floors,low,height};
}
/** A small interior equipment pad; every corner must remain inside the source
 * polygon, including courtyard exclusions. Narrow sites receive no equipment. */
export function equipmentPad(b){
 const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 for(const ix of [3,2,4,1,5])for(const iz of [3,2,4,1,5]){
  const x=minX+(maxX-minX)*ix/6,z=minZ+(maxZ-minZ)*iz/6;
  if([[-4,-5],[-4,5],[4,-5],[4,5],[0,0]].every(([dx,dz])=>insideFootprint([x+dx,z+dz],b)))return {x,z};
 }
 return null;
}
