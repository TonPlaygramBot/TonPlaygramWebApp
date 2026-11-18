import {buildingProfile,polygonContains} from '../tiranastreets/shared/architecture.mjs';
/** Original footprint edges are the only placement authority. No block is moved,
 * rectangularized or renamed to match a generic source building. */
export function realisticFacadeLayout(world,excluded=new Set(),clearance){
  const buildings=[];
  for(const b of world.buildings){
    if(b.special||b.neighbourhood||excluded.has(String(b.id)))continue;
    const profile=buildingProfile(b),height=profile.height??b.h;
    if(profile.style!=='residential'||height<7||height>36)continue;
    const placements=[];let incomplete=false;
    const seed=Array.from(String(b.id)).reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7);
    for(let edge=0;edge<b.p.length;edge++){
      const a=b.p[edge],end=b.p[(edge+1)%b.p.length],dx=end[0]-a[0],dz=end[1]-a[1],length=Math.hypot(dx,dz);
      if(length<2.5)continue;
      if(length>90){incomplete=true;continue;}
      const ux=dx/length,uz=dz/length;
      let nx=-uz,nz=ux;
      if(polygonContains((a[0]+end[0])/2+nx*.2,(a[1]+end[1])/2+nz*.2,b.p)){nx=-nx;nz=-nz;}
      const columns=Math.max(1,Math.round(length/3.2)),width=length/columns;
      const floors=Math.max(2,Math.round(height/3.2)),floorHeight=height/floors;
      for(let floor=0;floor<floors;floor++)for(let column=0;column<columns;column++){
        const d=(column+.5)*width,x=a[0]+ux*d,z=a[1]+uz*d;
        // Facade depth goes outward over the sidewalk, never the race ribbon.
        if(clearance?.(x+nx*.45,z+nz*.45,.3)){incomplete=true;continue;}
        placements.push({x:x+nx*.035,y:floor*floorHeight,z:z+nz*.035,yaw:Math.atan2(nx,nz),width,height:floorHeight,
          variant:floor===0&&column===Math.floor(columns/2)?'door':(seed+column+floor)%4===0?'large':(seed+column+floor)%3===0?'alternate':'window',edge,floor,column});
      }
    }
    if(incomplete||!placements.length||placements.length>300)continue;
    const x=b.p.reduce((sum,p)=>sum+p[0],0)/b.p.length,z=b.p.reduce((sum,p)=>sum+p[1],0)/b.p.length;
    buildings.push({id:String(b.id),x,z,placements});
  }
  return buildings;
}
/** Whole-building admission avoids partially disappearing fallback facades. */
export function selectRealisticFacades(buildings,viewer,battery=false){
  const radius=battery?95:165,budget=battery?160:480;
  const sorted=buildings.map(b=>({b,d:Math.hypot(b.x-viewer.x,b.z-viewer.z)})).filter(v=>v.d<radius).sort((a,b)=>a.d-b.d||a.b.id.localeCompare(b.b.id));
  const selected=[];let used=0;
  for(const {b} of sorted){if(used+b.placements.length>budget)continue;selected.push(b);used+=b.placements.length;}
  return selected;
}
