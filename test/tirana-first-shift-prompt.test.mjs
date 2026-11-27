import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstShiftPrompt} from '../webapp/src/games/tiranastreets-november/street-career/firstShiftPrompt.mjs';

const objective = Object.freeze({title:'Move with the left stick',detail:'First shift · learn as you go',training:true});
const context = {missionId:'first-shift',finished:false,objective,learned:[]};

test('entering a car immediately replaces walking directions with existing pedals', () => {
  assert.equal(firstShiftPrompt({...context, mode:'walking'}), objective);
  const driving = firstShiftPrompt({...context, mode:'driving'});
  assert.equal(driving.title,'Drive the car');
  assert.match(driving.detail,/GAS.*left stick.*BRAKE/);
  assert.equal(objective.title,'Move with the left stick');
});
test('show a stop and exit hint only after the player has driven', () => {
  const result = firstShiftPrompt({...context, mode:'driving', learned:['enter','drive']});
  assert.equal(result.title,'Stop before getting out');
  assert.match(result.detail,/BRAKE.*DIL/);
});
test('active route objectives, unrelated missions, flights and results remain unchanged', () => {
  const route = {title:'Collect parcel', detail:'Follow the route', training:false};
  assert.equal(firstShiftPrompt({...context,mode:'driving',objective:route}),route);
  assert.equal(firstShiftPrompt({...context,mode:'driving',missionId:'courier'}),objective);
  assert.equal(firstShiftPrompt({...context,mode:'flying'}),objective);
  assert.equal(firstShiftPrompt({...context,mode:'driving',finished:true}),objective);
});
