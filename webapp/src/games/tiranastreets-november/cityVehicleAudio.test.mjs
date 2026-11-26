import test from 'node:test';
import assert from 'node:assert/strict';
import {cityVehicleVoice} from './cityVehicleAudio.mjs';

test('combustion keeps its existing voice at idle, forward and reverse',()=>{
  for(const speed of [-12,0,12,40]){
    const v=Math.abs(speed);
    assert.deepEqual(cityVehicleVoice({speed,collectionVehicle:'golf-gti'}),{kind:'combustion',hz:28+v*3,gain:.035+Math.min(.08,v*.001),cutoff:240});
  }
});
test('catalog bicycles, scooters and motorcycles have distinct categories',()=>{
  for(const bikeType of ['city-bicycle','mountain-bike'])assert.equal(cityVehicleVoice({speed:12,bikeType}).gain,0);
  for(const bikeType of ['city-scooter','street-motorcycle'])assert.equal(cityVehicleVoice({speed:12,bikeType}).kind,'motorbike');
  assert.equal(cityVehicleVoice({speed:12,bikeType:'delivery-ebike'}).kind,'electric');
  assert.equal(cityVehicleVoice({speed:12,model:'motorbike'}).kind,'motorbike');
});
test('electric voice is silent at rest and quieter while driving',()=>{
  const ev={collectionVehicle:'jaguar'};
  assert.equal(cityVehicleVoice(ev).gain,0);
  const moving=cityVehicleVoice({...ev,speed:12});
  assert.ok(moving.hz>cityVehicleVoice({...ev,speed:6}).hz);
  assert.ok(moving.gain<cityVehicleVoice({speed:12}).gain);
});
test('engine is silent when the vehicle is left or disabled',()=>{
  for(const car of [undefined,{speed:35,destroyed:true},{speed:35,burning:true}])assert.equal(cityVehicleVoice(car).gain,0);
  assert.ok(Number.isFinite(cityVehicleVoice({speed:NaN}).hz));
});
