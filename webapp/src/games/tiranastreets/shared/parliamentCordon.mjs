import {facadeEdges, segmentDistance} from '../../tirana-city-source/sourceCore.mjs';
import {forceWeaponFor} from './uploadedWeapons.mjs';
export const PARLIAMENT_BUILDING_ID = '256162012';
/** Authored game approaches around the mapped hall, not real security posts. */
export function parliamentApproaches(site) {
  const edges=facadeEdges(site.footprint).filter(e=>e.length>=6),used=new Set();
  return [[-1,0,'front'],[0,-1,'north'],[1,0,'courtyard'],[0,1,'south']].flatMap(([x,z,id])=>{
    const edge=edges.filter(e=>e.nx*x+e.nz*z>.6&&!used.has(e))
      .sort((a,b)=>(b.x*x+b.z*z+b.length*.8)-(a.x*x+a.z*z+a.length*.8))[0];
    if(!edge)return [];used.add(edge);return [{...edge,id}];
  });
}
export function createParliamentCordon(site,collide,nearbyRoads,occupied=[]) {
  const result=[];
  for(const edge of parliamentApproaches(site)){
    const count=Math.min(6,Math.floor((edge.length-1.2)/1.1));let line;
    // Search whole rows so collision corrections cannot scatter the officers.
    search: for(const lateral of [0,-5,5,-10,10,-16,16,-24,24])for(const distance of [1.2,2,2.8,4.4,6,8,10,14]){
      const posts=Array.from({length:count},(_,i)=>{
        const u=edge.length/2+lateral+(i-(count-1)/2)*1.1;
        return {x:edge.a[0]+edge.ux*u+edge.nx*distance,z:edge.a[1]+edge.uz*u+edge.nz*distance};
      });
      if(posts.some(post=>{
        const probe={...post};collide(probe,.45);
        return Math.hypot(probe.x-post.x,probe.z-post.z)>.05||
          nearbyRoads(post.x,post.z).some(r=>!r.walk&&segmentDistance(post.x,post.z,r.a,r.b)<r.w/2+.65)||
          [...occupied,...result].some(n=>(n.x-post.x)**2+(n.z-post.z)**2<1);
      }))continue;
      line=posts;break search;
    }
    if(!line)continue;
    line.forEach((post,i)=>{
      const forceCharacter=(edge.id==='front'||edge.id==='courtyard')?'fnsh_officer':'shqiponja_officer';
      const heading=Math.atan2(-edge.nx,-edge.nz);
      result.push({...post,id:`parliament-cordon-${edge.id}-${i}`,kind:'police',role:'institution-guard',
        institution:site.buildingId,securityTier:3,cordon:edge.id,guardPost:{...post,heading},heading,
        forceCharacter,weapon:forceWeaponFor(forceCharacter,i),motion:'idle',anim:'idle',
        speed:0,health:100,nextShot:0,downUntil:0,panicUntil:0});
    });
  }
  return result;
}
/** Increase the bounded visual allowance only while visiting the cordon. */
export function forcePersonBudget(people,battery,lodReady=true){
  return lodReady&&people.some(c=>c.entity.cordon&&c.distance<95)?(battery?26:28):(battery?8:16);
}
export function forcePoseInterval(distance,anim,moving,cordon){
  if(distance<35&&(moving||!cordon||!['idle','walk'].includes(anim)))return 0;
  return distance<85?.05:.1;
}
