// All units are local metres. This module only supports peaceful free-roam.
import {stepBicycle} from './cityBicycle.mjs';
const CELL=40, WALK=.33;
const clamp=(value,a,b)=>Math.min(b,Math.max(a,value));
const moveToward=(value,target,step)=>value+clamp(target-value,-step,step);
export function edgeDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
  const t=len?clamp(((x-a[0])*dx+(z-a[1])*dz)/len,0,1):0;
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
const bikeClear=(bike,x,z,r)=>!bike||Math.hypot(x-bike.x,z-bike.z)>r+.86;
function touches(x,z,pad,p){
  let inside=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[j],b=p[i];
    if(edgeDistance(x,z,a,b)<=pad)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function index(records,bounds){
  const grid=new Map();
  for(const item of records){
    const [x0,z0,x1,z1]=bounds(item);
    for(let x=Math.floor(x0/CELL);x<=Math.floor(x1/CELL);x++)for(let z=Math.floor(z0/CELL);z<=Math.floor(z1/CELL);z++){
      const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);
    }
  }
  return (x,z)=>grid.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[];
}
const polygonBounds=p=>[Math.min(...p.map(v=>v[0]))-3,Math.min(...p.map(v=>v[1]))-3,Math.max(...p.map(v=>v[0]))+3,Math.max(...p.map(v=>v[1]))+3];
const lineBounds=({a,b,w})=>[Math.min(a[0],b[0])-w/2-3,Math.min(a[1],b[1])-w/2-3,Math.max(a[0],b[0])+w/2+3,Math.max(a[1],b[1])+w/2+3];
export const sedanSamples=(x,z,yaw)=>{
  const dx=Math.sin(yaw)*1.30,dz=Math.cos(yaw)*1.30;
  return [[x,z],[x+dx,z+dz],[x-dx,z-dz]];
};
export function buildMobility(city,priorSpawn){
  const regions=city.regions||[city.bounds];
  const admitted=(x,z)=>regions.some(([minX,minZ,maxX,maxZ])=>x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ);
  const fits=(x,z,r)=>admitted(x,z)&&admitted(x-r,z-r)&&admitted(x-r,z+r)&&admitted(x+r,z-r)&&admitted(x+r,z+r);
  const buildings=index([...city.buildings.map(b=>b.p),...city.markings.map(m=>m.footprint)].filter(p=>Array.isArray(p)&&p.length>=3),polygonBounds);
  const bridges=index(city.roads.filter(r=>r.bridge),lineBounds);
  const roads=index(city.roads.filter(r=>!r.walk&&r.w>=3.5),lineBounds);
  const waterAreas=index(city.water.filter(w=>w.p).map(w=>w.p),polygonBounds);
  const waterLines=index(city.water.filter(w=>!w.p),lineBounds);
  const obstructed=(x,z,r)=>{
    if(!fits(x,z,r)||buildings(x,z).some(p=>touches(x,z,r,p)))return true;
    if(bridges(x,z).some(b=>edgeDistance(x,z,b.a,b.b)<b.w/2-r))return false;
    return waterAreas(x,z).some(p=>touches(x,z,r,p))||waterLines(x,z).some(w=>edgeDistance(x,z,w.a,w.b)<=w.w/2+r);
  };
  const road=(x,z,r)=>roads(x,z).some(w=>edgeDistance(x,z,w.a,w.b)<=w.w/2-r);
  const validCar=(x,z,yaw)=>sedanSamples(x,z,yaw).every(([px,pz])=>!obstructed(px,pz,1.02)&&road(px,pz,.7));
  const validBike=(x,z,pad)=>!obstructed(x,z,pad)&&road(x,z,pad);
  if(priorSpawn)return {obstructed,validCar,validBike,spawn:priorSpawn};
  const point=city.spawnAnchor||city.landmarks.find(p=>p.id==='square')||{x:0,z:0};
  // Find a genuine nearby mapped road section with clear room for the parked car and a foot start.
  const spots=city.roads.filter(r=>!r.walk&&!r.bridge&&r.w>=4&&Math.hypot(r.a[0]-r.b[0],r.a[1]-r.b[1])>=7).flatMap(r=>{
    const [x,z]=[(r.a[0]+r.b[0])/2,(r.a[1]+r.b[1])/2],yaw=Math.atan2(r.b[0]-r.a[0],r.b[1]-r.a[1]);
    if(!validCar(x,z,yaw))return[];
    const footX=x+Math.cos(yaw)*2.75,footZ=z-Math.sin(yaw)*2.75;
    return obstructed(footX,footZ,WALK)?[]:[{x,z,yaw,footX,footZ,distance:Math.hypot(x-point.x,z-point.z)}];
  }).sort((a,b)=>a.distance-b.distance);
  if(!spots.length)throw new Error('No public starting area was found.');
  const spawn=spots[0];
  if(city.spawnAnchor&&!obstructed(point.x,point.z,WALK)){spawn.footX=point.x;spawn.footZ=point.z;}
  return {obstructed,validCar,validBike,spawn};
}
export function initialState(mobility){
  const {x,z,yaw,footX,footZ}=mobility.spawn;
  return {x:footX,z:footZ,yaw:Math.atan2(x-footX,z-footZ),mode:'walk',walkY:0,walkVy:0,walkSpeed:0,car:{x,z,yaw,speed:0,wheel:0,steer:0}};
}
export function vehicleAction(state,mobility){
  const {car}=state;
  if(state.ride==='bike')return 'Zbrit nga biçikleta së pari.';
  if(state.mode==='walk'){
    if(Math.hypot(state.x-car.x,state.z-car.z)>4)return 'Afrohu te makina.';
    state.walkY=0;state.walkVy=0;state.walkSpeed=0;state.mode='drive';state.x=car.x;state.z=car.z;state.yaw=car.yaw;return '';
  }
  if(Math.abs(car.speed)>.44)return 'Ndal makinën para se të dalësh.';
  for(const dist of [2.2,-2.2,3,-3]){
    const x=car.x+Math.cos(car.yaw)*dist,z=car.z-Math.sin(car.yaw)*dist;
    if(mobility.obstructed(x,z,WALK)||!bikeClear(state.bike,x,z,WALK))continue;
    state.x=x;state.z=z;state.yaw=car.yaw;state.mode='walk';car.speed=0;return '';
  }
  return 'Nuk ka hapësirë të sigurt për të dalë.';
}
export function stepRoam(state,mobility,input,seconds){
  const dt=clamp(seconds,0,1/30);
  const x=clamp(input.x||0,-1,1),y=clamp(input.y||0,-1,1),{car}=state;
  if(state.ride==='bike'){stepBicycle(state,mobility,input,dt);return;}
  if(state.mode==='drive'){
    const target=input.brake?0:y>=0?y*11:y*3.3;
    car.speed=moveToward(car.speed,target,(input.brake?9:y?4.4:2.8)*dt);
    car.steer=moveToward(car.steer,x,dt*3.8);
    const yaw=car.yaw+car.steer*clamp(car.speed/4,-1,1)*1.18*dt;
    const nextX=car.x+Math.sin(yaw)*car.speed*dt,nextZ=car.z+Math.cos(yaw)*car.speed*dt;
    if(mobility.validCar(nextX,nextZ,yaw)&&sedanSamples(nextX,nextZ,yaw).every(([a,b])=>bikeClear(state.bike,a,b,1.02))){car.x=nextX;car.z=nextZ;car.yaw=yaw;car.wheel+=car.speed*dt/.32;}
    else car.speed=0;
    state.x=car.x;state.z=car.z;state.yaw=car.yaw;
  }else{
    if(input.jump&&state.walkY===0){state.walkVy=3.95;}
    if(state.walkVy!==0||state.walkY>0){
      state.walkVy-=12*dt;state.walkY=Math.max(0,state.walkY+state.walkVy*dt);
      if(state.walkY===0)state.walkVy=0;
    }
    const beforeX=state.x,beforeZ=state.z;
    const speed=(input.brake?4.25:2.55)*dt/Math.max(1,Math.hypot(x,y));
    const dx=(Math.sin(state.yaw)*y+Math.cos(state.yaw)*x)*speed;
    const dz=(Math.cos(state.yaw)*y-Math.sin(state.yaw)*x)*speed;
    const clear=(x,z)=>!mobility.obstructed(x,z,WALK)&&bikeClear(state.bike,x,z,WALK)&&sedanSamples(car.x,car.z,car.yaw).every(([a,b])=>Math.hypot(x-a,z-b)>1.02+WALK);
    if(clear(state.x+dx,state.z))state.x+=dx;
    if(clear(state.x,state.z+dz))state.z+=dz;
    state.walkSpeed=dt>0?Math.hypot(state.x-beforeX,state.z-beforeZ)/dt:0;
    state.walkYaw=state.walkSpeed>.22?Math.atan2(state.x-beforeX,state.z-beforeZ):state.yaw;
  }
}
