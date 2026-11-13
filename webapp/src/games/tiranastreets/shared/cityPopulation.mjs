import { groundHeight } from '../../tirana-east/terrainCore.mjs';
import { WORLD } from './world.mjs';
import { WEAPONS, WEAPON_BY_ID } from './weapons.mjs';
import { onCarriageway } from './streetLayout.mjs';
import { footprintIndex } from '../../tirana-city-source/footprintIndex.mjs';
import {shopLayout} from './shopLayout.mjs';
import {reserveCapacity} from './ammunition.mjs';
export const CITY_POPULATION = Object.freeze({ vehicles: 2400, buses: 24, weapons: 300, ammoCaches: 96, shops: 24, pedestrians: 1400 });
export const nearestShop = (state, p) => (state.shops?.length ? state.shops : [state.shop]).filter(Boolean)
  .reduce((best, s) => !best || Math.hypot(s.x-p.x,s.z-p.z)<Math.hypot(best.x-p.x,best.z-p.z) ? s : best, null);
const nearBuilding = footprintIndex(WORLD.buildings, 40, 10);
let sites;
let shopGeometry=[];
const shopCells=new Map();
export const shopObstacles=()=>shopGeometry;
export const shopObstaclesNear=(x,z)=>shopCells.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[];
const apart = (points,p,d) => points.every(q=>(q.x-p.x)**2+(q.z-p.z)**2>d*d);
/** Authored roadside placement, resolved against the same collision map as play. */
export function citySites(env) {
  if(sites)return sites;
  const shops=[], pickups=[];
  const roads=env.world.roads.filter(r=>!r.walk&&!r.bridge&&r.w>=6&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>16);
  const walks=env.world.roads.filter(r=>r.walk&&!r.bridge&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>8);
  const clearShop=p=>{
    // Whole interior footprint, plus doorway apron; never place a shop in a road/building.
    for(let x=-7;x<=7;x+=2)for(let z=-11;z<=4;z+=2){
      const q={x:p.x+x,z:p.z+z},before={...q};env.collide(q,.8);
      if(Math.hypot(q.x-before.x,q.z-before.z)>.05||onCarriageway(before.x,before.z,.8))return false;
    }
    return !nearBuilding(p.x,p.z).some(b=>{
      const xs=b.p.map(v=>v[0]),zs=b.p.map(v=>v[1]);
      return Math.max(...xs)>p.x-7&&Math.min(...xs)<p.x+7&&Math.max(...zs)>p.z-11&&Math.min(...zs)<p.z+4;
    });
  };
  const ordered=[...roads].sort((a,b)=>Math.hypot(a.a[0]-env.spawn.x,a.a[1]-env.spawn.z)-Math.hypot(b.a[0]-env.spawn.x,b.a[1]-env.spawn.z));
  for(let i=0;i<ordered.length*4&&shops.length<CITY_POPULATION.shops;i++){
    const r=ordered[i<150?i:(i*997)%ordered.length],dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);
    const offset=r.w/2+13+(Math.floor(i/ordered.length)%2)*9,side=i%2?1:-1;
    const p={x:(r.a[0]+r.b[0])/2+dz/len*offset*side,z:(r.a[1]+r.b[1])/2-dx/len*offset*side};
    if(!apart(shops,p,shops.length<15?450:240)||!clearShop(p))continue;
    if(shopLayout({...p,id:"candidate"}).stairCount>32)continue;
    shops.push({...p,id:`arsenal-${shops.length+1}`,name:`Arben · Arsenal ${String(shops.length+1).padStart(2,'0')}`});
  }
  if(shops.length!==CITY_POPULATION.shops)throw Error(`Unable to place all ${CITY_POPULATION.shops} weapon stores safely`);
  const guns=WEAPONS.filter(w=>!w.radius&&w.id!=='fpsGunAttack'&&w.id!=='punch'&&w.category!=='throwable');
  const sorted=[...walks].sort((a,b)=>Math.hypot(a.a[0]-env.spawn.x,a.a[1]-env.spawn.z)-Math.hypot(b.a[0]-env.spawn.x,b.a[1]-env.spawn.z));
  for(let i=0;i<sorted.length*3&&pickups.length<CITY_POPULATION.weapons;i++){
    const r=sorted[i<90?i:(i*811)%sorted.length],t=.2+(i%7)*.1;
    const p={x:r.a[0]+(r.b[0]-r.a[0])*t,z:r.a[1]+(r.b[1]-r.a[1])*t};
    env.collide(p,.45);
    if(onCarriageway(p.x,p.z,.2)||!apart(pickups,p,32))continue;
    const w=guns[pickups.length%guns.length];
    pickups.push({...p,id:`city-weapon-${pickups.length}`,weapon:w.id,ammo:w.magazine,y:groundHeight(p.x,p.z)+.15,source:'city'});
  }
  if(pickups.length!==CITY_POPULATION.weapons)throw Error('Unable to place all 300 weapon pickups safely');
  // Stashes sit off pedestrian paths, spaced across the city. The collision
  // resolver must leave the candidate untouched: never hide loot in a wall.
  const cacheWeapons=guns.filter(w=>w.category!=='melee'),caches=[];
  for(let i=0;i<sorted.length*6&&caches.length<CITY_POPULATION.ammoCaches;i++){
    const r=sorted[(i*397)%sorted.length],dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);
    const side=i%2?1:-1,t=.25+(i%3)*.25,offset=2.4+(i%4)*.8;
    const p={x:r.a[0]+dx*t+dz/len*offset*side,z:r.a[1]+dz*t-dx/len*offset*side},before={...p};
    env.collide(p,.5);
    if(Math.hypot(p.x-before.x,p.z-before.z)>.05||onCarriageway(p.x,p.z,.8)||!apart(pickups,p,10)||!apart(caches,p,50)||!apart(shops,p,18))continue;
    const w=cacheWeapons[caches.length%cacheWeapons.length],ammo=w.magazine*3;
    caches.push({...p,id:`city-ammo-${caches.length}`,kind:'ammo',weapon:w.id,ammo,initialAmmo:ammo,y:groundHeight(p.x,p.z)+.15,source:'cache'});
  }
  if(caches.length!==CITY_POPULATION.ammoCaches)throw Error(`Unable to place all ${CITY_POPULATION.ammoCaches} ammunition caches safely`);
  pickups.push(...caches);
  shopGeometry=shops.flatMap(shop=>{const layout=shopLayout(shop);shop.y=layout.standingY;return layout.solids;});
  for(const b of shopGeometry)if(b.h>.3)for(let x=Math.floor((b.minX-3)/40);x<=Math.floor((b.maxX+3)/40);x++)for(let z=Math.floor((b.minZ-3)/40);z<=Math.floor((b.maxZ+3)/40);z++){const k=`${x},${z}`;if(!shopCells.has(k))shopCells.set(k,[]);shopCells.get(k).push(b);}
  sites={shops,pickups};return sites;
}
export function initCityPopulation(state,env){
  const {shops,pickups}=citySites(env);
  state.shops=shops.map(s=>({...s}));state.shop=state.shops[0];
  state.pickups??=[];
  const present=new Set(state.pickups.map(p=>p.id));
  for(const item of pickups)if(!present.has(item.id))state.pickups.push({...item});
  state.pickupSeq??=0;
  // Existing multiplayer rooms gain the extra storefronts without resetting
  // loot claims, NPCs, combat drops or the traffic simulation.
  if(state.npcs?.length){
    const dealers=new Set(state.npcs.map(n=>n.id));
    for(const shop of state.shops.slice(1)){
      const id=`dealer-${shop.id}`;
      if(!dealers.has(id))state.npcs.push({...shop,id,kind:'dealer',motion:'idle',heading:0,speed:0,health:100,weapon:null,downUntil:0});
    }
  }
  state.populationVersion=2;
}
export function dropWeapon(state,n){
  const w=WEAPON_BY_ID.get(n.weapon);if(!w||n.weaponDropped||n.kind==='dealer')return;
  n.weaponDropped=true;state.pickups??=[];state.pickupSeq=(state.pickupSeq||0)+1;
  state.pickups.push({id:`drop:${n.id}:${state.pickupSeq}`,x:n.x,z:n.z,y:(n.y??groundHeight(n.x,n.z))+.15,weapon:w.id,ammo:w.magazine,source:'npc',expiresAt:state.elapsed+300});
  // Bound uncollected combat drops without deleting the city's persistent pickups.
  const drops=state.pickups.filter(p=>p.source==='npc');
  if(drops.length>128){const discard=new Set(drops.slice(0,drops.length-128).map(p=>p.id));state.pickups=state.pickups.filter(p=>!discard.has(p.id));}
}
export function collectWeapon(state,p,id){
  if(p.health<=0||p.carId||p.aircraftId||p.finished||p.failed)return false;
  const item=state.pickups?.find(l=>l.id===id&&!l.collected&&(!l.expiresAt||l.expiresAt>state.elapsed));
  if(!item||Math.hypot(p.x-item.x,p.z-item.z)>3.2)return false;
  const w=WEAPON_BY_ID.get(item.weapon);if(!w)return false;
  const inv=p.inventory[item.weapon],available=Math.max(0,Math.floor(Number(item.ammo)||0));
  if(item.kind==='ammo'){
    if(!inv){p.shopMessage=`Find or equip ${w.label} before collecting its ammunition`;return false;}
    const amount=Math.min(available,Math.max(0,reserveCapacity(w)-inv.reserve));
    if(!amount){p.shopMessage='Reserve full · stash remains here';return false;}
    inv.reserve+=amount;item.ammo=available-amount;
    if(!item.ammo){item.collected=true;item.collectedBy=p.id;}
    p.shopMessage=`${amount} ${w.label} rounds collected${item.ammo?` · ${item.ammo} left in stash`:''}`;
    return true;
  }
  // A found weapon can still be equipped with a full reserve. Ammunition-only
  // stashes above never switch weapons or cancel an in-progress reload.
  if(inv){inv.reserve=Math.min(reserveCapacity(w),inv.reserve+available);}
  else p.inventory[item.weapon]={ammo:Math.min(w.magazine,available),reserve:Math.min(reserveCapacity(w),Math.max(0,available-w.magazine))};
  item.collected=true;item.collectedBy=p.id;p.weapon=item.weapon;p.reloadAt=0;p.nextShot=0;p.shopMessage=`${w.label} picked up`;
  return true;
}
