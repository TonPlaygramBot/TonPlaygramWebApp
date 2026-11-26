import {bikeFor} from './shared/bikeCatalog.mjs';

// Game mix parameters, not recordings or simulations of actual models.
export function cityVehicleVoice(car){
  const speed=Math.min(55,Number.isFinite(car?.speed) ? Math.abs(car.speed) : 0);
  let kind='off', hz=28, gain=0, cutoff=240;
  if(car&&!car.burning&&!car.destroyed){
    const bike=bikeFor(car)?.id;
    if(bike==='city-bicycle'||bike==='mountain-bike')kind='pedal';
    else if(bike==='delivery-ebike'||car.collectionVehicle==='jaguar'){
      kind='electric';hz=72+speed*5;cutoff=hz*1.2;
      gain=Math.min(.022,Math.max(0,speed-.3)*.0017);
    }else if(bike==='city-scooter'||bike==='street-motorcycle'){
      kind='motorbike';hz=42+speed*4.2;cutoff=310+speed*3;
      gain=.029+Math.min(.049,speed*.0018);
    }else{
      kind='combustion';hz=28+speed*3;cutoff=240;
      gain=.035+Math.min(.08,speed*.001);
    }
  }
  return {kind,hz,gain,cutoff};
}
