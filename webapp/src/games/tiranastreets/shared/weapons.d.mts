export type Weapon = {
  id: string;
  label: string;
  category: string;
  model: string;
  magazine: number;
  damage: number;
  interval: number;
  range: number;
  reload: number;
  price: number;
  radius: number;
};
export const WEAPONS: readonly Weapon[];
export const WEAPON_BY_ID: Map<string, Weapon>;
export const STARTER_WEAPON: string;
export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; damage: number; time: number; rival: number; reward: number }
>;
export function difficultyOf(id: string): typeof DIFFICULTIES.normal;
