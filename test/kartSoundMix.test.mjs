import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kartTrackMix,kartArcadeCueFrame} from '../webapp/src/games/kartroyale/kartSoundMix.mjs';
const frame=(patch={})=>({track:{surface:'asphalt'},speed:18,tireSlip:.5,countdown:0,time:1,drifting:false,driftCharge:0,...patch});
test('paved, gravel and dirt produce distinct rolling and skid tones',()=>{
 const paved=kartTrackMix(frame(),true);
 const gravel=kartTrackMix(frame({track:{surface:'gravel'}}),true);
 const dirt=kartTrackMix(frame({track:{surface:'dirt'}}),true);
 assert.equal(paved.grit,0);
 assert.ok(gravel.grit>dirt.grit&&dirt.grit>0);
 assert.ok(gravel.rolling>dirt.rolling&&dirt.rolling>paved.rolling);
 assert.ok(paved.tireHz>gravel.tireHz&&gravel.tireHz>dirt.tireHz);
});
test('airborne and inactive frames mute all contact layers, including gravel',()=>{
 const f=frame({airborne:true,track:{surface:'gravel'}});
 const {rolling,grit,tire,air}=kartTrackMix(f,true);
 assert.deepEqual({rolling,grit,tire},{rolling:0,grit:0,tire:0});
 assert.ok(air>0);
 const off=kartTrackMix(frame({track:f.track}),false);
 assert.equal(off.air,0);assert.equal(off.rolling,0);assert.equal(off.grit,0);
});
test('drift threshold cues fire once, reset for the next drift, and ignore held pickup',()=>{
 const track={surface:'asphalt'};
 let state;
 const step=(patch={},enabled=true)=>{
  const x=kartArcadeCueFrame(state,frame({track,...patch}),enabled);
  state=x.current;return x.cues;
 };
 assert.deepEqual(step(),[]);
 assert.deepEqual(step({time:2,drifting:true,driftCharge:.56,raceItem:'boost'}),[{kind:'charge',tier:1},{kind:'pickup'}]);
 assert.deepEqual(step({time:3,drifting:true,driftCharge:.8,raceItem:'boost'}),[]);
 assert.deepEqual(step({time:4,drifting:true,driftCharge:1.22,raceItem:'boost'}),[{kind:'charge',tier:2}]);
 assert.deepEqual(step({time:5}),[]);
 assert.deepEqual(step({time:6,drifting:true,driftCharge:.56}),[{kind:'charge',tier:1}]);
 assert.deepEqual(step({time:0,countdown:3}),[]);
 assert.deepEqual(step({time:1,countdown:0,raceItem:'boost'}),[]);
});
