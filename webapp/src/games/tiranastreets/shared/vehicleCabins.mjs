import {roadVehicleFor} from './vehicleCollection.mjs';
/** Checked against embedded node/material names in the original collection.
 * A leather seat alone is not evidence of a complete dashboard. Remaining
 * collection cars receive an explicitly authored class-specific basic cabin. */
const authored=Object.freeze({
 benz:/miutuinter|miutuseats|miutusteering/i,
 bmw:/interior/i,
 ford:/interior/i,
 ferrari:/interior|leather|carpet/i,
 jaguar:/interieur|siege/i,
 'golf-gti':/airbags|^int_|fabric_|leather_|pillars_|roofliner_|speaker_|stitching_|sun_visor|ambilight_|seats_tag|steering_wheel|golf_gti_my25_screen|plastic_black_triangle/i
});
export function cabinAssetId(car){return roadVehicleFor({...car,collectionVehicle:car.collectionVehicle||car.racingAsset})?.id;}
export function hasAuthoredCabin(car){return !!authored[cabinAssetId(car)];}
export function cabinSurface(car,nodeName,materialName){
 const rule=authored[cabinAssetId(car)];
 return !!rule&&(rule.test(nodeName||'')||rule.test(materialName||''));
}
export function cabinSteeringSurface(nodeName,materialName){return /steering|steerwheel/i.test(`${nodeName} ${materialName}`);}
