// Original Tirana bikeCatalog.mjs at 871f3c38: project-authored CC0 city bicycle.
export const BICYCLE=Object.freeze({
  url:'/assets/tirana-city-game/mobility/city-bicycle.glb',length:1.79,width:.74,speed:4.2
});
const pad=BICYCLE.width/2;
const limit=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(value,to,delta)=>value+limit(to-value,-delta,delta);
const offset=(x,z,yaw,dist)=>[x+Math.sin(yaw)*dist,z+Math.cos(yaw)*dist];
const carClear=(x,z,car,padding)=>[0,1.3,-1.3].every(d=>{
  const [a,b]=offset(car.x,car.z,car.yaw,d);
  return Math.hypot(x-a,z-b)>1.02+padding;
});

export function findParkedBicycle(state,mobility){
  const c=state.car;
  for(const d of [-5,5,-7,7,-10,10]){
    const [x,z]=offset(c.x,c.z,c.yaw,d);
    const yaw=d<0?c.yaw+Math.PI:c.yaw;
    if(canRideBicycle(state,mobility,x,z,yaw))return {x,z,yaw,speed:0,steer:0,wheel:0};
  }
}

export function canRideBicycle(state,mobility,x,z,yaw){
  return [0,-.55,.55].every(d=>{
    const [a,b]=offset(x,z,yaw,d);
    return mobility.validBike(a,b,pad)&&carClear(a,b,state.car,pad);
  });
}

export function bicycleAction(state,mobility){
  const b=state.bike;
  if(!b)return 'Biçikleta nuk është gati.';
  if(state.ride==='bike'){
    if(Math.abs(b.speed)>.25)return 'Freno para se të zbresësh.';
    for(const d of [.95,-.95,1.35,-1.35]){
      const [x,z]=offset(b.x,b.z,b.yaw+Math.PI/2,d);
      if(mobility.obstructed(x,z,.33)||!carClear(x,z,state.car,.33))continue;
      b.speed=0;b.steer=0;state.ride=undefined;state.mode='walk';state.x=x;state.z=z;return '';
    }
    return 'Nuk ka hapësirë të sigurt për të zbritur.';
  }
  if(state.mode!=='walk'||state.walkY>0||Math.hypot(state.x-b.x,state.z-b.z)>2.25)return 'Afrohu te biçikleta.';
  state.ride='bike';state.mode='drive';state.x=b.x;state.z=b.z;state.yaw=b.yaw;
  state.walkVy=0;state.walkY=0;state.walkSpeed=0;
  return '';
}

export function stepBicycle(state,mobility,input,dt){
  const b=state.bike;
  const steer=limit(input.x||0,-1,1),throttle=limit(input.y||0,0,1);
  b.speed=lerp(b.speed,!input.brake?throttle*BICYCLE.speed:0,(input.brake||input.y<0?6:throttle?2.3:1.6)*dt);
  b.steer=lerp(b.steer,steer,3.5*dt);
  const yaw=b.yaw+b.steer*limit(b.speed/2.5,0,1)*1.8*dt;
  const [x,z]=offset(b.x,b.z,yaw,b.speed*dt);
  if(canRideBicycle(state,mobility,x,z,yaw)){
    b.x=x;b.z=z;b.yaw=yaw;b.wheel+=b.speed*dt/.335;
  }else b.speed=0;
  state.x=b.x;state.z=b.z;state.yaw=b.yaw;
}
