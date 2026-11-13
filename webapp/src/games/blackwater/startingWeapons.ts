import {selectedStartingLoadout} from '../tiranastreets/startingLoadout.mjs';
import {BODY_WEAPON} from './BattlefieldPlayer';
import type {WeaponId} from './core';

export function startingWeapons(fallback:WeaponId='ak47'):WeaponId[] {
  const ids=selectedStartingLoadout();
  if(!ids)return [fallback];
  const reverse=new Map(Object.entries(BODY_WEAPON).map(([key,value])=>[value,key as WeaponId]));
  const result=ids.map(id=>reverse.get(id)).filter((id):id is WeaponId=>!!id);
  return result.length===3&&new Set(result).size===3?result:[fallback];
}
