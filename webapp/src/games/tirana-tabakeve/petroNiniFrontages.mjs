import { QUARTER } from './quarterData.mjs';

/** The footprint and neighboring businesses retain their mapped positions.
 * The bakery level and office stack are user-supplied; finish and dimensions
 * are authored approximation, not a facade survey or readable brand artwork. */
export function petroNiniFrontages(quarter=QUARTER) {
  const bakery=quarter.shops.find(s=>s.id==='user-byrektore-unit2');
  const office=quarter.shops.find(s=>s.id==='user-century21-west');
  const market=quarter.storefronts.find(s=>s.id==='node/11643279517');
  const restaurant=quarter.storefronts.find(s=>s.id==='node/12412793811');
  const opposite=quarter.storefronts.find(s=>s.id==='node/11386381423');
  if(!bakery||!office||!market||!restaurant||!opposite||
     new Set([bakery.buildingId,office.buildingId,market.buildingId]).size!==1||
     opposite.buildingId===bakery.buildingId||restaurant.buildingId===bakery.buildingId) return null;
  return {
    bakery:{...bakery,y:1.12,width:3.6,elevation:'basement',approximate:true},
    office:{...office,x:bakery.x,z:bakery.z,y:4.68,width:3.85,elevation:'upper',approximate:true},
    market,restaurant,opposite,
  };
}
