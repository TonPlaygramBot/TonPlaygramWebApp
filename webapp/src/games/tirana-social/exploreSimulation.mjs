import * as city from '../tiranastreets/shared/engine.mjs';
import {collideDetailPosts} from '../tirana-street-detail/sharedRoadDetails.mjs';
function peaceful(s) {
  s.units=[];s.effects=[];
  s.npcs=s.npcs.filter(n=>['civilian','dealer'].includes(n.kind));
  for(const p of Object.values(s.players)){p.weapon='';p.inventory={};p.cash=0;p.wanted=0;p.health=100;p.armor=0;p.kills=0;p.failed=false;p.finished=false;if(p.input)p.input.fire=false;}
  for(const n of s.npcs){n.weapon=null;n.health=100;n.downUntil=0;}
}
/** Same mapped roads, driving and fixed timestep, with all combat/economy removed. */
export const exploreSimulation={...city,
  createState(members){const s=city.createState(members,'free-roam','explore');peaceful(s);return s;},
  advanceState(s,seconds){
    for(let left=Math.max(0,Math.min(.2,seconds));left>0;){const dt=Math.min(1/60,left);peaceful(s);city.stepState(s,dt);peaceful(s);
      for(const p of Object.values(s.players)){const car=p.carId?s.cars.find(c=>c.id===p.carId):null;if(collideDetailPosts(car||p,car?1.35:.34)){if(car){car.speed=car.vx=car.vz=0;p.x=car.x;p.z=car.z;}p.speed=0;}}
      left-=dt;
    }
  }
};
