// Fictional sale listings and game bank interiors on mapped city footprints.
// Prices, ownership and robbery rules are gameplay, not real property offers.
export const ECONOMY_PROPERTIES = Object.freeze([
  {id:'home-lana-flat',buildingId:'relation/7757695',name:'Lana apartment',kind:'apartment',price:2400,stashMagazines:40},
  {id:'home-delvina-flat',buildingId:'534559992',name:'Delvina apartment',kind:'apartment',price:4200,stashMagazines:60},
  {id:'home-blloku-house',buildingId:'256328730',name:'Blloku town house',kind:'house',price:6500,stashMagazines:90},
  {id:'home-elbasan-house',buildingId:'56190593',name:'Elbasan Road house',kind:'house',price:8500,stashMagazines:120},
  {id:'home-central-villa',buildingId:'859607541',name:'Central garden villa',kind:'villa',price:13000,stashMagazines:180},
  {id:'home-truja-villa',buildingId:'543109586',name:'Truja villa',kind:'villa',price:18000,stashMagazines:240}
]);
export const ECONOMY_BANKS = Object.freeze([
  {id:'bank-bkt',buildingId:'360601454',name:'BKT · game branch',kind:'bank',reward:1600},
  {id:'bank-credins',buildingId:'400645195',name:'Credins · game branch',kind:'bank',reward:2000},
  {id:'bank-tirana',buildingId:'380047334',name:'Tirana Bank · game branch',kind:'bank',reward:1200}
]);
export const ECONOMY_RESIDENCE_IDS=new Set(ECONOMY_PROPERTIES.map(s=>s.buildingId));
export const ECONOMY_BUILDING_IDS=new Set([...ECONOMY_PROPERTIES,...ECONOMY_BANKS].map(s=>s.buildingId));
