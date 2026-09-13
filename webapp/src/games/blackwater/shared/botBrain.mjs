const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=p=>({x:p.x,z:p.z});
export function createBrain(id){return {id,target:null,lastSeen:null,seenAt:-100,acquiredAt:0,ammo:12,reserve:72,reload:0,medkit:true,healTime:0,heardAt:-100};}
const slot=(center,id,r)=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;const a=(h%16)*Math.PI/8;return {x:center.x+Math.sin(a)*r,z:center.z+Math.cos(a)*r};};

/** Only public mission state, visible opponents, timestamped reports and actual
 * sound events enter the brain. No hidden opponent position is used for goals. */
export function thinkBot(brain,self,opponents,now,dt,clear,objective,context={}) {
  dt=Math.max(0,Math.min(.25,dt));brain.reserve??=72;brain.healTime??=0;brain.heardAt??=-100;
  if(brain.reload>0){
    brain.reload=Math.max(0,brain.reload-dt);
    if(!brain.reload){const add=Math.min(12-brain.ammo,brain.reserve);brain.ammo+=add;brain.reserve-=add;}
  }
  const visible=opponents.filter(p=>p.hp>0&&distance(self,p)<65&&clear(self,p))
    .sort((a,b)=>distance(self,a)-distance(self,b)||a.id.localeCompare(b.id));
  const target=visible.find(p=>p.id===brain.target)||visible[0]||null;
  if(target){
    if(brain.target!==target.id)brain.acquiredAt=now;
    brain.target=target.id;brain.lastSeen=point(target);brain.seenAt=now;
  }else{
    brain.target=null;
    const report=(context.reports||[]).filter(r=>r.lastSeen&&now-r.seenAt<5&&r.seenAt>brain.seenAt).sort((a,b)=>b.seenAt-a.seenAt)[0];
    if(report){brain.lastSeen=point(report.lastSeen);brain.seenAt=report.seenAt;}
    const noise=context.noise;
    if(noise&&noise.at>brain.heardAt&&now-noise.at<2&&distance(self,noise)<38){brain.lastSeen=point(noise);brain.seenAt=noise.at;brain.heardAt=noise.at;}
  }
  if(brain.ammo<=0&&!brain.reload&&brain.reserve>0)brain.reload=2.2;
  const fire=!!target&&!brain.reload&&brain.ammo>0&&now-brain.acquiredAt>.6;
  const result=(state,goal,priority=false,extra={})=>({target,goal:point(goal),fire,state,priority,heal:0,pickup:null,...extra});
  if(context.mode==='last-stand'&&distance(self,objective)>Math.max(1,(context.zoneRadius??110)-8)){
    brain.healTime=0;
    return result('zone',slot(objective,self.id,Math.max(0,(context.zoneRadius??110)*.35)),true);
  }
  const covers=(context.covers||[]).filter(p=>distance(self,p)<24&&(!target||!clear(p,target)))
    .sort((a,b)=>distance(self,a)-distance(self,b));
  if(brain.medkit&&self.hp<40&&!target){
    const cover=covers[0];
    if(cover&&distance(self,cover)>1)return result('cover',cover,true,{fire:false});
    brain.healTime+=dt;
    if(brain.healTime>=1.8){brain.medkit=false;brain.healTime=0;return result('heal',self,true,{fire:false,heal:40});}
    return result('heal',self,true,{fire:false});
  }
  brain.healTime=0;
  if(brain.reload||target&&self.hp<30){
    const cover=covers[0];
    if(cover)return result('cover',cover,true,{fire:false});
    if(target){const d=distance(self,target)||1;return result('retreat',{x:self.x+(self.x-target.x)/d*8,z:self.z+(self.z-target.z)/d*8},true,{fire:false});}
  }
  if(brain.ammo===0&&brain.reserve===0){
    const loot=(context.loot||[]).filter(l=>l.ammo>0&&distance(self,l)<45&&clear(self,l)).sort((a,b)=>distance(self,a)-distance(self,b))[0];
    if(loot)return result('resupply',loot,true,{fire:false,pickup:distance(self,loot)<1.55?loot.id:null});
    return result('cover',covers[0]||self,true,{fire:false});
  }
  // Defenders contest the beacon and guard intel/extraction while the player
  // is out of sight. These are public mission locations, never hidden targets.
  const missionGoal=context.mode==='hold'?slot(objective,self.id,4)
    :context.mode==='extraction'?slot(context.intelCollected?context.extractionPoint||objective:context.intelPoint||objective,self.id,3):null;
  if(missionGoal&&distance(self,missionGoal)>2&&(!target||distance(self,target)>12))return result('objective',missionGoal,true);
  if(target)return result(brain.reload?'reload':distance(self,target)<28?'aim':'run',target);
  if(brain.lastSeen&&now-brain.seenAt<8&&distance(self,brain.lastSeen)>1.2)return result('search',brain.lastSeen,true);
  if(missionGoal)return result('guard',missionGoal,true);
  return result('patrol',context.mode?slot(objective,self.id+Math.floor(now/12),context.mode==='last-stand'?Math.min(20,(context.zoneRadius??110)*.4):14):objective,true);
}
