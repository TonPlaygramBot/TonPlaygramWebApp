import test from 'node:test';
import assert from 'node:assert/strict';
import games from '../webapp/src/config/gamesCatalog.js';
import {MALL_GAMES,mallGameFor,mallHallPosition} from '../webapp/src/games/tirana-mall/mallCatalog.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {PYRAMID_MALL,isNearPyramid,distanceToPyramid} from '../webapp/src/games/tirana-mall/mallLocation.mjs';

test('the mall launches every active Games page entry exactly once, with no retired routes',()=>{
  assert.deepEqual(MALL_GAMES.map(g=>[g.slug,g.route]),games.map(g=>[g.slug,g.route]));
  assert.equal(new Set(MALL_GAMES.map(g=>g.slug)).size,games.length);
  for(const game of MALL_GAMES){assert.match(game.route,/^\/games\/[a-z0-9-]+\/lobby$/);assert.equal(mallGameFor(game.slug),game);}
  assert.equal(mallGameFor('tiranastreets'),null);assert.equal(mallGameFor('javascript:alert(1)'),null);
});
test('halls have separated spaces, a clear central aisle and fit inside the Pyramid envelope',()=>{
  for(const count of [MALL_GAMES.length,15,20]){
    const halls=Array.from({length:count},(_,i)=>mallHallPosition(i,count));
    for(const hall of halls){assert.ok(Math.abs(hall.x)-hall.width/2>=5);assert.ok(Math.abs(hall.x)+hall.width/2<=19);assert.ok(Math.abs(hall.z)+hall.depth/2<=19);}
    for(let i=0;i<halls.length;i++)for(let j=i+1;j<halls.length;j++){
      const a=halls[i],b=halls[j];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.z-b.z)>=(a.depth+b.depth)/2);
    }
  }
});
test('entry uses the preserved map anchor and requires a nearby player on foot',()=>{
  const anchor=WORLD.landmarks.find(l=>l.id==='pyramid');assert.equal(PYRAMID_MALL.x,anchor.x);assert.equal(PYRAMID_MALL.z,anchor.z);
  assert.ok(isNearPyramid({...anchor,x:anchor.x+60}));assert.equal(isNearPyramid({...anchor,x:anchor.x+80}),false);assert.equal(isNearPyramid({...anchor,carId:'city-car'}),false);
  assert.equal(distanceToPyramid(null),Infinity);assert.equal(isNearPyramid({x:NaN,z:0}),false);assert.equal(distanceToPyramid(anchor),0);
});
