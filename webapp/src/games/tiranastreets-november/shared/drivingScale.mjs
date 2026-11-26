import {roadVehicleFor} from './vehicleCollection.mjs';
/** Arcade road tuning, not manufacturer performance claims. Metres and m/s;
 * the dashboard alone converts to km/h. Stable objects are shared per class. */
const make=(kind,kph,acceleration,braking,wheelbase,grip,steer)=>Object.freeze({
 kind,maximum:kph/3.6,reverse:20/3.6,acceleration,braking,wheelbase,grip,steer
});
export const DRIVING_PROFILES=Object.freeze({
 compact:make('compact',125,7.2,13.5,2.55,9.7,.58),
 sedan:make('sedan',145,7.8,13.8,2.95,9.8,.54),
 sport:make('sport',180,10.5,16,2.7,11.8,.56),
 supercar:make('supercar',210,12,17,2.65,12.4,.54),
 suv:make('suv',135,6.5,12,2.9,8.3,.53),
 van:make('van',110,4.9,10.5,3.45,7.5,.51),
 armored:make('armored',95,4.3,10,3.3,7.4,.46),
 bus:make('bus',75,3.5,9,7,6.6,.53),
 bike:make('bike',150,9.6,13,1.5,10.5,.35)
});
export function drivingScale(car) {
 if(car.model==='tirana-bus')return DRIVING_PROFILES.bus;
 const id=car.collectionVehicle||car.racingAsset||roadVehicleFor(car)?.id||car.forceVehicle||car.model||'';
 if(/bike|motorcycle|^(apex|oobi|oodi|ooli|oopi)$/.test(id))return DRIVING_PROFILES.bike;
 if(/armored|shota|military/.test(id))return DRIVING_PROFILES.armored;
 if(/van|ambulance/.test(id)||car.service==='ambulance')return DRIVING_PROFILES.van;
 if(/range|landrover|defender|brabus-g|suv/.test(id))return DRIVING_PROFILES.suv;
 if(/ferrari|bugatti/.test(id))return DRIVING_PROFILES.supercar;
 if(/bmw|golf-gti|sport|race/.test(id)||car.model==='sport'||car.model==='sedan-sports')return DRIVING_PROFILES.sport;
 if(/ford|fiat|city-car|hatch/.test(id))return DRIVING_PROFILES.compact;
 return DRIVING_PROFILES.sedan;
}
export function cornerSpeed(headingError,cruise) {
 return Math.min(cruise,Math.max(2.2,cruise/(1+Math.abs(headingError)*3.2)));
}
