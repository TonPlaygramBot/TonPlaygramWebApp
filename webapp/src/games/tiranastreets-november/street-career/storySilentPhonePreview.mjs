// Fictional story evidence only. No phone access, lookup, wallet or network.
export const SILENT_PHONE_ID = 'ch01-silent-phone';
const SAVE = 'tpg:story-preview:ch01-silent-phone:v3';
const valid = new Set(['briefing','travel','review','complete']);
const clues = new Set(['recording','postcard']);
const orders = Object.freeze({recording:'time-place',postcard:'place-time'});
const eligible=prior=>prior?.stage==='complete'&&clues.has(prior.clue);
function validState(row){
 return row && valid.has(row.stage)&&clues.has(row.clue)&&
  row.evidence===(row.stage==='complete'?'shared-meeting':null);
}
export function readSilentPhonePreview(storage,prior){
 if(!eligible(prior))return null;
 try {
  const row=JSON.parse(storage?.getItem(SAVE)??'null');
  if(!validState(row)||row.clue!==prior.clue)return null;
  return {stage:row.stage,clue:row.clue,evidence:row.evidence};
 }catch{return null;}
}
export function saveSilentPhonePreview(storage,row){
 try{
  if(!storage||!validState(row))return false;
  storage.setItem(SAVE,JSON.stringify(row));return true;
 }catch{return false;}
}
export function stepSilentPhonePreview(row,event,prior,target){
 if(!eligible(prior))return null;
 if(!row)return event.type==='continue'?{stage:'briefing',clue:prior.clue,evidence:null}:null;
 if(!validState(row)||row.clue!==prior.clue)return null;
 if(row.stage==='briefing'&&event.type==='accept'&&target)return {...row,stage:'travel'};
 if(row.stage==='travel'&&event.type==='position'&&event.grounded&&!event.flying&&target&&
    Math.hypot(event.x-target.x,event.z-target.z)<=10)return {...row,stage:'review'};
 if(row.stage==='review'&&event.type==='match'&&orders[row.clue]===event.order)
  return {...row,stage:'complete',evidence:'shared-meeting'};
 return row;
}
