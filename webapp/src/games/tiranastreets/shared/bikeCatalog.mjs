export const BIKE_TYPES=Object.freeze([
  {id:'city-bicycle',name:'City bicycle',length:1.79,width:.74,speed:4.2},
  {id:'mountain-bike',name:'Mountain bike',length:1.79,width:.74,speed:5},
  {id:'delivery-ebike',name:'Delivery e-bike',length:1.79,width:.74,speed:5.5},
  {id:'city-scooter',name:'City scooter',length:1.98,width:.94,speed:8},
  {id:'street-motorcycle',name:'Street motorcycle',length:1.98,width:.94,speed:10},
].map(b=>Object.freeze({...b,url:`/assets/tirana-streets/city-mobility/${b.id}.glb`})));
export function bikeFor(actor){
  if(actor.forceVehicle)return undefined;
  if(actor.bikeType)return BIKE_TYPES.find(b=>b.id===actor.bikeType);
  if(actor.motion==='cycle'){
    const hash=[...actor.id].reduce((s,c)=>s+c.charCodeAt(0),0);return BIKE_TYPES[hash%3];
  }
  return actor.model==='motorbike'?BIKE_TYPES[4]:undefined;
}
