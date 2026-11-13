import type {Weapon} from './weapons.mjs';
export function reserveCapacity(weapon: Weapon | undefined): number;
export function ammunitionQuote(weapon: Weapon | undefined, inventory: {reserve:number} | undefined, amount?: string): {rounds:number;price:number;capacity:number};
