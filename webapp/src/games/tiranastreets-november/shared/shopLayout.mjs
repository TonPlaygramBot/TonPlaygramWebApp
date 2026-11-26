import {groundHeight} from '../../tirana-east/terrainCore.mjs';

/** One datum for the existing room and every collider. Elevated rooms retain
 * their map position; a central stair uses only their existing floor footprint. */
export function shopLayout(shop){
  const corners=[[-6.51,-10.51],[6.51,-10.51],[6.51,2.5],[-6.51,2.5]];
  const heights=corners.map(([x,z])=>groundHeight(shop.x+x,shop.z+z));
  const baseY=Math.max(...heights),lowY=Math.min(...heights)-baseY-.2;
  // A capsule meets the first riser before its centre crosses the threshold.
  // Include that half-metre approach when setting its first legal step height.
  const entranceY=Math.min(groundHeight(shop.x,shop.z+2.5),groundHeight(shop.x,shop.z+3))+.08,topY=baseY+.18;
  const rise=topY-entranceY,stairCount=rise>.28?Math.ceil(rise/.24):0;
  const stairRun=stairCount?Math.min(8,Math.max(1.2,stairCount*.36)):0;
  const landingZ=2.5-stairRun,boxes=[],extras=[];
  const add=(id,x,z,w,d,minY,h,extra=false)=>{
    const box={id:`${shop.id}-solid-${id}`,x,z,w,d,minY,h,baseY};boxes.push(box);
    if(extra)extras.push(box);
  };
  add(0,0,-10.4,13,.22,0,4);
  add(1,-6.4,-4,.22,13,0,4);
  add(2,6.4,-4,.22,13,0,4);
  add(3,0,-7.9,8,1.1,0,1.075);
  if(!stairCount)add(4,0,-4,13,13,0,.18);
  else{
    // Preserve the original floor outside the stair corridor and behind its
    // landing. A hidden full floor would otherwise block the stair from below.
    add('floor-left',-4.05,-4,4.9,13,lowY,.18,true);
    add('floor-right',4.05,-4,4.9,13,lowY,.18,true);
    add('floor-back',0,(-10.5+landingZ)/2,3.2,landingZ+10.5,lowY,.18,true);
    for(let i=0;i<stairCount;i++){
      const depth=stairRun/stairCount,top=entranceY+rise*(i+1)/stairCount-baseY;
      add(`step-${i}`,0,2.5-depth*(i+.5),3.2,depth,lowY,top,true);
    }
  }
  // The unchanged walls sit on a visible foundation rather than floating over
  // the downhill ground. The open front remains the only entrance.
  if(baseY>0)for(const wall of boxes.slice(0,3))add(`foundation-${wall.id.split('-solid-')[1]}`,wall.x,wall.z,wall.w,wall.d,lowY,0,true);
  const solids=boxes.map(b=>({id:b.id,baseY,minY:b.minY,h:b.h,
    minX:shop.x+b.x-b.w/2,maxX:shop.x+b.x+b.w/2,minZ:shop.z+b.z-b.d/2,maxZ:shop.z+b.z+b.d/2,
    p:[[shop.x+b.x-b.w/2,shop.z+b.z-b.d/2],[shop.x+b.x+b.w/2,shop.z+b.z-b.d/2],[shop.x+b.x+b.w/2,shop.z+b.z+b.d/2],[shop.x+b.x-b.w/2,shop.z+b.z+b.d/2]]}));
  const standingY=baseY+Math.max(...boxes.filter(b=>Math.abs(b.x)<=b.w/2&&Math.abs(b.z)<=b.d/2).map(b=>b.h));
  return {baseY,entranceY,standingY,stairCount,stairRun,landingZ,extras,solids};
}
