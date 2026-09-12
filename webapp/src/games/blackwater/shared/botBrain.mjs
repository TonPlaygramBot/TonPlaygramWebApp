const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createBrain(id){return {id,target:null,lastSeen:null,seenAt:-100,acquiredAt:0,ammo:12,reload:0,medkit:true};}
/** Observations are supplied by collision queries. No hidden player coordinates
 * are retained or used after the observation expires. */
export function thinkBot(brain,self,opponents,now,dt,clear,objective) {
  if(brain.reload>0){brain.reload=Math.max(0,brain.reload-dt);if(!brain.reload)brain.ammo=12;}
  if(brain.ammo<=0&&!brain.reload)brain.reload=2.2;
  const visible=opponents.filter(p=>p.hp>0&&distance(self,p)<65&&clear(self,p))
    .sort((a,b)=>distance(self,a)-distance(self,b));
  const target=visible.find(p=>p.id===brain.target)||visible[0];
  if(target){
    if(brain.target!==target.id){brain.acquiredAt=now;brain.target=target.id;}
    brain.lastSeen={x:target.x,z:target.z};brain.seenAt=now;
    return {target,goal:target,fire:!brain.reload&&brain.ammo>0&&now-brain.acquiredAt>.6,
      state:brain.reload||self.hp<30?'cover':distance(self,target)<28?'aim':'run'};
  }
  brain.target=null;
  return {target:null,goal:brain.lastSeen&&now-brain.seenAt<8?brain.lastSeen:objective,fire:false,state:'search'};
}
