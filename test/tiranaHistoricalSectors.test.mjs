import test from 'node:test';
import assert from 'node:assert/strict';
import {readHistoricBundle} from '../webapp/scripts/materialize-tirana-historic.mjs';
import {buildMobility,initialState,stepRoam,vehicleAction} from '../webapp/src/games/tirana-standalone/walkDrive.mjs';
import {combineHistoric,desiredSectors,gridBounds,gridKey,HISTORIC_MAX} from '../webapp/src/games/tirana-standalone/historicGrid.mjs';
const archive=await readHistoricBundle();
const read=k=>JSON.parse(archive.get(k+'.json').text);
const meta=read('start'),keys=new Set(meta.keys);
const one={...combineHistoric(meta,[meta.first]),spawnAnchor:meta.spawn};
const before=buildMobility(one);
test('verified pre-removal city bounds and spawn restored; cold transfer is smaller than the slim extract',()=>{
  assert.equal(meta.historical,'871f3c38c512084c495eeaa0811b0788d62c751b');
  assert.deepEqual(meta.bounds,[-5000,-3500,3600,3100]);assert.equal(keys.size,420);assert.equal(HISTORIC_MAX,9);
  assert.deepEqual(meta.spawn,{x:-59.39,z:126.25});
  assert.ok(Buffer.byteLength(archive.get('start.json').text)<100_000);
  assert.equal(meta.first.key,gridKey(meta.spawn.x,meta.spawn.z));
  const state=initialState(before);
  assert.equal(state.mode,'walk');assert.deepEqual({x:state.x,z:state.z},meta.spawn);
  assert.ok(Math.hypot(state.x-state.car.x,state.z-state.car.z)<75);
  const [gx,gz]=[state.car.x,state.car.z];
  const checked=new Set(),todo=[[state.x,state.z,[]]];
  let path=null;
  for(let i=0;i<todo.length&&i<25_000;i++){
    const [x,z,steps]=todo[i];
    if(Math.hypot(x-gx,z-gz)<3){path=steps;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next=[x+dx,z+dz],key=next.map(v=>v.toFixed(1)).join(',');
      if(checked.has(key)||Math.hypot(x-meta.spawn.x,z-meta.spawn.z)>98||before.obstructed(...next,.52)||before.obstructed(x+dx/2,z+dz/2,.52))continue;
      checked.add(key);todo.push([...next,[...steps,next]]);
    }
  }
  assert.ok(path,'No accessible foot route from historical spawn to parked sedan');
  for(const [x,z] of path){
    for(let i=0;i<28;i++){
      const remaining=Math.hypot(x-state.x,z-state.z);
      if(remaining<.01)break;
      state.yaw=Math.atan2(x-state.x,z-state.z);
      stepRoam(state,before,{x:0,y:Math.min(1,remaining/(2.55/60))},1/60);
    }
    assert.ok(Math.hypot(x-state.x,z-state.z)<.08,'Waypoint not reached '+[x,z,state.x,state.z]);
  }
  assert.equal(vehicleAction(state,before),'');
  const begin=[state.x,state.z];
  for(let i=0;i<30;i++)stepRoam(state,before,{x:0,y:1},1/60);
  assert.ok(Math.hypot(state.x-begin[0],state.z-begin[1])>.15);
});
test('neighbor data makes a named historic first-sector boundary physically traversable, not just atlas scenery',()=>{
  const sectors=meta.keys.filter(k=>k!==meta.first.key).filter(k=>{
    const a=k.split('_').map(Number),b=meta.first.key.split('_').map(Number);
    return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;
  });
  let walkCrossings=0,driveCrossings=0;
  for(const key of sectors){
    const tile=read(key),world=buildMobility(combineHistoric(meta,[meta.first,tile]),before.spawn);
    const a=meta.first.bounds,b=tile.bounds,ex=b[0]===a[2]?a[2]:b[2]===a[0]?a[0]:null;
    const ez=ex===null?(b[1]===a[3]?a[3]:a[1]):null;
    const positive=ex!==null?b[0]>a[0]:b[1]>a[1];
    const yaw=(ex!==null?Math.PI/2:0)+(positive?0:Math.PI),dx=Math.sin(yaw),dz=Math.cos(yaw);
    const lo=ex!==null?a[1]:a[0],hi=ex!==null?a[3]:a[2];
    for(let line=lo+5;line<hi-5;line++){
      const x=ex??line,z=ez??line,from={x:x-dx,z:z-dz},to={x:x+dx,z:z+dz};
      if(before.obstructed(from.x,from.z,.33)||!before.obstructed(to.x,to.z,.33))continue;
      if(!world.obstructed(from.x,from.z,.33)&&!world.obstructed(to.x,to.z,.33)){
        const s={...initialState(before),...from,yaw};
        for(let i=0;i<55;i++)stepRoam(s,world,{x:0,y:1},1/60);
        if(gridKey(s.x,s.z)===key){walkCrossings++;if(!desiredSectors(from,keys).includes(key))throw Error('Neighbor queued too late');}
      }
      if(world.validCar(from.x,from.z,yaw)&&world.validCar(to.x,to.z,yaw)){
        const s={...initialState(before),...from,yaw,mode:'drive',car:{...from,yaw,speed:2,wheel:0,steer:0}};
        for(let i=0;i<60;i++)stepRoam(s,world,{x:0,y:1},1/60);
        if(gridKey(s.x,s.z)===key)driveCrossings++;
      }
    }
  }
  assert.ok(walkCrossings>100,'walk '+walkCrossings);
  assert.ok(driveCrossings>0,'drive '+driveCrossings);
  console.log({walkCrossings,driveCrossings});
});
test('all assets have owned/clipped sector geometry; the released width covers the historical city',()=>{
  let roads=0,buildings=0,water=0,ranges=[Infinity,Infinity,-Infinity,-Infinity];
  const inBox=(p,b)=>p[0]>=b[0]-.02&&p[0]<=b[2]+.02&&p[1]>=b[1]-.02&&p[1]<=b[3]+.02;
  for(const key of keys){
    const cell=key===meta.first.key?meta.first:read(key);
    const b=cell.bounds, g=gridBounds(key);
    assert.ok(b[0]>=g[0]&&b[1]>=g[1]&&b[2]<=g[2]&&b[3]<=g[3]);
    ranges=[Math.min(ranges[0],b[0]),Math.min(ranges[1],b[1]),Math.max(ranges[2],b[2]),Math.max(ranges[3],b[3])];
    assert.ok(cell.roads.every(r=>r.w>0&&inBox(r.a,b)&&inBox(r.b,b)));
    assert.ok(cell.buildings.every(m=>m.p.every(p=>inBox(p,b))));
    assert.ok(cell.roads.every(r=>!Object.hasOwn(r,'name')));
    roads+=cell.roads.length;buildings+=cell.buildings.length;water+=cell.water.length;
  }
  assert.ok(roads>90_000&&buildings>30_000&&water>1_800);
  assert.deepEqual(ranges,meta.bounds);
  console.log({roads,buildings,water,ranges});
});
