import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ROADS, cityById, distanceKm, pathBetween } from '../webapp/src/games/explorealbania/world.js';
import { acceptJob, advanceTruck, defaultState, jobsFrom, nearestRoad, neutralControls, remainingDistance, serviceTruck } from '../webapp/src/games/explorealbania/simulation.js';

test('Albania freight map has twelve unique, connected cities', () => {
  assert.equal(CITIES.length, 12);
  assert.equal(new Set(CITIES.map(c=>c.id)).size, 12);
  for (const city of CITIES) {
    const route=pathBetween('tirana',city.id);
    if(city.id!=='tirana') assert.ok(route.length>=2,city.name);
    assert.ok(Number.isFinite(city.x)&&Number.isFinite(city.z));
  }
  assert.ok(ROADS.length>=14);
});

test('major routes preserve geographic endpoints and useful road distance', () => {
  const route=pathBetween('shkoder','sarande');
  assert.deepEqual(route[0],{x:cityById('shkoder').x,z:cityById('shkoder').z});
  assert.deepEqual(route.at(-1),{x:cityById('sarande').x,z:cityById('sarande').z});
  assert.ok(distanceKm('shkoder','sarande')>250);
  assert.ok(distanceKm('tirana','durres')>20);
});

test('freight market offers deterministic jobs with cargo economics', () => {
  const jobs=jobsFrom('tirana',3);
  assert.equal(jobs.length,5);
  assert.deepEqual(jobs,jobsFrom('tirana',3));
  for(const job of jobs){assert.equal(job.from,'tirana');assert.ok(job.distance>0);assert.ok(job.tonnes>=8);assert.ok(job.payout>job.distance);}
});

test('truck accelerates, steers, consumes fuel and brakes', () => {
  const s=defaultState(),fuel=s.fuel,heading=s.heading;
  for(let i=0;i<100;i++)advanceTruck(s,{steer:.65,throttle:1,brake:0},.05);
  assert.ok(s.speed>5);assert.notEqual(s.heading,heading);assert.ok(s.fuel<fuel);assert.ok(s.odometer>0);
  for(let i=0;i<100;i++)advanceTruck(s,{steer:0,throttle:0,brake:1},.05);
  assert.ok(Math.abs(s.speed)<1);
});

test('off-road speeding damages the rig while roads remain detectable', () => {
  const s=defaultState();s.x=600;s.z=600;s.speed=25;
  const before=s.damage;for(let i=0;i<40;i++)advanceTruck(s,{steer:0,throttle:1,brake:0},.05);
  assert.ok(s.damage>before);assert.ok(nearestRoad(s.x,s.z).distance>7.5);
});

test('job completes only stopped inside its destination and pays damage-adjusted income', () => {
  const s=defaultState(),job=jobsFrom('tirana',0).find(j=>j.to==='durres')||jobsFrom('tirana',0)[0];
  assert.ok(acceptJob(s,job));assert.ok(remainingDistance(s)>0);const before=s.money,destination=cityById(job.to);
  s.x=destination.x;s.z=destination.z;s.speed=0;advanceTruck(s,neutralControls(),.05);
  assert.equal(s.activeJob,null);assert.equal(s.delivered,1);assert.ok(s.money>before);
});

test('fuel and repair services charge cash and restore the truck', () => {
  const s=defaultState();s.fuel=40;s.damage=20;const before=s.money;
  assert.equal(serviceTruck(s,'fuel'),true);assert.equal(s.fuel,100);assert.ok(s.money<before);
  const afterFuel=s.money;assert.equal(serviceTruck(s,'repair'),true);assert.equal(s.damage,0);assert.ok(s.money<afterFuel);
});
