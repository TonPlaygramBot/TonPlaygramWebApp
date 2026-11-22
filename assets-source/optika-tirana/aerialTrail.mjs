// Local aerial waypoint challenge over public landmarks, not a real navigation system.
const MIN_CLEARANCE=7;
export const AIR_STOPS=Object.freeze([
  Object.freeze({label:'Mbi Sheshin Skënderbej',id:'square',y:21}),
  Object.freeze({label:'Mbi Kullën e Sahatit',id:'clock',y:24}),
  Object.freeze({label:'Mbi Piramidën',id:'pyramid',y:25})
]);
export function createAerialTrail(publicTrail){
  const stops=AIR_STOPS.map((spec,i)=>{
    const p=publicTrail.find(e=>e.id===spec.id);
    if(!p||![p.x,p.z].every(Number.isFinite))throw Error('Pika publike mungon.');
    return Object.freeze({...spec,x:p.x+(i===0?12:0),z:p.z});
  });
  let index=0,seconds=0;
  const state=()=>({index,total:stops.length,seconds,target:stops[index]??null,complete:index===stops.length});
  return Object.freeze({state,advance(position,dt){
    if(index>=stops.length||!Number.isFinite(dt)||dt<0)return state();
    seconds+=Math.min(dt,.1);
    const stop=stops[index];
    if([position?.x,position?.y,position?.z].every(Number.isFinite)&&
      Math.hypot(stop.x-position.x,stop.y-position.y,stop.z-position.z)<=MIN_CLEARANCE)index++;
    return state();
  }});
}
