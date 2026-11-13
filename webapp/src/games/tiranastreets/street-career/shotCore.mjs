import { rayBox, pointAlong } from './spatialCore.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';
/** Shared player/NPC cover and body hit test. Distances are metres. */
export function traceShot(world,from,direction,range,cars,actors){
  let hit=world.cast(from,direction,range,cars),target=null;
  for(const actor of actors){
    if(actor.health<=0||actor.kind==='dealer'||actor.motion==='drive')continue;
    const y=actor.y??groundHeight(actor.x,actor.z)+.08;
    const distance=rayBox(from,direction,{min:{x:actor.x-.3,y,z:actor.z-.3},max:{x:actor.x+.3,y:y+(actor.height||1.76),z:actor.z+.3}},hit.distance);
    if(distance!==null&&distance<hit.distance){target=actor;hit={distance,point:pointAlong(from,direction,distance),kind:'actor',objectId:actor.id};}
  }
  return {hit,target};
}
export function hitMultiplier(actor,point){
  const relative=point.y-(actor.y??groundHeight(actor.x,actor.z)+.08);
  return relative>1.45?1.65:relative<.65?.7:1;
}
