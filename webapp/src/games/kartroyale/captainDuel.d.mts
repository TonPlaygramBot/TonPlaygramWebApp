import type {Racer,Track} from './simulation.mjs';
export const CAPTAIN_ID:'captain-ali-demi';
export const CAPTAIN_NAME:'Ali Demi Captain';
export function createCaptainGrid(track:Track,kartId:string):[Racer,Racer];
export function captainDuelOutcome(player:Racer|undefined,rival:Racer|undefined):'incomplete'|'loss'|'win'|'tie';
