import type {Weapon} from './weapons.mjs';
export type UploadedWeapon = Weapon & {battlefieldId:'acr'|'dragunov'|'vityaz'|'ar15'|'makarov';priceTPG:number;length:number;modelUrl:string;thumbnail:string};
export const UPLOADED_WEAPONS:readonly Readonly<UploadedWeapon>[];
export function forceWeaponFor(character:string,slot?:number):string;
