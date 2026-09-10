export interface MilitaryVehicle {
  id: string;
  name: string;
  detail: string;
  speed: number;
  handling: number;
  brake: number;
  shield: number;
  ammunition: number;
}
export const MILITARY_VEHICLES: readonly MilitaryVehicle[];
export function isMilitaryVehicle(id: unknown): boolean;
