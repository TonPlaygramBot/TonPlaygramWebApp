import {createRacer,equipKart,STEP} from './simulation.mjs';
export const CAPTAIN_ID='captain-ali-demi';
export const CAPTAIN_NAME='Ali Demi Captain';

/** Slot zero and one share the same grid row and the player's kart specification.
 * Only the existing solo difficulty gives the CPU its usual pace. */
export function createCaptainGrid(track,kartId){
  const you=createRacer(track,'you','You',0,false);
  const rival=createRacer(track,CAPTAIN_ID,CAPTAIN_NAME,1,true);
  equipKart(you,kartId);
  equipKart(rival,kartId);
  return [you,rival];
}

export function captainDuelOutcome(player,rival){
  if(!player||!rival||(!player.finished&&!rival.finished))return 'incomplete';
  if(!player.finished)return 'loss';
  if(!rival.finished)return 'win';
  const delta=player.finishTime-rival.finishTime;
  return Math.abs(delta)<STEP*.5?'tie':delta<0?'win':'loss';
}
