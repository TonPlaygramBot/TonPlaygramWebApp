import {kartPassingRoom,KART_WIDTH,KART_LENGTH} from './racingDimensions.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Evaluate both passing lanes before committing. Every rival sees the same
 * pre-step field; no player-distance speed boost or teleporting catch-up. */
export function planRacecraft(r,near,racers,time){
 const room=kartPassingRoom(near.width,r.bodyWidth),s=Math.sin(near.yaw),c=Math.cos(near.yaw);
 const traffic=racers.filter(o=>o!==r&&!o.finished&&!o.retired&&!o.disconnected).map(o=>{
  const dx=o.x-r.x,dz=o.z-r.z;
  return {other:o,ahead:dx*s+dz*c,lane:near.lane-dx*c+dz*s,
   gap:((r.bodyLength||KART_LENGTH)+(o.bodyLength||KART_LENGTH))*.5,
   width:((r.bodyWidth||KART_WIDTH)+(o.bodyWidth||KART_WIDTH))*.5+.35};
 }).filter(o=>o.ahead>-10&&o.ahead<55);
 const current=clamp(r.aiLane??near.lane,-room,room);
 const leader=traffic.filter(o=>o.ahead>0&&Math.abs(o.lane-current)<o.width).sort((a,b)=>a.ahead-b.ahead)[0];
 let lane=clamp((r.slot%2?1:-1)*Math.min(room,.65),-room,room),commit=r.aiPassUntil||0;
 if(commit>time)lane=clamp(r.aiPassLane??current,-room,room);
 if(leader&&leader.other.speed<r.speed+2){
  const choices=[-room,room,0].map(candidate=>{
   let cost=Math.abs(candidate-current)*.25;
   for(const o of traffic){
    // Occupied sides include a fast rival coming up from behind.
    const crossing=o.lane>=Math.min(current,candidate)-o.width&&o.lane<=Math.max(current,candidate)+o.width;
    if(crossing&&Math.abs(o.ahead)<o.gap+2.5)cost+=100;
    if(Math.abs(o.lane-candidate)<o.width&&o.ahead>0)cost+=Math.max(0,32-o.ahead)*2;
    if(o.ahead<0&&o.ahead>-8&&o.other.speed>r.speed+2&&Math.abs(o.lane-candidate)<o.width)cost+=80;
   }
   return {lane:candidate,cost};
  }).sort((a,b)=>a.cost-b.cost);
  // Hysteresis prevents weaving when two gaps have nearly the same score.
  if(commit<=time&&choices[0].cost<18){lane=choices[0].lane;commit=time+1.1;}
 }
 let speedLimit=Infinity,blocked=false;
 for(const o of traffic){
  if(o.ahead<=0||Math.abs(o.lane-current)>=o.width)continue;
  const free=Math.max(0,o.ahead-o.gap-1.0);
  const closing=Math.max(0,r.speed-o.other.speed);
  if(free<closing*.5+closing*closing/48+1.5){
   speedLimit=Math.min(speedLimit,Math.max(0,o.other.speed)+Math.max(0,free-1)*.65);
   if(free<1.1)blocked=true;
  }
 }
 return {lane,aiPassLane:lane,aiPassUntil:commit,speedLimit,blocked};
}
