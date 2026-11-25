import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {combineHistoric,desiredSectors} from '../webapp/src/games/tirana-standalone/historicGrid.mjs';
import {buildMobility,initialState,stepRoam,sedanSamples} from '../webapp/src/games/tirana-standalone/walkDrive.mjs';
import {createCivilianCareer,localCareerMenu,CIVILIAN_CAREER_ENTRIES} from '../webapp/src/games/tirana-standalone/civilianCareer.mjs';
import {SAVE_KEY,loadCareer} from '../webapp/src/games/tiranastreets/career/careerCore.mjs';
import {readHistoricBundle} from '../webapp/scripts/materialize-tirana-historic.mjs';
const archive=await readHistoricBundle();
const meta=JSON.parse(archive.get('start.json').text);
const city={...combineHistoric(meta,[meta.first]),spawnAnchor:meta.spawn};
const mobility=buildMobility(city);
const storage=()=>{const store=new Map();return {getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};};

const cellFor=key=>key===meta.first.key?meta.first:JSON.parse(archive.get(key+'.json').text);
const keys=new Set(meta.keys);
const loopCells=['-1_-1','-1_0','0_-1','0_0','0_1','1_0','1_1'].map(cellFor);
const course=combineHistoric(meta,loopCells), courseMobility=buildMobility(course,mobility.spawn);
function streamer(actor){
  const loaded=new Map([[meta.first.key,meta.first]]);
  let cityView=city, collision=mobility;
  return ()=>{
    const desired=desiredSectors(actor,keys);
    const missing=desired.filter(k=>!loaded.has(k));
    if(missing.length){
      for(const k of missing)loaded.set(k,cellFor(k));
      assert.ok(loaded.size<=9,'proof exceeds runtime sector budget');
      cityView=combineHistoric(meta,[...loaded.values()]);
      collision=buildMobility(cityView,mobility.spawn);
    }
    return [cityView,collision];
  };
}
function travel(actor,session,getWorld=()=>[city,mobility],wide=false){
  const [world,collision]=wide?[course,courseMobility]:[city,mobility];
  const target=session.view(...getWorld(),actor).task.marker;
  const queue=[[actor.x,actor.z,-1]],seen=new Set(),str=(x,z)=>x.toFixed(2)+','+z.toFixed(2);
  const free=(x,z)=>!collision.obstructed(x,z,.52)&&
    sedanSamples(actor.car.x,actor.car.z,actor.car.yaw).every(([a,b])=>Math.hypot(x-a,z-b)>1.5);
  let finish=-1;
  seen.add(str(actor.x,actor.z));
  for(let i=0;i<queue.length&&i<500_000;i++){
    const [x,z]=queue[i];
    if(Math.hypot(x-target.x,z-target.z)<=3&&session.view(world,collision,{...actor,x,z}).task.canInteract){finish=i;break;}
    for(const [dx,dz] of (wide?[[2,0],[-2,0],[0,2],[0,-2]]:[[1,0],[-1,0],[0,1],[0,-1]])){
      const nx=x+dx,nz=z+dz,k=str(nx,nz);
      if(!seen.has(k)&&free(nx,nz)&&[.125,.25,.375,.5,.625,.75,.875].every(t=>free(x+dx*t,z+dz*t))){
        seen.add(k);queue.push([nx,nz,i]);
      }
    }
  }
  assert.ok(finish>=0,'no loaded, unobstructed walk from real spawn to career objective '+target.x);
  const path=[];
  for(let at=finish;at>0;at=queue[at][2])path.unshift(queue[at]);
  for(const [x,z] of path){
    for(let i=0;i<52;i++){
      const remaining=Math.hypot(x-actor.x,z-actor.z);if(remaining<.01)break;
      actor.yaw=Math.atan2(x-actor.x,z-actor.z);
      stepRoam(actor,getWorld()[1],{x:0,y:Math.min(1,remaining/(2.55/60))},1/60);
      session.tick(1/60);
    }
    assert.ok(Math.hypot(x-actor.x,z-actor.z)<.05,JSON.stringify({goal:[x,z],at:[actor.x,actor.z],target,world:getWorld()[0].regions}));
  }
  assert.equal(session.view(...getWorld(),actor).task.canInteract,true);
}

