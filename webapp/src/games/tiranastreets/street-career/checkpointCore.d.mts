import type { StreetSimulation } from './StreetSimulation.mjs';
import type { Loadout } from './campaignCore.mjs';
import type { Player } from '../shared/engine.mjs';
export type PhaseCheckpoint = {
  version: 2;
  index: number;
  elapsed: number;
  player: Loadout & {
    x: number;
    z: number;
    heading: number;
    health: number;
    armor: number;
    wanted: number;
  };
  aircraft?: null | {kind:'helicopter'|'jet';x:number;y:number;z:number;heading:number;health:number;missiles:number};
  car: null | {
    id: string;
    model: string;
    x: number;
    z: number;
    heading: number;
    collectionVehicle?: string;
    racingAsset?: string;
  };
  job: { parcel: boolean; defend: number; tutorial: string[] };
  defeated: string[];
  claimed: string[];
};
export function captureCheckpoint(
  sim: StreetSimulation
): PhaseCheckpoint | null;
export function restoreCheckpoint(
  sim: StreetSimulation,
  checkpoint: PhaseCheckpoint | null | undefined,
  apply: (p: Player, loadout: Loadout) => void
): boolean;
