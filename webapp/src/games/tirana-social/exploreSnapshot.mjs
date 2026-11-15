/** Only presentation data crosses the social socket. AI walk plans can contain
 * back-references to their actor; paths, inventories and the full city stay on
 * the authority. Limits match the mobile renderer's local visibility budget. */
export const EXPLORE_VIEW_BUDGET=Object.freeze({people:12,vehicles:28,peopleRadius:90,vehicleRadius:180});
const PLAYER_FIELDS=['id','name','x','z','y','heading','speed','carId','aircraftId','health','anim'];
const PERSON_FIELDS=['id','x','z','y','heading','speed','health','kind','motion','anim','weapon','downUntil','hitUntil','characterId','bikeType','role','behavior','forceCharacter','seat','deployed','eventSlot'];
const VEHICLE_FIELDS=['id','x','z','heading','speed','vx','vz','model','collectionVehicle','driver','npcDriver','steering','steerAngle','bikeType','trailerHeading','livery','braking','doorsUntil','health'];
function pick(value,fields){const result={};for(const key of fields){const entry=value?.[key];if(entry===null||typeof entry==='boolean'||typeof entry==='number'&&Number.isFinite(entry))result[key]=entry;else if(typeof entry==='string')result[key]=entry.slice(0,160);}return result;}
const distance=(actor,viewer)=>Math.hypot(actor.x-viewer.x,actor.z-viewer.z);
function vehicle(car){const result=pick(car,VEHICLE_FIELDS);if(Array.isArray(car.passengers))result.passengers=car.passengers.slice(0,20).map(passenger=>pick(passenger,['seat','face','shirt']));return result;}
export function exploreSnapshot(state,playerId){
  const viewer=state.players[playerId]||Object.values(state.players)[0];
  const result={...pick(state,['elapsed','phase','mode','missionId','worldVersion']),players:{},npcs:[],cars:[],traffic:[],units:[],effects:[],effectSeq:0,rival:null,shop:pick(state.shop,['id','name','x','z'])};
  for(const [id,player] of Object.entries(state.players)){
    result.players[id]={...pick(player,PLAYER_FIELDS),weapon:'',inventory:{}};
  }
  if(!viewer)return result;
  result.npcs=(state.npcs||[]).filter(actor=>distance(actor,viewer)<EXPLORE_VIEW_BUDGET.peopleRadius).sort((a,b)=>distance(a,viewer)-distance(b,viewer)).slice(0,EXPLORE_VIEW_BUDGET.people).map(person=>pick(person,PERSON_FIELDS));
  const vehicles=[...(state.cars||[]).map(car=>({car,kind:'cars'})),...(state.traffic||[]).map(car=>({car,kind:'traffic'}))]
    .filter(({car})=>car.id===viewer.carId||distance(car,viewer)<EXPLORE_VIEW_BUDGET.vehicleRadius)
    .sort((a,b)=>a.car.id===viewer.carId?-1:b.car.id===viewer.carId?1:distance(a.car,viewer)-distance(b.car,viewer))
    .slice(0,EXPLORE_VIEW_BUDGET.vehicles);
  for(const {car,kind} of vehicles)result[kind].push(vehicle(car));
  return result;
}