test('preserves all six original authored chapters and exact historical reducer bytes',async()=>{
  const source=await readFile(new URL('../webapp/src/games/tiranastreets/career/careerCore.mjs',import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex'),'47c1b736496d98fb9175b19d0d99b9bdb347a763');
  assert.equal(CIVILIAN_CAREER_ENTRIES.length,6);
  assert.equal(CIVILIAN_CAREER_ENTRIES.reduce((n,c)=>n+c.steps,0),18);
  assert.deepEqual(CIVILIAN_CAREER_ENTRIES.filter(c=>c.available).map(c=>c.id),['first-contact','culture-run','city-ledger','light-and-stone','last-delivery']);
});

test('walks actual historical spawn to both first objectives, restores checkpoint and completion on reload',()=>{
  const store=storage(),actor=initialState(mobility);
  let session=createCivilianCareer(store);
  assert.equal(session.start(),true);
  assert.equal(session.view(city,mobility,actor).task.canInteract,false);
  assert.equal(session.interact(city,mobility,actor),false);
  travel(actor,session);
  for(const blocked of [{...actor,mode:'drive'},{...actor,walkY:1}])
    assert.equal(session.interact(city,mobility,blocked),false);
  assert.equal(session.interact(city,mobility,actor,true),false);
  assert.equal(session.interact(city,mobility,actor),true);
  assert.equal(loadCareer(store).active.step,1);
  assert.deepEqual(loadCareer(store).active.items,['introduction']);
  assert.equal(localCareerMenu(store).active,'first-contact');
  session=createCivilianCareer(store);
  // A real remount loads the saved progress but spawns the avatar anew.
  Object.assign(actor,initialState(mobility));
  assert.equal(session.start(),true);
  assert.equal(session.view(city,mobility,actor).position,2);
  assert.equal(session.interact(city,mobility,actor),false);
  travel(actor,session);
  assert.equal(session.interact(city,mobility,actor),true);
  assert.equal(session.interact(city,mobility,actor),false);
  assert.deepEqual(loadCareer(store).completed,['first-contact']);
  assert.ok(Number.isFinite(loadCareer(store).bestTimes['first-contact']));
  const fresh=createCivilianCareer(store);
  assert.equal(fresh.view(city,mobility,actor).completed,1);
  assert.equal(fresh.start('city-ledger'),false);
  assert.equal(fresh.start('culture-run'),true);
  assert.equal(fresh.start('dajti-connection'),false);
});

test('keeps future/legacy chapter progress untouched and fails visibly on storage denial',()=>{
  const legacy=storage();
  const raw={version:1,completed:CIVILIAN_CAREER_ENTRIES.slice(0,5).map(c=>c.id),active:{id:'dajti-connection',step:1,elapsed:30}};
  legacy.setItem(SAVE_KEY,JSON.stringify(raw));
  const session=createCivilianCareer(legacy);
  assert.equal(session.view(city,mobility,initialState(mobility)).unavailable,true);
  assert.equal(session.start(),false);
  session.tick(.1);
  session.flush();
  assert.deepEqual(JSON.parse(legacy.getItem(SAVE_KEY)),raw);

  const noStore=createCivilianCareer({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(noStore.start(),true);
  assert.equal(noStore.view(city,mobility,initialState(mobility)).storageOK,false);
});

test('short distance is insufficient when the actual segment crosses an obstacle',()=>{
  const blocksMiddle={obstructed:(x,z,r)=>mobility.obstructed(x,z,r)||(x>-.1&&x<.3&&Math.abs(z+.226)<1.5)};
  const session=createCivilianCareer(storage());
  assert.equal(session.start(),true);
  const actor={mode:'walk',walkY:0,x:-.6,z:-.226};
  const view=session.view(city,blocksMiddle,actor);
  assert.ok(view.task.distance<=4);
  assert.equal(view.task.canInteract,false);
  assert.equal(session.interact(city,blocksMiddle,actor),false);
});

test('walks and completes all original 16 public outdoor steps, including streamed travel and all inventory gates',()=>{
  const store=storage(),actor=initialState(mobility),world=streamer(actor);
  let session=createCivilianCareer(store), arrivals=0;
  for(const entry of CIVILIAN_CAREER_ENTRIES.filter(c=>c.available)){
    assert.equal(session.view(...world(),actor).next.id,entry.id);
    assert.equal(session.start(),true);
    for(let i=0;i<entry.steps;i++){
      const view=session.view(...world(),actor);
      assert.equal(view.position,i+1);
      assert.equal(view.steps,entry.steps);
      travel(actor,session,world,true);
      assert.equal(session.interact(...world(),actor),true);
      arrivals++;
      if(entry.id==='culture-run'&&i===1){
        session.flush();session=createCivilianCareer(store);
        assert.deepEqual(loadCareer(store).active.items,['schedule','entrance-note']);
      }
    }
    const record=loadCareer(store);
    assert.ok(record.completed.includes(entry.id));
    assert.equal(record.active,null);
  }
  assert.equal(arrivals,16);
  assert.ok(loadCareer(store).bestTimes['last-delivery']<360);
  assert.equal(session.start('dajti-connection'),false);
  assert.equal(session.view(...world(),actor).next,undefined);
});

test('does not let unloaded sectors, clipped or unverified lookalike paths complete a checkpoint',()=>{
  const store=storage(),c=createCivilianCareer(store);
  store.setItem(SAVE_KEY,JSON.stringify({version:1,completed:['first-contact'],active:{id:'culture-run',step:1,elapsed:30}}));
  const legacy=createCivilianCareer(store),faux={mode:'walk',walkY:0,x:193.52,z:504.12};
  assert.equal(legacy.view(city,mobility,faux).position,3);
  assert.equal(legacy.view(city,mobility,faux).task.name,'Bashkia e Tiranës');
  assert.deepEqual(loadCareer(store).active.items,['schedule','entrance-note']);
  assert.equal(c.start(),true);
  const actor={...initialState(mobility),x:1.077,z:-.226};
  const stripped={...city,roads:city.roads.map(r=>({...r,walk:false}))};
  assert.equal(c.view(stripped,mobility,actor).task.loaded,false);
  assert.equal(c.marker(stripped,mobility),null);
  assert.ok(c.marker(city,mobility));
  assert.equal(c.interact(stripped,mobility,actor),false);
  assert.equal(c.interact(city,mobility,actor),true);
  const onlyStart={...city,regions:[]},clock={...actor,x:70.29,z:-21.69};
  assert.equal(c.view(onlyStart,mobility,clock).task.loaded,false);
  assert.equal(c.interact(onlyStart,mobility,clock),false);
});

test('timed courier respects pause and retries the original saved parcel checkpoint without duplication',()=>{
  const store=storage(),act=initialState(mobility),world=streamer(act);
  store.setItem(SAVE_KEY,JSON.stringify({version:1,completed:CIVILIAN_CAREER_ENTRIES.slice(0,4).map(c=>c.id)}));
  let c=createCivilianCareer(store);
  assert.equal(c.start(),true);
  assert.equal(c.view(...world(),act).remaining,360);
  travel(act,c,world,true);
  assert.equal(c.interact(...world(),act),true);
  const checkpoint=loadCareer(store).active.checkpoint;
  for(let i=0;i<3601;i++)c.tick(.1,true);
  assert.equal(c.view(...world(),act).remaining,Math.ceil(360-checkpoint.elapsed));
  for(let i=0;i<3601;i++)c.tick(.1);
  assert.equal(c.view(...world(),act).failed,true);
  assert.equal(loadCareer(store).active.status,'failed');
  c=createCivilianCareer(store);
  assert.equal(c.start(),true);
  const resumed=loadCareer(store).active;
  assert.equal(resumed.status,'active');
  assert.deepEqual(resumed.checkpoint,checkpoint);
  assert.deepEqual(resumed.items,['sealed-parcel']);
  assert.equal(c.view(...world(),act).position,2);
});
