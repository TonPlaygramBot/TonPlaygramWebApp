export interface Weapon {
  id: string;
  name: string;
  icon: string;
  urls: string[];
  ammo: number;
  power: number;
  speed: number;
  cooldown: number;
}
export const WEAPONS: Weapon[];
export const FERRARI: string, BUGGY: string, BUGGY_RAW: string;
