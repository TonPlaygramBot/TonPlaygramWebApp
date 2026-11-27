import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_ID,NINE_STOREY_IDS,marketExterior,nineStoreyBays} from '../webapp/src/games/tirana-city-source/oldTownExterior.mjs';

const ring=[[441.84,-319.81],[467.61,-322.94],[472.27,-284.55],[446.5,-281.42]];
test('Pazari double roof and floor fit the retained mapped canopy footprint',()=>{
 assert.equal(MARKET_ID,'623438669');
 const before=structuredClone(ring),data=marketExterior(ring);
 assert.deepEqual(ring,before);
 assert.equal(data.roof.length,4);
 assert.equal(data.floor.length,247);
 const roof=data.roof.flat();
 assert.equal(Math.max(...roof.map(p=>p[1])),7.9);
 assert.ok(roof.every(([x,y,z])=>x>=441.84&&x<=472.27&&z>=-322.94&&z<=-281.42&&y>4.6));
 assert.equal(data.boxes.filter(p=>p[2][1]>=4.6).length,15);
 assert.ok(data.beams.length<40);
 assert.ok(data.boxes.length*12+data.floor.length*2+data.beams.length*12<2500);
 assert.deepEqual(marketExterior(ring),data);
 assert.equal(marketExterior([[0,0],[26,0],[43,50],[0,39]]),null);
});

test('Four individually mapped façades keep nine ascending storeys and no ground balcony',()=>{
 assert.deepEqual(NINE_STOREY_IDS,['682795212','682795153','682795152','470177345']);
 for(const ordinal of [0,1,2,3]){
  const length=11,bays=nineStoreyBays(length,28.8,ordinal);
  assert.deepEqual([...new Set(bays.map(p=>p.n))],[0,1,2,3,4,5,6,7,8]);
  assert.ok(!bays.filter(p=>p.n===0).some(p=>p.balcony||p.awning));
  assert.ok(bays.some(p=>p.balcony)&&bays.some(p=>p.awning));
  assert.ok(bays.every(p=>p.y<28.8&&p.u-p.width/2>0&&p.u+p.width/2<length));
 }
 assert.deepEqual(nineStoreyBays(2.1,28.8,0),[]);
});
